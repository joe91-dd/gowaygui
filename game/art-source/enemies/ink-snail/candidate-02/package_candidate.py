"""Verify c02 frozen deliverables without launching Blender/Cocos; keep c01 bytes."""
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
require(motion['status']==source['status']==comparison['status']=='pass','QA did not pass')
require(stats['triangles']==13956 and len(motion['materials'])==1 and len(motion['bones'])==9,'Geometry contract mismatch')
require(stats['fbx_sha256']==motion['fbx_sha256']==sha(HERE/'export/ink-snail.fbx'),'FBX hash mismatch')
require(sum(v['samples'] for v in motion['clips'].values())==419,'Incomplete action sampling')
for name,data in source['files'].items():require(sha(HERE/name)==data['sha256'],'Editable source changed '+name)
for name,digest in read('c01-preservation.json')['files'].items():require(sha(ROOT/name)==digest,'Protected c01 bytes changed '+name)
links=re.findall(r'(?:src|href)="([^"]+)"',(HERE/'review.html').read_text(encoding='utf-8'))
require(all((HERE/link).is_file() for link in links),'Broken gallery links')
for name in ('render-side.png','render-three-quarter.png'):
    with Image.open(HERE/name) as im:require(im.size==(980,820),'Unexpected image dimensions');im.verify()
raw=(HERE/'export/ink-snail.fbx').read_bytes();embedded={}
for name in ('snail-colour.png','snail-roughness.png'):
    path=HERE/'export'/name;blob=path.read_bytes();offset=raw.find(blob)
    require(offset>=0,'FBX must embed exact atlas '+name)
    require(sha(path)==comparison['texture_sha256_identical'][name],'Atlas differs from c01')
    with Image.open(path) as im:
        require(im.size==(512,512),'Atlas dimensions mismatch')
        data=im.convert('RGBA').tobytes();require(set(data[3::4])=={255},'Unexpected alpha')
        if name=='snail-roughness.png':require(data[0::4]==data[1::4]==data[2::4],'Roughness is not gray')
    embedded[name]={'sha256':sha(path),'exact_png_byte_offset':offset,'bytes':len(blob)}
generator=ROOT/'game/art-source/enemies/build_ink_snail_candidate02.py'
files=[p for p in sorted(HERE.rglob('*')) if p.is_file() and p.name!='asset-manifest.json' and p.suffix not in ('.log','.blend1') and '.fbm' not in str(p)]
manifest={'version':'ink-snail-candidate-02','status':'source-review-candidate-not-promoted-not-final-art',
    'recorded_at_utc':datetime.now(timezone.utc).isoformat(),'runtime_written':False,'cocos_started':False,
    'render_threads':2,'max_samples':24,'blender_processes_exited':True,'images_actually_viewed':['render-side.png','render-three-quarter.png'],
    'changed_meshes':comparison['changed_meshes_only'],'unchanged_meshes':comparison['unchanged_meshes'],
    'c01_preserved':True,'bones_and_authored_actions_identical':True,'texture_pngs_identical':True,
    'triangles':13956,'vertices':7004,'mesh_count':1,'material_count':1,'bone_count':9,'half_frame_samples':419,
    'embedded_pngs':embedded,'generator':generator.relative_to(ROOT).as_posix(),'generator_sha256':sha(generator),
    'source':'Project-original geometry, UV artwork, rig and actions. c02 only changes the four shell curves; no external stock assets.',
    'files':[{'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]}
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'packaging-pass','c01_preserved':True,'only_changed_meshes':comparison['changed_meshes_only'],
    'triangles':13956,'samples':419,'fbx_sha256':sha(HERE/'export/ink-snail.fbx'),'runtime_written':False},indent=2))
