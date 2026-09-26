"""Promote exactly three frozen approved files; no Blender/Cocos or authored meta."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,shutil
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
DEST=ROOT/'game/assets/resources/models/enemies/armored-crab'
EXPECTED={
    'armored-crab.fbx':'837caade510dd003847a05a4dfe7ee4551235b75026354338defc0523e409474',
    'armored-colour.png':'36faabdfab94e6e227f5ba8038ee7c51d85f59c9663c66c9c83758359191538d',
    'armored-roughness.png':'8355d3e4e53cca0ec1b951ca0c6c98a870d1ceae564ec5684db109d886b99ba1',
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def rel(path):return path.relative_to(ROOT).as_posix()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def require(value,message):
    if not value:raise RuntimeError(message)

stats=read(HERE/'model-stats.json');motion=read(HERE/'round-trip-check.json');sources=read(HERE/'source-check.json')
require(motion['status']==sources['status']=='pass','Candidate validation did not pass')
require(stats['fbx_sha256']==motion['fbx_sha256']==EXPECTED['armored-crab.fbx'],'Frozen FBX report mismatch')
for name,entry in sources['files'].items():require(sha(HERE/name)==entry['sha256'],'Editable source changed: '+name)
for name,digest in EXPECTED.items():
    require(sha(HERE/'export'/name)==digest,'Frozen export changed: '+name)
    if (DEST/name).exists():require(sha(DEST/name)==digest,'Different runtime version exists: '+name)
raw=(HERE/'export/armored-crab.fbx').read_bytes();embedded={}
for name in ('armored-colour.png','armored-roughness.png'):
    png=(HERE/'export'/name).read_bytes();offset=raw.find(png)
    require(offset>=0,'FBX does not embed exact PNG: '+name)
    embedded[name]={'sha256':sha(HERE/'export'/name),'exact_png_byte_offset':offset,'bytes':len(png)}
with Image.open(HERE/'export/armored-roughness.png') as im:
    require(im.size==(512,512),'Unexpected atlas dimensions')
    pixels=list(im.convert('RGBA').getdata())
    require(all(r==g==b and a==255 for r,g,b,a in pixels),'Roughness must be gray with opaque alpha')
    gray=sorted(set(r for r,g,b,a in pixels))
manifest_path=HERE/'promotion-manifest.json'
if manifest_path.exists():
    require(read(manifest_path)['runtime_sha256']==EXPECTED['armored-crab.fbx'],'Different promotion record exists')
    require(all((DEST/name).is_file() for name in EXPECTED),'Previous promotion incomplete')
else:
    new_directory=not DEST.exists();DEST.mkdir(parents=True,exist_ok=True);files=[]
    for name in ('armored-colour.png','armored-roughness.png','armored-crab.fbx'):
        target=DEST/name;created=not target.exists()
        if created:shutil.copyfile(HERE/'export'/name,target)
        require(sha(target)==EXPECTED[name],'Copy hash mismatch: '+name)
        files.append({'path':rel(target),'source_path':rel(HERE/'export'/name),'bytes':target.stat().st_size,
                      'sha256':sha(target),'created_by_this_run':created})
    peak=max(motion['clips'][name]['maximum_z_m'] for name in ('idle','walk','attack','hit'))
    manifest={
        'version':'armored-crab-candidate-01','promoted_at_utc':datetime.now(timezone.utc).isoformat(),
        'status':'approved-runtime-candidate-not-final-art; first Cocos import/build/runtime review pending',
        'authorization':'Parent actually reviewed front, three-quarter, battle overview and runner scale comparison; approved frozen c01 with no further shape changes.',
        'enemy_kind':'armored','display_name':'铁壳蟹','runtime_directory':rel(DEST),
        'runtime_directory_created_by_this_run':new_directory,'runtime_sha256':EXPECTED['armored-crab.fbx'],
        'runtime_files':files,'copied_frozen_bytes':True,'meta_created_by_this_script':False,
        'fbx_subasset_uuids_authored':False,'cocos_started':False,'blender_started':False,
        'embedded_pngs':embedded,
        'source_hashes':{rel(HERE/name):sha(HERE/name) for name in ('armored-crab.blend','armored-crab-review-scene.blend','armored-crab.glb','model-stats.json','round-trip-check.json','source-check.json')},
        'geometry':{'triangles':stats['triangles'],'vertices':stats['vertices'],'meshes':1,'materials':1,'bones':16},
        'clips':{name:{'expected_cocos_take':entry['name'],'seconds':entry['seconds'],'loop':name in stats['loops']} for name,entry in stats['clips'].items()},
        'coordinate_handoff':{'source':'Blender Z up / -Y forward','fbx_export':'axis_forward=-Z / axis_up=Y',
            'expected_cocos_forward':'+Z; confirm first actual import','foot_origin_y':0,'road_root_y':.064,
            'recommended_model_uniform_scale':.90,'dimensions_at_scale':stats['dimensions_at_recommended_scale'],
            'standing_action_peak_height_at_scale':peak*.90,'recommended_health_bar_y_on_unscaled_actor':round(peak*.90+.16,2),'root_motion':False},
        'expected_import':{
            'prefab_resource_path':'models/enemies/armored-crab/armored-crab/armored-crab',
            'path_status':'Expected from existing enemy FBX importer structure; confirm generated metadata during first build',
            'material_name_prefix':'ArmoredCrab_Toy_Atlas','colour_image_prefix':'ArmoredCrab_Colour_',
            'roughness_image_prefix':'ArmoredCrab_Roughness_',
            'colour':'sRGB mainTexture; preserve original atlas',
            'roughness':'linear gray; imported shininessExponentMap -> native Standard pbrMap G',
            'roughness_gray_u8':gray,'roughness_alpha_u8':255,
            'native_standard_starting_values':{'roughness':1,'metallic':0,'occlusion':0,'specularIntensity':.5,'mainColor':[255,255,255,255],'albedoScale':[1,1,1]}},
        'integration_notes':['Authored exit lasts .9 seconds; retain actor until it ends and do not compound placeholder shrink.',
            'Material adapter needs explicit ArmoredCrab_Toy_Atlas acceptance; no view files changed here.',
            'No manual meta or importer UUID; actual Cocos animation, light and performance review remains pending.',
            'Original asset-manifest/REVIEW describe the historical isolated candidate before this authorized promotion.'],
        'rollback':'Remove only the three runtime_files after verifying their hashes still match this manifest; source candidate and editable files remain intact. Do not delete later importer metadata without inspecting it.'}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name,digest in EXPECTED.items():require(sha(DEST/name)==digest,'Final runtime hash mismatch')
print(json.dumps({'status':'frozen-armored-c01-promoted','runtime_directory':rel(DEST),'files':EXPECTED,
                  'prefab':'models/enemies/armored-crab/armored-crab/armored-crab','material':'ArmoredCrab_Toy_Atlas'},indent=2))
