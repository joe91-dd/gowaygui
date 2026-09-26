"""Original editable tutorial island, derived from the project's tidal-island v04 modules.

No imported stock geometry/textures. World interface uses Cocos x/y(up)/z;
conversion to Blender is (x,-z,y). Level 0 geometry is generated from its live route.
Writes ONLY to this candidate directory, never runtime. --export-only skips rendering.
"""
import bpy
import bmesh
import math
import random
import json
import re
import hashlib
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[5]
SOURCE=Path(__file__).resolve().parent
OUT=SOURCE
SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
RNG=random.Random(708501)
EXPORT_ONLY='--export-only' in sys.argv
DATA=ROOT/'game/assets/scripts/core/data.ts'
data=DATA.read_text(encoding='utf-8')
def points(s):return [{'x':float(x),'z':float(z)} for x,z in re.findall(r'x:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)',s)]
route=points(re.search(r"id:0,name:.*?route:\[(.*?)\]",data,re.S).group(1))
slots=points(re.search(r'const slots\s*=\s*\[(.*?)\]',data,re.S).group(1))
assert len(route)==5 and len(slots)==5
assert route==[{'x':-9.,'z':0.},{'x':-4.,'z':0.},{'x':0.,'z':0.},{'x':4.,'z':0.},{'x':9.,'z':0.}]
ROUTE=[Vector((p['x'],p['z'])) for p in route]
SLOTS=[Vector((p['x'],p['z'])) for p in slots]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection':bpy.data.collections.remove(c)
COL=bpy.data.collections.new('EDITABLE_ISLAND_PARTS');bpy.context.scene.collection.children.link(COL)
OBJECTS=[];GROUPS={'Ground':[],'Landmarks_and_nature':[],'Pearl_and_lamps':[]};ANCHORS=[]

