"""Task-local G1 orchestration. Credentials are supplied through secure process environment."""
import argparse, datetime as dt, hashlib, json, os, subprocess, sys
from pathlib import Path
SKILL=Path(r'C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
sys.path.insert(0,str(SKILL/'core/runtime'))
import lux3d_client as client
ROOT=Path(__file__).resolve().parent
PRIVATE=Path(os.environ['TEMP'])/'codex-enemy-g1-20260917'
REGION='cn'
def read(p): return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,obj):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def now():return dt.datetime.now(dt.timezone.utc).isoformat()
def quote():
 p=subprocess.run([sys.executable,str(SKILL/'scripts/commerce.py'),'quote','--region',REGION,'--items',str(PRIVATE/'quote-items.json')],capture_output=True,text=True,encoding='utf-8')
 if p.returncode: print(p.stderr);raise RuntimeError('QUOTE_FAILED')
 q=json.loads(p.stdout);write(PRIVATE/'quote.json',q)
 print(json.dumps({'estimatedCreditsTotal':q['quote']['estimatedCreditsTotal'],'availableCredits':q['account']['availableCredits'],'details':q['quote']['details'],'expiresAt':q['quote']['expiresAt']}),flush=True)
def init():
 path=ROOT/'budget-ledger.json'
 if path.exists():raise RuntimeError('LEDGER_ALREADY_EXISTS')
 plan=read(ROOT/'production-plan.json');q=read(PRIVATE/'quote.json')
 entries={x['id']:{'state':'reserved','quoteAmount':q['quote']['details'][str(i+1)],'attemptId':x['id']+'-r1','region':REGION,'accountRef':q['account']['accountRef']} for i,x in enumerate(plan['items'])}
 if sum(x['quoteAmount'] for x in entries.values())>440:raise RuntimeError('BATCH_OVER_BUDGET')
 write(path,{'conversation':'01a0a95b-1a73-7542-bc47-95d3a8e215aa','authorization':'User selected 自动执行：总上限 440 积分 on 2026-09-17; includes current 20 G1 assets and necessary revisions, no topups.','authorizedTotal':440,'mode':'automatic','purchasesAllowed':False,'entries':entries,'createdAt':now()})
 print(json.dumps({'authorizedTotal':440,'reserved':sum(x['quoteAmount'] for x in entries.values()),'committed':0}))
def totals(l):
 entries=list(l['entries'].values())
 return {'authorizedTotal':l['authorizedTotal'],'reserved':sum(e['quoteAmount'] for e in entries if e['state']=='reserved'),'committed':sum(e['quoteAmount'] for e in entries if e['state']!='reserved' and e['state']!='released')}
def submit(asset):
 plan=read(ROOT/'production-plan.json');index=next(i for i,x in enumerate(plan['items']) if x['id']==asset);x=plan['items'][index]
 path=ROOT/'attempts'/(asset+'-r1.json')
 if path.exists():raise RuntimeError('ATTEMPT_EXISTS_QUERY_OR_RECONCILE')
 q=read(PRIVATE/'quote.json');entry=read(PRIVATE/'quote-items.json')[str(index+1)];body=entry['parameters']['body']
 if dt.datetime.now(dt.timezone.utc)>=dt.datetime.fromisoformat(q['quote']['expiresAt']):raise RuntimeError('QUOTE_EXPIRED')
 if body['version']!='G1' or body['faceCount']!=x['faceCount'] or body['outputFormat']!=['glb']:raise RuntimeError('PARAMETER_MISMATCH')
 if q['account']['region']!=REGION:raise RuntimeError('ACCOUNT_REGION_MISMATCH')
 uploads=read(PRIVATE/'uploads.json')
 if hashlib.sha256(Path(x['icon']).read_bytes()).hexdigest()!=uploads[asset]['sha256'] or body['img']!=uploads[asset]['url']:raise RuntimeError('REFERENCE_CHANGED')
 l=read(ROOT/'budget-ledger.json');budget=l['entries'][asset];cost=q['quote']['details'][str(index+1)]
 if cost!=budget['quoteAmount'] or budget['accountRef']!=q['account']['accountRef'] or budget['state']!='reserved':raise RuntimeError('RESERVATION_MISMATCH')
 t=totals(l)
 if t['reserved']+t['committed']>l['authorizedTotal']:raise RuntimeError('OVER_BUDGET')
 r={'asset':asset,'name':x['name'],'attemptId':asset+'-r1','region':REGION,'accountRef':q['account']['accountRef'],'operation':'image-to-3d','request':{k:v for k,v in body.items() if k!='img'},'referenceSha256':uploads[asset]['sha256'],'quoteId':q['quote']['quoteId'],'estimatedCredits':cost,'state':'submission_started','startedAt':now(),'taskId':None,'retryCount':0}
 write(path,r);budget.update(state='committed',quoteId=q['quote']['quoteId'],startedAt=r['startedAt']);write(ROOT/'budget-ledger.json',l)
 try:
  task=client.create_image_to_3d_task(region=REGION,**body)
  r.update(taskId=task,state='submitted',submittedAt=now());write(path,r)
  budget.update(taskId=task);write(ROOT/'budget-ledger.json',l)
  print(json.dumps({'asset':asset,'taskId':task,'state':'submitted','budget':totals(l)}),flush=True)
 except Exception as e:
  r.update(state='submission_unknown',errorType=type(e).__name__,updatedAt=now());write(path,r);raise
def query(asset,download=False):
 p=ROOT/'attempts'/(asset+'-r1.json');r=read(p)
 if not r.get('taskId'):raise RuntimeError('NO_TASK_ID_RECONCILE')
 task=client.get_task(r['taskId'],region=REGION);write(PRIVATE/(asset+'-task.json'),task)
 r.update(providerStatus=task.get('status'),queriedAt=now());write(p,r)
 if task.get('status')==3 and download and not r.get('files'):
  outputs=client.parse_task_outputs(task);formats=client.generation_result_formats('G1',['glb'])
  out=ROOT/'source'/asset;out.mkdir(parents=True,exist_ok=True)
  files=client.download_requested_models(outputs,str(out/asset),formats)
  r['files']=[{'path':str(f),'bytes':n,'sha256':hashlib.sha256(Path(f).read_bytes()).hexdigest()} for f,n in files]
  r.update(state='downloaded-awaiting-inspection',downloadedAt=now());write(p,r)
 print(json.dumps({'asset':asset,'taskId':r['taskId'],'providerStatus':task.get('status'),'files':r.get('files',[])},ensure_ascii=False),flush=True)
def main():
 a=argparse.ArgumentParser();a.add_argument('action',choices=['quote','init','submit','query','download','budget']);a.add_argument('assets',nargs='*');args=a.parse_args()
 if args.action=='quote':quote()
 elif args.action=='init':init()
 elif args.action=='budget':print(json.dumps(totals(read(ROOT/'budget-ledger.json'))))
 else:
  for asset in args.assets:
   if asset not in [x['id'] for x in read(ROOT/'production-plan.json')['items']]:raise ValueError('UNKNOWN_ASSET')
   submit(asset) if args.action=='submit' else query(asset,args.action=='download')
if __name__=='__main__':
 try:main()
 except Exception as exc:
  print(json.dumps({'errorType':type(exc).__name__,'message':str(exc) if str(exc).isupper() and len(str(exc))<80 else 'Action did not complete; preserve original attempt and task ID.'}),flush=True);sys.exit(1)
