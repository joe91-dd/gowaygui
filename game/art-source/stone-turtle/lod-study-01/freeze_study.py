"""Hash this isolated study and verify every protected source/runtime byte."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
protected=json.loads((HERE/'protected-inputs.json').read_text())
for name,row in protected.items():
    p=ROOT/name
    assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],name
rows=[]
for p in sorted(HERE.rglob('*')):
    if not p.is_file() or p.name=='freeze-manifest.json' or p.suffix=='.blend1':continue
    rows.append({'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p),'bytes':p.stat().st_size})
payload={'status':'Root reviewed both close renders: preserve independent study; do not promote runtime; no FPS claim',
 'protected_files_unchanged':len(protected),'original_runtime_meta_untouched':True,
 'source_geometry':{'path':'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle-review-scene.blend','sha256':sha(HERE.parent/'candidate-12/c12b/stone-turtle-review-scene.blend')},
 'triangles':15465,'vertices':8745,'head_triangles_preserved':8064,
 'manual_review':['compare-original-close.png','compare-lod-close.png','compare-original-home-size.png','compare-lod-home-size.png','lod-attack-11.png','lod-hit-04.png'],
 'manual_findings':['Face/eye/muzzle and native home-scale silhouette remain readable','Close view shows harder stone bevels and slightly faceted palm/toe edges; not a final art approval'],
 'root_review':{'images':['compare-original-close.png','compare-lod-close.png'],'decision':'Do not promote this iteration','reason':'Face and eyes retain quality, but top plate planes and foot edge facets are more apparent'},
 'files':rows,'bytes_total':sum(r['bytes'] for r in rows)}
(HERE/'freeze-manifest.json').write_text(json.dumps(payload,indent=2),encoding='utf-8')
print(json.dumps({'protected_files':len(protected),'output_files':len(rows),'bytes_total':payload['bytes_total'],'fbx_sha256':sha(HERE/'export/stone-turtle-lod.fbx')}))
