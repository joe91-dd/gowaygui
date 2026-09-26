"""Copy only prepared runtime FBX assets into the Cocos resource catalogue."""
from pathlib import Path
import json,hashlib,shutil,uuid
OUT=Path(__file__).resolve().parent;ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui')
dims={};ready=[]
for folder in sorted((OUT/'production').iterdir()):
 if not folder.is_dir():continue
 ID=folder.name;key=ID.lower();report=folder/'manifest.json';verified=OUT/'inspection'/ID/'fbx-verification.json'
 if not report.exists() or not verified.exists():continue
 m=json.loads(report.read_text());v=json.loads(verified.read_text())
 if not v.get('allClipsDeform') or 'materialRegions' not in m:continue
 src=folder/f'{key}.fbx'
 if v.get('fbxSha256')!=hashlib.sha256(src.read_bytes()).hexdigest():continue
 dest=ROOT/'game/assets/resources/models-enemy-g1'/key/f'{key}.fbx';dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists() or hashlib.sha256(src.read_bytes()).digest()!=hashlib.sha256(dest.read_bytes()).digest():shutil.copy2(src,dest)
 meta=dest.with_suffix('.fbx.meta')
 if not meta.exists():
  meta.write_text(json.dumps({'ver':'2.3.14','importer':'fbx','imported':False,'uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,'gowaygui:enemy-g1:'+ID)),'files':[],'subMetas':{},'userData':{'fbx':{'smartMaterialEnabled':True}}},indent=2),'utf8')
 d=m['dimensions'];dims['g1-'+key]=[d[0],2,d[1]];ready.append(ID)
path=ROOT/'game/assets/scripts/core/enemyG1Dimensions.ts'
path.write_text('export const ENEMY_G1_DIMENSIONS:Record<string,readonly [number,number,number]>='+json.dumps(dims,separators=(',',':'))+';\n','utf8')
(OUT/'integration-status.json').write_text(json.dumps({'installed':ready,'count':len(ready),'total':20,'buildValidated':False},indent=2),'utf8')
print('Installed prepared models:',','.join(ready))
