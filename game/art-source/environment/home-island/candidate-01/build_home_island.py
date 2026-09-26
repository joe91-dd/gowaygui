"""Original A-style home island. Source candidate only; never touches game resources/core/views.
Run only after root allocates the Blender slot. --export-only writes source/export/review scene.
Characters are not part of the exported collection; references are recorded separately.
"""
import bpy,bmesh,math,random,json,hashlib,sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
SOURCE=Path(__file__).resolve().parent;OUT=SOURCE;ROOT=SOURCE.parents[4]
PROPOSAL=json.loads((SOURCE/'layout-proposal.json').read_text(encoding='utf-8'))
RNG=random.Random(7086019)
EXPORT_ONLY='--export-only' in sys.argv
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.users==0:bpy.data.collections.remove(c)
COL=bpy.data.collections.new('EDITABLE_ISLAND_PARTS');bpy.context.scene.collection.children.link(COL)
OBJECTS=[];GROUPS={'Ground':[],'Landmarks_and_nature':[],'Pearl_and_lamps':[]};ANCHORS=[]

# Original compact colour/roughness atlas. Every runtime opaque surface uses it.
COLOURS=[
 (.22,.41,.25),(.34,.50,.28),(.49,.62,.35),(.76,.65,.44),
 (.19,.28,.28),(.44,.46,.39),(.75,.70,.55),(.27,.22,.15),
 (.15,.32,.06),(.30,.46,.08),(.43,.55,.14),(.29,.15,.05),
 (.47,.30,.11),(.05,.31,.31),(.10,.47,.42),(.035,.09,.085),
 (.76,.28,.17),(.77,.41,.40),(.09,.53,.52),(.40,.38,.55),
 (.86,.77,.60),(.96,.88,.71),(.50,.36,.21),(.93,.63,.23),
 (.10,.30,.28),(.28,.47,.37),(.60,.70,.53),(.70,.68,.51),
 (.13,.24,.25),(.19,.32,.22),(.81,.88,.80),(.43,.33,.22),
]
W,H,T=2048,1024,256
arr=np.ones((H,W,4),dtype=np.float32);rough=np.ones_like(arr)
yy,xx=np.mgrid[0:T,0:T].astype(np.float32);nr=np.random.default_rng(85920)
for i,c in enumerate(COLOURS):
    n=nr.normal(0,.007,(T,T))
    mar=.012*np.sin(xx*.041+np.sin(yy*.025)*2)*np.sin(yy*.060)
    if i in (0,1,2):
        mar=.041*np.sin(xx*.032+np.sin(yy*.034)*2)*np.sin(yy*.047)+.015*np.sin(xx*.29)*np.sin(yy*.25)
        n*=1.65
    if i in (11,12,31):mar=.018*np.sin(xx*.071+np.sin(yy*.017)*1.7)
    if i in (3,20):n*=.70;mar*=.45
    if i in (15,21,23):n*=.15;mar*=.1
    x0,y0=(i%8)*T,(i//8)*T
    for k in range(3):arr[y0:y0+T,x0:x0+T,k]=np.clip(c[k]+n+mar,0,1)
    r=(.27 if i in (4,28) else (.18 if i==13 else (.74 if i<4 else (.43 if i in (8,9,10) else (.22 if i==21 else .57)))))
    rough[y0:y0+T,x0:x0+T,:3]=r
def save_image(name,pixels,path,noncolor=False):
    img=bpy.data.images.new(name,width=W,height=H,alpha=True)
    if noncolor:img.colorspace_settings.name='Non-Color'
    img.pixels.foreach_set(pixels.ravel());img.filepath_raw=str(path);img.file_format='PNG';img.save();return img
colour=save_image('Island_original_colour',arr,OUT/'island-colour.png')
roughness=save_image('Island_original_roughness',rough,OUT/'island-roughness.png',True)
MAT=bpy.data.materials.new('Island_atlas');MAT.use_nodes=True
p=MAT.node_tree.nodes.get('Principled BSDF');p.inputs['Specular IOR Level'].default_value=.24
for img,socket in [(colour,'Base Color'),(roughness,'Roughness')]:
    tex=MAT.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img;MAT.node_tree.links.new(tex.outputs['Color'],p.inputs[socket])
GLOW=MAT.copy();GLOW.name='Warm_pearl_and_lamps'
gp=GLOW.node_tree.nodes.get('Principled BSDF');gp.inputs['Emission Color'].default_value=(.72,.80,.63,1);gp.inputs['Emission Strength'].default_value=.22

def world(x,y,z):return (x,-z,y)
def vworld(p):return Vector(world(*p))
def mesh(name,vertices,faces,tile=5,group='Landmarks_and_nature',smooth=False,uv_world=False):
    m=bpy.data.meshes.new(name+'_geometry');m.from_pydata([world(*p) for p in vertices],[],faces);m.update()
    ob=bpy.data.objects.new(name,m);COL.objects.link(ob)
    ob.data.materials.append(GLOW if group=='Pearl_and_lamps' else MAT)
    for f in m.polygons:f.use_smooth=smooth
    bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(m);bm.free()
    uv=m.uv_layers.new(name='AtlasUV')
    coords=np.array(vertices)
    mins=coords.min(axis=0);sizes=np.maximum(coords.max(axis=0)-mins,.0001)
    for face in m.polygons:
        normal=face.normal
        # Major-axis projection retains material grain on tops and cliff faces.
        dims=(0,2) if abs(normal.z)>.5 or uv_world else ((0,1) if abs(normal.y)>.5 else (2,1))
        for li in face.loop_indices:
            co=coords[m.loops[li].vertex_index]
            a=(co[dims[0]]-mins[dims[0]])/sizes[dims[0]]
            b=(co[dims[1]]-mins[dims[1]])/sizes[dims[1]]
            uv.data[li].uv=((tile%8+.025+a*.95)/8,(tile//8+.025+b*.95)/4)
    ob['atlas_tile']=tile;ob['part_group']=group;OBJECTS.append(ob);GROUPS[group].append(ob)
    return ob

def tube(name,pts,radius,tile=11,sides=8,group='Landmarks_and_nature'):
    pts=[Vector(p) for p in pts];vs=[]
    for i,pt in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        n=tangent.cross(Vector((0,1,0)))
        if n.length<.01:n=tangent.cross(Vector((0,0,1)))
        n.normalize();o=tangent.cross(n).normalized()
        r=radius[i] if isinstance(radius,list) else radius
        for j in range(sides):vs.append(tuple(pt+(n*math.cos(j*2*math.pi/sides)+o*math.sin(j*2*math.pi/sides))*r))
    fs=[]
    for k in range(len(pts)-1):
        for j in range(sides):fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return mesh(name,vs,fs,tile,group,True)

def rock(name,pos,scale,tile=5,angle=0,group='Landmarks_and_nature',sides=7):
    # Asymmetric chamfered polygon rock; authored rings, not scaled stock spheres.
    rad=[RNG.uniform(.86,1.10) for _ in range(sides)];vs=[]
    for ring,(f,h) in enumerate([(.72,-.5),(1,-.29),(.93,.28),(.63,.50)]):
        for j in range(sides):
            a=2*math.pi*j/sides+angle
            vs.append((pos[0]+math.cos(a)*scale[0]*rad[j]*f*.5,pos[1]+scale[1]*(h+RNG.uniform(-.055,.055)),pos[2]+math.sin(a)*scale[2]*rad[j]*f*.5))
    fs=[]
    for k in range(3):
        for j in range(sides):fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple(3*sides+j for j in range(sides))])
    return mesh(name,vs,fs,tile,group,True)

def oval(name,pos,scale,tile=21,group='Landmarks_and_nature',n=20,rings=12):
    vs=[];fs=[]
    for k in range(rings+1):
        a=math.pi*k/rings
        for j in range(n):
            b=j*2*math.pi/n;vs.append((pos[0]+scale[0]*math.sin(a)*math.cos(b),pos[1]+scale[1]*math.cos(a),pos[2]+scale[2]*math.sin(a)*math.sin(b)))
    for k in range(rings):
        for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    return mesh(name,vs,fs,tile,group,True)

def disc(name,x,z,y,r,height,tile=5,n=24,group='Landmarks_and_nature'):
    vs=[];fs=[]
    for rr,hh in [(r*.92,y),(r,y+height*.25),(r,y+height*.74),(r*.94,y+height)]:
        for j in range(n):
            a=2*math.pi*j/n;vs.append((x+rr*math.cos(a),hh,z+rr*math.sin(a)))
    for k in range(3):
        for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    fs.extend([tuple(range(n-1,-1,-1)),tuple(3*n+j for j in range(n))])
    return mesh(name,vs,fs,tile,group,False)

def anchor(name,x,y,z):
    ob=bpy.data.objects.new(name,None);COL.objects.link(ob);ob.location=world(x,y,z);ob.empty_display_size=.20;ANCHORS.append(ob)

def leaf(name,base,direction,length,width,tile=8,curve=.25,down=.2):
    base=Vector(base);d=Vector((direction[0],0,direction[1])).normalized();side=Vector((-d.z,0,d.x))
    vs=[];L=8
    for i in range(L+1):
        t=i/L;c=base+d*length*t+Vector((0,curve*math.sin(t*math.pi)-down*t*t,0))
        w=width*math.sin(math.pi*t)**.7
        for f in [-1,0,1]:
            p=c+side*w*f+Vector((0,(-abs(f))*.055*math.sin(t*math.pi),0));vs.append(tuple(p))
    fs=[]
    for k in range(L):
        fs.extend([(k*3,k*3+1,(k+1)*3+1,(k+1)*3),(k*3+1,k*3+2,(k+1)*3+2,(k+1)*3+1)])
    return mesh(name,vs,fs,tile,smooth=True)

def palm(i,x,z,h=2.3,lean=.25):
    ground=height(x,z);pts=[];radii=[]
    for k in range(12):
        t=k/11;pts.append((x+lean*t*t,ground+h*t,z+.12*math.sin(t*2)))
        radii.append(.205*(1-.36*t)*(1+.08*math.sin(k*2.4)))
    tube('Palm_%d_curved_trunk'%i,pts,radii,11,sides=9)
    for k in range(1,10):
        p=Vector(pts[k]);r=radii[k]+.015
        ring=[tuple(p+Vector((r*math.cos(j*2*math.pi/12),.012*math.sin(j*2*math.pi/12),r*math.sin(j*2*math.pi/12)))) for j in range(13)]
        tube('Palm_%d_bark_ring_%d'%(i,k),ring,.020,12,sides=5)
    crown=Vector(pts[-1]);oval('Palm_%d_crown'%i,tuple(crown),(.24,.20,.24),8,n=12,rings=8)
    for j in range(8):
        angle=j*math.pi/4+.23*i;d=Vector((math.cos(angle),0,math.sin(angle)));side=Vector((-d.z,0,d.x));length=RNG.uniform(1.10,1.6)
        spine=[]
        for k in range(11):
            t=k/10;p=crown+d*length*t+Vector((0,.34*math.sin(t*math.pi)-.55*t*t,0));spine.append(tuple(p))
        tube('Palm_%d_frond_spine_%d'%(i,j),spine,.020,9,sides=5)
        leaf('Palm_%d_broad_frond_%d'%(i,j),tuple(crown),(d.x,d.z),length,.24,8+j%3,curve=.34,down=.55)
        for k in range(1,9):
            t=k/10;c=Vector(spine[k]);spread=(.12+.23*math.sin(t*math.pi))*(1-t*.5)
            for sign in [-1,1]:
                tip=c+d*.26+side*spread*sign+Vector((0,-.085,0));root=c-d*.06
                mid=(root+tip)*.5+Vector((0,.028,0))
                verts=[tuple(root),tuple(mid+side*.060),tuple(tip),tuple(mid-side*.060)]
                mesh('Palm_%d_leaflet_%d_%d_%d'%(i,j,k,sign),verts,[(0,1,2),(0,2,3)],8+(j+k)%3,smooth=False)
    for j in range(3):
        a=j*2*math.pi/3;oval('Palm_%d_coconut_%d'%(i,j),tuple(crown+Vector((.18*math.cos(a),-.12,.18*math.sin(a)))),(.12,.15,.12),12,n=12,rings=8)

def bush(i,x,z,size=.5):
    h=height(x,z)+.015
    count=RNG.choice([5,7,9]);rotation=RNG.random()*6.28
    for j in range(count):
        a=j*2*math.pi/count+rotation+RNG.random()*.3
        leaf('Bush_%03d_leaf_%d'%(i,j),(x,h,z),(math.cos(a),math.sin(a)),size*RNG.uniform(.7,1.05),size*.24,8+j%3,curve=size*.40,down=-size*.06)
    # Central pointed bud anchors the rosette in the grass.
    leaf('Bush_%03d_new_leaf'%i,(x,h,z),(.2,1),size*.45,size*.13,10,curve=size*.70,down=-size*.26)

"""Own home-only composition; concatenated with our original geometry routines by the author step.
Not a standalone execution entry point. No combat route or gameplay rules.
"""
DISPLAY=PROPOSAL['anchors'];HOUSE=PROPOSAL['house'];CX,CZ=.05,-2.5
COURT=[(-4.4,-1.30),(-3.8,-1.55),(-1.0,-1.30),(0,-1.65),(1.7,-1.5),(3.2,-1.45),(3.6,-.6),(3.2,1.0),(2.7,3.55),(.3,3.93),(-2.2,3.65),(-4.1,3.35),(-4.45,1.4)]
def inside_polygon(x,z,poly=COURT):
    inside=False
    for (ax,az),(bx,bz) in zip(poly,poly[1:]+poly[:1]):
        if ((az>z)!=(bz>z)) and x<(bx-ax)*(z-az)/(bz-az)+ax:inside=not inside
    return inside
def boundary(th):
    c,s=math.cos(th),math.sin(th)
    f=1+.018*math.sin(5*th+.7)+.012*math.cos(9*th)
    return Vector((6.00*math.copysign(abs(c)**.72,c)*f,4.02*math.copysign(abs(s)**.72,s)*f))
def height(x,z):
    if inside_polygon(x,z):return .08
    # The display foreground is level; only the quiet back rim has small relief.
    return .08+.11*max(0,min(1,(-z-1.8)/1.7))*(.65+.35*math.sin(x*.8)**2)
def safe_decor(x,z,r):
    if any(math.hypot(x-a['x'],z-a['z'])<1.15+r for a in DISPLAY):return False
    if -.90<x<.90 and -1.65<z<.55:return False
    if -2.1<x<2.2 and z<-.90:return False
    return True
def flat_polygon(name,poly,y,tile=20,group='Ground'):
    vectors=[Vector((x,z,0)) for x,z in poly];tri=tessellate_polygon([vectors])
    # Blender 4.5 returns index triples here; retain compatibility with Vector-returning versions.
    faces=[tuple(p if isinstance(p,int) else min(range(len(vectors)),key=lambda i:(vectors[i]-p).length_squared) for p in t) for t in tri]
    return mesh(name,[(x,y,z) for x,z in poly],faces,tile,group,False,True)
def extrude_profile(name,profile,zfront,depth,tile=20,group='Landmarks_and_nature'):
    # profile in x/up plane, actual front/back faces and bevelled wall thickness.
    n=len(profile);vs=[(x,y,z) for z in [zfront,zfront-depth] for x,y in profile]
    fs=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    fs.extend((j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n))
    return mesh(name,vs,fs,tile,group,True)
def arched_profile(cx,bottom,spring,radius,n=20):
    p=[(cx-radius,bottom),(cx+radius,bottom),(cx+radius,spring)]
    p.extend((cx+radius*math.cos(j*math.pi/n),spring+radius*math.sin(j*math.pi/n)) for j in range(1,n+1))
    return p
def plank_box(name,center,size,tile=12):
    # True rectangular plank with clipped corners and bevelled top/bottom, not a diamond rock.
    x,y,z=center;w,h,d=size;cut=min(.035,w*.12,d*.1);vs=[];fs=[]
    for k,(inset,yy) in enumerate([(cut*.5,y-h/2),(0,y-h*.3),(0,y+h*.3),(cut*.5,y+h/2)]):
        a=w/2-inset;b=d/2-inset;c=cut
        outline=[(-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c)]
        vs.extend((x+px,yy,z+pz) for px,pz in outline)
    for k in range(3):
        for j in range(8):fs.append((k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j))
    fs.extend([tuple(range(7,-1,-1)),tuple(range(24,32))]);return mesh(name,vs,fs,tile,smooth=True)

# New modelled island perimeter and ground: no circular stage and no enemy road.
N,NR=96,14;vs=[];fs=[]
for k in range(NR+1):
    for j in range(N):
        q=boundary(j*2*math.pi/N)*(.972*k/NR);vs.append((q.x,height(q.x,q.y),q.y))
for k in range(NR):
    for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Home_continuous_grass',vs,fs,1,'Ground',True,True)
vs=[];fs=[]
for k,(radius,y) in enumerate([(.970,.07),(1.018,-.09),(1.018,-.31),(.94,-1.05)]):
    for j in range(N):
        q=boundary(j*2*math.pi/N)*radius;vs.append((q.x,y+.015*math.sin(j*.8),q.y))
for k in range(3):
    for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Home_warm_sand_rock_skirt',vs,fs,6,'Ground',True)
for i in range(48):
    a=i*2*math.pi/48;q=boundary(a)
    rock('Home_coast_block_%02d'%i,(q.x,-.28,q.y),(.58+RNG.random()*.35,.47+RNG.random()*.22,.48+RNG.random()*.22),[4,5,6][i%3],a)
for i in range(12):
    a=i*2*math.pi/12+.12;q=boundary(a)*1.028
    rock('Home_wet_foot_rock_%02d'%i,(q.x,-.73,q.y),(.60,.28,.43),4,a)
flat_polygon('Continuous_level_display_court',COURT,.16,20)
# Quiet irregular paving on a continuous flat support surface. Seams never remove the supporting floor.
for i in range(12):
    for j in range(9):
        x=-4.15+i*.64+(j%2)*.12;z=-1.15+j*.58
        poly=[(x-.28,z-.23),(x+.27,z-.25),(x+.32,z+.13),(x+.16,z+.25),(x-.26,z+.22)]
        if not all(inside_polygon(a,b) for a,b in poly):continue
        flat_polygon('Courtyard_paver_%02d_%02d'%(i,j),poly,.16025,[20,6,27][(i+j)%3])
for a in DISPLAY:
    # Flat continuous court provides all-yaw foot support; no avatar is exported with the island.
    for j in range(72):
        angle=j*math.pi/36;assert inside_polygon(a['x']+1.02*math.cos(angle),a['z']+1.02*math.sin(angle)),a['name']
    anchor(a['name'],a['x'],a['y'],a['z'])

# Low cream stone foundation supports an actual hollow-front masonry volume.
base=[(CX+2.02*math.sin(i*2*math.pi/32),CZ+1.27*math.cos(i*2*math.pi/32)) for i in range(32)]
flat_polygon('House_cream_foundation',base,.23,6,'Landmarks_and_nature')
for row in range(3):
    for j in range(18):
        a=j*2*math.pi/18+(row%2)*.10
        if min(a%(2*math.pi),2*math.pi-a%(2*math.pi))<.47:continue
        x=CX+1.55*math.sin(a);z=CZ+1.02*math.cos(a)
        rock('House_wall_masonry_%d_%02d'%(row,j),(x,.47+row*.48,z),(.66,.51,.61),20 if (row+j)%3 else 6,a,sides=7)
# Facade side shoulders and curved upper cornice close the silhouette above the doorway.
for x in [-1.18,1.28]:
    for k in range(3):rock('House_front_shoulder_%s_%d'%(x,k),(x,.49+k*.45,-1.39),(.57,.49,.54),20,sides=7)
for j in range(15):
    a=-1.36+j*2.72/14
    rock('House_rounded_cornice_%02d'%j,(CX+1.61*math.sin(a),1.75+.20*math.cos(a),CZ+1.05*math.cos(a)),(.50,.43,.53),6,a,sides=8)
# Teal double door: separate left/right leaf, recessed, curved boundary and simple round portholes.
door=arched_profile(CX,.24,1.22,.60)
extrude_profile('Door_recess_dark',arched_profile(CX,.22,1.24,.69),-1.271,.10,24)
extrude_profile('Door_teal_leaf_pair',door,-1.255,.065,14)
tube('Door_center_seam',[(CX,.25,-1.235),(CX,1.77,-1.235)],.013,24,sides=5)
for side in [-1,1]:
    for y in [.53,.98]:tube('Door_panel_seam_%s_%s'%(side,y),[(CX+side*.03,y,-1.228),(CX+side*.51,y,-1.228)],.008,13,sides=4)
    oval('Door_round_window_%s'%side,(CX+side*.24,1.36,-1.209),(.135,.135,.025),24,n=16,rings=8)
    oval('Door_round_knob_%s'%side,(CX+side*.10,.88,-1.192),(.049,.049,.031),23,n=12,rings=8)
for j in range(11):
    a=j*math.pi/10;x=CX+.77*math.cos(a);y=1.21+.77*math.sin(a)
    rock('Door_arch_ivory_block_%02d'%j,(x,y,-1.20),(.31,.30,.29),6 if j%3==0 else 20,-a,sides=7)
for side in [-1,1]:
    for k in range(3):rock('Door_jamb_%s_%s'%(side,k),(CX+side*.77,.43+k*.28,-1.20),(.29,.31,.30),20,sides=7)
anchor('House_door',CX,.24,-1.18)
# Two independent arched teal windows, low ledges and a tiny eave, all modelled in depth.
for side in [-1,1]:
    # Keep the facade window/ledge inside the house shoulder: the first wide ledge crossed
    # the actual full-sole envelope of the reserved right display position.
    x=CX+side*1.05
    extrude_profile('Window_stone_frame_%s'%side,arched_profile(x,.96,1.29,.20),-1.12,.15,6)
    extrude_profile('Window_teal_inset_%s'%side,arched_profile(x,1.01,1.29,.125),-1.101,.035,14)
    oval('Window_shadow_%s'%side,(x,1.28,-1.075),(.045,.074,.015),24,n=12,rings=8)
    rock('Window_ledge_%s'%side,(x,.95,-1.22),(.48,.14,.23),20,sides=8)

# Original shell roof: fluted, solid scallop fan rising behind a wide pearl cradle.
vs=[];fs=[];RADIAL,RAYS=12,32
for k in range(RADIAL+1):
    t=k/RADIAL;r=.055+2.00*t
    for j in range(RAYS+1):
        a=-1.15+j*2.30/RAYS;flute=.062*math.cos(a*13)*t
        vs.append((CX+math.sin(a)*r,2.23+math.cos(a)*r,CZ-.20-.40*math.sin(t*math.pi/2)+flute))
for k in range(RADIAL):
    for j in range(RAYS):fs.append((k*(RAYS+1)+j,k*(RAYS+1)+j+1,(k+1)*(RAYS+1)+j+1,(k+1)*(RAYS+1)+j))
fan=mesh('House_solid_fluted_shell_roof',vs,fs,20,smooth=True)
bpy.context.view_layer.objects.active=fan;fan.select_set(True)
solid=fan.modifiers.new('Authored_shell_thickness','SOLIDIFY');solid.thickness=.085;bpy.ops.object.modifier_apply(modifier=solid.name);fan.select_set(False)
for j in range(13):
    a=-1.13+j*2.26/12;pts=[]
    for k in range(13):
        t=.04+.96*k/12;r=.055+2*t;pts.append((CX+math.sin(a)*r,2.23+math.cos(a)*r,CZ-.12-.4*math.sin(t*math.pi/2)))
    tube('Roof_ivory_flute_%02d'%j,pts,.028,6,sides=6)
# Raised scalloped bowl around the pearl; openings and flutes are geometry, not texture decals.
for j in range(18):
    a=j*math.pi/9
    rock('Pearl_cradle_masonry_%02d'%j,(CX+1.36*math.sin(a),2.34,CZ+.70*math.cos(a)),(.42,.47,.39),20,a,sides=7)
oval('Home_warm_pearl',(CX,3.11,CZ+.13),(.57,.57,.57),21,'Pearl_and_lamps',n=28,rings=18)
anchor('Home_pearl',CX,3.11,CZ+.13)

# Left short wood pier with individual thick planks, stringers, peg heads and sparse rope rails.
for j in range(14):
    x=-7.26+j*.205
    plank_box('Dock_plank_%02d'%j,(x,-.025,1.35),(.200,.16,1.24),12 if j%3 else 11)
    for z in [.89,1.81]:oval('Dock_peg_%02d_%s'%(j,z),(x,.056,z),(.026,.015,.026),7,n=8,rings=4)
for z in [.90,1.80]:plank_box('Dock_underbeam_%s'%z,(-5.98,-.18,z),(3.05,.25,.16),11)
for i,(x,z) in enumerate([(-7.28,.76),(-7.28,1.94),(-5.03,.76),(-5.03,1.94)]):
    tube('Dock_post_%d'%i,[(x,-.92,z),(x,.41,z)],[.13,.105],11,sides=8)
    for y in [.18,.25]:
        ring=[(x+.113*math.cos(j*math.pi/6),y,z+.113*math.sin(j*math.pi/6)) for j in range(13)]
        tube('Dock_rope_wrap_%d_%s'%(i,y),ring,.022,22,sides=5)
for z in [.76,1.94]:tube('Dock_short_rope_%s'%z,[(-7.28,.34,z),(-6.16,.20,z),(-5.03,.34,z)],.031,22,sides=6)
anchor('Dock_landing',-4.76,.06,1.35)

# Few ropes and palms live on the rear shoulders, away from door/display silhouettes.
for side in [-1,1]:
    x=side*4.90;zs=[-2.8,-1.6,-.40]
    for i,z in enumerate(zs):
        tube('Side_fence_post_%s_%s'%(side,i),[(x,height(x,z),z),(x,height(x,z)+.62,z)],.075,11,sides=7)
        oval('Side_fence_cap_%s_%s'%(side,i),(x,height(x,z)+.65,z),(.115,.08,.115),12,n=12,rings=6)
    for i in range(2):tube('Side_fence_rope_%s_%s'%(side,i),[(x,.57,zs[i]),(x,.43,(zs[i]+zs[i+1])*.5),(x,.57,zs[i+1])],.028,22,sides=6)
for args in [(0,-4.35,-2.25,2.4,.22),(1,3.85,-2.65,2.65,-.18)]:palm(*args)
for i,(x,z) in enumerate([(-4.7,2.65),(-4.8,-.8),(-3.8,-3.25),(3.45,2.25),(4.75,.90),(4.5,-2.90)]):
    if safe_decor(x,z,.34):bush(i,x,z,.34)
for i in range(25):
    a=i*2*math.pi/25;q=boundary(a)*.88
    if not safe_decor(q.x,q.y,.28):continue
    rock('Quiet_home_grass_rock_%02d'%i,(q.x,height(q.x,q.y)+.11,q.y),(.42,.24,.32),5,a)
for i in range(20):
    a=i*math.pi/10;q=boundary(a)*1.04
    tube('Home_foam_%02d'%i,[(q.x-.18,-.70,q.y),(q.x,-.685,q.y+.02),(q.x+.18,-.70,q.y)],.016,30,sides=5,group='Ground')
anchor('Home_origin',0,0,0)

scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
for image in [colour,roughness]:image.pack()
manifest={'version':'home-island-candidate-01','status':'offline-model-generated-runtime-not-promoted','coordinateConvention':'Cocos x/y-up/z; Blender x/-z/y','nominalFootprintXZ':[12,8],'displayAnchors':DISPLAY,'displaySurfaceY':.16,'waterY':-.72,'houseDoor':[CX,.24,-1.18],'pearl':[CX,3.11,CZ+.13],'editableMeshes':len(OBJECTS),'cameraCandidate':PROPOSAL['cameraCandidate'],'characterReferences':PROPOSAL['characterSourceReferences'],'charactersExported':False,'noGameplayRoute':True,'authorship':'New home-only geometry, original own-project modules/UV/pigment atlas; no imported stock/game assets'}
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'home-island.blend'))
stats=[];exported=[]
for group,objects in GROUPS.items():
    if not objects:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=group
    ob.data.materials.clear();ob.data.materials.append(GLOW if group=='Pearl_and_lamps' else MAT)
    for p in ob.data.polygons:p.material_index=0
    stats.append({'name':group,'vertices':len(ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons)});exported.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in exported+ANCHORS:ob.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.fbx(filepath=str(SOURCE/'home-island.fbx'),use_selection=True,object_types={'MESH','EMPTY'},axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=False,path_mode='COPY',embed_textures=True)