# Original compact colour/roughness atlas. Every runtime opaque surface uses it.
COLOURS=[
 (.31,.38,.11),(.41,.46,.17),(.50,.54,.23),(.69,.54,.34),
 (.40,.335,.23),(.50,.46,.35),(.70,.62,.46),(.26,.21,.14),
 (.14,.265,.043),(.28,.405,.060),(.40,.47,.10),(.26,.125,.035),
 (.43,.265,.082),(.065,.26,.235),(.10,.39,.36),(.034,.068,.045),
 (.65,.225,.10),(.61,.30,.32),(.075,.41,.45),(.31,.30,.465),
 (.79,.67,.49),(.91,.77,.57),(.50,.34,.18),(.90,.47,.10),
 (.09,.25,.22),(.22,.42,.36),(.53,.65,.48),(.66,.60,.41),
 (.38,.39,.29),(.21,.265,.15),(.78,.79,.67),(.47,.30,.12),
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
    r=.75 if i<4 else (.43 if i in (8,9,10) else (.22 if i==21 else .57))
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
gp=GLOW.node_tree.nodes.get('Principled BSDF');gp.inputs['Emission Color'].default_value=(.72,.40,.11,1);gp.inputs['Emission Strength'].default_value=.35

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

def route_distance(x,z):
    q=Vector((x,z));result=999
    for a,b in zip(ROUTE,ROUTE[1:]):
        d=b-a;t=max(0,min(1,(q-a).dot(d)/d.length_squared));result=min(result,(q-(a+t*d)).length)
    return result

def height(x,z):
    d=route_distance(x,z);pad=min((Vector((x,z))-p).length for p in SLOTS)
    mask=max(0,min(1,(d-1.1)/1.4))*max(0,min(1,(pad-1.15)/1.0))
    # Tutorial lawns are lower and quieter; the route and all five pads remain flat.
    hills=.18*math.exp(-((x+5.8)**2+(z+3.8)**2)/4)+.13*math.exp(-((x-5.8)**2+(z-3.6)**2)/3)
    return .04+mask*(.14+.13*math.sin(x*.53+z*.36)+.055*math.cos(z*1.12-x*.22)+hills)

def boundary(theta):
    c,s=math.cos(theta),math.sin(theta)
    f=1+.047*math.sin(theta*7+.7)+.028*math.cos(theta*11)
    return Vector((11.2*math.copysign(abs(c)**.72,c)*f,5.45*math.copysign(abs(s)**.72,s)*f))

def grass_edge(theta):return .943+.021*math.sin(theta*5+.5)+.012*math.cos(theta*9)

# A continuously modelled, gently undulating island top and a layered cliff skirt.
N,NR=128,18;vs=[];fs=[]
for k in range(NR+1):
    t=k/NR
    for j in range(N):
        theta=j*2*math.pi/N;q=boundary(theta)*(t*grass_edge(theta));vs.append((q.x,height(q.x,q.y),q.y))
for k in range(NR):
    for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
top=mesh('Continuous_grass_island',vs,fs,1,'Ground',True,True)
# Apply a sandy rim as a real narrow surface, not a square decal.
rimv=[];rimf=[]
for k in range(3):
    for j in range(N):
        th=j*2*math.pi/N;inner=grass_edge(th)-.005
        t=[inner,(inner+1.025)/2,1.025][k]
        q=boundary(th)*t;rimv.append((q.x,height(q.x,q.y)+[.013,-.065,-.240][k],q.y))
for k in range(2):
    for j in range(N):rimf.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Warm_sand_coast_rim',rimv,rimf,3,'Ground',True,True)
cliffv=[];clifff=[]
for k,(scale,drop) in enumerate([(1.025,-.24),(1.025,-.50),(.98,-1.06),(.91,-1.78)]):
    for j in range(N):
        th=j*2*math.pi/N;q=boundary(th)*scale
        cliffv.append((q.x,height(q.x,q.y)-.240 if k==0 else drop+.09*math.sin(th*13+k),q.y))
for k in range(3):
    for j in range(N):clifff.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
mesh('Layered_sandstone_cliff',cliffv,clifff,4,'Ground',False)
for j in range(72):
    a=j*2*math.pi/72;q=boundary(a)*RNG.uniform(.982,1.020)
    rock('Coast_chamfer_rock_%02d'%j,(q.x,RNG.uniform(-.70,-.23),q.y),(RNG.uniform(.8,1.4),RNG.uniform(.65,1.1),RNG.uniform(.62,1.0)),[4,5,6,28][j%4],a)
for j in range(26):
    a=j*2*math.pi/26+.17;q=boundary(a)*RNG.uniform(1.025,1.09)
    rock('Tidal_boulder_%02d'%j,(q.x,-.98,q.y),(RNG.uniform(.5,1.1),RNG.uniform(.32,.65),RNG.uniform(.45,.85)),j%2+4,a)
for j in range(19):
    a=j*2*math.pi/19+RNG.uniform(-.06,.06);q=boundary(a)*RNG.uniform(.962,.995)
    rock('Coast_upper_outcrop_%02d'%j,(q.x,height(q.x,q.y)-.015,q.y),(RNG.uniform(.55,1.1),RNG.uniform(.40,.68),RNG.uniform(.45,.80)),[4,5,6][j%3],a)

# Exact gameplay route remains within a readable continuous warm sand ribbon.
visual_route=[ROUTE[0]-Vector((1.25,0)),ROUTE[0]]
for i in range(1,len(ROUTE)-1):
    a,q,b=ROUTE[i-1],ROUTE[i],ROUTE[i+1]
    before=q-(q-a).normalized()*.42;after=q+(b-q).normalized()*.42
    for k in range(7):
        t=k/6;visual_route.append(before*(1-t)**2+q*2*t*(1-t)+after*t*t)
visual_route.append(ROUTE[-1]);visual_route.append(ROUTE[-1]+Vector((.50,0)))
samples=[]
for index,(a,b) in enumerate(zip(visual_route,visual_route[1:])):
    count=max(2,int((b-a).length/.28))
    for j in range(count):samples.append(a+(b-a)*(j/count))
samples.append(visual_route[-1])
roadv=[];roadf=[];normals=[]
for i,q in enumerate(samples):
    t=(samples[min(i+1,len(samples)-1)]-samples[max(i-1,0)]).normalized();n=Vector((-t.y,t.x));normals.append(n)
    width=.69+.035*math.sin(i*.37)+RNG.uniform(-.015,.015)
    for side in [-1,0,1]:
        p=q+n*width*side;roadv.append((p.x,.060+(1-abs(side))*.004,p.y))
for i in range(len(samples)-1):
    for k in range(2):roadf.append((i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k))
mesh('Gameplay_sand_path',roadv,roadf,3,'Ground',True,True)
for i in range(2,len(samples)-2,3):
    q=samples[i];n=normals[i]
    for side in [-1,1]:
        p=q+n*(.83+RNG.uniform(0,.07))*side
        if min((p-s).length for s in SLOTS)<1.06 or RNG.random()<.18:continue
        rock('Low_path_border_%03d_%d'%(i,side),(p.x,.11,p.y),(.30+RNG.random()*.18,.16,.22+RNG.random()*.13),5 if i%2 else 6,RNG.random()*6)
for i in range(5,len(samples)-4,5):
    q=samples[i]+normals[i]*RNG.uniform(-.35,.35)
    rock('Path_inset_stone_%03d'%i,(q.x,.064,q.y),(.28,.037,.18),27,RNG.random()*6)

# Five purpose-built battle plinths. Their anchor y is the usable top surface.
for i,q in enumerate(SLOTS):
    disc('Plinth_%d_lower'%i,q.x,q.y,.035,.96,.125,4)
    disc('Plinth_%d_base'%i,q.x,q.y,.135,.86,.115,5)
    disc('Plinth_%d_green_inset'%i,q.x,q.y,.247,.70,.045,24)
    for j in range(12):
        a=j*math.pi/6;da=.23;r0,r1=.71,.91
        vs=[]
        for y,shrink in [(.19,1),(.285,.94)]:
            for r,t in [(r0,-da),(r1,-da),(r1,da),(r0,da)]:vs.append((q.x+r*math.cos(a+t)*shrink,y,q.y+r*math.sin(a+t)*shrink))
        mesh('Plinth_%d_rim_stone_%02d'%(i,j),vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],6 if j%4==0 else 5)
    # Small inlaid concentric ripple motif, readable beneath a selected turtle.
    for r in [.20,.32]:
        pts=[(q.x+r*math.cos(j*math.pi/16),.2924,q.y+r*math.sin(j*math.pi/16)) for j in range(33)]
        tube('Plinth_%d_ripple'%i,pts,.0015,14,sides=5)
    anchor('Slot_%d'%i,q.x,.292,q.y)

