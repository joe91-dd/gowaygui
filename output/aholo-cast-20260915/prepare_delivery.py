"""Prepare the supported Lux3D bundle from actual local generation and Blender records."""
from pathlib import Path
import json,hashlib,subprocess,sys
root=Path(__file__).resolve().parent
runtime=Path('C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d/core/runtime')
record=sys.argv[1];dest=sys.argv[2]
attempt=json.loads((root/'attempts/yandun.json').read_text(encoding='utf8'))
report=json.loads((root/'polished-yandun/build-report.json').read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,data):p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
for p,f in [(root/'models/yandun_glb.glb','glb'),(root/'models/yandun_zip.zip','zip'),(root/'polished-yandun/yandun-polished.glb','glb')]:
    result=subprocess.run([sys.executable,str(runtime/'artifact_delivery.py'),'inspect',str(p),'--format',f],capture_output=True,text=True,check=True,encoding='utf8')
    write(p.parent/(p.name+'.validation.json'),json.loads(result.stdout))
state={
 'schema':'lux3d.workflow-state/v2','taskId':attempt['taskId'],'status':'succeeded','lastKnownProviderStatus':3,
 'request':{'operation':'image-to-3d','region':'cn','version':'G1'},'expectedFormats':['zip','glb'],
 'downloadedArtifacts':[{'path':'../models/yandun_zip.zip','format':'zip'},{'path':'../models/yandun_glb.glb','format':'glb'}],
 'createdAt':attempt['startedAt'],'updatedAt':attempt['downloadedAt'],'localCompletedAt':attempt['downloadedAt']}
write(root/'attempts/yandun-delivery-state.json',state)
evidence={'schema':'lux3d.scene-execution/v1','kind':'external-tool','toolName':'exec_command','callId':record,'recordRef':'session:local-blender/'+record,
 'executedAt':report['time'],'exportSha256':sha(root/'polished-yandun/yandun-polished.glb'),
 'sources':[{'itemId':'yandun','attemptId':'yandun-generation','artifactId':'yandun-generation:glb','sha256':sha(root/'models/yandun_glb.glb')}]}
write(root/'polished-yandun/execution.json',evidence)
spec={'schema':'lux3d.delivery-spec/v2','title':'岩盾 · 内部验收资产','items':[{'id':'yandun','label':'岩盾 AHOLO 原始模型','selectedAttemptId':'yandun-generation','attempts':[{'id':'yandun-generation','statePath':'attempts/yandun-delivery-state.json'}]}],
 'scene':{'status':'ready','artifactPath':'polished-yandun/yandun-polished.glb','evidencePath':'polished-yandun/execution.json'}}
write(root/'delivery-spec.json',spec)
subprocess.run([sys.executable,str(runtime/'delivery_bundle.py'),'prepare','--spec',str(root/'delivery-spec.json'),'--output-dir',str(root/dest),'--locale','zh-CN'],check=True)
