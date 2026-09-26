"""Freeze bubble c01/c02 source inventory and propose parent-only runtime copy.
No Blender, resources writes, Cocos, meta or OS read-only attributes.
"""
import datetime,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;SPECIES=HERE.parent;ROOT=HERE.parents[3];OUT=HERE/'runtime-candidate'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
handoff=json.loads((OUT/'handoff-manifest.json').read_text(encoding='utf-8'))
assert handoff['image_review']['actual_images_reviewed']
files=[]
for candidate in ['candidate-01','candidate-02']:
    files += [p for p in (SPECIES/candidate).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
files += [ROOT/'game/art-source/build_bubble_turtle_candidate01.py',ROOT/'game/art-source/build_bubble_turtle_candidate02.py']
inventory={str(p.relative_to(ROOT)).replace('\\','/'):{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(set(files))}
write(SPECIES/'source-freeze.json',{'status':'Logical c01-c02 source byte freeze after own QA and parent shape review; final Cocos appearance pending.',
    'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'file_count':len(inventory),
    'files':inventory,'excluded':'Python bytecode caches. Global promotion-manifest.json is an external handoff status record and is not part of frozen c01/c02 sources.',
    'os_readonly_attributes_changed':False,'runtime_written':False})
proposal={}
for name,record in handoff['files'].items():
    source=ROOT/record['source'];assert sha(source)==record['sha256']
    target='game/assets/resources/models/bubble-turtle/'+name
    proposal[name]={**record,'expected_target':target,'copied':False,'target_verified':False}
write(SPECIES/'promotion-manifest.json',{'status':'Ready for root to copy exactly three files; source candidate frozen. No copy executed by art agent.',
    'candidate':'02/runtime-candidate','files':proposal,'expected_prefab_after_root_copy':'models/bubble-turtle/bubble-turtle/bubble-turtle',
    'prefab_import_verified':False,'material_prefix':handoff['material_prefix'],'material_name':handoff['material_name'],
    'cocos_scale':handoff['cocos_scale'],'expected_cocos_forward':'+Z','up':'+Y','foot_y':0,
    'clips':handoff['clips'],'rest_bounds':handoff['rest_bounds'],'maximum_animation_y_scaled':handoff['maximum_animation_y_scaled'],
    'suggested_healthbar_height':handoff['suggested_healthbar_height'],'suggested_control_marker_height':handoff['suggested_control_marker_height'],
    'source_freeze':str((SPECIES/'source-freeze.json').relative_to(ROOT)).replace('\\','/'),
    'source_freeze_sha256':sha(SPECIES/'source-freeze.json'),'runtime_written':False,'meta_written':False,'cocos_started':False})
print(json.dumps({'frozen_files':len(inventory),'runtime_copy_proposed':3,'runtime_written':False,'source_freeze_sha256':sha(SPECIES/'source-freeze.json')}))

