"""Check editable source portability and head-envelope preservation."""
import bpy
import json
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'game/art-source/stone-turtle'
report={}
for label,directory in [('v09',SOURCE/'versions/v09'),('v10',SOURCE/'candidate-10'),('canonical_v10',SOURCE)]:
    entry={}
    for filename in ['stone-turtle.blend','stone-turtle-review-scene.blend']:
        bpy.ops.wm.open_mainfile(filepath=str(directory/filename))
        images=[i for i in bpy.data.images if i.source=='FILE']
        assert len(images)==2,(label,filename,[i.name for i in images])
        assert all(i.packed_file for i in images),(label,filename,'Missing packed image')
        entry[filename]={'packed_images':[{'name':i.name,'png_bytes':i.packed_file.size,'size':list(i.size),'sha256':hashlib.sha256(i.packed_file.data).hexdigest()} for i in images]}
        if filename=='stone-turtle.blend':
            head=bpy.data.objects['Head_sculpt']
            lo=[min(v.co[i] for v in head.data.vertices) for i in range(3)]
            hi=[max(v.co[i] for v in head.data.vertices) for i in range(3)]
            entry['head_dimensions_m']=[round(b-a,6) for a,b in zip(lo,hi)]
    report[label]=entry
ratios=[new/old for old,new in zip(report['v09']['head_dimensions_m'],report['v10']['head_dimensions_m'])]
assert max(ratios)<1.025,('Head enlarged beyond intended envelope',ratios)
report['head_size_ratio_v10_to_v09']=ratios
assert report['canonical_v10']['head_dimensions_m']==report['v10']['head_dimensions_m']
report['source_check']='pass'
report['runtime_fbx_sha256']=hashlib.sha256((ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx').read_bytes()).hexdigest()
(SOURCE/'source-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
