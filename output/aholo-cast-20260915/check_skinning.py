import bpy, numpy as np,json
from pathlib import Path
root=Path(__file__).resolve().parent;out=root/'polished-yandun'
bpy.ops.wm.open_mainfile(filepath=str(out/'yandun-polished.blend'))
ob=bpy.data.objects['Yandun_Surface'];rig=bpy.data.objects['Yandun_Rig'];scene=bpy.context.scene
for track in rig.animation_data.nla_tracks:track.mute=True
base=np.array([v.co[:] for v in ob.data.vertices]);edges=np.array([e.vertices[:] for e in ob.data.edges]);orig=np.linalg.norm(base[edges[:,0]]-base[edges[:,1]],axis=1)
report=[]
for clip,frame in [('Attack_Combo',14),('Attack_Combo',35),('Rock_Storm',38),('Greeting',28)]:
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame)
    print('HAND_POSITION',clip,frame,[(n,tuple(round(c,3) for c in rig.pose.bones[n].head)) for n in ['hand.L','hand.R']])
    eo=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=eo.to_mesh();co=np.array([v.co[:] for v in me.vertices]);eo.to_mesh_clear()
    lengths=np.linalg.norm(co[edges[:,0]]-co[edges[:,1]],axis=1);d=lengths-orig
    worst=[]
    for i in np.argsort(d)[-5:][::-1]:
        e=edges[i];worst.append({'length':round(float(lengths[i]),4),'original':round(float(orig[i]),4),'base':np.round(base[e],4).tolist(),'weights':[{ob.vertex_groups[g.group].name:round(g.weight,3) for g in ob.data.vertices[vi].groups if g.weight>.02} for vi in e]})
    report.append({'clip':clip,'frame':frame,'edgesStretchedMoreThan15cm':int((d>.15).sum()),'worstEdges':worst})
(out/'skinning-check.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
