"""Fast read-only packaging check; uses Python/Pillow, never starts Blender."""
from pathlib import Path
import json,hashlib,re
from PIL import Image

here=Path(__file__).resolve().parent
stats=json.loads((here/'model-stats.json').read_text(encoding='utf-8'))
fbx=json.loads((here/'round-trip-check.json').read_text(encoding='utf-8'))
source=json.loads((here/'source-check.json').read_text(encoding='utf-8'))
assert fbx['status']==source['status']=='pass'
assert hashlib.sha256((here/'export/runner-crab.fbx').read_bytes()).hexdigest()==stats['fbx_sha256']==fbx['fbx_sha256']
assert fbx['triangles']<=12000 and len(fbx['materials'])==1 and len(fbx['bones'])==16
assert sum(clip['samples'] for clip in fbx['clips'].values())==269
for name,clip in fbx['clips'].items():
    assert clip['maximum_vertex_motion_m']>.001 and clip['minimum_z_m']>-.002
    if name in ('idle','walk','attack','hit'):assert clip['first_last_seam_m']<.0001
for name,data in source['files'].items():
    assert hashlib.sha256((here/name).read_bytes()).hexdigest()==data['sha256']
links=re.findall(r'(?:href|src)="([^"]+)"',(here/'review.html').read_text(encoding='utf-8'))
assert all((here/link).is_file() for link in links)
images=[link for link in links if link.endswith('.png')]
assert len(images)==6
for link in images:
    with Image.open(here/link) as image:image.verify()
for name in ('runner-colour.png','runner-roughness.png'):
    with Image.open(here/'export'/name) as image:
        assert image.size==(512,512)
        assert image.convert('RGBA').getchannel('A').getextrema()==(255,255)
print(json.dumps({'packaging':'pass','review_images':len(images),'half_frame_animation_samples':269,
                  'triangles':fbx['triangles'],'fbx_sha256':fbx['fbx_sha256']},indent=2))