points=[ob.matrix_world@v.co for ob in exported for v in ob.data.vertices]
manifest.update(runtimeMeshes=stats,totalTriangles=sum(p['triangles'] for p in stats),materials=2,fbxSha256=hashlib.sha256((SOURCE/'home-island.fbx').read_bytes()).hexdigest(),geometryBoundsCocos={'min':[min(p.x for p in points),min(p.z for p in points),min(-p.y for p in points)],'max':[max(p.x for p in points),max(p.z for p in points),max(-p.y for p in points)]})
assert manifest['totalTriangles']<=80000,manifest['totalTriangles']
(SOURCE/'environment-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
# Separate review-only ocean/camera/light scene. It is saved only after environment export.
sea=bpy.data.materials.new('PREVIEW_ONLY_home_ocean');sea.use_nodes=True
bs=sea.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.045,.29,.33,1);bs.inputs['Roughness'].default_value=.28
bpy.ops.mesh.primitive_plane_add(size=160,location=(0,0,-.72));water=bpy.context.object;water.name='PREVIEW_ONLY_OCEAN';water.data.materials.append(sea)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.72,.75,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.75
for name,typ,loc,power,col,size in [('Home_warm_sun','SUN',(-8,12,6),2.7,(1,.93,.78),10),('Home_soft_fill','AREA',(4,8,-7),1100,(.69,.85,1),10)]:
    lightdata=bpy.data.lights.new(name,typ);lightdata.energy=power;lightdata.color=col
    if typ=='AREA':lightdata.shape='DISK';lightdata.size=size
    if typ=='SUN':lightdata.angle=.17
    lightob=bpy.data.objects.new(name,lightdata);scene.collection.objects.link(lightob);lightob.location=world(*loc);lightob.rotation_euler=(-lightob.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Home_review_camera',bpy.data.cameras.new('Home_review_camera'));scene.collection.objects.link(camera);scene.camera=camera
cam=PROPOSAL['cameraCandidate'];camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
vfov=2*math.atan(math.tan(math.radians(cam['baseVerticalFovDegrees'])/2)*max(1,(1280/720)/(1000/700)));camera.data.lens=32/(2*math.tan(vfov/2))
camera.location=world(*cam['position']);camera.rotation_euler=(vworld(cam['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'home-island-review-scene.blend'))
if not EXPORT_ONLY:
    scene.render.filepath=str(SOURCE/'render-home-overview.png');bpy.ops.render.render(write_still=True)
print('HOME_ISLAND_EXPORT_COMPLETE '+json.dumps(manifest,ensure_ascii=False))