# Stone turtle gateway: traversable arch made of individual carved voussoirs.
GX=-9.8;GZ=0
for sign in [-1,1]:
    for k in range(3):rock('Gateway_column_%d_%d'%(sign,k),(GX,.22+k*.29,GZ+sign*.97),(.79,.38,.46),[5,6,5][k],.05*k)
for j in range(11):
    a0=j*math.pi/11;a1=(j+1)*math.pi/11;vs=[]
    for x in [GX-.41,GX+.41]:
        for r,a in [(.78,a0),(1.18,a0),(1.18,a1),(.78,a1)]:vs.append((x,.72+r*math.sin(a),GZ+r*math.cos(a)))
    ob=mesh('Gateway_arch_carved_%02d'%j,vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],6 if j%3 else 5)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    mod=ob.modifiers.new('Soft_hand_carved_edges','BEVEL');mod.width=.055;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False)
# Back tunnel dark surface is recessed, with physical thickness and arch entrance.
archpts=[(-.74,.05),(-.74,.70)]+[(.75*math.cos(a),.70+.75*math.sin(a)) for a in np.linspace(math.pi,0,17)]+[(.74,.05)]
mesh('Gateway_recessed_tunnel_end',[(GX-.62,y,z) for z,y in archpts],[tuple(range(len(archpts)))],15)
rock('Gateway_turtle_brow',(GX+.04,1.68,0),(.88,.45,1.28),6,0,sides=9)
for sign in [-1,1]:
    oval('Gateway_inset_eye_'+str(sign),(GX+.485,1.67,sign*.34),(.027,.115,.12),15,n=14,rings=8)
    rock('Gateway_cheek_'+str(sign),(GX+.28,1.50,sign*.61),(.48,.36,.43),6,0)
    rock('Gateway_flipper_'+str(sign),(GX+.24,.11,sign*1.24),(.98,.18,.48),5,sign*.4)
anchor('Enemy_entrance',-9,.064,0)

# A quiet welcome garland above the gateway: no signs/text and no path-level obstacles.
welcome_rope=[]
for j in range(17):
    t=j/16;welcome_rope.append((GX+.53,2.06-.17*math.sin(t*math.pi),-1.05+2.10*t))
