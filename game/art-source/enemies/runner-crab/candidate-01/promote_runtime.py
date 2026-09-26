"""Copy the approved frozen runner c01 into its new runtime directory.

Plain Python only: no Blender/Cocos invocation and no authored .meta or UUIDs.
Existing nonmatching destination bytes are never overwritten.
"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,shutil
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
DEST=ROOT/'game/assets/resources/models/enemies/runner-crab'
EXPECTED={
    'runner-crab.fbx':'9a881e9afd4f168f9af8348b4da47e95faa2bc46ed9c8705a479f69e99e55e14',
    'runner-colour.png':'18c46e33630712ce34b94add1703e880799d279b4a1f35e10cc03bd2b5b9a72d',
    'runner-roughness.png':'c2ca32a47a37f2ec0c42a3c3548cbe30208d0fccf91d48a93cd40a1e67fff48c',
}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def rel(path):return path.relative_to(ROOT).as_posix()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def require(condition,message):
    if not condition:raise RuntimeError(message)

stats=read(HERE/'model-stats.json');motion=read(HERE/'round-trip-check.json');sources=read(HERE/'source-check.json')
require(motion['status']==sources['status']=='pass','Candidate checks have not passed')
require(stats['fbx_sha256']==motion['fbx_sha256']==EXPECTED['runner-crab.fbx'],'Candidate FBX report mismatch')
for name,data in sources['files'].items():
    require(sha(HERE/name)==data['sha256'],'Editable source changed since validation: '+name)
for name,digest in EXPECTED.items():
    require(sha(HERE/'export'/name)==digest,'Frozen source changed: '+name)
    if (DEST/name).exists():require(sha(DEST/name)==digest,'Destination has another version: '+name)
raw=(HERE/'export/runner-crab.fbx').read_bytes();embedded={}
for name in ('runner-colour.png','runner-roughness.png'):
    content=(HERE/'export'/name).read_bytes();offset=raw.find(content)
    require(offset>=0,'Exact PNG is not embedded in FBX: '+name)
    embedded[name]={'sha256':EXPECTED[name],'bytes':len(content),'exact_png_byte_offset':offset}
with Image.open(HERE/'export/runner-roughness.png') as im:
    pixels=im.convert('RGBA').tobytes()
    rgba=list(zip(pixels[0::4],pixels[1::4],pixels[2::4],pixels[3::4]))
    require(im.size==(512,512),'Unexpected roughness atlas size')
    require(all(r==g==b and a==255 for r,g,b,a in rgba),'Roughness must be grayscale with alpha one')
    gray=sorted(set(pixel[0] for pixel in rgba))
manifest_path=HERE/'promotion-manifest.json'
if manifest_path.exists():
    old=read(manifest_path)
    require(old['runtime_sha256']==EXPECTED['runner-crab.fbx'],'Existing manifest identifies another version')
    require(all((DEST/name).exists() for name in EXPECTED),'An earlier promotion is incomplete; inspect it before retrying')
else:
    created_directory=not DEST.exists();DEST.mkdir(parents=True,exist_ok=True)
    files=[]
    # Texture files first, FBX last: the editor can discover complete sidecars
    # if it happens to observe the new folder before the parent's next build.
    for name in ('runner-colour.png','runner-roughness.png','runner-crab.fbx'):
        target=DEST/name;created=not target.exists()
        if created:shutil.copyfile(HERE/'export'/name,target)
        require(sha(target)==EXPECTED[name],'Promoted bytes failed verification: '+name)
        files.append({'path':rel(target),'source_path':rel(HERE/'export'/name),
                      'sha256':sha(target),'bytes':target.stat().st_size,'created_by_this_run':created})
    peak=max(motion['clips'][name]['maximum_z_m'] for name in ('idle','walk','attack','hit'))
    manifest={
        'version':'runner-crab-candidate-01','promoted_at_utc':datetime.now(timezone.utc).isoformat(),
        'status':'approved-runtime-candidate-not-final-art; first Cocos import/build/runtime review pending',
        'enemy_kind':'runner','display_name':'快跑蟹',
        'authorization':'Parent reviewed three-quarter, battle angle, five-pose and real-island context renders; approved c01 as runtime candidate without further eye-stalk/leg-shape edits.',
        'runtime_directory':rel(DEST),'runtime_directory_created_by_this_run':created_directory,
        'runtime_file':rel(DEST/'runner-crab.fbx'),'runtime_sha256':EXPECTED['runner-crab.fbx'],
        'runtime_files':files,'copied_frozen_bytes':True,'meta_created_by_this_script':False,
        'fbx_subasset_uuids_authored':False,'cocos_started':False,'blender_started':False,
        'embedded_pngs':embedded,
        'external_png_copies':'Explicitly requested alongside the FBX; embedded PNG bytes remain identical. Prefer imported material texture bindings during adaptation.',
        'source_hashes':{rel(HERE/name):sha(HERE/name) for name in ('runner-crab.blend','runner-crab-review-scene.blend','runner-crab.glb','model-stats.json','round-trip-check.json','source-check.json')},
        'geometry':{'triangles':stats['triangles'],'vertices':stats['vertices'],'meshes':1,'materials':1,'bones':16},
        'clips':{name:{'expected_cocos_take':data['name'],'seconds':data['seconds'],
                       'frames':[data['first'],data['last']],'loop':name in stats['loops']}
                 for name,data in stats['clips'].items()},
        'coordinate_handoff':{'source_axes':'Blender Z up / -Y forward','export_axes':'FBX axis_forward=-Z / axis_up=Y',
            'expected_cocos_forward':'+Z; confirm first actual import','foot_origin_cocos_y':0,
            'recommended_model_uniform_scale':.83,'rest_dimensions_at_scale':stats['dimensions_at_recommended_scale'],
            'rest_bounds_blender_xyz':stats['bounds_blender_xyz'],
            'standing_action_peak_height_at_scale':peak*.83,
            'recommended_health_bar_y_on_unscaled_actor':round(peak*.83+.16,2),
            'road_root_y':.064,'root_motion':False},
        'expected_import':{
            'prefab_resource_path':'models/enemies/runner-crab/runner-crab/runner-crab',
            'path_status':'Expected from existing ink folder/FBX importer structure; generated metadata still requires first build confirmation',
            'material_name_prefix':'RunnerCrab_Toy_Atlas','source_material_name':'RunnerCrab_Toy_Atlas',
            'source_colour_image_prefix':'RunnerCrab_Colour_','source_roughness_image_prefix':'RunnerCrab_Roughness_',
            'colour':{'png':'runner-colour.png','expected_import_property':'mainTexture','native_standard_property':'mainTexture','sampling':'sRGB colour'},
            'roughness':{'png':'runner-roughness.png','expected_import_property':'shininessExponentMap','native_standard_property':'pbrMap',
                         'sampling':'linear data; G=roughness','gray_u8':gray,'alpha_u8':255},
            'native_standard_starting_values':{'roughness':1,'metallic':0,'occlusion':0,'specularIntensity':.5,
                                               'mainColor':[255,255,255,255],'albedoScale':[1,1,1]}},
        'integration_notes':[
            'Keep the actor alive for the authored exit duration of 0.8s; avoid applying the procedural placeholder shrink on top of it.',
            'Expected action prefix is RunnerCrab_Rig|; Blender round-trip names may include an additional object prefix.',
            'Allow RunnerCrab_Toy_Atlas explicitly in the existing native Standard material adapter; do not alter other models.',
            'No importer UUIDs or meta were manually generated. No Cocos rendering/animation acceptance is claimed.',
            'Original isolated delivery asset-manifest.json and REVIEW.md are historical evidence from before this authorized promotion.']}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name,digest in EXPECTED.items():require(sha(DEST/name)==digest,'Final runtime hash mismatch: '+name)
print(json.dumps({'status':'runner-c01-runtime-candidate-promoted','path':rel(DEST),
                  'files':{name:sha(DEST/name) for name in EXPECTED},
                  'material_prefix':'RunnerCrab_Toy_Atlas',
                  'expected_prefab_resource_path':'models/enemies/runner-crab/runner-crab/runner-crab',
                  'roughness_gray_u8':gray,'manual_meta_or_uuid':False,'cocos_started':False},indent=2))
