import bpy, json, numpy as np
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'models/yandun_glb.glb'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj; obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
cs=np.array([v.co[:] for v in obj.data.vertices]); lo=cs.min(0); hi=cs.max(0)
cs=(cs-np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]]))*2.4/(hi[2]-lo[2])
obj.data.vertices.foreach_set('co',cs.ravel()); obj.data.update()
mat=obj.data.materials[0]
report={'nodes':[{'type':n.type,'name':n.name,'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None} for n in mat.node_tree.nodes], 'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in mat.node_tree.links], 'bounds':[cs.min(0).tolist(),cs.max(0).tolist()]}
tex=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
pix=np.array(tex.pixels[:]).reshape(tex.size[1],tex.size[0],4)
uv=obj.data.uv_layers.active.data
rows=[]
for z in np.arange(1.55,2.06,.05):
    row=[]
    for x in np.arange(-.35,.36,.05):
        hit,loc,norm,fi=obj.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
        if hit:
            face=obj.data.polygons[fi]; tuv=np.mean([uv[i].uv[:] for i in face.loop_indices],axis=0)
            rgb=pix[int(tuv[1]*(tex.size[1]-1)),int(tuv[0]*(tex.size[0]-1)),:3]
            row.append({'x':round(x,3),'y':round(loc.y,3),'z':round(z,3),'rgb':[round(float(a),3) for a in rgb]})
    rows+=row
report['frontFaceSamples']=rows
(root/'probe.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='frontFaceSamples'}))
print('EYE_SAMPLES', json.dumps([v for v in rows if v['z']>=1.8 and abs(v['x'])>=.1]))
