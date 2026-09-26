import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=r'C:/Users/Administrator/Documents/ChatGPT/gowaygui/output/enemy-g1-production-20260917/production/B01/b01.fbx')
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for a in bpy.data.actions:
 print('ACTION',a.name,'frames',list(a.frame_range),'slots',[(s.identifier,s.target_id_type) for s in a.slots])
 for fc in list(a.fcurves)[:6]:print(fc.data_path,fc.array_index,len(fc.keyframe_points),[(tuple(k.co)) for k in list(fc.keyframe_points)[0:4]])
print('TRACKS',[(t.name,t.mute) for t in rig.animation_data.nla_tracks])

