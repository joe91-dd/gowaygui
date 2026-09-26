"""Read-only packaging check; never starts Blender/Cocos."""
from pathlib import Path
import hashlib,json,re
from PIL import Image
here=Path(__file__).resolve().parent
def read(name):return json.loads((here/name).read_text(encoding='utf-8-sig'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
stats=read('model-stats.json');fbx=read('round-trip-check.json');source=read('source-check.json')
assert fbx['status']==source['status']=='pass'
assert sha(here/'export/armored-crab.fbx')==stats['fbx_sha256']==fbx['fbx_sha256']
assert fbx['triangles']<=14000 and len(fbx['materials'])==1 and len(fbx['bones'])==16
assert sum(clip['samples'] for clip in fbx['clips'].values())==347
for name,clip in fbx['clips'].items():
    assert clip['maximum_vertex_motion_m']>.001 and clip['minimum_z_m']>-.002
    if name in ('idle','walk','attack','hit'):assert clip['first_last_seam_m']<.0001
for name,data in source['files'].items():assert sha(here/name)==data['sha256']
comparison=read('comparison-manifest.json')
assert sha(Path(comparison['runner_source']))==comparison['runner_source_sha256']
for path,digest in read('battle-camera-manifest.json')['source_hashes_unchanged'].items():assert sha(Path(path))==digest
links=re.findall(r'(?:href|src)="([^"]+)"',(here/'review.html').read_text(encoding='utf-8'))
assert all((here/link).is_file() for link in links)
images=[link for link in links if link.endswith('.png')];assert len(images)==6
for link in images:
    with Image.open(here/link) as image:image.verify()
for name in ('armored-colour.png','armored-roughness.png'):
    with Image.open(here/'export'/name) as image:
        assert image.size==(512,512) and image.convert('RGBA').getchannel('A').getextrema()==(255,255)
print(json.dumps({'packaging':'pass','review_images':6,'half_frame_samples':347,'triangles':fbx['triangles'],
                  'protected_reference_sources_unchanged':True,'fbx_sha256':fbx['fbx_sha256']},indent=2))
