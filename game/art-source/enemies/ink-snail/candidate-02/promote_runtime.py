"""Verify frozen c02 provenance and copy exactly FBX + two PNGs. No meta/engine UI."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,shutil
from PIL import Image

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
DEST=ROOT/'game/assets/resources/models/enemies/ink-snail'
EXPECTED={
 'ink-snail.fbx':'3ff3b91dab1e86e2c43ab2fe11d55810fb879e6b9f312c04dfc33e2822c59179',
 'snail-colour.png':'96969a32fdd36c032c3e4d27efe810c279b21fd47c03da49ef8898c452f9c019',
 'snail-roughness.png':'2e172711b3983c23709048ffc4cebc6cfa5887fff0b7e7bb7799ff8330a14eb7',
}
TAKES={'idle':(85,2.8,True),'walk':(37,1.2,True),'attack':(37,1.2,False),'hit':(19,.6,False),'exit':(34,1.1,False)}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def rel(path):return path.relative_to(ROOT).as_posix()
def require(value,message):
    if not value:raise RuntimeError(message)
stats=read(HERE/'model-stats.json');motion=read(HERE/'round-trip-check.json')
sources=read(HERE/'source-check.json');comparison=read(HERE/'c01-comparison-check.json')
preservation=read(HERE/'c01-preservation.json');package=read(HERE/'asset-manifest.json')
require(motion['status']==sources['status']==comparison['status']==preservation['status']=='pass','Prior validation did not pass')
require(stats['fbx_sha256']==motion['fbx_sha256']==EXPECTED['ink-snail.fbx'],'Frozen FBX does not match round-trip evidence')
require(stats['triangles']==motion['triangles']==13956 and len(motion['materials'])==1 and len(motion['bones'])==9,'Runtime geometry contract mismatch')
require(comparison['bones_identical'] and comparison['authored_actions_identical'],'Unexpected skeleton/actions')
require(sha(ROOT/package['generator'])==package['generator_sha256'],'Candidate generator changed after packaging')
for name,digest in preservation['files'].items():require(sha(ROOT/name)==digest,'Protected c01 bytes changed: '+name)
for name,entry in sources['files'].items():require(sha(HERE/name)==entry['sha256'],'Editable source changed: '+name)
require(set(stats['clips'])==set(motion['clips'])==set(TAKES),'Expected exactly five actions')
for name,(last,seconds,loop) in TAKES.items():
    a=stats['clips'][name];b=motion['clips'][name]
    require(a['name']=='InkSnail_Rig|'+name and a['first']==b['first']==1 and a['last']==b['last']==last,'Action name/range mismatch: '+name)
    require(abs(a['seconds']-seconds)<1e-6 and abs(b['seconds']-seconds)<1e-6 and b['loop']==loop,'Action timing mismatch: '+name)
    require(b['samples']==(last-1)*2+1 and b['maximum_vertex_motion_m']>.001 and b['minimum_z_m']>-.002,'Invalid round-trip motion: '+name)
    if name!='exit':require(b['first_last_seam_m']<.0001,'Action no longer returns: '+name)
require(sum(entry['samples'] for entry in motion['clips'].values())==419,'Missing action samples')
for name,digest in EXPECTED.items():
    require(sha(HERE/'export'/name)==digest,'Frozen export changed: '+name)
    if (DEST/name).exists():require(sha(DEST/name)==digest,'Different existing runtime asset: '+name)
raw=(HERE/'export/ink-snail.fbx').read_bytes();embedded={};gray=[]
for name in ('snail-colour.png','snail-roughness.png'):
    blob=(HERE/'export'/name).read_bytes();offset=raw.find(blob)
    require(offset>=0,'Exact atlas PNG not embedded in FBX: '+name)
    require(EXPECTED[name]==comparison['texture_sha256_identical'][name],'Atlas no longer matches c01')
    with Image.open(HERE/'export'/name) as im:
        require(im.size==(512,512),'Unexpected atlas dimensions')
        rgba=im.convert('RGBA').tobytes();require(set(rgba[3::4])=={255},'Unexpected transparent atlas')
        if name=='snail-roughness.png':
            require(rgba[0::4]==rgba[1::4]==rgba[2::4],'Roughness must be grayscale')
            gray=sorted(set(rgba[1::4]))
    embedded[name]={'sha256':EXPECTED[name],'bytes':len(blob),'exact_png_byte_offset':offset}
scale=.93;bounds=stats['bounds_blender_xyz'];lo,hi=bounds['min'],bounds['max']
cocos_bounds={'min':[lo[0]*scale,lo[2]*scale,-hi[1]*scale],
              'max':[hi[0]*scale,hi[2]*scale,-lo[1]*scale]}
cocos_dimensions=[cocos_bounds['max'][i]-cocos_bounds['min'][i] for i in range(3)]
peak=max(motion['clips'][name]['maximum_z_m'] for name in ('idle','walk','attack','hit'))*scale
manifest_path=HERE/'promotion-manifest.json'
if manifest_path.exists():
    require(read(manifest_path)['runtime_sha256']==EXPECTED['ink-snail.fbx'],'Another version already recorded')
    require(all((DEST/name).is_file() for name in EXPECTED),'Existing promotion incomplete')
else:
    created_directory=not DEST.exists();DEST.mkdir(parents=True,exist_ok=True);files=[]
    for name in ('snail-colour.png','snail-roughness.png','ink-snail.fbx'):
        target=DEST/name;created=not target.exists()
        if created:shutil.copyfile(HERE/'export'/name,target)
        require(sha(target)==EXPECTED[name],'Promoted copy hash mismatch: '+name)
        files.append({'path':rel(target),'source_path':rel(HERE/'export'/name),'sha256':sha(target),'bytes':target.stat().st_size,'created_by_this_run':created})
    manifest={
     'version':'ink-snail-candidate-02','promoted_at_utc':datetime.now(timezone.utc).isoformat(),
     'status':'approved-frozen-runtime-candidate; actual Cocos import/render/performance acceptance pending',
     'authorization':'Parent actually reviewed c02 three-quarter render, accepted corrected shell creases/bulges, and explicitly authorized frozen runtime promotion.',
     'enemy_kind':'snail','display_name':'吐墨螺','runtime_directory':rel(DEST),'runtime_directory_created_by_this_run':created_directory,
     'runtime_sha256':EXPECTED['ink-snail.fbx'],'runtime_files':files,'copied_frozen_bytes':True,
     'meta_authored':False,'fbx_subasset_uuids_authored':False,'cocos_started':False,'blender_started_for_promotion':False,
     'provenance_final_check':{'source_hashes_match':True,'roundtrip_fbx_hash_matches':True,'half_frame_samples':419,
        'five_clip_names_ranges_durations_match':True,'atlas_bytes_embedded_and_match_c01':True,
        'c01_all_recorded_bytes_preserved':True,'generator_hash_matches_package':True},
     'source_hashes':{rel(HERE/name):sha(HERE/name) for name in ('ink-snail.blend','ink-snail-review-scene.blend','ink-snail.glb','model-stats.json','round-trip-check.json','source-check.json','c01-comparison-check.json','c01-preservation.json')},
     'embedded_pngs':embedded,'geometry':{'triangles':13956,'vertices':7004,'meshes':1,'materials':1,'bones':9},
     'clips':{name:{'expected_cocos_take':'InkSnail_Rig|'+name,'seconds':seconds,'first':1,'last':last,'loop':loop,
                    'observed_blender_roundtrip_name':motion['clips'][name]['imported_action_name']} for name,(last,seconds,loop) in TAKES.items()},
     'coordinate_handoff':{'source':'Blender Z up / -Y forward','fbx_export':'axis_forward=-Z / axis_up=Y',
        'expected_cocos_forward':'+Z; confirm first actual import','recommended_model_uniform_scale':scale,
        'expected_cocos_bounds_at_scale_xyz':cocos_bounds,'expected_cocos_dimensions_width_height_depth':cocos_dimensions,
        'bounds_status':'Calculated from validated source and established axis contract; actual importer bounds not yet measured',
        'foot_origin_y':0,'road_actor_y':.064,'root_motion':False,'standing_action_peak_y_at_scale':peak,
        'health_bar_local_on_unscaled_actor':{'position':[0,1.02,0],'suggested_width':.65},
        'rest_spout_local_on_unscaled_actor':[0,.29*scale,.56*scale],
        'spout_note':'Rest approximation only; spout/head move during attack, prefer bone-derived visual origin when available.'},
     'expected_import':{'prefab_resource_path':'models/enemies/ink-snail/ink-snail/ink-snail',
        'path_status':'Matches established filename/sub-prefab importer layout; confirm generated metadata during first Cocos build',
        'material_name_prefix':'InkSnail_Toy_Atlas','colour_image_prefix':'InkSnail_Colour_','roughness_image_prefix':'InkSnail_Roughness_',
        'colour':'sRGB mainTexture','roughness':'linear gray; imported shininessExponentMap -> native Standard pbrMap G',
        'roughness_gray_u8':gray,'roughness_alpha_u8':255,
        'native_standard_starting_values':{'roughness':1,'metallic':0,'occlusion':0,'specularIntensity':.5,'mainColor':[255,255,255,255],'albedoScale':[1,1,1]}},
     'control_notes':['Scale the visual model child, preserving unscaled actor coordinates for path/health bar.',
        'Walk is in-place soft gliding at 1.2 seconds; position and .8 movement speed remain core-driven.',
        'Trigger attack from existing battle events; the 1.2 second animation does not schedule damage or new projectiles.',
        'Keep the existing ranged range 3.5 and attack interval 2.0 seconds; do not convert into a melee or sand enemy.',
        'Keep the actor until authored exit 1.1 seconds finishes; avoid stacking placeholder shrink on the skinned exit.',
        'Actual importer may normalize take prefixes; the expected take prefix is InkSnail_Rig| and the five suffixes are exact.'],
     'rollback':'Verify these three runtime hashes and remove only those frozen payloads if rollback is needed; c01/c02 editable sources remain intact. Inspect any later importer metadata before altering it.'}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name,digest in EXPECTED.items():require(sha(DEST/name)==digest,'Final destination hash mismatch')
for name,digest in preservation['files'].items():require(sha(ROOT/name)==digest,'c01 changed during promotion')
print(json.dumps({'status':'frozen-ink-snail-c02-promoted','prefab':'models/enemies/ink-snail/ink-snail/ink-snail',
    'files':EXPECTED,'scale':scale,'expected_cocos_bounds_xyz':cocos_bounds,'dimensions_width_height_depth':cocos_dimensions,
    'bar_local':[0,1.02,0],'standing_action_peak_y':peak,'c01_preserved':True},indent=2))
