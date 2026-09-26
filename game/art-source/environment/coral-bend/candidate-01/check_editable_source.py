"""Read the editable source blend and report portability; never modifies that blend."""
import bpy
import json
import hashlib
from pathlib import Path

SOURCE=Path(__file__).resolve().parent
blend=SOURCE/'coral-bend.blend'
bpy.ops.wm.open_mainfile(filepath=str(blend))
scene=bpy.context.scene
meshes=[o for o in scene.objects if o.type=='MESH']
anchors=[o.name for o in scene.objects if o.type=='EMPTY']
images=[i for i in bpy.data.images if i.size[0]>0]
assert len(meshes)>1000,'Editable components were flattened'
assert len({m.name for o in meshes for m in o.data.materials})==2
assert len(images)==2 and all(i.packed_file for i in images),'Source must include both packed atlas images'
assert all(tuple(i.size)==(2048,1024) for i in images)
assert scene.render.threads_mode=='FIXED' and scene.render.threads==2
assert scene.cycles.samples==32 and scene.cycles.device=='CPU'
assert scene.render.resolution_x==1000 and scene.render.resolution_y==700
assert not any('PREVIEW_ONLY' in o.name for o in scene.objects)
assert all('Slot_'+str(i) in anchors for i in range(5))
report={'status':'pass','sourceBlendSha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'editableMeshes':len(meshes),'anchors':anchors,'materials':2,'packedImages':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'colorspace':i.colorspace_settings.name} for i in images],'renderSettings':{'engine':scene.render.engine,'device':scene.cycles.device,'threads':scene.render.threads,'samples':scene.cycles.samples,'resolution':[scene.render.resolution_x,scene.render.resolution_y]},'notes':['Actual source blend reopened read-only; full editable part structure and packed textures verified.','Preview water/camera/lights are separate in coral-bend-review-scene.blend.']}
(SOURCE/'source-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
