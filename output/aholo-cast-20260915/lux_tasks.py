"""Task-local orchestration for approved Lux3D calls; credentials come from environment."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys

SKILL = Path('C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
sys.path.insert(0, str(SKILL / 'core/runtime'))
import lux3d_client as client

ROOT = Path(__file__).resolve().parent
PRIVATE = Path(os.environ['USERPROFILE']) / 'AppData/Local/Temp/codex-aholo-cast-20260915'
PRIVATE.mkdir(parents=True, exist_ok=True)

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['submit', 'query', 'download'])
    parser.add_argument('asset')
    parser.add_argument('--quote')
    parser.add_argument('--items')
    parser.add_argument('--sequence', default='1')
    args = parser.parse_args()
    if not args.asset.replace('-', '').isalnum():
        raise ValueError('invalid asset id')
    record_path = ROOT / 'attempts' / (args.asset + '.json')
    if args.action == 'submit':
        if record_path.exists():
            raise ValueError('An attempt already exists; inspect its status instead of resubmitting.')
        quote = read(args.quote)
        item = read(args.items)[args.sequence]
        if item['endpoint']['path'] != '/lux3d/v1/generate/img-to-3d/task/create':
            raise ValueError('Unexpected operation')
        cost = quote['quote']['details'][args.sequence]
        expiry = dt.datetime.fromisoformat(quote['quote']['expiresAt'])
        if dt.datetime.now(dt.timezone.utc) >= expiry:
            raise ValueError('Quote expired')
        ledger_path = ROOT / 'budget.json'
        ledger = read(ledger_path)
        if ledger['committedEstimate'] + cost > ledger['authorizedGiftCreditLimit']:
            raise ValueError('Authorized gift-credit budget exceeded')
        body = item['parameters']['body']
        if isinstance(body, str):
            body = json.loads(body)
        record = {'asset': args.asset, 'region': 'cn', 'accountRef': quote['account'].get('accountRef'),
                  'operation': 'image-to-3d', 'version': body['version'], 'faceCount': body.get('faceCount'),
                  'outputFormat': body.get('outputFormat'), 'quoteId': quote['quote']['quoteId'],
                  'estimatedCredits': cost, 'approval': 'User authorized 30 trial uses first, then gifted credits; no purchases.',
                  'submissionState': 'started', 'startedAt': now(), 'taskId': None, 'retryCount': 0}
        # Reserve before dispatch, keep the amount committed even if the response is uncertain.
        ledger['committedEstimate'] += cost
        ledger['entries'].append({'asset': args.asset, 'estimate': cost, 'state': 'started'})
        write(ledger_path, ledger)
        write(record_path, record)
        write(PRIVATE / (args.asset + '-request.json'), body)
        try:
            task_id = client.create_image_to_3d_task(region='cn', **body)
            record.update(taskId=task_id, submissionState='submitted', submittedAt=now())
            write(record_path, record)
            ledger['entries'][-1].update(taskId=task_id, state='submitted')
            write(ledger_path, ledger)
            print(json.dumps({'asset': args.asset, 'taskId': task_id, 'submissionState': 'submitted'}))
        except Exception as exc:
            record.update(submissionState='uncertain', errorType=type(exc).__name__, updatedAt=now())
            write(record_path, record)
            print(json.dumps({'asset': args.asset, 'submissionState': 'uncertain', 'errorType': type(exc).__name__}))
            return 2
    else:
        record = read(record_path)
        if not record.get('taskId'):
            raise ValueError('No saved task ID; reconcile before creating another task.')
        task = client.get_task(record['taskId'], region='cn')
        write(PRIVATE / (args.asset + '-task.json'), task)
        record.update(providerStatus=task.get('status'), queriedAt=now())
        write(record_path, record)
        if args.action == 'download':
            if task.get('status') != 3:
                print(json.dumps({'asset': args.asset, 'status': task.get('status'), 'downloaded': False}))
                return 0
            outputs = client.parse_task_outputs(task)
            formats = client.generation_result_formats(record['version'], record['outputFormat'])
            (ROOT / 'models').mkdir(parents=True, exist_ok=True)
            files = client.download_requested_models(outputs, str(ROOT / 'models' / args.asset), formats)
            record['files'] = [{'path': str(p), 'bytes': size} for p, size in files]
            record['downloadedAt'] = now()
            write(record_path, record)
        print(json.dumps({'asset': args.asset, 'taskId': record['taskId'], 'status': task.get('status'),
                          'files': record.get('files', [])}))
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        # Never print exception strings containing a credential or signed input/output URL.
        print(json.dumps({'errorType': type(exc).__name__, 'message': 'See saved task records; no automatic resubmission.'}))
        sys.exit(1)
