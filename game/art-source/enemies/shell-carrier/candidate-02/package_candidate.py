"""Validate isolated carrier deliverables and write a source manifest; no engine launch."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,re
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def require(value,message):
    if not value:raise RuntimeError(message)
stats=read('model-stats.json');motion=read('round-trip-check.json');source=read('source-check.json');comparison=read('c01-comparison-check.json')
require(motion['status']==source['status']==comparison['status']=='pass','Source/FBX QA not passed')
require(stats['fbx_sha256']==motion['fbx_sha256']==sha(HERE/'export/shell-carrier.fbx'),'FBX hash mismatch')
require(stats['triangles']==15088 and stats['triangles']<=16000 and len(motion['bones'])==17 and len(motion['materials'])==1,'Geometry contract mismatch')
samples=sum(c['samples'] for c in motion['clips'].values());require(samples==417,'Missing action samples')
for name,clip in motion['clips'].items():
    require(clip['maximum_vertex_motion_m']>.001 and clip['minimum_z_m']>-.002,'Motion/ground failed '+name)
    if name in ('idle','walk','attack','hit'):require(clip['first_last_seam_m']<.0001,'Pose did not return '+name)
for name,entry in source['files'].items():require(sha(HERE/name)==entry['sha256'],'Editable source changed '+name)
for name,digest in stats['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Frozen reference changed '+name)
require(comparison['changed_meshes']==['Large_carried_fan_shell'] and len(comparison['unchanged_meshes'])==30,'Edit scope changed')
require(comparison['rig_exactly_unchanged'] and comparison['five_actions_exactly_unchanged'] and comparison['material_nodes_exactly_unchanged'] and comparison['studio_lighting_exactly_unchanged'],'Immutable contract changed')
require(comparison['maximum_shell_bound_error_m']==0,'Shell size changed')
for name,digest in comparison['atlas_bytes_unchanged'].items():require(sha(HERE/'export'/name)==digest,'Atlas changed')
links=re.findall(r'(?:src|href)="([^"]+)"',(HERE/'review.html').read_text(encoding='utf-8'))
require(all((HERE/name).is_file() for name in links),'Broken gallery links')
for name in ('render-three-quarter.png','render-battle-angle.png'):
    with Image.open(HERE/name) as im:require(im.size==(920,820),'Unexpected review dimensions');im.verify()
raw=(HERE/'export/shell-carrier.fbx').read_bytes();embedded={}
for name in ('carrier-colour.png','carrier-roughness.png'):
    path=HERE/'export'/name;png=path.read_bytes();offset=raw.find(png)
    require(offset>=0,'Exact atlas is not embedded: '+name)
    with Image.open(path) as im:
        require(im.size==(512,512),'Unexpected atlas size');data=im.convert('RGBA').tobytes()
        require(set(data[3::4])=={255},'Transparent atlas detected')
        if name=='carrier-roughness.png':require(data[0::4]==data[1::4]==data[2::4],'Roughness must be gray')
    embedded[name]={'sha256':sha(path),'bytes':len(png),'exact_png_byte_offset':offset}
generator=ROOT/'game/art-source/enemies/build_shell_carrier_candidate02.py'
files=[p for p in sorted(HERE.rglob('*')) if p.is_file() and p.name!='asset-manifest.json' and p.suffix not in ('.log','.blend1') and '.fbm' not in str(p)]
manifest={'version':'shell-carrier-candidate-02','status':'isolated-single-source-candidate-not-promoted-not-final-art',
    'recorded_at_utc':datetime.now(timezone.utc).isoformat(),'runtime_written':False,'cocos_started':False,
    'render_threads':2,'max_samples':24,'images_actually_viewed':['render-three-quarter.png','render-battle-angle.png'],
    'render_processes_exited':True,'triangles':15088,'vertices':7606,'bones':17,'material_count':1,'half_frame_samples':samples,
    'enemy_kind':'elite','display_name':'搬壳大蟹','recommended_scale':1.0,
    'dimensions_blender_xyz':stats['dimensions_blender_xyz'],'embedded_pngs':embedded,
    'generator':generator.relative_to(ROOT).as_posix(),'generator_sha256':sha(generator),
    'original_source':'Project-original c02 rounded fan surface/elliptical rim from frozen c01. Remaining 30 source meshes, rig/action keyframes, material, lighting and PNG bytes verified unchanged. Internal original crab lineage; no external stock material or model.',
    'protected_sources_unchanged':stats['protected_reference_hashes'],
    'files':[{'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]}
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'packaging':'pass','triangles':15088,'samples':samples,'review_images':2,'source_references_unchanged':True,
                  'fbx_sha256':sha(HERE/'export/shell-carrier.fbx'),'runtime_written':False},indent=2))


