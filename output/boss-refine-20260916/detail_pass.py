"""Authored geometry and packed PBR refinements for the existing CC0 boss rigs.
Executed in finish.py's namespace, before baking and consolidation.
"""
def soften_source(objects,rig,world):
 for o in objects:
  if not o.data.polygons or len(o.data.polygons)>12500:continue
  # Preserve the supplied anatomy and weights; subdivide the organic silhouette once.
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Refined organic silhouette','SUBSURF');mod.levels=1;mod.subdivision_type='CATMULL_CLARK'
  while list(o.modifiers).index(mod)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
  bpy.ops.object.modifier_apply(modifier=mod.name)
  # Pull oversized cartoon tongues back into the mouth without closing the jaw.
  for slot,m in enumerate(o.data.materials):
   if not m or 'tongue' not in m.name.lower():continue
   ids={i for p in o.data.polygons if p.material_index==slot for i in p.vertices}
   if not ids:continue
   center=sum((o.data.vertices[i].co for i in ids),Vector())/len(ids)
   for i in ids:
    v=o.data.vertices[i].co;v.x=center.x+(v.x-center.x)*.75;v.z=center.z+(v.z-center.z)*.72;v.y=center.y+(v.y-center.y)*.54+.045

def detailed_plate(name,at,w,h,thickness,mat,rig,bone):
 at=Vector(at);outline=[(0,1),(.68,.74),(1,.12),(.77,-.56),(0,-1),(-.77,-.56),(-1,.12),(-.68,.74)]
 verts=[tuple(at+Vector((x*w/2,0,z*h/2))) for x,z in outline]
 verts += [tuple(at+Vector((x*w/2,thickness,z*h/2))) for x,z in outline]
 verts.append(tuple(at+Vector((0,-thickness*.6,0))))
 faces=[(16,i,(i+1)%8) for i in range(8)]+[(i,i+8,(i+1)%8+8,(i+1)%8) for i in range(8)]+[tuple(range(15,7,-1))]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bevel=o.modifiers.new('Forged edge bevel','BEVEL');bevel.width=min(w,h)*.025;bevel.segments=2
 bpy.ops.object.modifier_apply(modifier=bevel.name);skin(o,rig,bone)
 return o

def detail_tube(name,points,radius,mat,rig,bone,taper=.25,chain=False):
 # Catmull-Rom centreline, circular cross section, smooth skin weights along the tube.
 points=[Vector(p) for p in points];samples=[];steps=(len(points)-1)*8;sides=8
 for i in range(steps+1):
  t=i/steps*(len(points)-1);j=min(len(points)-2,int(t));f=t-j
  a,b,c,d=points[max(0,j-1)],points[j],points[j+1],points[min(len(points)-1,j+2)]
  samples.append(.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f))
 verts=[];faces=[]
 for i,p in enumerate(samples):
  tangent=(samples[min(i+1,steps)]-samples[max(0,i-1)]).normalized();axis=tangent.cross(Vector((0,0,1)))
  if axis.length<.01:axis=tangent.cross(Vector((0,1,0)))
  axis.normalize();other=tangent.cross(axis).normalized();r=radius*(1-(1-taper)*(i/steps)**1.25)
  for k in range(sides):verts.append(tuple(p+r*(axis*math.cos(k*math.tau/sides)+other*math.sin(k*math.tau/sides))))
  if i:
   for k in range(sides):a=i*sides+k;b=i*sides+(k+1)%sides;faces.append((a-sides,b-sides,b,a))
 faces.extend([tuple(range(sides-1,-1,-1)),tuple(steps*sides+k for k in range(sides))])
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(mat);skin(o,rig,bone)
 if chain:
  bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT');inv=rig.matrix_world.inverted();bones=[]
  for k in range(4):
   b=rig.data.edit_bones.new(name+'_joint_'+str(k));b.head=inv@samples[round(steps*k/4)];b.tail=inv@samples[round(steps*(k+1)/4)];b.parent=rig.data.edit_bones.get(bones[-1] if bones else bone);bones.append(b.name)
  bpy.ops.object.mode_set(mode='OBJECT');o.vertex_groups.clear()
  groups=[o.vertex_groups.new(name=n) for n in bones]
  for i in range(steps+1):
   t=min(3,i/steps*4);j=min(3,int(t));f=t-j;ids=list(range(i*sides,(i+1)*sides));groups[j].add(ids,1-f,'REPLACE')
   if j<3 and f>0:groups[j+1].add(ids,f,'REPLACE')
  actions={s.action for t in rig.animation_data.nla_tracks for s in t.strips}
  for action in actions:
   rig.animation_data.action=action
   if len(action.slots):rig.animation_data.action_slot=action.slots[0]
   start,end=action.frame_range
   for k,n in enumerate(bones):
    b=rig.pose.bones[n];b.rotation_mode='XYZ'
    for step in range(9):
     f=step/8;frame=start+(end-start)*f;b.rotation_euler=(.09*math.sin(f*math.tau+k*.75),0,.11*math.sin(f*math.tau+k*.65));b.keyframe_insert('rotation_euler',frame=frame)
    b.rotation_euler=(0,0,0)
  rig.animation_data.action=None
 return o

