import bpy,json,sys,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'temp/enemy-gait-20260926';out.mkdir(parents=True,exist_ok=True)
reports=[]
for key in ['m01','m02','m03','m04','m05','b01','b02']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=root/'assets/resources/models-enemy-g1'/key
    source=next(iter(folder.glob('*.fbx')),None)
    if source:bpy.ops.import_scene.fbx(filepath=str(source))
    else:bpy.ops.import_scene.gltf(filepath=str(next(folder.glob('*.glb'))))
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    actions=list(bpy.data.actions)
    walk=next((a for a in actions if a.name.startswith(rig.name+'|') and a.name.lower().endswith('walk')),None)
    report={'key':key,'bones':list(rig.data.bones.keys()),'actions':[a.name for a in actions]}
    if walk:
        rig.animation_data_create();rig.animation_data.action=walk
        if hasattr(walk,'slots') and len(walk.slots):rig.animation_data.action_slot=walk.slots[0]
        for track in rig.animation_data.nla_tracks:track.mute=True
        frames=[walk.frame_range[0]+(walk.frame_range[1]-walk.frame_range[0])*x for x in [0,.25,.5,.75,1]]
        poses=[]
        for f in frames:
            bpy.context.scene.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
            deps=bpy.context.evaluated_depsgraph_get();points=[]
            for obj in bpy.data.objects:
                if obj.type!='MESH' or obj.name.startswith('FX_'):continue
                evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
                points.extend([list(evaluated.matrix_world@v.co) for v in mesh.vertices]);evaluated.to_mesh_clear()
            poses.append(points)
        base=poses[0];zmin=min(p[2] for p in base);height=max(p[2] for p in base)-zmin
        feet=[i for i,p in enumerate(base) if p[2]<zmin+height*.28]
        distances=[max(math.dist(base[i],pose[i]) for pose in poses) for i in feet]
        report.update(frames=frames,height=height,footVertices=len(feet),footMotionMax=max(distances),footMotionMean=sum(distances)/len(distances),walkCurves=len(walk.fcurves))
    reports.append(report)
(out/'source-rig-audit.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
for r in reports:print(json.dumps(r,ensure_ascii=False))
