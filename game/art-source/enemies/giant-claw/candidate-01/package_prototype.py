"""Package a viewed, source-checked static prototype. Does not invoke Blender."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,re
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8-sig'))
def require(value,message):
    if not value:raise RuntimeError(message)
stats=read('model-stats.json');check=read('source-check.json')
require(check['status']=='pass','Source QA not passed')
require(stats['bone_count']==stats['action_count']==0 and stats['editable_mesh_count']==36,'Wrong prototype stage')
require(stats['triangles']<=24000 and stats['material_count']==1,'Prototype budget exceeded')
require(check['initial_preview_comparison']['other_34_parts_exactly_unchanged'],'Unapproved shape change')
require(check['initial_preview_comparison']['packed_atlas_bytes_exactly_unchanged'],'Palette changed')
for name,entry in check['files'].items():require(sha(HERE/name)==entry['sha256'],'Saved source changed after QA')
for name,digest in stats['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Frozen reference changed')
require(not list(HERE.rglob('*.fbx')) and not list(HERE.rglob('*.glb')),'Unexpected exported runtime asset')
for name in ('render-three-quarter.png','render-front.png'):
    with Image.open(HERE/name) as im:require(im.size==(1000,840),'Wrong preview size');im.verify()
atlases={}
for name in ('giant-colour.png','giant-roughness.png'):
    p=HERE/'textures'/name
    with Image.open(p) as im:
        require(im.size==(512,512),'Wrong atlas size');raw=im.convert('RGBA').tobytes()
        require(set(raw[3::4])=={255},'Unexpected transparency')
        if 'roughness' in name:require(raw[0::4]==raw[1::4]==raw[2::4],'Non-gray roughness')
    atlases[name]={'sha256':sha(p),'bytes':p.stat().st_size}
links=re.findall(r'(?:href|src)="([^"]+)"',(HERE/'review.html').read_text(encoding='utf-8'))
require(all((HERE/p).is_file() for p in links),'Broken review gallery link')
generator=ROOT/'game/art-source/enemies/build_giant_claw_prototype.py'
files=[p for p in sorted(HERE.rglob('*')) if p.is_file() and p.name!='asset-manifest.json' and p.suffix not in ('.log','.blend1')]
manifest={'version':'giant-claw-shape-candidate-01','recorded_at_utc':datetime.now(timezone.utc).isoformat(),
    'status':'isolated editable static boss shape candidate; no rig/actions/interchange export/runtime promotion',
    'enemy_kind':'boss','display_name':'巨钳蟹','triangles':stats['triangles'],'vertices':stats['vertices'],
    'editable_meshes':36,'model_materials':1,'bones':0,'actions':0,
    'source_bounds':stats['bounds_blender_xyz'],'provisional_scale':1.0,
    'images_actually_viewed':['render-three-quarter.png','render-front.png'],
    'render_threads':2,'render_samples':24,'blender_processes_exited':True,
    'runtime_written':False,'cocos_started':False,'fbx_exported':False,
    'scope_check':check['initial_preview_comparison'],'atlas_files':atlases,
    'original_source':stats['source'],'protected_reference_hashes':stats['protected_reference_hashes'],
    'generator':generator.relative_to(ROOT).as_posix(),'generator_sha256':sha(generator),
    'files':[{'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]}
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'static-prototype-packaged','triangles':stats['triangles'],'vertices':stats['vertices'],
    'editable_parts':36,'model_materials':1,'bones':0,'actions':0,'fbx_exported':False,
    'protected_sources_unchanged':True,'source_sha256':sha(HERE/'giant-claw-prototype.blend')},indent=2))
