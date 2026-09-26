"""A separate Blender sculpt study of the approved stone turtle.

Edits the saved mesh; does not regenerate the five-character cast or replace
the running game. The head is a continuous sculpt with recessed eye sockets.
"""
import bpy,bmesh,math,json,random,sys
from mathutils import Vector
from mathutils.kdtree import KDTree
from pathlib import Path
P=Path(__file__).resolve().parents[3]
SOURCE=P/'game/art-source/approved-cast/stone/stone.blend'
OUT=P/'output/stone-blender-r02'
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
skin=material('Sculpt golden skin','F2AD25',.47)
white=material('Warm eye white','FFF9DE',.24)
iris=material('Amber iris','B5650B',.24)
irislight=material('Golden iris rim','D99A24',.30)
pupil=material('Deep brown pupil','26190C',.20)
mouth=material('Soft recessed crease','855220',.75)
rock=material('Mineral charcoal','595457',.76)
edge=material('Mineral edge','746A63',.69)
belly=material('Curved ivory plastron','F5D89E',.53)
for mat,scale,strength in [(skin,66,.11),(rock,22,.16),(belly,34,.08)]:
    tree=mat.node_tree;n=tree.nodes;l=tree.links
    noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=3
    bump=n.new('ShaderNodeBump');bump.inputs['Distance'].default_value=.010;bump.inputs['Strength'].default_value=strength
    l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],n.get('Principled BSDF').inputs['Normal'])

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
    z=2.342+(.079 if e>=0 else .103)*e*scale+.035*u*s
    return Vector((x,-.383-.016*abs(e),z))

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
            u=-1+2*i/cols;e=math.sqrt(max(0,1-u*u));zz=z+(.079 if v>0 else .103)*e*v+.035*u*s
            vv.append((x+.133*u,-.386-.047*e*math.sqrt(max(0,1-v*v)),zz))
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
            uv.data[li].uv=((v.x-ix)/.093,(v.z-iz)/.106)
    tree=eye_mat.node_tree;n=tree.nodes;l=tree.links
    coord=n.new('ShaderNodeTexCoord');length=n.new('ShaderNodeVectorMath');length.operation='LENGTH';l.new(coord.outputs['UV'],length.inputs[0])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='LINEAR'
    stops=[(0,'160F09'),(.62,'160F09'),(.68,'704009'),(.75,'B57721'),(.85,'D2983B'),(.94,'7D4517'),(.978,'4E2B14'),(.993,'FFF9E6'),(1,'FFF9E6')]
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1]);ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=rgb(stops[0][1])+(1,)
    for at,color in stops[1:]:el=ramp.color_ramp.elements.new(at);el.color=rgb(color)+(1,)
    l.new(length.outputs['Value'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    # A low heavy brow with fused roots gives the stone turtle a firm gaze.
    brow=[(s*.108,-.385,2.390),(s*.225,-.431,2.455),(s*.34,-.380,2.484),(s*.448,-.284,2.460)]
    skin_parts.append(stroke('Heavy integrated brow '+side,brow,.055,skin))
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

# Rebuild the anatomical transition volumes. The old limb tubes ended in flat
# caps, visible above the knees even after remeshing. Keep the original rig and
# transfer its joint weights to the continuous sculpt, without replacing clips.
body=bpy.data.objects.get('Unified deforming skin')
if body:
    names={g.index:g.name for g in body.vertex_groups};source=[]
    for v in body.data.vertices:source.append((v.co.copy(),{names[g.group]:g.weight for g in v.groups}))
    tree=KDTree(len(source))
    for i,(co,w) in enumerate(source):tree.insert(co,i)
    tree.balance();bpy.data.objects.remove(body,do_unlink=True)
    forms=[]
    def volume(name,c,scale):
        ob=oval(name,c,scale,skin,None);forms.append(ob);return ob
    def muscle(name,a,b,width,depth):
        a,b=Vector(a),Vector(b);ob=volume(name,(a+b)*.5,(width,depth,(b-a).length*.5+width*.42))
        center=(a+b)*.5;q=(b-a).to_track_quat('Z','Y')
        for v in ob.data.vertices:v.co=center+q@(v.co-center)
        return ob
    volume('Sculpt torso volume',(0,.015,1.20),(.645,.408,.67))
    volume('Sculpt hip bridge',(0,.055,.76),(.58,.33,.28))
    for s,side in [(-1,'L'),(1,'R')]:
        muscle('Rounded biceps '+side,(s*.64,0,1.59),(s*.875,-.065,1.29),.257,.245)
        volume('Elbow connection '+side,(s*.888,-.07,1.285),(.20,.198,.20))
        muscle('Forearm volume '+side,(s*.885,-.09,1.28),(s*.94,-.24,1.065),.23,.215)
        volume('Palm volume '+side,(s*.94,-.29,.993),(.183,.142,.169))
        # Separate curled digits emerge from a continuous palm. Valleys are
        # actual negative space at the fingertips, rather than painted lines.
        for i in range(3):
            xx=s*.94+(i-1)*.117
            volume('Knuckle '+side+str(i),(xx,-.425,1.018),(.066,.078,.073))
            volume('Curled finger '+side+str(i),(xx,-.427,.945),(.064,.073,.101))
            volume('Finger return '+side+str(i),(xx,-.351,.875),(.056,.074,.053))
        muscle('Thumb thenar '+side,(s*.821,-.30,1.039),(s*.755,-.407,.969),.077,.080)
        volume('Opposed thumb tip '+side,(s*.803,-.463,.924),(.078,.063,.070))
        muscle('Rounded quadriceps '+side,(s*.38,.025,.76),(s*.445,-.07,.37),.263,.251)
        volume('Knee volume '+side,(s*.444,-.12,.41),(.227,.208,.207))
        muscle('Short calf '+side,(s*.445,-.04,.37),(s*.452,-.065,.18),.185,.199)
        volume('Planted foot '+side,(s*.452,-.22,.150),(.314,.365,.149))
        for i in range(3):volume('Rounded toe '+side+str(i),(s*.452+(i-1)*.167,-.464,.112),(.106,.151,.110))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in forms:ob.select_set(True)
    bpy.context.view_layer.objects.active=forms[0];bpy.ops.object.join();body=bpy.context.object;body.name='Continuous anatomical body sculpt'
    rem=body.modifiers.new('Weld anatomy','REMESH');rem.mode='VOXEL';rem.voxel_size=.009;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=body.modifiers.new('Sculpt surface relaxation','SMOOTH');sm.factor=.65;sm.iterations=5;bpy.ops.object.modifier_apply(modifier=sm.name)
    groups={}
    for v in body.data.vertices:
        weights={}
        for co,i,d in tree.find_n(v.co,3):
            for name,w in source[i][1].items():weights[name]=weights.get(name,0)+w/(d*d+.00001)
        chosen=sorted(weights.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for n,w in chosen)
        for name,w in chosen:
            if name not in groups:groups[name]=body.vertex_groups.new(name=name)
            groups[name].add([v.index],w/total,'REPLACE')
    body.parent=rig;mod=body.modifiers.new('Existing skeleton','ARMATURE');mod.object=rig

# Eight ivory scutes follow one convex belly surface, with a narrow seam and
# a rounded perimeter. Radial surface rings prevent the old flat n-gon panels.
for ob in list(bpy.context.scene.objects):
    if ob.name.startswith(('Paired abdominal scute','Plastron underlayer')):bpy.data.objects.remove(ob,do_unlink=True)
def belly_surface(x,z):return -.272-.299*math.sqrt(max(.08,1-(x/.72)**2-((z-1.13)/.79)**2))
foundation=oval('Fitted plastron foundation',(0,-.305,1.13),(.553,.23,.601),material('Plastron seam ochre','C69953',.68),'spine')
# The foundation follows the same analytic surface as the plates, avoiding a
# dark empty shelf behind every seam.
for v in foundation.data.vertices:
    if v.co.y<-.305:v.co.y=belly_surface(v.co.x,v.co.z)+.024
rows=[(.55,.77,.19,.355),(.783,1.040,.367,.517),(1.053,1.340,.520,.522),(1.353,1.700,.520,.338)]
for row,(lo,hi,low,high) in enumerate(rows):
    for s,side in [(-1,'L'),(1,'R')]:
        outline=[(.009,lo+.029),(low*.85,lo+.015),(low,lo+.065),(high,hi-.072),(high*.82,hi-.014),(.027,hi),(.009,hi-.033)]
        # Evenly subdivided polygon border retains the approved paired shape.
        border=[]
        for i,a in enumerate(outline):
            b=outline[(i+1)%len(outline)]
            for k in range(4):t=k/4;border.append((s*(a[0]*(1-t)+b[0]*t),a[1]*(1-t)+b[1]*t))
        cx=s*(low+high)*.235;cz=(lo+hi)*.5;n=len(border);vv=[];ff=[]
        for j in range(10):
            r=.04+.96*j/9
            for x,z in border:
                x=cx+(x-cx)*r;z=cz+(z-cz)*r
                y=belly_surface(x,z)-.004-.012*(1-r*r)+.012*max(0,(r-.88)/.12)**2
                vv.append((x,y,z))
            if j:
                for i in range(n):a=j*n+i;b=j*n+(i+1)%n;ff.append((a-n,b-n,b,a))
        ff.append(tuple(range(n-1,-1,-1)))
        start=len(vv)
        for x,z in border:vv.append((x,belly_surface(x,z)+.027,z))
        for i in range(n):a=9*n+i;b=9*n+(i+1)%n;ff.append((a,b,start+(i+1)%n,start+i))
        ff.append(tuple(range(start,start+n)))
        ob=mesh('Convex paired plastron '+side+str(row),vv,ff,belly,'chest' if row>1 else 'spine')
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')

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

# Real closed crystal volumes with uneven mineral facets. A continuous
# crystalline material replaces unrelated flat blue colors on adjacent faces.
crystal=material('Azure refractive mineral','009EEB',.115,.06)
tree=crystal.node_tree;n=tree.nodes;l=tree.links;p=n.get('Principled BSDF')
p.inputs['Coat Weight'].default_value=.65;p.inputs['Coat Roughness'].default_value=.075
p.inputs['Transmission Weight'].default_value=.18;p.inputs['IOR'].default_value=1.46
tex=n.new('ShaderNodeTexCoord');separate=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],separate.inputs[0])
depth_ramp=n.new('ShaderNodeValToRGB');depth_ramp.color_ramp.elements[0].color=(.001,.055,.62,1)
depth_ramp.color_ramp.elements[1].color=(.003,.55,.94,1)
l.new(separate.outputs['Z'],depth_ramp.inputs[0]);l.new(depth_ramp.outputs[0],p.inputs['Base Color'])
l.new(depth_ramp.outputs[0],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.20
for ob in list(bpy.context.scene.objects):
    if ob.name.startswith(('Back blue crystal','Wrist crystal','Blue toe crystal')):bpy.data.objects.remove(ob,do_unlink=True)
def gem(name,base,scale,bone,tilt=0,seed=0):
    rng=random.Random(792+seed);points=[];count=7
    q=Vector((math.sin(tilt),0,math.cos(tilt))).to_track_quat('Z','Y')
    for row,(h,r) in enumerate([(0,.52),(.18,1),(.53,.94),(.77,.65)]):
        for i in range(count):
            a=i*2*PI/count+.05*(row%2);radius=r*(.87+.20*rng.random())
            local=Vector((math.cos(a)*scale[0]*radius,math.sin(a)*scale[1]*radius,(h+.03*rng.random())*scale[2]))
            points.append(tuple(Vector(base)+q@local))
    points.append(tuple(Vector(base)+q@Vector((scale[0]*.14,scale[1]*-.08,scale[2]))))
    me=bpy.data.meshes.new(name);bm=bmesh.new()
    for pnt in points:bm.verts.new(pnt)
    bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False);bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);attach(ob,name,crystal,bone,False)
    bevel=ob.modifiers.new('Polished mineral edges','BEVEL');bevel.width=.003;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
    return ob
