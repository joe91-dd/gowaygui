"""Bind the actually exported, reimported and rendered offline candidate by SHA."""
from pathlib import Path
import ast,hashlib,json
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def sha(name):return hashlib.sha256((OUT/name).read_bytes()).hexdigest()
manifest=read('environment-manifest.json');rt=read('environment-round-trip.json')
feet=read('foot-support-check.json');source=read('source-check.json');plants=read('vegetation-support-check.json');render=read('render-report.json')
assert manifest['fbxSha256']==rt['fbx_sha256']==feet['candidateFbxSha256']==sha('boss-bay.fbx')
assert source['sourceBlendSha256']==plants['sourceBlendSha256']==sha('boss-bay.blend')
assert rt['fbx_round_trip']=='pass' and all(q['status']=='pass' for q in (feet,source,plants))
assert manifest['totalTriangles']==rt['total_triangles']<=80000
assert sum(p['surfaceRays'] for p in feet['slots'])==372240
assert all(not p['unsupportedSamples'] for p in feet['slots'])
assert (render['threads'],render['samples'],render['width'],render['height'])==(2,32,1000,700)
assert [p['name'] for p in render['views']]==['battle-overview','top-down']
for view in render['views']:assert view['sha256']==sha('render-'+view['name']+'.png')
for path in OUT.glob('*.py'):ast.parse(path.read_text(encoding='utf-8'))
auth=read('module-authorship.json');assert auth['generatedScriptSha256']==sha('build_boss_bay.py')
auth.update(status='offline-candidate-generated-and-checked',note='The authoring step itself does not start Blender. The resulting generator has now run; actual export, round-trip, support, source and render reports are beside this file. No runtime promotion or production coordinate changes by this task.')
(OUT/'module-authorship.json').write_text(json.dumps(auth,ensure_ascii=False,indent=2),encoding='utf-8')
files=['author_boss_candidate.py','build_boss_bay.py','boss-bay.blend','boss-bay-review-scene.blend','boss-bay.fbx','island-colour.png','island-roughness.png','layout-decision.json','proposal.json','layout-options.json','layout-options.svg','layout-options.png','layout-preflight.json','stone-footprint-audit.json','environment-manifest.json','environment-round-trip.json','foot-support-check.json','source-check.json','vegetation-support-check.json','render-report.json','render-battle-overview.png','render-top-down.png','module-authorship.json','verify_boss_bay.py','verify_foot_support.py','check_editable_source.py','verify_vegetation_support.py','render_boss_views.py','compare_slot5.cjs','slot5-comparison-39QdTT/report.json','slot5-comparison-39QdTT/README.md','README.md']
report={'status':'offline-source-candidate-ready-for-root-image-review','generatedAt':datetime.now(timezone.utc).isoformat(),'levelId':4,'name':'巨钳来袭','authorship':'Original editable project-authored code geometry/UV/atlases; reuses our own frozen tidal/tutorial/coral/dusk routines. No third-party game or stock assets.','routeExact':manifest['route'],'sourceSlots':manifest['sourceSlots'],'candidateSlots':manifest['slots'],'layoutScope':'Only position5 offline art moves to (6.62,-1.31), as approved by root. Production/save/runtime untouched here.','checks':{'triangles':manifest['totalTriangles'],'meshes':len(manifest['runtimeMeshes']),'materials':manifest['materials'],'editableMeshes':source['editableMeshes'],'routeSamples':rt['route_samples'],'allYawFootRays':372240,'vegetationRootParts':plants['checkedRootParts'],'allPassed':True},'geometryBoundsCocos':rt['geometry_bounds_cocos'],'materials':['Island_atlas','Warm_pearl_and_lamps'],'fixedCorrections':['Initial right palm frond overhung slot5: remove that ornamental tree, keep full feet/platform.','Second deterministic layout had one bush leaf intersecting slot5 top: increase root spacing to include full leaf envelope. Rejected diagnostic JSON files retained.'],'limitations':['Static sole support and empty-stage renders do not establish Cocos animation/contact/performance/UI acceptance.','Nominal 22x12 includes external authored rocks/foam in the larger measured bounds.','Current v2 eight-seed fixed strategy showed no material regression; bubble5 had zero attacks/skill activations in both variants, so it does not prove that role station combat output.','Nearest ally from slot3 changes from5 to2; old leaf4 without reach loses3-to5 link. Root owns migration and live coverage review.'],'hashes':{name:sha(name) for name in files}}
(OUT/'provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':report['status'],'checks':report['checks'],'fbxSha256':sha('boss-bay.fbx')},ensure_ascii=False,indent=2))
