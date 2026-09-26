"""Rebuild original Go Away Turtle stone-turtle art with Blender 4.5 LTS.

All geometry, UV colour atlas and animation curves are authored here. No external
game asset, downloaded texture or pretrained mesh is used. Coordinates: Z up,
forward -Y. Export scale is metres. Run with Blender --background --python FILE.
"""
import bpy
import bmesh
import math
import random
import json
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'game/art-source/stone-turtle'
OUT = ROOT / 'game/assets/resources/models/stone-turtle'
SCULPT_CANDIDATE='--candidate-10' in sys.argv
ISOLATED_CANDIDATE='--candidate-08' in sys.argv or '--candidate-09' in sys.argv or SCULPT_CANDIDATE
FACE_CANDIDATE='--version-07' not in sys.argv and '--candidate-08' not in sys.argv
SOFT_EDGE_CANDIDATE='--version-07' not in sys.argv
if ISOLATED_CANDIDATE:
    SOURCE=SOURCE/('candidate-10' if SCULPT_CANDIDATE else ('candidate-09' if FACE_CANDIDATE else 'candidate-08'))
    OUT=SOURCE/'export'
SOURCE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(140923)
FAST_REVIEW='--fast-review' in sys.argv
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in list(bpy.data.collections):
    if coll.name != 'Collection':
        bpy.data.collections.remove(coll)
