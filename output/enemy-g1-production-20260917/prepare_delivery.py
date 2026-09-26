from pathlib import Path
import json,subprocess,sys,datetime as dt
ROOT=Path(__file__).resolve().parent
SKILL=Path(r'C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d')
items=[]
for record in sorted((ROOT/'attempts').glob('*-r1.json')):
 r=json.loads(record.read_text('utf8'))
 if r.get('providerStatus')!=3 or len(r.get('files',[]))!=2:continue
 checked=[]
 for f in r['files']:
  fmt='glb' if f['path'].endswith('.glb') else 'zip'
  p=subprocess.run([sys.executable,str(SKILL/'core/runtime/artifact_delivery.py'),'inspect',f['path'],'--format',fmt],capture_output=True,text=True,encoding='utf8')
  if p.returncode:raise RuntimeError('Artifact inspection failed: '+r['asset'])
  result=json.loads(p.stdout)
  if not result.get('validation',{}).get('valid'):raise RuntimeError('Invalid artifact: '+r['asset'])
  out=ROOT/'artifact-inspection'/r['asset'];out.mkdir(parents=True,exist_ok=True)
  (out/(fmt+'.json')).write_text(json.dumps(result,indent=2),'utf8');checked.append({'path':f['path'],'format':fmt})
 snapshot=ROOT/'delivery-states'/f"{r['attemptId']}.json";snapshot.parent.mkdir(parents=True,exist_ok=True)
 r.setdefault('artifactInspectedAt',dt.datetime.now(dt.timezone.utc).isoformat())
 record.write_text(json.dumps(r,ensure_ascii=False,indent=2),'utf8')
 state={'schema':'lux3d.workflow-state/v2','taskId':r['taskId'],'status':'succeeded','lastKnownProviderStatus':3,'request':{'operation':r['operation'],'region':r['region'],'version':'G1'},'expectedFormats':['zip','glb'],'downloadedArtifacts':checked,'createdAt':r['startedAt'],'updatedAt':r['artifactInspectedAt'],'localCompletedAt':r['artifactInspectedAt']}
 snapshot.write_text(json.dumps(state,ensure_ascii=False,indent=2),'utf8')
 items.append({'id':r['asset'],'label':r['name'],'selectedAttemptId':r['attemptId'],'attempts':[{'id':r['attemptId'],'statePath':str(snapshot)}]})
(ROOT/'delivery-spec.json').write_text(json.dumps({'schema':'lux3d.delivery-spec/v2','title':'哥喂龟 · 20只 G1 怪物源模型','items':items,'scene':{'status':'not-requested'}},ensure_ascii=False,indent=2),'utf8')
print('Verified provider artifacts:',len(items),'models; bundle ready only when count is 20.')