def add_fine_details(record,rig,c):
 h=c['height'];mid=c['mid'];lo=c['lo'];depth=c['depth'];idx=c['idx'];world=c['world'];tier=c['tier'];key=c['key'];headbone=c['headbone'];chestbone=c['chestbone'];accent=c['accent'];gold=c['gold'];gem=c['gem'];ivory=c['ivory'];bonepos=c['bonepos']
 # Fit new trim to the actual front surface, not the overall tail/wing bounds.
 vertices=[o.matrix_world@v.co for o in c['source_objects'] for v in o.data.vertices]
 def front(x,z):
  near=sorted(vertices,key=lambda v:(v.x-x)**2+(v.z-z)**2)[:60]
  return min(v.y for v in near)-h*.014
 steel=material('Patinated edge steel','#263D4B',.40,.62);shadow=material('Armour seam','#182D38',.83);ivory.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.37
 # Engraved overlapping chest plates: real bevels and shadows, no oversized floating ring.
 z=c['z'];y=c['y'];rows=3 if world else 2
 for row in range(rows):
  for side in [-1,1]:
   at=Vector((mid.x+side*h*.059,y-h*.04,z+h*(.055-row*.061)))
   detailed_plate('Layered cuirass rim',at,h*.119,h*.089,h*.015,gold,rig,chestbone)
   detailed_plate('Layered enamel scale',at+Vector((0,-h*.012,0)),h*.103,h*.073,h*.009,accent,rig,chestbone)
   ellipsoid('Cuirass rivet',at+Vector((side*h*.033,-h*.020,h*.018)),(h*.009,h*.006,h*.009),gold,rig,chestbone,12)
 # Locate brows from the previously authored eye lenses; keep each face's own proportions.
 for eye in [o for o in meshes() if o.name.startswith('Iris lens')]:
  bpy.context.view_layer.update();at=eye.matrix_world.translation.copy();radius=max(eye.dimensions.x/2,.012);bone=eye.vertex_groups[0].name;side=-1 if at.x<mid.x else 1
  browpoints=[at+Vector((-radius*1.12,-radius*.12,radius*(.88-side*.20))),at+Vector((0,-radius*.20,radius*.83)),at+Vector((radius*1.12,-radius*.12,radius*(.88+side*.20)))]
  detail_tube('Sculpted upper orbital ridge',browpoints,radius*.17,accent,rig,bone,taper=.55)
  # Keep the eye rim organic; metal monocles obscured the expression.
 # Deliberate segmented shoulder plates, clasps, cuffs and attachment seams.
 if idx>=36:
  for sign,side in [(-1,'R'),(1,'L')]:
   at,bn=bonepos(['UpperArm.'+side,'Shoulder.'+side],(mid.x+sign*h*.26,mid.y,lo.z+h*.57))
   for j in range(3):
    p=at+Vector((sign*h*.015*j,0, -j*h*.037));p.y=front(p.x,p.z)-h*.006
    detailed_plate('Overlapping shoulder lamella',p,h*(.19-j*.022),h*.09,h*.022,steel if j==0 else accent,rig,bn)
    for a in [-1,1]:ellipsoid('Shoulder rivet',p+Vector((a*h*.055,-h*.02,h*.015)),(h*.010,h*.007,h*.010),gold,rig,bn,12)
   hand,bn=bonepos(['LowerArm.'+side,'UpperArm.'+side],tuple(at))
   for j in [-1,1]:detail_tube('Wrist cuff seam',[hand+Vector((h*.04,-h*.055,j*h*.022)),hand+Vector((0,-h*.072,j*h*.022)),hand+Vector((-h*.04,-h*.055,j*h*.022))],h*.006,gold,rig,bn,taper=1)
 # Every casting sceptre gets a socket, prongs and a smaller enclosed crystal.
 for crown in [o for o in meshes() if o.name.startswith('Tide sceptre crown')]:
  at=crown.matrix_world.translation.copy();bn=crown.vertex_groups[0].name
  for j in range(4):
   a=j*math.tau/4;start=at+Vector((math.cos(a)*h*.05,math.sin(a)*h*.05,0));end=at+Vector((math.cos(a)*h*.036,math.sin(a)*h*.036,h*.105))
   detail_tube('Sceptre setting prong',[start,start+Vector((0,0,h*.05)),end],h*.008,gold,rig,bn,taper=.5)
 if idx==58:
  head=Vector((mid.x,mid.y-depth*.05,lo.z+h*.92));head.y=front(head.x,head.z)
  ellipsoid('Captain carved skull',head,(h*.09,h*.074,h*.095),ivory,rig,headbone,24)
  for side in [-1,1]:
   eye=head+Vector((side*h*.033,-h*.072,h*.02));ellipsoid('Recessed skull socket',eye,(h*.023,h*.012,h*.026),shadow,rig,headbone,16)
   ellipsoid('Captain spirit eye',eye+Vector((0,-h*.011,0)),(h*.011,h*.006,h*.015),gem,rig,headbone,12)
  for j in range(5):detailed_plate('Skull tooth',head+Vector(((j-2)*h*.023,-h*.065,-h*.061)),h*.017,h*.035,h*.010,ivory,rig,headbone)
 if not world:return
 # Model-specific world-boss silhouettes.
 if key=='world-0':
  for sign in [-1,1]:
   for j in range(4):
    at=Vector((mid.x+sign*h*(.10+j*.013),0,lo.z+h*(.53-j*.060)));at.y=front(at.x,at.z)
    detailed_plate('Dragon breast scale',at,h*.10,h*.11,h*.018,accent,rig,chestbone)
   start=Vector((mid.x+sign*h*.16,mid.y+depth*.05,lo.z+h*.81))
   detail_tube('Curved dragon antler',[start,start+Vector((sign*h*.08,h*.06,h*.15)),start+Vector((sign*h*.14,h*.15,h*.18)),start+Vector((sign*h*.18,h*.22,h*.10))],h*.045,ivory,rig,headbone,taper=.05)
 elif key=='world-1':
  basalt=material('Lava basalt','#34343D',.82,.06)
  for sign in [-1,1]:
   at,bn=bonepos(['UpperArm.'+('L' if sign>0 else 'R')],(mid.x+sign*h*.28,mid.y,lo.z+h*.60))
   for j in range(4):
    p=at+Vector((sign*h*.022*j,0, -h*.035*j));p.y=front(p.x,p.z)-h*.025;detailed_plate('Basalt shoulder crust',p,h*.19,h*.12,h*.03,basalt,rig,bn)
    detail_tube('Inset ember fault',[p+Vector((-h*.06,-h*.023,h*.035)),p+Vector((-h*.01,-h*.040,0)),p+Vector((h*.044,-h*.024,-h*.03))],h*.0055,gem,rig,bn,taper=.65)
  detail_tube('Heart magma fissure',[Vector((mid.x-h*.08,y-h*.063,z+h*.07)),Vector((mid.x-h*.02,y-h*.065,z)),Vector((mid.x+h*.07,y-h*.060,z-h*.06))],h*.009,gem,rig,chestbone,taper=.6)
 elif key=='world-2':
  # Four multi-jointed living feelers, not rigid spikes glued to a squid's face.
  mantle=material('Abyss mantle','#493766',.48)
  for side in [-1,1]:
   for j in range(2):
    start=Vector((mid.x+side*h*(.17+j*.08),0,lo.z+h*.31));start.y=front(start.x,start.z)
    pts=[start,start+Vector((side*h*.10,-h*.08,-h*.14)),start+Vector((side*h*.20,-h*.16,-h*.27)),start+Vector((side*h*.32,-h*.23,-h*.31)),start+Vector((side*h*.39,-h*.25,-h*.15))]
    detail_tube('Abyss feeler '+str(side)+' '+str(j),pts,h*(.048-j*.009),mantle,rig,chestbone,taper=.045,chain=True)
 elif key=='world-3':
  rock=material('Glacial stone','#3C5963',.79,.04)
  for side in [-1,1]:
   at=Vector((mid.x+side*h*.29,0,lo.z+h*.60));at.y=front(at.x,at.z)
   detailed_plate('Glacial face bastion',at,h*.14,h*.25,h*.024,rock,rig,headbone)
   for j in range(3):
    p=Vector((mid.x+side*h*(.25+j*.06),mid.y,lo.z+h*(.81-j*.05)))
    spike('Crystal bastion',p,p+Vector((side*h*.11,h*.06,h*(.35-j*.035))),h*.065,gem,rig,headbone)
  detailed_plate('Glacial forehead crest',Vector((mid.x,front(mid.x,lo.z+h*.87),lo.z+h*.87)),h*.32,h*.19,h*.036,rock,rig,headbone)
 elif key=='world-4':
  for obj in [o for o in meshes() if o.name.startswith('Shoulder cannon housing')]:
   at=obj.matrix_world.translation.copy();bn=obj.vertex_groups[0].name
   for j in range(3):
    pts=[at+Vector((math.cos(a)*h*.087,-h*(.03+j*.057),math.sin(a)*h*.087)) for a in [k*math.tau/16 for k in range(17)]]
    detail_tube('Cannon forged reinforcing hoop',pts,h*.008,gold,rig,bn,taper=1)
   for side in [-1,1]:detailed_plate('Cannon cheek shield',at+Vector((side*h*.12,-h*.03,0)),h*.095,h*.16,h*.023,steel,rig,bn)
  for sign in [-1,1]:
   at,bn=bonepos(['LowerArm.'+('L' if sign>0 else 'R')],(mid.x+sign*h*.22,mid.y,lo.z+h*.4))
   detailed_plate('Captain vambrace',at+Vector((0,-h*.065,0)),h*.12,h*.17,h*.022,steel,rig,bn)

