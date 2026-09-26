import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
P=json.loads((R/'plan.json').read_text('utf8'));src=P['fauna'][55]
bpy.ops.wm.open_mainfile(filepath=str(R.parent/'g1-polish-20260916/production/fauna-55/fauna-55.blend'))
for r in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
 r.data.pose_position='REST'
 if r.animation_data:
  r.animation_data.action=None
  for t in r.animation_data.nla_tracks:t.mute=True
print('FACE_MESHES')
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 points=[o.matrix_world@v.co for v in o.data.vertices];lo=[min(v[j] for v in points) for j in range(3)];hi=[max(v[j] for v in points) for j in range(3)]
 print(o.name,lo,hi,[g.name for g in o.vertex_groups])
 imgs=[n.image for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
 if not imgs or not o.data.uv_layers:continue
 im=imgs[0];pix=list(im.pixels);w,h=im.size;uv=o.data.uv_layers.active.data;ids=set()
 for poly in o.data.polygons:
  for loop in poly.loop_indices:
   u,v=uv[loop].uv;x=min(w-1,max(0,int(u*w)));y=min(h-1,max(0,int(v*h)));rgb=pix[(y*w+x)*4:(y*w+x)*4+3]
   vi=o.data.loops[loop].vertex_index;p=points[vi]
   if max(rgb)<.20 and p.z>lo[2]+(hi[2]-lo[2])*.7:ids.add(vi)
 adj={i:set() for i in ids}
 for e in o.data.edges:
  a,b=e.vertices
  if a in ids and b in ids:adj[a].add(b);adj[b].add(a)
 while ids:
  todo=[ids.pop()];part=[]
  while todo:
   i=todo.pop();part.append(i)
   for j in adj[i]:
    if j in ids:ids.remove(j);todo.append(j)
  pts=[points[i] for i in part];center=sum(pts,Vector())/len(pts)
  print('DARK',len(part),list(center),[[min(p[j] for p in pts),max(p[j] for p in pts)] for j in range(3)])
