import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
keys=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['fauna-01','fauna-17','fauna-27','fauna-41','fauna-55','boss-00','boss-03','world-0','world-3','world-4']
report=[]
for key in keys:
 d=R/'production'/key;bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(d/(key+'.fbx')))
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];actions=list(bpy.data.actions);clips=[]
 for rig in rigs:
  if rig.animation_data:
   for track in rig.animation_data.nla_tracks:track.mute=True
 for name in ['idle','walk','attack','skill']:
  action=next((a for a in actions if (a.name.endswith('|'+name) or a.name==name) and any('pose.bones' in f.data_path for f in a.fcurves)),None)
  if not action:raise RuntimeError(key+' missing '+name)
  for r in rigs:
   r.animation_data.action=action
   if len(action.slots):r.animation_data.action_slot=action.slots[0]
  for fraction in [0,.35,.7]:
   frame=action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*fraction;bpy.context.scene.frame_set(int(frame));bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();points=[]
   for o in meshes:
    e=o.evaluated_get(deps);me=e.to_mesh();points.extend(e.matrix_world@v.co for v in me.vertices);e.to_mesh_clear()
   lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)];size=[hi[i]-lo[i] for i in range(3)]
   assert all(math.isfinite(v) for v in [*lo,*hi]);assert max(size)<12,(key,name,size)
   clips.append({'clip':name,'fraction':fraction,'bounds':[lo,hi]})
 report.append({'key':key,'clips':clips,'materials':sum(len(o.data.materials) for o in meshes),'bones':sum(len(r.data.bones) for r in rigs)})
 print('EXPORT_CHECK',key,flush=True)
(R/'export-validation.json').write_text(json.dumps(report,indent=2))
