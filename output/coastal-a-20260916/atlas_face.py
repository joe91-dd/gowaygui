def atlas_face(source_objects,rig,idx):
 # Pirate sharks store eyes in an atlas, not named materials. Rebuild only the
 # verified paired dark eye patches; do not place generic eyes by bounding box.
 if idx not in [55,56]:return
 white=material('Sculpted eye ivory','#F9F0D8',.36)
 amber=material('Sculpted eye amber','#DAA04D',.27)
 black=material('Sculpted pupil','#102B39',.28)
 sparkle=material('Sculpted eye glint','#FFF8E9',.18)
 rim=material('Sculpted eye brow','#244E68',.56)
 for o in list(source_objects):
  imgs=[n.image for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
  if not imgs or not o.data.uv_layers:continue
  pts=[o.matrix_world@v.co for v in o.data.vertices]
  lo=Vector([min(v[j] for v in pts) for j in range(3)]);hi=Vector([max(v[j] for v in pts) for j in range(3)]);h=hi.z-lo.z;mid=(hi+lo)/2
  if h<.4:continue
  im=imgs[0];pix=list(im.pixels);w,ih=im.size;uv=o.data.uv_layers.active.data;ids=set()
  for poly in o.data.polygons:
   for li in poly.loop_indices:
    u,v=uv[li].uv;x=min(w-1,max(0,int(u*w)));y=min(ih-1,max(0,int(v*ih)));col=pix[(y*w+x)*4:(y*w+x)*4+3];vi=o.data.loops[li].vertex_index
    if max(col)<.20 and pts[vi].z>lo.z+h*.74:ids.add(vi)
  print('ATLAS_EYE',o.name,im.name,len(ids),h,flush=True)
  for group in comp(o.data,ids):
   if len(group)<20:continue
   pp=[pts[i] for i in group];at=sum(pp,Vector())/len(pp);size=Vector([max(p[j] for p in pp)-min(p[j] for p in pp) for j in range(3)])
   print('EYE_PATCH',len(group),list(at),list(size),flush=True)
   if size.z>h*.15 or size.x>h*.12 or abs(at.x-mid.x)<h*.035 or at.z>lo.z+h*.97:continue
   weights={}
   for i in group:
    for g in o.data.vertices[i].groups:weights[o.vertex_groups[g.group].name]=weights.get(o.vertex_groups[g.group].name,0)+g.weight
   bone=max(weights,key=weights.get) if weights else 'Head';side=1 if at.x>mid.x else -1
   normal=Vector((side*.85,-.53,.03)).normalized();at+=normal*(max((point-at).dot(normal) for point in pp)+.009);tangent=Vector((.53,side*.85,0));up=Vector((0,0,1));r=max(size.z*.40,h*.016)
   slot=len(o.data.materials);o.data.materials.append(white);patch=set(group)
   for poly in o.data.polygons:
    if sum(i in patch for i in poly.vertices)>=len(poly.vertices)*.6:poly.material_index=slot
   def eye(name,center,scale,mat):
    n=ellipsoid(name,center,scale,mat,rig,bone,24);n.rotation_euler=normal.to_track_quat('Y','Z').to_euler();return n
   eye('Amber iris',at+normal*.004-tangent*side*r*.09,(r*.48,r*.18,r*.76),amber)
   eye('Focused slit',at+normal*.017-tangent*side*r*.09,(r*.22,r*.13,r*.58),black)
   eye('Wet eye glint',at+normal*.025+up*r*.30-tangent*r*.15,(r*.12,r*.10,r*.16),sparkle)
   points=[at+normal*.020-tangent*r+up*r*.96,at+normal*.043+up*r*.92,at+normal*.020+tangent*r+up*r*.69]
   detail_tube('Shark expressive brow',points,r*.15,rim,rig,bone,taper=.50)