tube('Welcome_garland_rope',welcome_rope,.025,22,sides=6)
for j,t in enumerate([.19,.39,.61,.81]):
    zz=-1.05+2.10*t;yy=2.06-.17*math.sin(t*math.pi)
    vs=[(GX+.55,yy,zz-.13),(GX+.55,yy,zz+.13),(GX+.57,yy-.28,zz+.09),(GX+.60,yy-.19,zz),(GX+.57,yy-.28,zz-.09)]
    ob=mesh('Welcome_leaf_banner_%d'%j,vs,[(0,1,2,3,4)],[14,20,17,14][j],smooth=False)
    mod=ob.modifiers.new('Soft_banner_thickness','SOLIDIFY');mod.thickness=.018
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False)

# Pearl sanctuary: stepped stone foot, scalloped concave shell and fluted fan.
CX,CZ=ROUTE[-1].x,ROUTE[-1].y
disc('Sanctuary_lower_step',CX,CZ,.03,1.31,.13,4,32)
disc('Sanctuary_upper_step',CX,CZ,.16,1.12,.14,5,32)
disc('Sanctuary_teal_inset',CX,CZ,.30,.94,.055,13,32)
for j in range(16):
    a=j*2*math.pi/16
    rock('Sanctuary_border_%02d'%j,(CX+1.08*math.cos(a),.30,CZ+1.08*math.sin(a)),(.31,.14,.24),6,a)
vs=[];fs=[];NCL=64;RCL=10
for k in range(RCL+1):
    r=k/RCL
    for j in range(NCL):
        a=j*2*math.pi/NCL;rr=r*(.91+.035*math.cos(a*14))
        vs.append((CX+rr*math.cos(a),.37+.35*r*r,CZ+.72*rr*math.sin(a)))
for k in range(RCL):
    for j in range(NCL):fs.append((k*NCL+j,k*NCL+(j+1)%NCL,(k+1)*NCL+(j+1)%NCL,(k+1)*NCL+j))
mesh('Shell_lower_concave_valve',vs,fs,20,smooth=True)
vs=[];fs=[];NF=60;RF=14
for k in range(RF+1):
    r=.03+1.45*k/RF
    for j in range(NF+1):
        a=-1.20+2.4*j/NF
        flutter=.05*math.cos(j/NF*math.pi*14)*(k/RF)**1.4
        vs.append((CX+math.sin(a)*r,.50+math.cos(a)*r,CZ-.38-.23*math.sin(k/RF*math.pi/2)+flutter))
for k in range(RF):
    for j in range(NF):fs.append((k*(NF+1)+j,k*(NF+1)+j+1,(k+1)*(NF+1)+j+1,(k+1)*(NF+1)+j))
fan=mesh('Shell_upper_fluted_fan',vs,fs,20,smooth=True)
bpy.context.view_layer.objects.active=fan;fan.select_set(True)
solid=fan.modifiers.new('Real_shell_thickness','SOLIDIFY');solid.thickness=.055;bpy.ops.object.modifier_apply(modifier=solid.name);fan.select_set(False)
for j in range(15):
    a=-1.17+j*2.34/14;pts=[]
    for k in range(10):
        t=.09+.91*k/9;r=1.43*t
        pts.append((CX+math.sin(a)*r,.51+math.cos(a)*r,CZ-.36-.23*math.sin(t*math.pi/2)+.055))
    tube('Shell_fan_ivory_ridge_%02d'%j,pts,[.025+.013*k/9 for k in range(10)],6,sides=6)
oval('Sanctuary_luminous_pearl',(CX,1.10,CZ),(.43,.43,.43),21,'Pearl_and_lamps',n=32,rings=20)
anchor('Pearl_center',CX,1.10,CZ);anchor('Player_exit',ROUTE[-1].x,.064,ROUTE[-1].y)

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

for args in [(0,-7.9,-4.1,1.85,.25),(1,-3.6,-4.4,1.95,-.25),(2,5.0,-4.2,1.80,.30),(3,8.6,-3.3,1.75,-.18)]:palm(*args)

