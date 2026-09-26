import bpy,json,numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent;src=root.parent/'aholo-pro-cast-20260915/g1/runtime-v2'
report=[]
for key in ['yandun','yeling','shange','yangguang','chaoxing']:
 bpy.ops.wm.open_mainfile(filepath=str(src/key/(key+'.blend')),load_ui=False)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');body=next(o for o in bpy.data.objects if o.type=='MESH' and '_Body' in o.name)
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.animation_data.action=None
 for pb in rig.pose.bones:pb.matrix_basis.identity()
 bpy.context.view_layer.update()
 hand=rig.data.bones['hand.L'];inv=hand.matrix_local.inverted();group=body.vertex_groups['hand.L'].index
 points=[v.co.copy() for v in body.data.vertices if any(g.group==group and g.weight>.6 for g in v.groups)]
 local=np.array([(inv@p)[:] for p in points]);centroid=np.median(np.array([p[:] for p in points]),axis=0)
 grip=bpy.data.objects.get('FX_Weapon_Grip')
 meshes=[o for o in bpy.data.objects if o.type=='MESH' and '_Body' not in o.name]
 report.append(dict(key=key,handBoneHead=list(hand.head_local),handBoneTail=list(hand.tail_local),localQuantiles=np.quantile(local,[0,.1,.25,.5,.75,.9,1],axis=0).tolist(),handMedian=centroid.tolist(),grip=list(grip.matrix_world.translation) if grip else None,weapons=[dict(name=o.name,location=list(o.matrix_world.translation),vertices=len(o.data.vertices)) for o in meshes]))
(root/'hands-before.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('HANDS_AUDITED')
