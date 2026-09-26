"""Record completed second-round source files; do not mutate first-round artifacts or runtime."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib
OUT=Path(__file__).resolve().parent;FIRST=OUT.parent/'candidate-01'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
prior=json.loads((OUT.parent/'first-round-freeze.json').read_text(encoding='utf-8'))
assert all(sha(FIRST/n)==item['sha256'] for n,item in prior['files'].items())
provenance=json.loads((OUT/'provenance.json').read_text(encoding='utf-8'))
assert all(sha(OUT/n)==item['sha256'] for n,item in provenance['files'].items())
target=OUT/'source-freeze.json';assert not target.exists(),'Never overwrite a completed source freeze'
files={p.relative_to(OUT).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(OUT.rglob('*')) if p.is_file() and p!=target}
record={'status':'completed-one-round-offline-candidate-frozen-awaiting-root-review','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
        'firstRoundOriginalFilesIntact':31,'runtimePromoted':False,'blenderSessionsAllExited':True,
        'lastRenderSession':'72085 exit 0','imagesActuallyViewed':['render-home-overview.png','render-house-detail.png'],'files':files}
target.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':record['status'],'frozenFiles':len(files),'fbxSha256':sha(OUT/'home-island.fbx'),'sourceSha256':sha(OUT/'home-island.blend')},indent=2))