def bush(i,x,z,size=.5):
    h=height(x,z)+.015
    count=RNG.choice([5,7,9]);rotation=RNG.random()*6.28
    for j in range(count):
        a=j*2*math.pi/count+rotation+RNG.random()*.3
        leaf('Bush_%03d_leaf_%d'%(i,j),(x,h,z),(math.cos(a),math.sin(a)),size*RNG.uniform(.7,1.05),size*.24,8+j%3,curve=size*.40,down=-size*.06)
    # Central pointed bud anchors the rosette in the grass.
    leaf('Bush_%03d_new_leaf'%i,(x,h,z),(.2,1),size*.45,size*.13,10,curve=size*.70,down=-size*.26)

placed=0
for attempt in range(500):
    x=RNG.uniform(-10.3,10.3);z=RNG.uniform(-4.9,4.9)
    if route_distance(x,z)<1.25 or min((Vector((x,z))-p).length for p in SLOTS)<1.30:continue
    if ((x+9.8)**2+z*z)<2.5 or ((x-CX)**2+(z-CZ)**2)<3.4:continue
    if (abs(x)/11.1)**3.0+(abs(z)/5.35)**3.0>.90:continue
    bush(placed,x,z,RNG.uniform(.27,.58));placed+=1
    if placed>=40:break

# Grass is actual curved blades, clustered without hiding the playable path.
for i in range(82):
    x=RNG.uniform(-10.0,10.0);z=RNG.uniform(-4.9,4.9)
    if route_distance(x,z)<.93 or min((Vector((x,z))-p).length for p in SLOTS)<1.08:continue
    h=height(x,z)+.013
    for j in range(4):
        a=RNG.random()*6.28;d=Vector((math.cos(a),0,math.sin(a)));base=Vector((x,h,z))+d*.04
        top=base+d*.07+Vector((0,RNG.uniform(.13,.25),0));mid=(base+top)*.5+d*.015
        side=Vector((-d.z,0,d.x))*.032
        mesh('Grass_%03d_%d'%(i,j),[tuple(base-side),tuple(base+side),tuple(mid+side*.7),tuple(top),tuple(mid-side*.7)],[(0,1,2,3,4)],j%3,smooth=False)