CHAR = bpy.data.collections.new('STONE_TURTLE_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS = []

# A single 1024px atlas is both editable source and portable runtime texture.
# Its tiles contain subtle original mineral / skin grain, not photographic data.
PALETTE = [
    (0.27,0.26,0.22), (0.34,0.33,0.27), (0.23,0.24,0.21), (0.38,0.35,0.28),
    (0.29,0.33,0.14), (0.43,0.46,0.22), (0.55,0.54,0.29), (0.57,0.46,0.24),
    (0.12,0.15,0.10), (0.93,0.90,0.76), (0.16,0.19,0.11), (0.035,0.045,0.025),
    (0.57,0.46,0.24), (0.37,0.40,0.20), (0.96,0.94,0.83), (0.11,0.12,0.10),
]
SIZE, TILE = 1024, 256
pix = np.ones((SIZE,SIZE,4), dtype=np.float32)
yy,xx = np.mgrid[0:TILE,0:TILE].astype(np.float32)
noise_rng = np.random.default_rng(4127)
for i,base in enumerate(PALETTE):
    noise = noise_rng.normal(0,0.009,(TILE,TILE))
    mineral = 0.017*np.sin(xx*.075+np.sin(yy*.038)*2.7)*np.sin(yy*.061)
    if i > 7: mineral *= 0.15; noise *= 0.3
    rgba=np.ones((TILE,TILE,4),dtype=np.float32)
    for c in range(3): rgba[:,:,c]=np.clip(base[c]+noise+mineral,0,1)
    if i < 4:
        # Fine veins and flecks stay restrained at battle distance.
        vein=np.exp(-np.abs(np.sin(xx*.024+yy*.042+np.sin(xx*.043))) * 75)*.022
        rgba[:,:,:3]+=vein[:,:,None]
    tx,ty=i%4,i//4
    pix[ty*TILE:(ty+1)*TILE,tx*TILE:(tx+1)*TILE]=rgba
atlas=bpy.data.images.new('StoneTurtle_Colour_1024',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pix.ravel())
atlas.filepath_raw=str(OUT/'stone-colour.png')
atlas.file_format='PNG'; atlas.save()
rough_pixels=np.ones((SIZE,SIZE,4),dtype=np.float32)
for i in range(16):
    r=.57 if i<4 else (.20 if i in (9,10,11,14) else .43)
    rough_pixels[(i//4)*TILE:(i//4+1)*TILE,(i%4)*TILE:(i%4+1)*TILE,:3]=r
rough_atlas=bpy.data.images.new('StoneTurtle_Roughness_1024',width=SIZE,height=SIZE,alpha=True)
rough_atlas.colorspace_settings.name='Non-Color';rough_atlas.pixels.foreach_set(rough_pixels.ravel())
rough_atlas.filepath_raw=str(OUT/'stone-roughness.png');rough_atlas.file_format='PNG';rough_atlas.save()
MATS=[]
for i in range(16):
    mat=bpy.data.materials.new('StoneAtlas_%02d'%i)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=atlas
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    rough_tex=mat.node_tree.nodes.new('ShaderNodeTexImage');rough_tex.image=rough_atlas
    mat.node_tree.links.new(rough_tex.outputs['Color'],bsdf.inputs['Roughness'])
    bsdf.inputs['Roughness'].default_value=.36 if i<4 else (.24 if i in (9,10,11,14) else .40)
    bsdf.inputs['Specular IOR Level'].default_value=.27 if i<8 else .34
    MATS.append(mat)

def objmesh(name,verts,faces,tile=4,bone='body',smooth=True,subdiv=0):
    mesh=bpy.data.meshes.new(name+'_mesh'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); CHAR.objects.link(obj)
    obj.data.materials.append(MATS[tile]); obj['atlas_tile']=tile; obj['bone']=bone
    for p in mesh.polygons:p.use_smooth=smooth
    if subdiv:
        bpy.context.view_layer.objects.active=obj; obj.select_set(True)
        mod=obj.modifiers.new('Sculpted_surface','SUBSURF'); mod.levels=subdiv
        bpy.ops.object.modifier_apply(modifier=mod.name); obj.select_set(False)
    # Smart unwrap is retained per part in the .blend. Map its islands into tile.
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    bm=bmesh.new(); bm.from_mesh(obj.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(obj.data); bm.free()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.1519,island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    for uv in obj.data.uv_layers.active.data:
        uv.uv=((tile%4+.04+uv.uv.x*.92)/4,(tile//4+.04+uv.uv.y*.92)/4)
    obj.select_set(False); PARTS.append(obj)
    return obj

def loft(name,rings,axis='Y',tile=4,bone='body',segments=20,subdiv=1,shape=1.0):
    # Rings store axis position, radius A, radius B, offset A, offset B.
    verts=[]
    for pos,ra,rb,oa,ob in rings:
        for j in range(segments):
            t=2*math.pi*j/segments
            # Superellipse: a broad sculpted plane around the face and foot.
            ca=math.copysign(abs(math.cos(t))**shape,math.cos(t))
            sa=math.copysign(abs(math.sin(t))**shape,math.sin(t))
            a,b=oa+ra*ca,ob+rb*sa
            verts.append((a,pos,b) if axis=='Y' else (a,b,pos))
    faces=[]
    for k in range(len(rings)-1):
        for j in range(segments):
            faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return objmesh(name,verts,faces,tile,bone,True,subdiv)

def oval(name,center,radius,tile,bone='head',seg=20,rings=12,shape=1.0):
    # Small sculpting detail only; main body/feet/head use purpose-shaped lofts.
    verts=[]
    for k in range(rings+1):
        a=math.pi*k/rings
        for j in range(seg):
            b=2*math.pi*j/seg
            verts.append((center[0]+radius[0]*math.sin(a)*math.cos(b),center[1]+radius[1]*math.sin(a)*math.sin(b),center[2]+radius[2]*math.cos(a)))
    faces=[]
    for k in range(rings):
        for j in range(seg):faces.append((k*seg+j,k*seg+(j+1)%seg,(k+1)*seg+(j+1)%seg,(k+1)*seg+j))
    return objmesh(name,verts,faces,tile,bone)

def tube(name,points,radius,tile,bone='head',sides=8):
    pts=[Vector(p) for p in points]; verts=[]
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        normal=tangent.cross(Vector((0,1,0)))
        if normal.length<.1:normal=tangent.cross(Vector((1,0,0)))
        normal.normalize(); other=tangent.cross(normal).normalized()
        r=radius*(.42+.58*math.sin(math.pi*i/(len(pts)-1))**.32)
        for j in range(sides):
            d=normal*math.cos(j*2*math.pi/sides)+other*math.sin(j*2*math.pi/sides)
            verts.append(tuple(p+d*r))
    faces=[]
    for k in range(len(pts)-1):
        for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return objmesh(name,verts,faces,tile,bone)

# Integrated torso and plastron. Musculature tapers beneath protective carapace.
loft('Torso',[(.94,.03,.03,0,.66),(.84,.53,.26,0,.65),(.48,.73,.33,0,.66),(-.15,.77,.34,0,.64),(-.63,.63,.32,0,.64),(-.83,.28,.24,0,.69),(-.89,.02,.02,0,.71)],tile=4)
loft('Warm_plastron',[(.85,.06,.02,0,.43),(.64,.52,.075,0,.41),(-.45,.58,.075,0,.41),(-.73,.19,.045,0,.45),(-.78,.02,.01,0,.46)],tile=7)
# A short articulated neck prevents a disembodied head silhouette.
loft('Neck', [(-.66,.23,.22,0,.70),(-.84,.26,.245,0,.70),(-1.02,.24,.23,0,.70),(-1.10,.19,.16,0,.71)],tile=5,bone='neck')
head_rings=[(-.88,.055,.06,0,.77),(-.97,.255,.275,0,.80),(-1.13,.33,.29,0,.80),(-1.32,.34,.265,0,.76),(-1.48,.285,.195,0,.715),(-1.56,.22,.13,0,.705),(-1.585,.06,.045,0,.705)]
if FACE_CANDIDATE:head_rings=[(-.88,.055,.06,0,.77),(-.97,.255,.275,0,.80),(-1.13,.33,.29,0,.80),(-1.32,.34,.280,0,.78),(-1.48,.300,.235,0,.760),(-1.56,.245,.16,0,.72),(-1.59,.08,.075,0,.72)]
if SCULPT_CANDIDATE:head_rings=[(-.88,.055,.06,0,.77),(-.98,.26,.27,0,.80),(-1.13,.335,.285,0,.80),(-1.27,.338,.265,0,.78),(-1.39,.314,.222,0,.743),(-1.50,.270,.166,0,.717),(-1.57,.18,.095,0,.714),(-1.595,.045,.047,0,.718)]
head_mesh=loft('Head_sculpt',head_rings,tile=6,bone='head',segments=28,subdiv=2,shape=.86)
if SCULPT_CANDIDATE:
    # Continuous sculpted cheek/muzzle volume and shallow eye sockets are part
    # of the same closed head mesh. Head envelope stays within the A baseline.
    for vert in head_mesh.data.vertices:
        x,y,z=vert.co
        mask=max(0,min(1,(-y-1.12)/.19))
        socket=math.exp(-((abs(x)-.218)/.098)**2-((z-.870)/.115)**2)
        cheek=math.exp(-((abs(x)-.245)/.110)**2-((z-.735)/.115)**2)
        muzzle=math.exp(-(x/.22)**2-((z-.710)/.11)**2)
        brow=math.exp(-((abs(x)-.205)/.115)**2-((z-.989)/.055)**2)
        vert.co.y=max(-1.603,y+mask*(.026*socket-.023*cheek-.025*muzzle-.017*brow))
    head_mesh.data.update()

def face_surface(x,z,lift=.002):
    hit,p,n,_=head_mesh.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    return (p+Vector((0,-lift,0)),n) if hit else (Vector((x,-1.42,z)),Vector((0,-1,0)))

def eye_detail(name,p,radius,tile,normal):
    obj=oval(name,p,radius,tile,'head',seg=24,rings=12)
    rot=Vector((0,-1,0)).rotation_difference(normal)
    for v in obj.data.vertices:v.co=p+rot @ (v.co-p)
    return obj

# Four bent, load-bearing legs; hand-shaped cross sections widen into flat feet.
for side,label in [(-1,'L'),(1,'R')]:
    for front,y in [(True,-.57),(False,.63)]:
        bone=('front_' if front else 'rear_')+label
        x=side*(.67 if front else .64)
        leg_rings=[(.82,.17,.19,x*.91,y+.07),(.66,.23,.235,x,y+.02),(.43,.25,.25,x+side*.03,y-.045),(.20,.26,.28,x+side*.07,y-.08),(.105,.255,.27,x+side*.07,y-.085),(.08,.22,.235,x+side*.07,y-.085)]
        if SCULPT_CANDIDATE:leg_rings=[(.82,.17,.19,x*.91,y+.08),(.66,.235,.245,x,y+.065),(.47,.235,.220,x+side*.025,y+.035),(.29,.205,.205,x+side*.06,y-.055),(.185,.272,.300,x+side*.10,y-.125),(.11,.265,.30,x+side*.10,y-.135),(.08,.23,.255,x+side*.10,y-.135)]
        leg_mesh=loft(bone+'_sculpt',leg_rings,axis='Z',tile=5,bone=bone,segments=24 if SCULPT_CANDIDATE else 20,subdiv=1,shape=.82)
        for toe in [-1,0,1]:
            if SCULPT_CANDIDATE:oval(bone+'_toe_'+str(toe),(x+side*.10+toe*.128,y-.411,.120),(.051,.051,.026),6,bone,seg=12,rings=8)
            else:oval(bone+'_toe_'+str(toe),(x+side*.07+toe*.125,y-.335,.132),(.051,.046,.048),12,bone,seg=12,rings=8)
        # Sculpted olive scales sit flush on the forward shins, with size rhythm.
        for row in range(3):
            for col in range(3-row%2):
                dx=(col-1+(.5 if row%2 else 0))*.145
                sx=x+side*.04+dx
                sz=.28+row*.135
                def front_surface(px,pz):
                    if SCULPT_CANDIDATE:
                        hit,p,_,_=leg_mesh.ray_cast(Vector((px,-3,pz)),Vector((0,1,0)))
                        if hit:return p.y
                    controls=[(.105,.255,.27,x+side*.07,y-.085),(.20,.26,.28,x+side*.07,y-.08),(.43,.25,.25,x+side*.03,y-.045),(.66,.23,.235,x,y+.02)]
                    a,b=controls[0],controls[-1]
                    for ca,cb in zip(controls,controls[1:]):
                        if ca[0]<=pz<=cb[0]:a,b=ca,cb;break
                    t=max(0,min(1,(pz-a[0])/(b[0]-a[0])))
                    _,rx,ry,cx,cy=[aa+(bb-aa)*t for aa,bb in zip(a,b)]
                    co=min(.97,abs((px-cx)/rx)**(1/.82))
                    return cy-ry*(math.sqrt(1-co*co)**.82)
                sv=[]
                for fac,dep in ([(1,.003),(.82,.007),(.2,.010)] if SCULPT_CANDIDATE else [(1,.009),(.82,.019),(.2,.024)]):
                    for k in range(6):
                        ang=k*math.pi/3
                        px=sx+math.cos(ang)*.082*fac;pz=sz+math.sin(ang)*.071*fac
                        sv.append((px,front_surface(px,pz)-dep,pz))
                sf=[]
                for layer in range(2):
                    for k in range(6):sf.append((layer*6+k,layer*6+(k+1)%6,(layer+1)*6+(k+1)%6,(layer+1)*6+k))
                sf.append(tuple(12+k for k in range(6)))
                objmesh(bone+'_flush_scale_%d_%d'%(row,col),sv,sf,13 if (row+col)%3 else 6,bone,True,1)

# Tail is a bent tapered sculpt, not a sphere.
loft('Tail',[(.69,.16,.12,0,.46),(.98,.13,.105,0,.43),(1.13,.08,.065,.04,.44),(1.28,.015,.015,.075,.47)],tile=4,bone='tail',segments=12,subdiv=1)

# Main shell: a smooth dark substrate plus individually fitted mineral plates.
SHELL_Z=.68; SHELL_H=1.05; RX=.95; RY=1.08
def shell_surface(u,v,offset=0):
    r=max(.00001,math.sqrt(u*u+v*v)); angle=min(1,r)*math.pi/2
    sp=math.sin(angle); h=math.cos(angle); du=u/r; dv=v/r
    p=Vector((RX*du*sp,RY*dv*sp,SHELL_Z+SHELL_H*h))
    n=Vector((du*sp/RX,dv*sp/RY,h/SHELL_H)).normalized()
    return p+n*offset
verts=[]; faces=[]; N=48; NR=16
for k in range(NR+1):
    a=k/NR
    for j in range(N):
        t=2*math.pi*j/N
        verts.append(tuple(shell_surface(a*math.cos(t),a*math.sin(t))))
for k in range(NR):
    for j in range(N):faces.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
objmesh('Carapace_shadow_between_stones',verts,faces,15,'shell')

# Voronoi polygons clipped in the circular shell domain give interlocking,
# non-repeating stones. Their bevel rings follow the underlying dome.
sites=[(0,0)]
for count,r,rot in [(6,.34,.12),(11,.66,.26),(15,.91,.08)]:
    for j in range(count):
        a=j*2*math.pi/count+rot+RNG.uniform(-.035,.035)
        rr=r+RNG.uniform(-.018,.018)
        sites.append((rr*math.cos(a),rr*math.sin(a)))
if SCULPT_CANDIDATE:
    # An offset, jittered lattice avoids the prior concentric rows of equal
    # tiles. Boundary sites retain coverage but vary in width and elevation.
    sr=random.Random(2034010);sites=[]
    for row in range(-2,3):
        for col in range(-2,3):
            u=col*.30+(row%2)*.14+sr.uniform(-.075,.075)
            v=row*.30+sr.uniform(-.085,.085)
            if u*u+v*v<.72**2:sites.append((u,v))
    for j in range(14):
        a=j*2*math.pi/14+sr.uniform(-.045,.045);r=sr.uniform(.865,.955)
        sites.append((r*math.cos(a),r*math.sin(a)))
boundary=[(math.cos(i*2*math.pi/72),math.sin(i*2*math.pi/72)) for i in range(72)]
def clip(poly,nx,ny,d):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        fa=a[0]*nx+a[1]*ny-d; fb=b[0]*nx+b[1]*ny-d
        if fa<=0:result.append(a)
        if (fa<=0)!=(fb<=0):
            t=fa/(fa-fb); result.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return result
for idx,s in enumerate(sites):
    poly=boundary[:]
    for q in sites:
        if q==s:continue
        poly=clip(poly,q[0]-s[0],q[1]-s[1],(q[0]*q[0]+q[1]*q[1]-s[0]*s[0]-s[1]*s[1])/2)
    # Clamp awkward slivers, retaining all distinct polygon corners.
    if len(poly)<3:continue
    c=(sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly))
    vs=[]; fs=[]; n=len(poly)
    cp=shell_surface(c[0],c[1]);cn=(shell_surface(c[0],c[1],.1)-cp).normalized()
    rings=[(1.00,.005),(.98,.025),(.89,.072),(.63,.084),(.13,.084)]
    if SOFT_EDGE_CANDIDATE:rings=[(1.13,.005),(1.105,.025),(.98,.072),(.73,.084),(.13,.084)]
    cap_depth=.084
    if SCULPT_CANDIDATE:
        cap_depth=RNG.uniform(.065,.10)
        rings=[(1.075,.004),(1.055,.027),(.96,cap_depth-.008),(.82,cap_depth),(.13,cap_depth)]
    for ring,(fac,depth) in enumerate(rings):
        for p in poly:
            u=c[0]+(p[0]-c[0])*fac*.975; v=c[1]+(p[1]-c[1])*fac*.975
            pt=shell_surface(u,v,depth)
            if ring>=2:pt=pt-cn*((pt-cp).dot(cn)-((cap_depth-.008 if ring==2 else cap_depth) if SCULPT_CANDIDATE else (.074 if ring==2 else .084)))
            vs.append(tuple(pt))
    for k in range(4):
        for j in range(n):fs.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    fs.append(tuple(4*n+j for j in range(n)))
    stone=objmesh('Fitted_stone_%02d'%idx,vs,fs,idx%4,'shell',True,1 if SOFT_EDGE_CANDIDATE else 0)
    if SCULPT_CANDIDATE:
        # Keep broad stone planes while softening only the rim transitions.
        # This avoids both v09's cushions and v10a's manufactured armour plates.
        for face in stone.data.polygons:
            if face.normal.dot(cn)>.997:face.use_smooth=False
    stone.data.polygons[-1].use_smooth=False

# Lower hem has broad, slanted overlapping stones, a signature from reference A.
for j in range(18):
    a=j*2*math.pi/18+(RNG.uniform(-.025,.025) if SCULPT_CANDIDATE else 0)
    hem_lift=RNG.uniform(-.025,.025) if SCULPT_CANDIDATE else 0
    points=[]
    for da,z,r in [(-.17,.77,1.0),(.17,.77,1.0),(.165,.655,1.035),(0,.60,1.065),(-.165,.655,1.035)]:
        points.append((RX*r*math.cos(a+da),RY*r*math.sin(a+da),z+hem_lift))
    center=Vector((sum(p[0] for p in points)/5,sum(p[1] for p in points)/5,.69))
    vs=[]
    for f,dep in [(1,0),(.86,.065),(.60,.085)]:
        for p in points:
            v=center+(Vector(p)-center)*f+Vector((math.cos(a),math.sin(a),0))*dep
            vs.append(tuple(v))
    fs=[]
    for k in range(2):
        for q in range(5):fs.append((k*5+q,k*5+(q+1)%5,(k+1)*5+(q+1)%5,(k+1)*5+q))
    fs.append(tuple(10+q for q in range(5)))
    objmesh('Overlapping_rim_%02d'%j,vs,fs,(j+2)%4,'shell',True,1)

# Eyes sit within small sockets; head/shell proportion follows original A.
for sign,lab in [(-1,'L'),(1,'R')]:
    ex=sign*(.218 if SCULPT_CANDIDATE else .235)
    if SCULPT_CANDIDATE:
        ep,en=face_surface(ex,.870,0);en=Vector((en.x*.45,en.y,en.z*.25)).normalized()
        eye_detail('Eye_white_'+lab,ep-en*.026,(.096,.055,.115),9,en)
        eye_detail('Iris_'+lab,ep+en*.020+Vector((-sign*.005,0,-.003)),(.066,.010,.081),10,en)
        eye_detail('Pupil_'+lab,ep+en*.030+Vector((-sign*.005,0,-.002)),(.045,.007,.062),11,en)
        eye_detail('Eye_catchlight_'+lab,ep+en*.039+Vector((-.016,0,.025)),(.012,.004,.015),14,en)
        # Skin eyelid rim bridges onto the true head surface, partially covering
        # the sclera edge instead of leaving a white sticker contour.
        rot=Vector((0,-1,0)).rotation_difference(en);ev=[];ef=[];EN=32
        for ring in range(3):
            for j in range(EN):
                a=j*2*math.pi/EN;rx=[.119,.102,.089][ring];rz=[.140,.120,.102][ring]
                local=Vector((rx*math.cos(a),0,rz*math.sin(a)));p=ep+rot@local
                # The outer eyelid must remain on the real head silhouette.
                # Shrink invalid ring samples toward the socket instead of
                # letting a missing ray hit create a sharp fallback triangle.
                for retry in range(24):
                    hit,sp,sn,_=head_mesh.ray_cast(Vector((p.x,-3,p.z)),Vector((0,1,0)))
                    if hit:break
                    p=ep+(p-ep)*.94
                assert hit,('eyelid outside face',lab,ring,j)
                skin=sp+Vector((0,-.001,0))
                bridge=ep+rot@Vector((local.x,-(.003 if ring==1 else .011),local.z))
                # Reuse the valid surface x/z for the bridge so it cannot flare
                # beyond the cheek after the outer silhouette clamp.
                bridge.x=p.x;bridge.z=p.z
                p=skin if ring==0 else skin.lerp(bridge,.45 if ring==1 else .82)
                ev.append(tuple(p))
        for ring in range(2):
            for j in range(EN):ef.append((ring*EN+j,ring*EN+(j+1)%EN,(ring+1)*EN+(j+1)%EN,(ring+1)*EN+j))
        objmesh('Continuous_eyelid_'+lab,ev,ef,6,'head',True,0)
    elif FACE_CANDIDATE:
        ep,en=face_surface(ex,.865,0)
        en=Vector((en.x*.55,en.y,en.z*.35)).normalized()
        eye_detail('Eye_white_'+lab,ep-en*.014,(.106,.051,.126),9,en)
        eye_detail('Iris_'+lab,ep+en*.037,(.075,.013,.092),10,en)
        eye_detail('Pupil_'+lab,ep+en*.049,(.049,.009,.073),11,en)
        eye_detail('Eye_catchlight_'+lab,ep+en*.061+Vector((-.017,0,.030)),(.014,.004,.018),14,en)
    else:
        oval('Eye_socket_'+lab,(ex,-1.380,.856),(.121,.030,.144),5,'head')
        oval('Eye_white_'+lab,(ex,-1.420,.856),(.103,.048,.126),9,'head',seg=24,rings=14)
        oval('Iris_'+lab,(ex+sign*.005,-1.467,.850),(.076,.016,.094),10,'head',seg=24,rings=12)
        oval('Pupil_'+lab,(ex+sign*.005,-1.481,.852),(.050,.010,.074),11,'head',seg=20,rings=12)
        oval('Eye_catchlight_'+lab,(ex-.018,-1.493,.880),(.014,.005,.019),14,'head',seg=12,rings=8)
    # Straight low brows are dependable; the slight outward taper avoids anger.
    b=[]
    for k in range(9):
        t=k/8
        if SCULPT_CANDIDATE:b.append(tuple(face_surface(sign*(.115+.188*t),.977-.030*t+.013*math.sin(t*math.pi),.006)[0]))
        elif FACE_CANDIDATE:b.append(tuple(face_surface(sign*(.135+.170*t),.966-.025*t+.012*math.sin(t*math.pi),.009)[0]))
        else:b.append((sign*(.135+.205*t),-1.430+.034*t,.989-.018*t+.012*math.sin(t*math.pi)))
    tube('Steady_brow_'+lab,b,.026 if SCULPT_CANDIDATE else .033,5,'head')
    nostril=tuple(face_surface(sign*.09,.736,.004)[0]) if FACE_CANDIDATE else (sign*.090,-1.580,.736)
    oval('Nostril_'+lab,nostril,(.018,.005,.012),8,'head',seg=12,rings=8)
mouth=[]
for k in range(19):
    t=-1+2*k/18
    if SCULPT_CANDIDATE:mouth.append(tuple(face_surface(t*.254,.653+.034*t*t,.0025)[0]))
    elif FACE_CANDIDATE:mouth.append(tuple(face_surface(t*.25,.644+.038*t*t,.003)[0]))
    else:mouth.append((t*.250,-1.606+.066*t*t,.631+.038*t*t))
tube('Friendly_closed_mouth',mouth,.0065,8,'head',sides=6)
# Small sculptural chin plane and an unobtrusive cheek crease.
for side in [-1,1]:
    crease=[(side*.252,-1.464,.675),(side*.267,-1.453,.696),(side*.265,-1.446,.712)]
    if SCULPT_CANDIDATE:crease=[tuple(face_surface(side*x,z,.0015)[0]) for x,z in [(.248,.686),(.266,.700),(.268,.713)]]
    tube('Cheek_crease_'+str(side),crease,.005 if SCULPT_CANDIDATE else .008,5,'head',sides=6)

# Lower, braced proportions from original A: keep head size, reduce leg height
# 20%, spread lower forearms, lower dome 10% without inflating the face.
for ob in PARTS:
    bone=ob['bone']
    for v in ob.data.vertices:
        z=v.co.z
        if bone.startswith(('front_','rear_')):
            spread=max(0,min(1,(.82-z)/.74))
            v.co.x+=(-1 if bone.endswith('L') else 1)*.10*spread
            if bone.startswith('front_'):v.co.y-=.08*spread
            v.co.z=.08+(z-.08)*.80
        elif bone=='shell':v.co.z=SHELL_Z-.12+(z-SHELL_Z)*.90
        else:v.co.z-=.12
        v.co.z-=.08

# Rig: genuinely skinned edit-friendly meshes, named deform bones and six clips.
arm_data=bpy.data.armatures.new('StoneTurtle_skeleton')
rig=bpy.data.objects.new('StoneTurtle_Rig',arm_data); CHAR.objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec={
 'root':((0,0,0),(0,0,.25),None),
 'body':((0,0,.38),(0,0,.83),'root'),
 'shell':((0,0,.65),(0,0,1.16),'body'),
 'neck':((0,-.65,.60),(0,-.94,.60),'body'),
 'head':((0,-.94,.60),(0,-1.47,.63),'neck'),
 'front_L':((-.65,-.54,.536),(-.83,-.72,.152),'body'),
 'front_R':((.65,-.54,.536),(.83,-.72,.152),'body'),
 'rear_L':((-.62,.64,.536),(-.80,.54,.152),'body'),
 'rear_R':((.62,.64,.536),(.80,.54,.152),'body'),
 'tail':((0,.72,.31),(.07,1.22,.34),'body'),
}
for name,(head,tail,parent) in spec.items():
    b=arm_data.edit_bones.new(name)
    b.head=(head[0],head[1],head[2]-(.08 if name!='root' else 0))
    b.tail=(tail[0],tail[1],tail[2]-(.08 if name!='root' else 0))
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT'); rig.select_set(False)
for ob in PARTS:
    vg=ob.vertex_groups.new(name=ob['bone']); vg.add(list(range(len(ob.data.vertices))),1.0,'REPLACE')
    mod=ob.modifiers.new('Armature_deformation','ARMATURE'); mod.object=rig
    ob.parent=rig
for b in rig.pose.bones:b.rotation_mode='XYZ'
scene=bpy.context.scene; scene.render.fps=30
feet={name:[v.co.copy() for ob in PARTS if ob['bone']==name for v in ob.data.vertices if v.co.z<.07] for name in ['front_L','front_R','rear_L','rear_R']}

def setpose(frame,body_z=0,body_pitch=0,head_pitch=0,neck_back=0,body_y=0,legs=0,shell_pulse=0,tail=0):
    for pb in rig.pose.bones:
        pb.location=(0,0,0); pb.rotation_euler=(0,0,0); pb.scale=(1,1,1)
    rig.pose.bones['root'].location=rig.data.bones['root'].matrix_local.to_3x3().inverted() @ Vector((0,0,body_z))
    rig.pose.bones['body'].rotation_euler.x=body_pitch
    rig.pose.bones['body'].location=rig.data.bones['body'].matrix_local.to_3x3().inverted() @ Vector((0,body_y,0))
    rig.pose.bones['head'].rotation_euler.x=head_pitch
    rig.pose.bones['neck'].location=rig.data.bones['neck'].matrix_local.to_3x3().inverted() @ Vector((0,neck_back,0))
    rig.pose.bones['shell'].scale=(1+shell_pulse,1+shell_pulse,1+shell_pulse)
    rig.pose.bones['tail'].rotation_euler.y=tail
    for name in ['front_L','front_R','rear_L','rear_R']:
        rig.pose.bones[name].rotation_euler.x=legs*(1 if name.startswith('front') else -1)
    # Feet stay on the actual ground in standing/breathing/recoil poses. Airborne
    # skill and fusion key poses retain their deliberate small hop.
    bpy.context.view_layer.update()
    if body_z<=.05:
        for name,points in feet.items():
            pb=rig.pose.bones[name]
            deform=pb.matrix @ pb.bone.matrix_local.inverted()
            lowest=min((deform @ p).z for p in points)
            basis=pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() @ pb.bone.matrix_local
            pb.location+=basis.to_3x3().inverted() @ Vector((0,0,-lowest))
    for pb in rig.pose.bones:
        pb.keyframe_insert('location',frame=frame,group=pb.name)
        pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name)
        pb.keyframe_insert('scale',frame=frame,group=pb.name)

CLIPS={
 'idle':[(1,{}),(24,{'body_z':.012,'head_pitch':-.025,'tail':.05}),(48,{'body_z':0,'head_pitch':0,'tail':-.04}),(72,{})],
 'attack':[(1,{}),(7,{'body_y':.08,'head_pitch':-.10,'legs':-.045}),(11,{'body_y':-.15,'head_pitch':.13,'body_pitch':.045,'legs':.07}),(17,{'body_y':-.025,'head_pitch':.025}),(27,{})],
 'skill':[(1,{}),(10,{'body_z':-.045,'head_pitch':.16,'neck_back':.035,'legs':.10}),(16,{'body_z':.075,'body_pitch':-.055,'head_pitch':-.24,'shell_pulse':.025}),(25,{'body_z':-.025,'legs':.06,'shell_pulse':.013}),(42,{})],
 'hit':[(1,{}),(4,{'body_y':.065,'body_pitch':-.055,'head_pitch':.15,'neck_back':.06}),(10,{'body_y':.015,'head_pitch':.055}),(18,{})],
 'rest':[(1,{'body_z':-.030,'neck_back':.10,'head_pitch':.15,'legs':.07}),(36,{'body_z':-.035,'neck_back':.10,'head_pitch':.17,'legs':.07}),(72,{'body_z':-.030,'neck_back':.10,'head_pitch':.15,'legs':.07})],
 'fusion':[(1,{}),(12,{'body_z':-.05,'head_pitch':.12,'legs':.08}),(23,{'body_z':.14,'head_pitch':-.16,'legs':-.14,'tail':.16}),(31,{'body_z':-.035,'head_pitch':.08,'legs':.10}),(43,{'body_z':.06,'head_pitch':-.10}),(60,{})],
}
rig.animation_data_create()
for name,keys in CLIPS.items():
    act=bpy.data.actions.new(name); rig.animation_data.action=act
    for frame,kwargs in keys:setpose(frame,**kwargs)
    act.use_fake_user=True
    track=rig.animation_data.nla_tracks.new(); track.name=name
    strip=track.strips.new(name,1,act); strip.name=name; track.mute=True
rig.animation_data.action=bpy.data.actions['idle']; scene.frame_set(1)

# Preserve editable components and source palette. Export a merged draw-call mesh
# using one atlas while keeping the richly separated original in the .blend.
scene.world.color=(.14,.14,.14)
atlas.pack();rough_atlas.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'stone-turtle.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in PARTS:o.select_set(True)
bpy.context.view_layer.objects.active=PARTS[0]
bpy.ops.object.join(); merged=bpy.context.object; merged.name='StoneTurtle_SkinnedMesh'
# All atlas materials can be one physical material once the UVs are placed.
merged.data.materials.clear(); merged.data.materials.append(MATS[1])
for p in merged.data.polygons:p.material_index=0
# Preserve the full editable sculpt source, but export the actual reviewed LOD.
decimate=merged.modifiers.new('Runtime_LOD_preserve_skinning','DECIMATE');decimate.ratio=.60
bpy.context.view_layer.objects.active=merged
bpy.ops.object.modifier_move_up(modifier=decimate.name)
bpy.ops.object.modifier_apply(modifier=decimate.name)
rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'stone-turtle.fbx'),use_selection=True,
    object_types={'MESH','ARMATURE'},add_leaf_bones=False,axis_forward='-Z',axis_up='Y',
    apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,
    bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0.0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'stone-turtle.glb'),use_selection=True,
    export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',
    export_nla_strips=True,export_yup=True)
stats={'version':'stone-sample-10-candidate' if SCULPT_CANDIDATE else (('stone-sample-09-candidate' if ISOLATED_CANDIDATE else 'stone-sample-09') if FACE_CANDIDATE else ('stone-sample-08-candidate' if SOFT_EDGE_CANDIDATE else 'stone-sample-07')),'vertices':len(merged.data.vertices),
       'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),
       'bones':len(arm_data.bones),'clips':{k:(max(f for f,_ in v)-1)/30 for k,v in CLIPS.items()},
       'atlas':{'size':1024,'colour':'stone-colour.png','roughness':'stone-roughness.png'},'forward':'-Y in Blender; Cocos imported prefab faces +Z',
       'source':'Original scripted mesh, atlas, rig and keyframes; preserved project AI concept references do not imply exclusive-rights clearance.',
       'status':'Rendered sample awaiting comparison and user aesthetic acceptance; not final art approval.'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# A neutral contact sheet is real geometry rendered in four views. It is not a
# painted model substitute; runtime and source above contain the same skinned mesh.
scene.render.engine='CYCLES'; scene.cycles.samples=16 if FAST_REVIEW else 48
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'; scene.render.threads=4
scene.render.resolution_x=900 if FAST_REVIEW else 1200;scene.render.resolution_y=750 if FAST_REVIEW else 1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.64,.70,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX'
def simplemat(name,col,rough=.6):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
floor=bpy.context.object;floor.name='Studio_floor';floor.data.materials.append(simplemat('Warm_ivory_floor',(.72,.68,.57)))
for name,loc,power,size,col in [('Key',(-3,-4,6),650,4.0,(1,.91,.74)),('Fill',(4,-1,3),400,3.0,(.78,.90,1)),('Rim',(1,4,5),800,3.0,(1,.96,.84))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=col
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('ArtReviewCamera');cam=bpy.data.objects.new('ArtReviewCamera',camdata)
scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=3.6
views=[('three-quarter',(3.6,-5.4,3.0),(0,-.12,.91)),('front',(0,-6,2.2),(0,-.12,.88)),('side',(6,-.6,2.5),(0,0,.91)),('battle',(3.8,-5.2,5.3),(0,-.1,.88))]
for name,loc,target in views[:1] if FAST_REVIEW else views:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
# A second source file stores lights/camera for exact repeatable visual QA.
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
print('STONE_TURTLE_EXPORT_COMPLETE '+json.dumps(stats))
