"""Record completed human-visible review and a non-mutating promotion proposal.
Run only after the ten final images have actually been viewed. No resource writes.
"""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OUT=HERE/'runtime-candidate'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lod=json.loads((OUT/'lod-manifest.json').read_text(encoding='utf-8'))
qa=json.loads((OUT/'round-trip-check.json').read_text(encoding='utf-8'))
payload=json.loads((OUT/'export-payload-check.json').read_text(encoding='utf-8'))
for path,digest in lod['protected_inputs'].items():assert sha(ROOT/path)==digest,('Protected input changed',path)
assert qa['fbx_sha256']==lod['fbx_sha256']==sha(OUT/'export/leaf-turtle.fbx')
images=['render-front.png','render-three-quarter.png','render-side.png','render-battle.png',
    'animation-attack-08-side.png','animation-attack-13-three-quarter.png','animation-skill-20-three-quarter.png',
    'animation-rest-36-three-quarter.png','animation-hit-04-three-quarter.png','animation-fusion-23-three-quarter.png']
review={'status':'All ten final LOD images actually viewed by asset subagent; awaiting parent runtime-candidate review. No final user/Cocos approval claimed.',
    'images_actually_viewed':{name:sha(OUT/name) for name in images},
    'final_fbx_sha256':qa['fbx_sha256'],
    'observations':[
        'Front and three-quarter: rounded toe tips restored after first LOD review; warm face and eye layering retained.',
        'Three-quarter versus approved high source: rounded directional leaf tips and shallow midribs remain readable, overlap rhythm preserved.',
        'Side and battle: leaf coverage and bottom hem are coherent; a small natural white blossom remains visible from the side.',
        'Attack/skill/hit/rest/fusion key frames: no visible forward facial penetration or detached facial features; fusion intentionally lifts feet.'
    ],
    'remaining_aesthetic_limits':[
        'A mild tiered rhythm remains near the shell crown, inherited from the approved high source.',
        'Attack and skill motion is deliberately gentle in the retained six source clips; final combat readability needs Cocos effects/timing review.',
        'Offline studio images do not establish final Cocos lighting, animation timing or mobile performance.'
    ],
    'read_image_retry_note':'Three image reads initially timed out in filesystem helper; all were later reopened successfully without altering files.',
    'blender_generation_exit_code':0,'blender_technical_qa_exit_code':0,'blender_final_render_exit_code':0,
    'blender_processes_exited':True,'threads':2,'samples':32,
    'six_fbx_clips_reimported':True,'all_six_animation_half_frame_ground_samples':576,'critical_face_half_frame_samples':171,
    'c01_c02_c03_and_approved_c04_high_preview_bytes_preserved':True,
    'runtime_promoted':False,'cocos_started':False}
write(OUT/'technical-manual-review.json',review)
files=[]
for name in ['leaf-turtle.fbx','leaf-colour.png','leaf-roughness.png']:
    source=OUT/'export'/name;destination=ROOT/'game/assets/resources/models/leaf-turtle'/name
    files.append({'source':str(source.relative_to(ROOT)),'proposed_destination':str(destination.relative_to(ROOT)),
        'bytes':source.stat().st_size,'sha256':sha(source)})
write(OUT/'promotion-proposal.json',{'status':'proposal only; await parent approval before copying three runtime files',
    'files':files,'total_bytes':sum(f['bytes'] for f in files),
    'expected_prefab_resource_path':'models/leaf-turtle/leaf-turtle/leaf-turtle',
    'prefab_path_cocos_verified':False,'material_name':'LeafAtlas_01','material_prefix':'LeafAtlas_',
    'texture_adapter_mapping':{'DiffuseColor':'mainTexture -> Standard.mainTexture','ShininessExponent':'shininessExponentMap -> Standard.pbrMap'},
    'atlas_raster_inputs':[],'blender_forward':'-Y','blender_up':'+Z','cocos_expected_forward':'+Z','cocos_scale':.65,
    'cocos_foot_y':0,'bounds_at_scale_065':qa['expected_rest_bounds_cocos_xyz_scale_065'],
    'fbx_animation_stack_names':payload['fbx_animation_stack_names'],
    'clips':{name:{'seconds':v['seconds'],'first_frame':v['first'],'last_frame':v['last'],'loop':v['loop_recommended']} for name,v in qa['clips'].items()},
    'original_high_source_sha256':sha(HERE/'leaf-turtle.blend'),'approved_high_preview_sha256':sha(HERE/'render-three-quarter.png'),
    'lod_parts_sha256':sha(OUT/'leaf-turtle-lod-parts.blend'),'runtime_blend_sha256':sha(OUT/'leaf-turtle-runtime.blend'),
    'script_sha256':{name:sha(HERE/name) for name in ['build_runtime_lod.py','review_runtime_lod.py','inspect_export_payload.py','record_runtime_handoff.py']},
    'meta_or_uuid_written':False,'cocos_started':False})
print('LEAF_C04_HANDOFF_RECORDED '+json.dumps({'images_actually_viewed':10,'fbx_sha256':qa['fbx_sha256'],'proposed_files':3}))
