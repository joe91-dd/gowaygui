"""A separate Blender sculpt study of the approved stone turtle.

Edits the saved mesh; does not regenerate the five-character cast or replace
the running game. The head is a continuous sculpt with recessed eye sockets.
"""
import bpy,math,json
from mathutils import Vector
from pathlib import Path
P=Path(__file__).resolve().parents[3]
SOURCE=P/'game/art-source/approved-cast/stone/stone.blend'
OUT=P/'output/stone-blender-r01'
OUT.mkdir(parents=True,exist_ok=True)
PI=math.pi
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
rig.data.pose_position='REST'
for o in list(bpy.context.scene.objects):
    if o.name.startswith(('Continuous facial','Lower muzzle','Eye globe','Iris ','Pupil','Eye catchlight','Eye secondary','Upper sculpted','Lower sculpted','Expression upper','Anatomical brow','Blink skin','Nostril','Recessed closed mouth')):
        bpy.data.objects.remove(o,do_unlink=True)

def material(name,color,rough=.5,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    c=tuple((int(color[i:i+2],16)/255)**2.2 for i in [0,2,4])+(1,)
    p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    m.diffuse_color=c;return m
skin=material('Sculpt golden skin','EDAF28',.50)
white=material('Warm eye white','FFF9DE',.24)
iris=material('Amber iris','B5650B',.24)
irislight=material('Golden iris rim','D99A24',.30)
pupil=material('Deep brown pupil','26190C',.20)
mouth=material('Soft recessed crease','855220',.75)
rock=material('Mineral charcoal','595457',.76)
edge=material('Mineral edge','746A63',.69)

def attach(o,name,mat,bone='head',smooth=True):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.name=name
    o.data.materials.clear();o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=smooth
    if bone:
        o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE')
        o.parent=rig;mod=o.modifiers.new('Existing skeleton','ARMATURE');mod.object=rig
    return o
def mesh(name,vs,fs,mat,bone='head',smooth=True):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    return attach(o,name,mat,bone,smooth)
def oval(name,c,s,mat,bone='head',n=40):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=24,location=c);o=bpy.context.object;o.scale=s;return attach(o,name,mat,bone)
def stroke(name,points,r,mat,bone='head',taper=True):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8;data.bevel_depth=r;data.bevel_resolution=3
    s=data.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for i,(v,p) in enumerate(zip(s.bezier_points,points)):
        v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
        if taper:v.radius=.25+.75*math.sin(PI*i/(len(points)-1))**.25
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return attach(bpy.context.object,name,mat,bone)

def front(x,z):
    # Continuous brow, broad short muzzle and cheek pads are part of the head.
    rad=max(.0001,1-(x/.565)**2-((z-2.20)/.415)**2)
    y=-.035-.365*math.sqrt(rad)
    y-=.170*math.exp(-((z-2.085)/.145)**4-(x/.49)**6)
    y-=.035*math.exp(-((z-2.205)/.095)**2-(x/.24)**4)
    for s in [-1,1]:
        y-=.040*math.exp(-((x-s*.39)/.105)**2-((z-2.105)/.11)**2)
        y+=.14*math.exp(-((x-s*.265)/.125)**4-((z-2.340)/.122)**4)
        browz=2.445+.20*(abs(x)-.265)
        y-=.078*math.exp(-((x-s*.267)/.145)**4-((z-browz)/.065)**2)
    return y

vs=[];fs=[];nx=112;nz=80
for j in range(nz+1):
    theta=-PI/2+PI*j/nz
    for i in range(nx):
        a=i*2*PI/nx;x=.565*math.cos(theta)*math.sin(a);z=2.20+.415*math.sin(theta)
        y=-.035+.365*math.cos(theta)*math.cos(a)
        if math.cos(a)<0:
            base=-.035-.365*math.sqrt(max(.0001,1-(x/.565)**2-((z-2.20)/.415)**2))
            y+=(front(x,z)-base)*min(1,max(0,-math.cos(a))/.42)
        vs.append((x,y,z))
        if j:
            k=j*nx+i;b=j*nx+(i+1)%nx;fs.append((k-nx,b-nx,b,k))
