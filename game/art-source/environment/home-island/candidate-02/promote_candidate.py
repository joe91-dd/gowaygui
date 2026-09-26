"""Root-approved home-island c02 promotion: exactly FBX and two unchanged self-authored atlases."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,shutil
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
DESTINATION=ROOT/'game/assets/resources/environment/home-island'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((OUT/n).read_text(encoding='utf-8'))
freeze=read('source-freeze.json');model=read('environment-manifest.json');render=read('render-report.json')
for name,item in freeze['files'].items():assert sha(OUT/name)==item['sha256'],name
assert len(render['previewReferences'])==5 and not model['charactersExported']
assert model['totalTriangles']==38988 and model['materials']==2
DESTINATION.mkdir(parents=True,exist_ok=True)
files=[]
for name in ['home-island.fbx','island-colour.png','island-roughness.png']:
    source=OUT/name;target=DESTINATION/name
    if target.exists():assert sha(target)==sha(source),'Unexpected existing asset; do not overwrite unrelated data'
    else:shutil.copyfile(source,target)
    assert sha(source)==sha(target)
    files.append({'source':source.relative_to(ROOT).as_posix(),'destination':target.relative_to(ROOT).as_posix(),'sha256':sha(source),'bytes':source.stat().st_size})
manifest={'schemaVersion':1,'status':'runtime-home-c02-candidate-promoted-pending-cocos-import-and-acceptance',
          'promotedAtUtc':datetime.now(timezone.utc).isoformat(),
          'authorization':'Root actually reviewed both c02 five-turtle views, approved this version without c03, and explicitly authorized exactly three runtime environment files.',
          'sourceFreezeSha256':sha(OUT/'source-freeze.json'),'sourceProvenanceSha256':sha(OUT/'provenance.json'),
          'expectedResourcesPrefabPath':'environment/home-island/home-island/home-island',
          'resourcesTexturePaths':['environment/home-island/island-colour/texture','environment/home-island/island-roughness/texture'],
          'runtimeMeshes':model['runtimeMeshes'],'materials':['Island_atlas','Warm_pearl_and_lamps'],'totalTriangles':38988,
          'waterY':-.72,'displaySurfaceY':.16,'displayAnchors':model['displayAnchors'],'cameraCandidate':model['cameraCandidate'],
          'houseDoor':model['houseDoor'],'pearl':model['pearl'],'nominalFootprintXZ':[12,8],
          'actualBoundsCocos':read('round-trip-and-support.json')['geometryBoundsCocos'],
          'fiveTurtleReferences':render['previewReferences'],'referenceScope':'Only offline instances; no characters or armatures are in the environment FBX.',
          'files':files,'metasOrUuidsAuthored':False,'cocosLaunched':False,'gameEntryWorldLightingCoreModified':False,
          'pending':['Root HomeWorld/GameEntry wiring and Cocos import/build','Actual UI framing, animation/contact, materials/culling and resource lifecycle','Actual frame-rate/device performance acceptance']}
(OUT/'promotion-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':manifest['status'],'resourcePath':manifest['expectedResourcesPrefabPath'],'files':files},ensure_ascii=False,indent=2))