def bake_detail_maps(body,dest,key,resolution):
 scene=bpy.context.scene;originals=[]
 # Real tangent-space normal map from small-scale skin/metal sculpt shading.
 for m in body.data.materials:
  if not m or not m.use_nodes:continue
  p=m.node_tree.nodes.get('Principled BSDF')
  if not p:continue
  n=m.name.lower();tree=m.node_tree
  if not any(x in n for x in ['eye','pupil','iris','catchlight','gem']):
   tex=tree.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=95 if any(v in n for v in ['metal','brass','steel','enamel']) else 42;tex.inputs['Detail'].default_value=2
   bump=tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.23;bump.inputs['Distance'].default_value=.009;tree.links.new(tex.outputs['Fac'],bump.inputs['Height']);tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
  output=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL');originals.append((m,p,output))
 def target(name,colour):
  im=bpy.data.images.new(key+'_'+name,width=resolution,height=resolution,alpha=False);im.colorspace_settings.name='Non-Color';im.generated_color=colour
  for m,p,o in originals:n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;m.node_tree.nodes.active=n
  return im
 normal=target('normal',(.5,.5,1,1));scene.render.bake.normal_space='TANGENT';bpy.ops.object.bake(type='NORMAL');normal.filepath_raw=str(dest/(key+'_normal.png'));normal.file_format='PNG';normal.save();normal.pack()
 surface=target('surface',(1,.6,0,1))
 for m,p,output in originals:
  em=m.node_tree.nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(1,p.inputs['Roughness'].default_value,p.inputs['Metallic'].default_value,1);m.node_tree.links.new(em.outputs[0],output.inputs['Surface'])
 bpy.ops.object.bake(type='EMIT');surface.filepath_raw=str(dest/(key+'_surface.png'));surface.file_format='PNG';surface.save();surface.pack()
 for m,p,output in originals:m.node_tree.links.new(p.outputs[0],output.inputs['Surface'])
 return normal,surface
