import hashlib,json,re
from pathlib import Path
from PIL import Image

here=Path(__file__).resolve().parent
root=here.parents[3]
clearance=json.loads((here/'animation-clearance.json').read_text())
roundtrip=json.loads((here/'round-trip-check.json').read_text())
complete=json.loads((here/'review-complete.json').read_text())
assert complete['protected_files_unchanged']
promotion_path=here/'promotion-manifest.json'
promotion=json.loads(promotion_path.read_text(encoding='utf-8')) if promotion_path.exists() else None
protected={**json.loads((here/'protected-inputs.json').read_text())['sha256'],**complete['sha256']}
for key,value in protected.items():
    original=root/key
    check=original
    # The candidate-review evidence predates the explicitly authorized promotion.
    # Preserve its v10 hash check against the archived original; do not rewrite it.
    if promotion and '/assets/resources/' in original.as_posix():
        archived=next(item for item in promotion['before_runtime'] if item['name']==original.name)
        check=root/archived['archive_path']
    assert hashlib.sha256(check.read_bytes()).hexdigest()==value,str(check)
if promotion:
    from runtime_promotion import verify
    promotion_verification=verify()
assert hashlib.sha256((here/'export/stone-turtle.fbx').read_bytes()).hexdigest()==roundtrip['fbx_sha256']
assert sum(len(value['samples']) for value in clearance['clips'].values())==88
assert all(value['maximum_head_transform_change']>.0001 and value['maximum_shell_candidates']==value['maximum_leg_candidates']==0 for value in clearance['clips'].values())
assert len(roundtrip['clips'])==6
assert all(value['max_vertex_motion_m']>.0001 and value['loop_seam_m']<.0001 for value in roundtrip['clips'].values())
links=re.findall(r'(?:href|src)="([^"]+)"',(here/'review.html').read_text(encoding='utf-8'))
assert all((here/file).is_file() for file in links)
images=sorted(set(file for file in links if file.endswith('.png')))
assert len(images)==13
for file in images:
    with Image.open(here/file) as image:image.verify()
print(json.dumps({'gallery_images':len(images),'links_ok':True,'source_motion_samples':88,'fbx_motion_samples':sum(int(2*(value['last']-value['first'])+1) for value in roundtrip['clips'].values()),'protected_v10_sources_and_archive_verified':True,'runtime_promoted_to_c11':bool(promotion),'candidate_fbx_sha256':roundtrip['fbx_sha256']},indent=2))