head=mesh('Stone continuous facial sculpt',vs,fs,skin)
skin_parts=[head]

def eye_border(s,a,scale=1):
    u=math.cos(a);e=math.sin(a)
    x=s*.267+.135*u*scale
    z=2.342+(.098 if e>=0 else .114)*e*scale+.035*u*s
    return Vector((x,-.377-.035*abs(e),z))

for s,side in [(-1,'L'),(1,'R')]:
    x=s*.267;z=2.342
    # Skin annulus blends the almond opening into the continuous skull.
    vv=[];ff=[];steps=64;rings=9
    for j in range(rings+1):
        t=j/rings
        for i in range(steps):
            a=i*2*PI/steps;p=eye_border(s,a,1+.42*t);p.y=(eye_border(s,a).y-.010)*(1-t)+(front(p.x,p.z)+.004)*t
            p.y-=.027*math.sin(PI*t)
            vv.append(tuple(p))
            if j:k=j*steps+i;b=j*steps+(i+1)%steps;ff.append((k-steps,k,b,b-steps))
    # A closed rim volume is essential: voxel-union of an open sheet creates
    # ragged gaps at the socket. The rear wall enters the skull.
    count=len(vv);vv += [(x,y+.055,z) for x,y,z in vv]
    ff += [tuple(k+count for k in reversed(f)) for f in list(ff)]
    for row in [0,rings]:
        for i in range(steps):
            a=row*steps+i;b=row*steps+(i+1)%steps;ff.append((a,b,b+count,a+count))
    socket=mesh('Integrated orbital rim '+side,vv,ff,skin);skin_parts.append(socket)
    # White is an almond-shaped convex patch rather than a protruding ball.
    vv=[];ff=[];rows=26;cols=38
    for j in range(rows+1):
        v=-1+2*j/rows
        for i in range(cols+1):
            u=-1+2*i/cols;e=math.sqrt(max(0,1-u*u));zz=z+(.098 if v>0 else .114)*e*v+.035*u*s
            vv.append((x+.133*u,-.382-.067*e*math.sqrt(max(0,1-v*v)),zz))
            if j and i:k=j*(cols+1)+i;ff.append((k-cols-2,k-cols-1,k,k-1))
    # Iris/pupil are painted on the SAME curved eye surface. Separate flattened
    # spheres were creating the protruding button eyes visible in quarter view.
    eye_mat=material('Corneal iris paint '+side,'FFF9DE',.20)
    p=eye_mat.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.55;p.inputs['Coat Roughness'].default_value=.08
    eye=mesh('Inset painted eye '+side,vv,ff,eye_mat)
    ix=x-s*.009;iz=z-.008
    def rgb(hex):return tuple((int(hex[i:i+2],16)/255)**2.2 for i in [0,2,4])
    uv=eye.data.uv_layers.new(name='IrisCoordinates')
    for poly in eye.data.polygons:
        for li in poly.loop_indices:
            v=eye.data.vertices[eye.data.loops[li].vertex_index].co
            uv.data[li].uv=((v.x-ix)/.082,(v.z-iz)/.094)
    tree=eye_mat.node_tree;n=tree.nodes;l=tree.links
    coord=n.new('ShaderNodeTexCoord');length=n.new('ShaderNodeVectorMath');length.operation='LENGTH';l.new(coord.outputs['UV'],length.inputs[0])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
    stops=[(0,'211609'),(.49,'211609'),(.54,'583005'),(.62,'C08A2D'),(.80,'DCA64B'),(.90,'9D661C'),(.975,'603508'),(.995,'FFF9E6'),(1,'FFF9E6')]
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1]);ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=rgb(stops[0][1])+(1,)
    for at,color in stops[1:]:el=ramp.color_ramp.elements.new(at);el.color=rgb(color)+(1,)
    l.new(length.outputs['Value'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    # A low heavy brow with fused roots gives the stone turtle a firm gaze.
    brow=[(s*.104,-.364,2.402),(s*.23,-.420,2.467),(s*.35,-.356,2.490),(s*.46,-.263,2.456)]
    skin_parts.append(stroke('Heavy integrated brow '+side,brow,.036,skin))
    oval('Recessed nostril '+side,(s*.072,front(s*.072,2.208)-.005,2.208),(.012,.006,.016),mouth,n=20)

# A short broad smile follows the actual muzzle surface.
points=[]
for i in range(25):
    x=-.398+.796*i/24;q=abs(x)/.398;z=2.037+.050*q**3
    points.append((x,front(x,z)-.002,z))
stroke('Muzzle crease',points,.0048,mouth,'head')
for s in [-1,1]:
    points=[(s*.393,front(s*.393,2.085)-.004,2.085),(s*.416,front(s*.416,2.106)-.005,2.106),(s*.433,front(s*.433,2.133)-.003,2.133)]
    stroke('Cheek smile dimple',points,.0045,mouth)

# Fuse skin forms while keeping eyes and crease geometry independently editable.
bpy.ops.object.select_all(action='DESELECT')
for ob in skin_parts:
    for mod in list(ob.modifiers):ob.modifiers.remove(mod)
    ob.select_set(True)
bpy.context.view_layer.objects.active=head;bpy.ops.object.join();head=bpy.context.object
rem=head.modifiers.new('Continuous sculpt surface','REMESH');rem.mode='VOXEL';rem.voxel_size=.0065;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=head.modifiers.new('Relax orbital transition','SMOOTH');sm.factor=.42;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
head.vertex_groups.clear();head.vertex_groups.new(name='head').add(list(range(len(head.data.vertices))),1,'REPLACE')
mod=head.modifiers.new('Existing skeleton','ARMATURE');mod.object=rig

# Carve shallow inter-finger valleys into the existing continuous hand mesh.
body=bpy.data.objects.get('Unified deforming skin')
if body:
    for v in body.data.vertices:
        for s in [-1,1]:
            if abs(v.co.x-s*.9401)<.22 and .83<v.co.z<1.10 and v.co.y<-.32:
                carve=sum(.014*math.exp(-((v.co.x-(s*.9401+d))/.016)**2-((v.co.z-.96)/.105)**2) for d in [-.053,.053])
                v.co.y+=carve
    body.data.materials[0]=skin

# Armor stays broad and coherent: change actual mineral forms without a
# different random color on every triangle.
def mineral(name,c,scale,bone,normal=(0,-1,0)):
    outline=[(-.86,.36),(-.45,.91),(.20,1),(.82,.56),(.96,-.16),(.48,-.85),(-.33,-.92),(-.98,-.26)]
    q=Vector(normal).to_track_quat('Z','Y');vv=[];ff=[];n=len(outline)
    for radius,h in [(1,-.40),(1,.16),(.80,.59)]:
        for x,z in outline:vv.append(tuple(Vector(c)+q@Vector((x*scale[0]*radius,z*scale[1]*radius,h*scale[2]))))
    vv.append(tuple(Vector(c)+q@Vector((scale[0]*.05,scale[1]*.03,scale[2]*.72))))
    ff.append(tuple(range(n-1,-1,-1)))
    for row in range(2):
        for i in range(n):a=row*n+i;b=row*n+(i+1)%n;ff.append((a,b,b+n,a+n))
    for i in range(n):ff.append((2*n+i,2*n+(i+1)%n,3*n))
    ob=mesh(name,vv,ff,rock,bone,False)
    bpy.context.view_layer.objects.active=ob
    bevel=ob.modifiers.new('Soft worn stone edge','BEVEL');bevel.width=.011;bevel.segments=3;bpy.ops.object.modifier_apply(modifier=bevel.name)
    return ob

for ob in list(bpy.context.scene.objects):
    if ob.type!='MESH':continue
    if ob.name.startswith(('Shoulder mass','Solid shoulder rock','Wrist stone bracer','Ankle rock guard','Forehead crown')):
        bpy.data.objects.remove(ob,do_unlink=True);continue
    if ob.name.startswith(('Shoulder mass','Wrist stone bracer','Carapace scute','Ankle rock guard','Forehead crown','Temple armor')):
        ob.data.materials.clear();ob.data.materials.append(rock if 'Carapace' in ob.name else edge)
        center=sum((v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices)
        for v in ob.data.vertices:
            d=v.co-center
            v.co.y+=.008*math.sin(d.x*18+d.z*9)*math.cos(d.z*14)
        for f in ob.data.polygons:f.use_smooth=False
    if ob.name.startswith('Back blue crystal'):
        for v in ob.data.vertices:
            if v.co.z>1.8:v.co.z+=.18
    if ob.name.startswith('Paired abdominal scute'):
        for v in ob.data.vertices:v.co.z=1.1+(v.co.z-1.1)*1.026

for s,side in [(-1,'L'),(1,'R')]:
    mineral('Irregular major shoulder '+side,(s*.66,-.16,1.68),(.365,.285,.29),'upper_'+side,(s*.20,-1,.43))
    mineral('Shoulder outer overlapping stone '+side,(s*.85,.00,1.57),(.23,.20,.24),'upper_'+side,(s*.65,-.6,.18))
    for j in range(3):
        mineral('Shell collar mineral '+side+str(j),(s*(.40+j*.10),-.19,1.98-j*.14),(.125,.14,.14),'shell',(s*.3,-1,.1))
    for j in range(5):
        a=PI+.22+j*(PI-.44)/4
        mineral('Wrapped wrist stone '+side+str(j),(s*.9401+math.cos(a)*.165,-.24+math.sin(a)*.13,1.18),(.118,.17,.16),'fore_'+side,(math.cos(a)*.55,math.sin(a),.1))
    for j in range(3):
        a=PI+.30+j*(PI-.6)/2
        mineral('Wrapped ankle stone '+side+str(j),(s*.4522+math.cos(a)*.19,-.08+math.sin(a)*.19,.32),(.16,.145,.14),'shin_'+side,(math.cos(a)*.5,math.sin(a),.3))
for x in [-.28,0,.28]:mineral('Shaped brow crown',(x,-.10,2.57),(.20,.12,.13),'head',(x*.3,-.8,.5))

# Mineral coloration belongs to the material, not random per-face paint.
for name in ['aqua','aquaLight','aquaDeep']:
    m=bpy.data.materials.get(name)
    if m:
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.40;p.inputs['Coat Roughness'].default_value=.16
        p.inputs['Roughness'].default_value=.20

# Neutral lighting with a defined key/fill ratio, avoiding the washed-out
# flat studio illumination of the previous comparison renders.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Quiet warm studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.75,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.22
for name,loc,power,size in [('Key',(-3,-4,5),480,3.4),('Fill',(4,-2,3),85,4),('Rim',(2,3,4),300,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()
floor=material('Ivory floor','EFEAE1',.85);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
cam=bpy.data.cameras.new('Inspection camera');o=bpy.data.objects.new('Inspection camera',cam);bpy.context.collection.objects.link(o);scene.camera=o;cam.type='ORTHO'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'stone-sculpt-r01.blend'))
for name,pos,target,scale in [('face-front',(0,-8,2.32),(0,-.15,2.25),1.43),('face-quarter',(4,-7,2.70),(0,-.15,2.25),1.62),('full-front',(0,-8,2.20),(0,0,1.52),3.65),('full-quarter',(4,-7,2.70),(0,0,1.52),3.65)]:
    o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();cam.ortho_scale=scale;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('SCULPT_RENDER_DONE',name,flush=True)
report={'source':str(SOURCE),'output':str(OUT/'stone-sculpt-r01.blend'),'character':'岩盾','status':'sculpt study; not approved or integrated','continuousHeadVertices':len(head.data.vertices),'gameAssetsChanged':False,'changes':['continuous skull and muzzle','recessed almond eye sockets','integrated heavy brow','inter-finger valleys','mineral surface refinement','neutral comparison lighting']}
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('STONE_SCULPT_STUDY_DONE',flush=True)