def coral(i,x,z,tile=17):
    y=height(x,z)+.025
    trunk=[(x,y,z),(x+.04,y+.30,z),(x-.015,y+.65,z+.04)]
    tube('Coral_%d_main'%i,trunk,[.11,.09,.04],tile,sides=7)
    for j in range(4):
        sign=1 if j%2 else -1;start=Vector(trunk[1])+Vector((0,.075*(j//2),0))
        end=start+Vector((sign*(.24+.08*(j//2)),.26,.14*(1 if j<2 else -1)))
        tube('Coral_%d_branch_%d'%(i,j),[tuple(start),tuple((start+end)*.5+Vector((0,-.04,0))),tuple(end)],[.062,.05,.017],tile,sides=7)
        oval('Coral_%d_round_tip_%d'%(i,j),tuple(end),(.031,.032,.031),tile,n=8,rings=5)
for i,(x,z) in enumerate([(-10.3,-2.6),(-8.0,4.35),(-4.5,-4.8),(2.7,4.6),(7.0,4.0),(10.2,2.7)]):coral(i,x,z,[17,18,16][i%3])

def lantern(i,x,z):
    h=height(x,z)
    disc('Lantern_%d_foot'%i,x,z,h,.29,.13,4,n=8)
    rock('Lantern_%d_stem'%i,(x,h+.33,z),(.25,.48,.25),5,sides=4)
    disc('Lantern_%d_cage_base'%i,x,z,h+.56,.25,.07,12,n=6)
    oval('Lantern_%d_light'%i,(x,h+.76,z),(.13,.16,.13),23,'Pearl_and_lamps',n=12,rings=8)
    for j in range(4):
        a=math.pi/4+j*math.pi/2
        tube('Lantern_%d_corner_%d'%(i,j),[(x+.17*math.cos(a),h+.60,z+.17*math.sin(a)),(x+.17*math.cos(a),h+.94,z+.17*math.sin(a))],.025,12,sides=5)
    rock('Lantern_%d_roof'%i,(x,h+1.0,z),(.65,.18,.65),5,sides=4)
for i,(x,z) in enumerate([(-7.6,-1.95),(7.1,-2.15)]):lantern(i,x,z)

# Starfish and small shell clusters add scale at quiet beach edges.
for i,(x,z) in enumerate([(-8.1,4.7),(-4.1,4.9),(4.3,4.75),(9.9,2.9),(-9.5,-3.7)]):
    y=height(x,z)+.025;vs=[]
    for level,scale,dy in [(0,1,0),(1,.72,.045)]:
        for j in range(10):
            a=j*math.pi/5+i*.35;r=(.25 if j%2==0 else .10)*scale
            vs.append((x+r*math.cos(a),y+dy,z+r*math.sin(a)))
    fs=[tuple(range(10,20))]
    for j in range(10):fs.append((j,(j+1)%10,(j+1)%10+10,j+10))
    mesh('Beach_starfish_%d'%i,vs,fs,16 if i%2 else 17,smooth=True)
for i in range(16):
    a=RNG.random()*6.28;q=boundary(a)*RNG.uniform(.84,.94)
    if route_distance(q.x,q.y)<1.1:continue
    rock('Quiet_meadow_stone_%02d'%i,(q.x,height(q.x,q.y)+.12,q.y),(.45,.3,.38),5,RNG.random()*6)

# Small authored scallop shells on quiet beaches, separate from the large core shell.
for i,(x,z,turn) in enumerate([(-6.6,4.65,.3),(-2.7,4.95,-.4),(5.5,4.45,.6),(-8.8,-3.4,.9)]):
    h=height(x,z)+.035;vs=[];fs=[];rays=16
    for k in range(5):
        r=.035+.34*k/4
        for j in range(rays+1):
            a=-1.17+2.34*j/rays+turn
            flute=.018*math.cos(j*math.pi)*k/4
            vs.append((x+math.sin(a)*r,h+.045*math.sin(k/4*math.pi)+flute,z+math.cos(a)*r))
    for k in range(4):
        for j in range(rays):fs.append((k*(rays+1)+j,k*(rays+1)+j+1,(k+1)*(rays+1)+j+1,(k+1)*(rays+1)+j))
    mesh('Quiet_beach_shell_%d'%i,vs,fs,20,smooth=True)

# Short discontinuous foam crests are static coastal details; ocean stays dynamic.
for i in range(24):
    a=i*math.pi/12+.04;pts=[]
    for j in range(9):
        t=a+j*.018;q=boundary(t)*(1.045+.015*math.sin(i+j*.3));pts.append((q.x,-1.035+.009*math.sin(j),q.y))
    tube('Coastal_foam_crest_%02d'%i,pts,.018,30,sides=5,group='Ground')

anchor('Island_origin',0,0,0)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1.0
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
manifest={
 'version':'tutorial-island-candidate-01','levelId':0,'levelName':'初到龟岛',
 'dataSource':'assets/scripts/core/data.ts','dataSourceSha256':hashlib.sha256(DATA.read_bytes()).hexdigest(),
 'coordinateConvention':'Cocos world x/y-up/z; Blender source x/-z/y',
 'route':route,'routeSurfaceY':.064,'waterY':-1.06,
 'slots':[{'x':p['x'],'y':.292,'z':p['z']} for p in slots],
 'gameplayBase':{'x':ROUTE[-1].x,'y':.064,'z':ROUTE[-1].y},
 'pearl':{'x':CX,'y':1.10,'z':CZ},
 'boundsXZ':[min(p.x for p in [boundary(i*math.pi/128) for i in range(256)]),max(p.x for p in [boundary(i*math.pi/128) for i in range(256)]),min(p.y for p in [boundary(i*math.pi/128) for i in range(256)]),max(p.y for p in [boundary(i*math.pi/128) for i in range(256)])],
 'nominalFootprintXZ':[22,12],
 'cameraSuggestion':{'position':{'x':0,'y':15,'z':18},'target':{'x':0,'y':.2,'z':0},'baseVerticalFovDegrees':42,'responsiveRule':'same as GameEntry.resizeViewport: preserve 1280/720 horizontal framing'},
 'sourceObjects':len(OBJECTS),'authorship':'Original procedural geometry, UV, colours, and composition; no downloaded game or stock assets.',
 'sourceModule':'Project original tidal-island v04 geometry/material builders, adapted to level 0 with newly generated route-dependent terrain and road',
 'status':'First tutorial environment candidate; runtime integration and visual acceptance pending.'
}
# Save original separate, editable parts. Empty anchors remain meaningful objects.
for img in [colour,roughness]:img.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'tutorial-island.blend'))
exported=[];stats=[]
for group,objs in GROUPS.items():
    if not objs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:ob.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
    ob=bpy.context.object;ob.name=group
    # Joining can duplicate identical atlas material slots; consolidate explicitly.
    ob.data.materials.clear();ob.data.materials.append(GLOW if group=='Pearl_and_lamps' else MAT)
    for f in ob.data.polygons:f.material_index=0
    tri=sum(len(p.vertices)-2 for p in ob.data.polygons)
    stats.append({'name':group,'vertices':len(ob.data.vertices),'triangles':tri});exported.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in exported+ANCHORS:ob.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
bpy.ops.export_scene.fbx(filepath=str(OUT/'tutorial-island.fbx'),use_selection=True,object_types={'MESH','EMPTY'},axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=False,path_mode='COPY',embed_textures=True)
manifest.update({'runtimeMeshes':stats,'totalTriangles':sum(s['triangles'] for s in stats),'opaqueDrawCalls':len(stats),'materials':2,'fbxSha256':hashlib.sha256((OUT/'tutorial-island.fbx').read_bytes()).hexdigest()})
all_world=[ob.matrix_world@v.co for ob in exported for v in ob.data.vertices]
manifest['geometryBoundsCocos']={'min':[min(p.x for p in all_world),min(p.z for p in all_world),min(-p.y for p in all_world)],'max':[max(p.x for p in all_world),max(p.z for p in all_world),max(-p.y for p in all_world)]}
assert manifest['totalTriangles']<=80000,manifest['totalTriangles']
(SOURCE/'environment-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

# Preview ocean is deliberately excluded from FBX and marked for dynamic Cocos use.
sea=bpy.data.materials.new('PREVIEW_ONLY_dynamic_ocean');sea.use_nodes=True
n=sea.node_tree.nodes;links=sea.node_tree.links;bs=n.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.018,.24,.29,1);bs.inputs['Roughness'].default_value=.24;bs.inputs['Metallic'].default_value=.15
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.8;noise.inputs['Detail'].default_value=2
geo=n.new('ShaderNodeNewGeometry');links.new(geo.outputs['Position'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.012,.20,.255,1);ramp.color_ramp.elements[1].color=(.034,.40,.43,1)
links.new(noise.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],bs.inputs['Base Color'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.20;bump.inputs['Distance'].default_value=.08
links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.06));water=bpy.context.object;water.name='PREVIEW_ONLY_OCEAN';water.data.materials.append(sea)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.60,.72,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
def light(name,typ,loc,power,col,size=10):
    ld=bpy.data.lights.new(name,typ);ld.energy=power;ld.color=col
    if typ=='AREA':ld.shape='DISK';ld.size=size
    if typ=='SUN':ld.angle=.14
    ob=bpy.data.objects.new(name,ld);scene.collection.objects.link(ob);ob.location=world(*loc)
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
light('Island_sun','SUN',(-8,15,7),3.1,(1,.89,.72))
light('Island_fill','AREA',(5,10,-10),1000,(.61,.82,1),14)
camera=bpy.data.objects.new('Island_review_camera',bpy.data.cameras.new('Island_review_camera'));scene.collection.objects.link(camera);scene.camera=camera
camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=32
preview_vfov=2*math.atan(math.tan(math.radians(42)/2)*max(1,(1280/720)/(1000/700)))
camera.data.lens=32/(2*math.tan(preview_vfov/2))
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
for name,loc,target,scale in [('battle-overview',(0,15,18),(0,.2,0),None),('top-down',(0,28,0),(0,0,0),26.0),('sanctuary-detail',(14,6,7),(9,.8,0),6.0)]:
    camera.data.type='PERSP' if scale is None else 'ORTHO'
    camera.location=world(*loc);camera.rotation_euler=(vworld(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    if scale is not None:camera.data.ortho_scale=scale
    if not EXPORT_ONLY:
        scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'tutorial-island-review-scene.blend'))
print('TUTORIAL_ISLAND_EXPORT_COMPLETE '+json.dumps(manifest,ensure_ascii=False))