for i,(x,y,z,h,width,tilt) in enumerate([(0,.53,2.13,.84,.265,0),(-.35,.49,2.05,.62,.182,-.15),(.35,.49,2.05,.62,.182,.15),(-.65,.35,1.82,.44,.151,-.38),(.65,.35,1.82,.44,.151,.38)]):
    gem('Faceted carapace crystal '+str(i),(x,y,z),(width,width*.85,h),'shell',tilt,i)
for s,side in [(-1,'L'),(1,'R')]:
    gem('Wrist crystalline inlay '+side,(s*1.065,-.435,1.09),(.103,.080,.34),'fore_'+side,s*.26,11)
    for i in range(3):gem('Crystalline toe '+side+str(i),(s*.452+(i-1)*.167,-.562,.016),(.089,.10,.19),'foot_'+side,(i-1)*.17,20+i)

# Neutral lighting with a defined key/fill ratio, avoiding the washed-out
# flat studio illumination of the previous comparison renders.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
world=bpy.data.worlds.new('Quiet warm studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.75,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.22
for name,loc,power,size in [('Key',(-3,-4,5),480,3.4),('Eye softbox',(-1.6,-4,3.1),60,1.4),('Fill',(4,-2,3),85,4),('Rim',(2,3,4),300,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.4))-o.location).to_track_quat('-Z','Y').to_euler()
floor=material('Ivory floor','EFEAE1',.85);bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
cam=bpy.data.cameras.new('Inspection camera');o=bpy.data.objects.new('Inspection camera',cam);bpy.context.collection.objects.link(o);scene.camera=o;cam.type='ORTHO'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.20
o.location=(4,-7,2.70);o.rotation_euler=(Vector((0,0,1.52))-o.location).to_track_quat('-Z','Y').to_euler();cam.ortho_scale=3.65
bpy.ops.object.select_all(action='DESELECT');head.select_set(True);bpy.context.view_layer.objects.active=head
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active;space.region_3d.view_location=(0,0,1.5);space.region_3d.view_distance=4.4
            space.region_3d.view_rotation=o.rotation_euler.to_quaternion();space.region_3d.view_perspective='ORTHO'
            space.overlay.show_floor=False;space.shading.color_type='MATERIAL';space.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'stone-sculpt-r02.blend'))
views=[('full-front',(0,-8,2.20),(0,0,1.52),3.65),('full-quarter',(4,-7,2.70),(0,0,1.52),3.65),('face-front',(0,-8,2.32),(0,-.15,2.25),1.43),('face-quarter',(4,-7,2.70),(0,-.15,2.25),1.62)]
if '--quick' in sys.argv:
    views=views[:2];scene.cycles.samples=20;scene.render.resolution_percentage=75
for name,pos,target,scale in views:
    o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();cam.ortho_scale=scale;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    print('SCULPT_RENDER_DONE',name,flush=True)
report={'source':str(SOURCE),'output':str(OUT/'stone-sculpt-r02.blend'),'blenderVersion':bpy.app.version_string,'character':'岩盾','status':'sculpt study; not approved or integrated','continuousHeadVertices':len(head.data.vertices),'continuousBodyVertices':len(body.data.vertices),'gameAssetsChanged':False,'changes':['continuous skull and muzzle','recessed almond eye sockets','integrated heavy brow','rounded leg and hand anatomy','convex paired plastron','closed faceted crystal volumes with refraction','mineral surface refinement','neutral comparison lighting']}
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('STONE_SCULPT_STUDY_DONE',flush=True)
