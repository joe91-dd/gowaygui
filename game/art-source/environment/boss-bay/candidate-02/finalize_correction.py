"""Record reviewed c02 source and a root-managed runtime promotion manifest, no asset writes."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,ast
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4];FIRST=OUT.parent/'candidate-01'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(n):return json.loads((OUT/n).read_text(encoding='utf-8'))
check=read('fbx-semantic-check.json');model=read('environment-manifest.json');renders=read('render-report.json')
assert check['status']=='pass' and check['correctedFbxSha256']==model['fbxSha256']==sha(OUT/'boss-bay.fbx')
assert (renders['threads'],renders['samples'],renders['width'],renders['height'])==(2,32,1000,700)
for item in renders['views']:assert item['sha256']==sha(OUT/('render-'+item['name']+'.png'))
for p in OUT.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
for name,item in read('c01-full-freeze.json')['files'].items():assert sha(FIRST/name)==item['sha256']
names=['fix_upward_surface.py','prepare_correction.py','verify_fbx_semantics.py','finalize_correction.py',
       'boss-bay.blend','boss-bay.fbx','boss-bay-review-scene.blend','island-colour.png','island-roughness.png',
       'c01-full-freeze.json','correction-report.json','environment-manifest.json','fbx-semantic-check.json',
       'render_boss_views.py','render-battle-overview.png','render-top-down.png','render-report.json','render.log','README.md']
provenance={'status':'offline-c02-source-frozen-awaiting-root-cocos-acceptance','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
            'actualImageReview':'Both overview and top-down opened with view_image; original road, five platforms, shoreline and pearl remain readable; green ground present.',
            'changeBoundary':'2304 grass faces and corresponding normals reversed; other 24016 face index orders/normals identical, maximum unrelated normal delta zero. All positions/UV pairs/transforms/atlas bytes unchanged.',
            'triangles':55128,'meshCount':3,'materialCount':2,'retainedDegenerateTriangles':128,
            'sourceOrigin':'Frozen own-project boss c01 editable and merged scene, no third-party game or stock assets.',
            'runtimeFilesWrittenByThisSubtask':False,'cocosStarted':False,'runtimeAcceptance':'pending actual Cocos reimport/browser',
            'files':{n:{'sha256':sha(OUT/n),'bytes':(OUT/n).stat().st_size} for n in names}}
(OUT/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf-8')
runtime_files=[]
for name in ['boss-bay.fbx','island-colour.png','island-roughness.png']:
    runtime_files.append({'source':(OUT/name).relative_to(ROOT).as_posix(),'destination':'game/assets/resources/environment/boss-bay/'+name,
                          'sha256':sha(OUT/name),'bytes':(OUT/name).stat().st_size})
promotion={'schemaVersion':1,'status':'reviewed-c02-ready-for-root-managed-promotion-import-pending','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
           'levelId':4,'levelName':'巨钳来袭','change':'Only grass surface winding and normals; route/slots unchanged from c01.',
           'authorization':'Root approved independent c02 minimal correction; root manages runtime FBX replacement and Cocos rebuild after review.',
           'sourceProvenanceSha256':sha(OUT/'provenance.json'),'expectedResourcesPrefabPath':'environment/boss-bay/boss-bay/boss-bay',
           'materials':['Island_atlas','Warm_pearl_and_lamps'],'route':model['route'],'stationCoordinates':[{'x':p['x'],'z':p['z']} for p in model['slots']],
           'files':runtime_files,'runtimeFilesCopiedByThisSubtask':False,'metasOrUuidsAuthored':False,'cocosLaunched':False,
           'importCheckScript':'game/art-source/environment/boss-bay/normal-review/check_cocos_surface.py',
           'pending':['Root promotion and actual Cocos reimport','New timestamped imported-triangle report','Actual browser grass visibility and shared material/shadow review']}
(OUT/'promotion-manifest.json').write_text(json.dumps(promotion,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':promotion['status'],'fbxSha256':model['fbxSha256'],'files':runtime_files},ensure_ascii=False,indent=2))
