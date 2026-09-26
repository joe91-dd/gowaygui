"""Plain Python final-file validation and source manifest; no Blender/Cocos launch."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,re
from PIL import Image

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def require(value,message):
    if not value:raise RuntimeError(message)
stats=read('model-stats.json');motion=read('round-trip-check.json');source=read('source-check.json')
require(motion['status']==source['status']=='pass','Technical reports did not pass')
require(stats['fbx_sha256']==motion['fbx_sha256']==sha(HERE/'export/mist-bubble.fbx'),'FBX hash mismatch')
require(motion['triangles']<=12000 and len(motion['materials'])==1 and len(motion['bones'])==10,'Runtime budget contract mismatch')
sample_count=sum(v['samples'] for v in motion['clips'].values());require(sample_count==365,'Missing half-frame samples')
for name,clip in motion['clips'].items():
    require(clip['maximum_vertex_motion_m']>.001 and clip['minimum_z_m']>-.002,'Invalid motion/ground: '+name)
    if name in ('idle','walk','attack','hit'):require(clip['first_last_seam_m']<.0001,'Unreturned pose: '+name)
for name,entry in source['files'].items():require(sha(HERE/name)==entry['sha256'],'Source hash changed: '+name)
for path,digest in read('battle-camera-manifest.json')['source_hashes_unchanged'].items():require(sha(Path(path))==digest,'Reference modified')
gallery=(HERE/'review.html').read_text(encoding='utf-8')
links=re.findall(r'(?:src|href)="([^"]+)"',gallery);require(all((HERE/link).is_file() for link in links),'Broken gallery link')
images=[link for link in links if link.endswith('.png')];require(len(images)==5,'Missing review views')
for name in images:
    with Image.open(HERE/name) as image:image.verify()
raw=(HERE/'export/mist-bubble.fbx').read_bytes();embedded={}
for name in ('mist-colour.png','mist-roughness.png'):
    path=HERE/'export'/name;blob=path.read_bytes();offset=raw.find(blob)
    require(offset>=0,'FBX must embed exact PNG bytes: '+name)
    with Image.open(path) as im:
        require(im.size==(512,512),'Unexpected atlas dimensions')
        rgba=im.convert('RGBA');require(rgba.getchannel('A').getextrema()==(255,255),'Atlas transparency detected')
        if name=='mist-roughness.png':
            data=rgba.tobytes();require(data[0::4]==data[1::4]==data[2::4],'Roughness is not grayscale')
            gray=sorted(set(data[1::4]))
    embedded[name]={'sha256':sha(path),'exact_png_byte_offset':offset,'bytes':len(blob)}
generator=ROOT/'game/art-source/enemies/build_mist_bubble.py'
files=[p for p in sorted(HERE.rglob('*')) if p.is_file() and p.name not in ('asset-manifest.json',) and p.suffix not in ('.log','.blend1') and '.fbm' not in str(p)]
manifest={'version':'mist-bubble-candidate-01','status':'isolated-review-candidate-not-final-art',
    'recorded_at_utc':datetime.now(timezone.utc).isoformat(),'runtime_written':False,'cocos_started':False,
    'render_threads':2,'max_samples':24,'review_images':images,'human_or_agent_visual_review':'See REVIEW.md; file checks alone are not visual acceptance.',
    'triangles':stats['triangles'],'vertices':stats['vertices'],'material_count':1,'bones':10,'half_frame_samples':sample_count,
    'connected_cloud_shells':source['files']['mist-bubble.blend']['cloud_connected_components'],
    'opaque_atlases':True,'roughness_gray_u8':gray,'embedded_pngs':embedded,
    'generator':generator.relative_to(ROOT).as_posix(),'generator_sha256':sha(generator),
    'original_sources':'Original script, fused closed cloud shell, UV palette/eye artwork, skin and keyframes. Internal A4/island/ink style references only; no external stock models, textures, animations or particles.',
    'files':[{'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in files]}
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'packaging':'pass','triangles':stats['triangles'],'samples':sample_count,'images':len(images),
                  'fbx_sha256':sha(HERE/'export/mist-bubble.fbx'),'runtime_written':False,'reference_sources_unchanged':True},indent=2))
