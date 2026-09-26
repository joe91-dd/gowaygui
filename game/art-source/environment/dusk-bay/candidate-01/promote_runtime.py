"""Promote the exact reviewed dusk-bay source candidate; never author Cocos metadata."""
import hashlib,json,re,shutil
from datetime import datetime,timezone
from pathlib import Path

source=Path(__file__).resolve().parent
root=source.parents[4]
destination=root/'game/assets/resources/environment/dusk-bay'
assert (root/'game/assets/scripts').is_dir()
assert destination.resolve().is_relative_to((root/'game/assets/resources/environment').resolve())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda name:json.loads((source/name).read_text(encoding='utf-8'))
provenance=load('provenance.json');review=load('manual-review.json')
render=load('render-report.json');environment=load('environment-manifest.json')
checks={name:load(name) for name in ['environment-round-trip.json','source-check.json','foot-support-check.json','vegetation-support-check.json']}

# Source provenance is frozen evidence from after the vegetation fix and final three views.
for record in provenance['files']:
    p=source/record['path']
    assert p.stat().st_size==record['bytes'] and sha(p)==record['sha256'],f'Provenance mismatch: {p}'
assert review==provenance['manualReview'] and review['actuallyViewed'] is True
for name,digest in review['imageSha256'].items():assert sha(source/name)==digest,name
for view in render['views']:
    name='render-'+view['name']+'.png'
    assert sha(source/name)==view['sha256']==review['imageSha256'][name],name
assert checks['environment-round-trip.json']['fbx_round_trip']=='pass'
for name in ['source-check.json','foot-support-check.json','vegetation-support-check.json']:assert checks[name]['status']=='pass'
assert render['threads']==2 and render['samples']==32 and render['device']=='CPU'

data=(root/'game/assets/scripts/core/data.ts').read_text(encoding='utf-8')
def points(text):return [{'x':float(x),'z':float(z)} for x,z in re.findall(r'x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)',text)]
route=points(re.search(r'id:3,name:.*?route:\[(.*?)\]',data,re.S).group(1))
slots=points(re.search(r'const slots\s*=\s*\[(.*?)\]',data,re.S).group(1))
assert route==environment['route']
assert slots==environment['sourceSlots']==[{'x':p['x'],'z':p['z']} for p in environment['slots']]
names=('dusk-bay.fbx','island-colour.png','island-roughness.png')
assert sha(source/names[0])=='55ffe57152c8de18146b1bcb94550ff515b6a4c720e5da2f77c9fa4e3e606675'
for name in names:
    target=destination/name
    if target.exists() and sha(target)!=sha(source/name):raise RuntimeError(f'Refusing to overwrite different runtime asset: {target}')
destination.mkdir(parents=True,exist_ok=True)
records=[]
for name in names:
    target=destination/name
    if not target.exists():shutil.copyfile(source/name,target)
    assert sha(source/name)==sha(target)
    records.append({'source':(source/name).relative_to(root).as_posix(),'destination':target.relative_to(root).as_posix(),
                    'bytes':target.stat().st_size,'sha256':sha(target)})
manifest={'schemaVersion':1,'promotedAtUtc':datetime.now(timezone.utc).isoformat(),
 'status':'runtime-candidate-frozen-pending-cocos-review','levelId':3,'levelName':'薄暮海湾',
 'authorization':'Root actually reviewed final battle overview and approved the current layout/soft dusk palette for runtime candidacy; author reconfirmed final top-down/detail images and all post-fix provenance hashes before this promotion.',
 'sourceProvenanceSha256':sha(source/'provenance.json'),'manualReviewSha256':sha(source/'manual-review.json'),
 'finalRenderSha256':review['imageSha256'],'provenanceRecordsVerified':len(provenance['files']),
 'expectedResourcesPrefabPath':'environment/dusk-bay/dusk-bay/dusk-bay',
 'resourcesTexturePaths':['environment/dusk-bay/island-colour/texture','environment/dusk-bay/island-roughness/texture'],
 'materials':['Island_atlas','Warm_pearl_and_lamps'],'route':route,'stationCoordinates':slots,
 'routeChanged':False,'stationCoordinatesChanged':False,'files':records,
 'metasOrUuidsAuthored':False,'cocosLaunched':False,'coreOrViewModified':False,
 'pending':['Root loader wiring and actual Cocos import','Real dusk lighting/material/culling and mobile viewport','Character contact/animation and performance acceptance']}
(source/'promotion-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
