"""Promote exactly three root-approved original files; never author Cocos import metadata."""
from pathlib import Path
import hashlib,json,re,shutil
from datetime import datetime,timezone
SOURCE=Path(__file__).resolve().parent
ROOT=SOURCE.parents[4]
DEST=ROOT/'game/assets/resources/environment/boss-bay'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
freeze=json.loads((SOURCE/'source-freeze.json').read_text(encoding='utf-8'))
for name,h in freeze['hashes'].items():assert sha(SOURCE/name)==h,('Frozen source changed',name)
provenance=json.loads((SOURCE/'provenance.json').read_text(encoding='utf-8'))
for name,h in provenance['hashes'].items():assert sha(SOURCE/name)==h,('Provenance mismatch',name)
manifest=json.loads((SOURCE/'environment-manifest.json').read_text(encoding='utf-8'))
data=(ROOT/'game/assets/scripts/core/data.ts').read_text(encoding='utf-8')
def points(text):return [{'x':float(x),'z':float(z)} for x,z in re.findall(r'x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)',text)]
slots=points(re.search(r'const bossSlots\s*=\s*\[(.*?)\]',data,re.S).group(1))
route=points(re.search(r'id:4,name:.*?route:\[(.*?)\]',data,re.S).group(1))
assert slots==[{'x':p['x'],'z':p['z']} for p in manifest['slots']]
assert route==manifest['route']
DEST.mkdir(parents=True,exist_ok=True)
files=[]
for name in ['boss-bay.fbx','island-colour.png','island-roughness.png']:
    src=SOURCE/name;dst=DEST/name
    if dst.exists():assert sha(dst)==sha(src),'Do not overwrite a different runtime candidate'
    else:shutil.copy2(src,dst)
    assert sha(dst)==freeze['hashes'][name]
    files.append({'source':src.relative_to(ROOT).as_posix(),'destination':dst.relative_to(ROOT).as_posix(),'bytes':dst.stat().st_size,'sha256':sha(dst)})
report={'schemaVersion':1,'promotedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'runtime-candidate-pending-cocos-import-and-acceptance','levelId':4,'levelName':'巨钳来袭','authorization':'Root approved final battle/top images and subsequently explicitly authorized exactly three runtime files alongside the approved layout migration.','sourceFreezeSha256':sha(SOURCE/'source-freeze.json'),'sourceProvenanceSha256':sha(SOURCE/'provenance.json'),'expectedResourcesPrefabPath':'environment/boss-bay/boss-bay/boss-bay','resourcesTexturePaths':['environment/boss-bay/island-colour/texture','environment/boss-bay/island-roughness/texture'],'materials':['Island_atlas','Warm_pearl_and_lamps'],'route':route,'stationCoordinates':slots,'changedSlotIndices':[4],'previousSlot5':{'x':6,'z':-1},'files':files,'metasOrUuidsAuthored':False,'cocosLaunched':False,'viewsModifiedByThisTask':False,'pending':['Root Cocos import, loader wiring and build','Old combat load/pause/background/next-wave actual model placement','Actual character contact, material culling and mobile performance']}
(SOURCE/'promotion-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
