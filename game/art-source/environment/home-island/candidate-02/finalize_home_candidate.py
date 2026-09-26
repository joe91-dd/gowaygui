"""Freeze the bounded second home-island candidate after actual source/FBX and five-actor views."""
from pathlib import Path
import json,hashlib,ast
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4];FIRST=OUT.parent/'candidate-01'
def read(n):return json.loads((OUT/n).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
model=read('environment-manifest.json');support=read('round-trip-and-support.json');render=read('render-report.json');author=read('module-authorship.json')
assert model['fbxSha256']==support['fbxSha256']==render['environmentFbxSha256']==sha(OUT/'home-island.fbx')
assert support['sourceSha256']==sha(OUT/'home-island.blend') and support['status']=='pass'
assert sum(p['surfaceRays'] for p in support['footSupport'])==372240 and not any(p['badSamples'] for p in support['footSupport'])
assert support['actualImportedGreenSurface']['allUpward'] and model['totalTriangles']<45000
assert (render['threads'],render['samples'],render['resolution'])==(2,32,[1000,700])
assert len(render['previewReferences'])==5 and len(render['views'])==2
for v in render['views']:assert v['sha256']==sha(OUT/('render-'+v['name']+'.png'))
for ref in render['previewReferences']:assert sha(ROOT/ref['path'])==ref['sha256']
assert author['generatedScriptSha256']==sha(OUT/'build_home_island.py')
assert author['sourceSha256']==sha(ROOT/author['frozenProjectModule'])
for p in OUT.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
freeze=json.loads((OUT.parent/'first-round-freeze.json').read_text(encoding='utf-8'))
assert all(sha(FIRST/name)==item['sha256'] for name,item in freeze['files'].items())
assert (OUT/'layout-proposal.json').read_bytes()==(FIRST/'layout-proposal.json').read_bytes()
files=['author_home_candidate.py','build_home_island.py','home_composition.py','prepare_home_layout.py','layout-proposal.json','layout-proposal.svg','layout-proposal.png','module-authorship.json','home-island.blend','home-island.fbx','home-island-review-scene.blend','home-island-scale-review.blend','island-colour.png','island-roughness.png','environment-manifest.json','round-trip-and-support.json','verify_home_island.py','render_home_views.py','render-report.json','render-home-overview.png','render-house-detail.png','static-preparation.json','check_static_preparation.py']
report={'status':'bounded-second-offline-candidate-awaiting-root-image-review','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
        'runtimePromoted':False,'coreViewsResourcesModified':False,'firstRoundOriginalFilesIntact':len(freeze['files']),
        'geometry':{'triangles':model['totalTriangles'],'meshes':3,'materials':2,'editableMeshes':support['editableMeshes'],'boundsCocos':support['geometryBoundsCocos'],'displaySurfaceY':.16},
        'checks':{'fbxReimport':'pass','actualFootRays':372240,'editablePackedSource':'pass','noCharactersInEnvironmentFbx':True,'renderCount':2,'renderReferences':['stone','spike','crystal','leaf','bubble'],'upperSurfaces':support['actualImportedGreenSurface'],'cameraAndFiveAnchors':'c01 bytes retained'},
        'changes':model['boundedChanges'],
        'limitations':['Five static character references are present only in review scene, never baked into environment FBX.','No Cocos import, animation, mobile performance, UI-layout or resource-lifecycle acceptance in this subtask.'],
        'files':{name:{'sha256':sha(OUT/name),'bytes':(OUT/name).stat().st_size} for name in files}}
(OUT/'provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':report['status'],'geometry':report['geometry'],'checks':report['checks']},ensure_ascii=False,indent=2))
