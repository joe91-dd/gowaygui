import bpy,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(HERE/'export/stone-turtle.fbx'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
result={'actions':[],'modifiers':[{'type':m.type,'show_viewport':m.show_viewport,'object':getattr(m,'object',None).name if getattr(m,'object',None) else None} for m in mesh.modifiers],'tests':[]}
for action in bpy.data.actions:
    curves=[]
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    if 'location' in curve.data_path or 'rotation' in curve.data_path:
                        coords=[tuple(p.co) for p in curve.keyframe_points]
                        if coords and max(y for x,y in coords)-min(y for x,y in coords)>.0001:curves.append({'path':curve.data_path,'index':curve.array_index,'first':coords[0],'min':min(y for x,y in coords),'max':max(y for x,y in coords)})
    result['actions'].append({'name':action.name,'range':list(action.frame_range),'slots':[{'identifier':s.identifier,'target':s.target_id_type} for s in action.slots],'moving_curves':curves[:8]})
idle=next(a for a in bpy.data.actions if a.name.endswith('|idle'))
for explicit in [False,True]:
    rig.animation_data.action=idle
    if explicit:rig.animation_data.action_slot=idle.slots[0]
    snapshots=[]
    for frame in [1,24,48,72]:
        bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
        dg=bpy.context.evaluated_depsgraph_get();evaluated=mesh.evaluated_get(dg);me=evaluated.to_mesh()
        snapshots.append({'frame':frame,'action_slot':str(rig.animation_data.action_slot),'root_location':list(rig.pose.bones['root'].location),'root_matrix':list(rig.pose.bones['root'].matrix.translation),'vertex0':list(evaluated.matrix_world@me.vertices[0].co)})
        evaluated.to_mesh_clear()
    result['tests'].append({'explicit_slot':explicit,'snapshots':snapshots})
(HERE/'action-debug.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
