"""Original leaf-turtle candidate 01, closed layered leaf meshes and toy pigments.
Blender -b -t 2 --python-exit-code 1. Only leaf-turtle/candidate-01 is written.
Shared authored body, head and rig use a frozen local foundation. Leaves, face
details, opaque pigment atlas and six actions are generated here from editable
source parameters. No runtime promotion, external model, or raster-image edit.
"""
import bpy, bmesh, hashlib, json, math, random, shutil, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT/'game/art-source/leaf-turtle/candidate-01'
OUT = HERE/'export'; INPUT = HERE/'inputs'
for directory in [HERE, OUT, INPUT]: directory.mkdir(parents=True, exist_ok=True)
ORIGINAL = ROOT/'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle.blend'
FOUNDATION = INPUT/'authored-c12b-foundation.blend'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
protected_paths=[ORIGINAL, ROOT/'game/art-source/build_stone_turtle_candidate12b.py',
    ROOT/'game/art-source/stone_turtle_atlas.py', ROOT/'game/art-source/build_spike_turtle_candidate02.py',
    ROOT/'game/art-source/spike-turtle/candidate-02/spike-turtle.blend',
    ROOT/'game/art-source/spike-turtle/candidate-02/export/spike-turtle.fbx',
    ROOT/'game/art-source/build_crystal_turtle_candidate01.py',ROOT/'game/art-source/build_crystal_turtle_candidate02.py',
    ROOT/'game/art-source/crystal-turtle/candidate-02/crystal-turtle.blend',
    ROOT/'game/art-source/crystal-turtle/candidate-02/export/crystal-turtle.fbx']
for species in ['stone-turtle','spike-turtle','crystal-turtle']:
    protected_paths += [p for p in (ROOT/'game/assets/resources/models'/species).glob('*') if p.is_file() and not p.name.endswith('.meta')]
protected_paths=[p for p in protected_paths if p.is_file()]
protected = {str(p.relative_to(ROOT)):sha(p) for p in protected_paths}
if not FOUNDATION.exists(): shutil.copy2(ORIGINAL, FOUNDATION)
assert sha(FOUNDATION) == '53f828584edcc3d93c1b28a01883fe768db106a1fd44f27b5f95d729482a4ac3', 'Frozen shared foundation mismatch; do not overwrite silently'
write(INPUT/'provenance.json', {'original_source':str(ORIGINAL.relative_to(ROOT)), 'sha256':sha(FOUNDATION),
    'reuse':'Self-authored c12b head/eyes/short limbs/rig. Shell, brows, mouth, atlas and six action curves are rebuilt by this leaf candidate script.',
    'rights':'Original project-authored mesh; no external asset extraction.', 'raster_inputs':[]})
bpy.ops.wm.open_mainfile(filepath=str(FOUNDATION))
scene = bpy.context.scene; scene.render.fps=30
rig = next(o for o in scene.objects if o.type=='ARMATURE'); rig.name='LeafTurtle_Rig'; rig.data.name='LeafTurtle_skeleton'
CHAR=bpy.data.collections['STONE_TURTLE_EDITABLE_PARTS']; CHAR.name='LEAF_TURTLE_EDITABLE_PARTS'
parts=[o for o in CHAR.objects if o.type=='MESH' and 'bone' in o]
for ob in list(parts):
    if ob['bone']=='shell' or ob.name.startswith(('Steady_brow','Friendly_closed_mouth','Cheek_crease')):
        parts.remove(ob); bpy.data.objects.remove(ob,do_unlink=True)
rig.animation_data_clear()
for action in list(bpy.data.actions): bpy.data.actions.remove(action)
for bone in rig.pose.bones:
    bone.location=(0,0,0); bone.rotation_mode='XYZ'; bone.rotation_euler=(0,0,0); bone.scale=(1,1,1)
bpy.context.view_layer.update()

# Self-authored full-atlas equations, local parameters and no image inputs.
PALETTE=[(.280,.430,.055),(.400,.560,.073),(.510,.650,.115),(.335,.500,.067),
    (.320,.390,.095),(.490,.590,.230),(.770,.670,.280),(.590,.660,.290),
    (.085,.082,.025),(.970,.950,.840),(.340,.220,.080),(.030,.025,.012),
    (.710,.750,.390),(.230,.380,.050),(.945,.968,.866),(.130,.240,.025)]
ATLAS_PARAMETERS={'size':1024,'tile_grid':[4,4],'noise_seed':81207,'palette':PALETTE,
    'iris_colour':[.305,.210,.052],'iris_uv_center':[.5,.49], 'iris_uv_radii':[.415,.411],
    'pupil_uv_radii':[.302,.314],'raster_inputs':[],
    'leaf_surface_policy':'Closed original curled leaf geometry; subtle analytic midrib pigment, no raster inputs.',
    'leaf_roughness':.35,
    'provenance':'Local numeric pigment/grain generator; eye UV equations reused from self-authored stone_turtle_atlas.py.'}
def build_atlas(directory):
    directory=Path(directory); directory.mkdir(parents=True,exist_ok=True)
    size=ATLAS_PARAMETERS['size']; tile=size//4; pixels=np.ones((size,size,4),dtype=np.float32)
    yy,xx=np.mgrid[0:tile,0:tile].astype(np.float32); rng=np.random.default_rng(ATLAS_PARAMETERS['noise_seed'])
    for index,base in enumerate(PALETTE):
        noise=rng.normal(0,.0025,(tile,tile)); warm_band=.004*np.sin(xx*.044+np.sin(yy*.027))*np.sin(yy*.033)
        if index<4:
            # Vein pigment follows the leaf's own semantic U/V coordinates.
            # The raised midrib, lamina volume and rounded tip are real meshes.
            u=(xx+.5)/tile; v=(yy+.5)/tile
            warm_band += .019*np.exp(-((u-.5)/.022)**2)*np.sin(np.pi*v)**.6
            for base_v in [.24,.40,.56,.72]:
                branch=v-(base_v+.36*abs(u-.5))
                warm_band += .006*np.exp(-(branch/.012)**2)*np.clip(1-abs(u-.5)/.47,0,1)
        if index>=8: warm_band*=.2; noise*=.3
        rgba=np.ones((tile,tile,4),dtype=np.float32)
        for channel,value in enumerate(base): rgba[:,:,channel]=np.clip(value+noise+warm_band,0,1)
        if index==9:
            u=(xx+.5)/tile;v=(yy+.5)/tile
            distance=np.sqrt(((u-.5)/.415)**2+((v-.49)/.411)**2)
            pupil_distance=np.sqrt(((u-.5)/.302)**2+((v-.49)/.314)**2)
            angle=np.arctan2(v-.49,u-.5); iris=np.zeros_like(rgba[:,:,:3]); grain=.011*np.sin(angle*37+distance*10)
            for channel,value in enumerate(ATLAS_PARAMETERS['iris_colour']): iris[:,:,channel]=value+grain-.065*np.clip((distance-.76)/.24,0,1)
            blend=np.clip((1-distance)*tile/1.4,0,1)[:,:,None];rgba[:,:,:3]=rgba[:,:,:3]*(1-blend)+iris*blend
            pupil=np.clip((1-pupil_distance)*tile/1.3,0,1)[:,:,None]
            rgba[:,:,:3]=rgba[:,:,:3]*(1-pupil)+np.array((.027,.023,.012))*pupil
            for cx,cy,rx,ry,colour in [(.405,.665,.056,.067,(.994,.983,.922)),(.632,.363,.019,.025,(.896,.876,.626))]:
                glint=np.clip((1-np.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2))*tile/1.4,0,1)[:,:,None]
                rgba[:,:,:3]=rgba[:,:,:3]*(1-glint)+np.array(colour)*glint
        pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile]=rgba
    atlas=bpy.data.images.new('LeafTurtle_Colour_1024',width=size,height=size,alpha=True)
    atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(directory/'leaf-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    rough_pixels=np.ones((size,size,4),dtype=np.float32)
    for index in range(16):
        roughness=ATLAS_PARAMETERS['leaf_roughness'] if index<4 else (.18 if index in (9,10,11,14) else .44)
        rough_pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile,:3]=roughness
    rough=bpy.data.images.new('LeafTurtle_Roughness_1024',width=size,height=size,alpha=True)
    rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rough_pixels.ravel())
    rough.filepath_raw=str(directory/'leaf-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
    return atlas,rough

atlas,rough=build_atlas(OUT); write(HERE/'atlas-parameters.json',ATLAS_PARAMETERS)
MATS=[]
for index in range(16):
    mat=bpy.data.materials.new('LeafAtlas_%02d'%index);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Specular IOR Level'].default_value=.32
    bsdf.inputs['Alpha'].default_value=1;bsdf.inputs['Transmission Weight'].default_value=0;bsdf.inputs['Metallic'].default_value=0
    mat['mobile_alpha_policy']='Opaque: no refraction/transparency/sorting dependency'
    for image,socket in [(atlas,'Base Color'),(rough,'Roughness')]:
        texture=mat.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
        mat.node_tree.links.new(texture.outputs['Color'],bsdf.inputs[socket])
    MATS.append(mat)
for ob in parts:
    tile=int(ob['atlas_tile']);ob.data.materials.clear();ob.data.materials.append(MATS[tile])
    for polygon in ob.data.polygons:polygon.material_index=0
# Remove packed old atlases now that no material is needed by a part.
for material in list(bpy.data.materials):
    if material.name.startswith('StoneAtlas_'):bpy.data.materials.remove(material)
for image in list(bpy.data.images):
    if image.name.startswith('StoneTurtle_'):bpy.data.images.remove(image)

def objmesh(name,vertices,faces,tile,bone='shell',smooth=True,subdiv=0):
    mesh=bpy.data.meshes.new(name+'_mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);CHAR.objects.link(ob);ob['bone']=bone;ob['atlas_tile']=tile
    mesh.materials.append(MATS[tile])
    for polygon in mesh.polygons:polygon.use_smooth=smooth
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    if subdiv:
        mod=ob.modifiers.new('Rounded_authored_surface','SUBSURF');mod.levels=subdiv;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.1519,island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
    for uv in ob.data.uv_layers.active.data:uv.uv=((tile%4+.04+uv.uv.x*.92)/4,(tile//4+.04+uv.uv.y*.92)/4)
    group=ob.vertex_groups.new(name=bone);group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('Armature_deformation','ARMATURE');mod.object=rig;ob.parent=rig
    ob.select_set(False);parts.append(ob);return ob

def tube(name,points,radius,tile,bone='head',sides=12):
    points=[Vector(p) for p in points];vertices=[];faces=[]
    for i,point in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        normal=tangent.cross(Vector((0,1,0))).normalized();other=tangent.cross(normal).normalized()
        r=radius*(.20+.80*math.sin(math.pi*i/(len(points)-1))**.45)
        for j in range(sides):
            angle=2*math.pi*j/sides;vertices.append(tuple(point+r*(normal*math.cos(angle)+other*math.sin(angle))))
    for i in range(len(points)-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
    return objmesh(name,vertices,faces,tile,bone)

# A4 warm female character: gentle brows with a tiny inquisitive asymmetry,
# warm amber-olive eyes and a short smile; same authored face/limb volume.
head=bpy.data.objects['Head_sculpt']
def face_z(z):return .75+(z-.75)*1.15-.20
def surface(x,z,lift=0):
    hit,point,normal,_=head.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    assert hit,('facial feature outside head',x,z)
    return point+Vector((0,-lift,0))
for sign,label in [(-1,'L'),(1,'R')]:
    points=[]
    for j in range(17):
        t=j/16;z=1.028+.010*t+.062*math.sin(math.pi*t)+(.004 if sign<0 else 0)
        points.append(surface(sign*(.183+.232*t),face_z(z),.012))
    tube('Gentle_inquisitive_brow_'+label,points,.034,13,sides=12)
    lash=[surface(sign*x,face_z(z),.010) for x,z in [(.454,.981),(.477,.986),(.493,1.006)]]
    tube('Restrained_outer_eye_accent_'+label,lash,.0075,8,sides=10)
mouth=[surface(t*.315,face_z(.651+.044*t*t+.005*t),.0025) for t in [-1+2*j/30 for j in range(31)]]
tube('Warm_leaf_smile',mouth,.0063,8,sides=10)

# A4 layered leaf carapace: thick, rounded toy leaves overlap down the dome.
# Each leaf is a closed authored mesh. No raster reference is a geometry input.
RX,RY,Z,H=.91,1.025,.46,.86
def shell_surface(u,v,offset=0):
    r=max(.00001,math.hypot(u,v));angle=min(1.075,r)*math.pi/2
    sn=math.sin(angle);cs=math.cos(angle)
    point=Vector((RX*u/r*sn,RY*v/r*sn,Z+H*cs))
    normal=Vector((u/r*sn/RX,v/r*sn/RY,cs/H)).normalized()
    return point+normal*offset,normal
vertices=[(0,0,Z+H)];faces=[];N=64;NR=15
for ring in range(1,NR+1):
    for j in range(N):
        a=2*math.pi*j/N;vertices.append(tuple(shell_surface(ring/NR*math.cos(a),ring/NR*math.sin(a))[0]))
for j in range(N):faces.append((0,1+j,1+(j+1)%N))
for ring in range(NR-1):
    for j in range(N):
        a=1+ring*N+j;b=1+ring*N+(j+1)%N;faces.append((a,b,b+N,a+N))
faces.append(tuple(1+(NR-1)*N+j for j in range(N-1,-1,-1)))
objmesh('Leaf_shell_core',vertices,faces,15)

def leaf(name,u,v,direction,length,halfwidth,offset,tile,phase):
    sweep=Vector((math.cos(direction),math.sin(direction)))
    across=Vector((-sweep.y,sweep.x))
    vertices=[];faces=[];semantic_uv=[]
    longitudinal=[.005,.035,.08,.16,.26,.38,.50,.62,.74,.84,.92,.97,.995]
    sides=12
    for s in longitudinal:
        width=halfwidth*math.sin(math.pi*s)**.69
        bow=.025*math.sin(math.pi*s)*math.sin(phase)
        for j in range(sides):
            a=2*math.pi*j/sides;t=math.cos(a);top=math.sin(a)
            asymmetry=1+.045*t*math.sin(phase)
            q=Vector((u,v))+sweep*(length*(s-.44))+across*(width*t*asymmetry+bow)
            lift=offset+.022*math.sin(math.pi*s)
            lift += (.014+.016*math.sin(math.pi*s))*top
            lift += max(0,top)**2*.025*math.sin(math.pi*s)
            lift += .026*s**6
            point,normal=shell_surface(q.x,q.y,lift)
            vertices.append(tuple(point));semantic_uv.append((.5+.465*t,.04+.92*s))
    for ring in range(len(longitudinal)-1):
        for j in range(sides):
            faces.append((ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(longitudinal)-1)*sides+j for j in range(sides))])
    ob=objmesh(name,vertices,faces,tile,smooth=True)
    for polygon in ob.data.polygons:
        for li in polygon.loop_indices:
            vid=ob.data.loops[li].vertex_index;tu,tv=semantic_uv[vid]
            ob.data.uv_layers.active.data[li].uv=((tile%4+.04+tu*.92)/4,(tile//4+.04+tv*.92)/4)
    ob['authored_leaf_parameters']={'u':u,'v':v,'direction':direction,'length':length,'halfwidth':halfwidth,'offset':offset,'phase':phase}
    return ob

LEAVES=[];rng=random.Random(81207)
# Alternating rings avoid a radial flower/pinecone grid; the lower, lighter row
# retains A4's soft scalloped hem while every upper row overlaps its stems.
for row,(radius,count,length,width,offset) in enumerate([
    (.90,14,.53,.220,.025),(.69,13,.58,.255,.052),
    (.47,10,.60,.265,.078),(.24,7,.53,.265,.110)]):
    for j in range(count):
        angle=2*math.pi*(j+.44*(row%2))/count+.08*row
        u=radius*math.cos(angle);v=radius*math.sin(angle)
        direction=angle+rng.uniform(-.24,.24)
        params=(u,v,direction,length*rng.uniform(.94,1.06),width*rng.uniform(.94,1.06),offset+rng.uniform(-.004,.006),2 if row==0 and j%3 else [0,1,3,1,2][(j+row)%5],j*.77+row)
        LEAVES.append(params)
for j in range(3):
    a=2*math.pi*j/3+.26
    LEAVES.append((.035*math.cos(a),.035*math.sin(a),a,.46,.213,.145,[1,2,1][j],j+.7))
for index,params in enumerate(LEAVES):
    leaf('Layered_leaf_%02d'%index,*params)

# Two tiny natural white blossoms follow A4's shell flora; no wearable accessory.
# A continuous five-lobed petal disk and small pollen dome keep mobile cost low.
def blossom(name,u,v):
    center,normal=shell_surface(u,v,.100)
    tangent=normal.cross(Vector((0,0,1))).normalized()
    if tangent.length<.1:tangent=Vector((1,0,0))
    other=normal.cross(tangent).normalized()
    n=40;vertices=[tuple(center+normal*.012)];faces=[]
    for r,z in [(.50,.013),(1,0),(.92,-.014)]:
        for j in range(n):
            a=2*math.pi*j/n;radius=(.049+.014*math.cos(5*a)) *r
            vertices.append(tuple(center+radius*(tangent*math.cos(a)+other*math.sin(a))+normal*z))
    for j in range(n):faces.append((0,1+j,1+(j+1)%n))
    for ring in range(2):
        for j in range(n):
            a=1+ring*n+j;b=1+ring*n+(j+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(1+2*n+j for j in range(n-1,-1,-1)))
    objmesh(name+'_petals',vertices,faces,14)
    vertices=[tuple(center+normal*.027)];faces=[];n=16
    for j in range(n):
        a=2*math.pi*j/n;vertices.append(tuple(center+normal*.013+.016*(tangent*math.cos(a)+other*math.sin(a))))
    for j in range(n):faces.append((0,1+j,1+(j+1)%n))
    faces.append(tuple(range(n,0,-1)))
    objmesh(name+'_pollen',vertices,faces,6)
blossom('Small_shell_blossom_L',-.85,.13)
blossom('Small_shell_blossom_R',.84,.24)

# Match the approved family's shell width, leaving head and limbs untouched.
shell_parts=[ob for ob in parts if ob['bone']=='shell']
shell_min=min(v.co.x for ob in shell_parts for v in ob.data.vertices)
shell_max=max(v.co.x for ob in shell_parts for v in ob.data.vertices)
shell_center=(shell_min+shell_max)/2
for ob in shell_parts:
    for v in ob.data.vertices:v.co.x=(v.co.x-shell_center)*(2.03/(shell_max-shell_min))
    ob.data.update()

# Six original clips keep the same ten-bone names and blend-friendly endpoints.
# Leaf attacks gently nod/release; its skill opens the carapace in a soft lift.
FEET={name:[v.co.copy() for ob in parts if ob['bone']==name for v in ob.data.vertices if v.co.z<.07] for name in ['front_L','front_R','rear_L','rear_R']}
def setpose(frame,body_z=0,body_pitch=0,head_pitch=0,neck_back=0,body_y=0,legs=0,shell_pulse=0,shell_pitch=0,tail=0):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].location=rig.data.bones['root'].matrix_local.to_3x3().inverted()@Vector((0,0,body_z))
    rig.pose.bones['body'].rotation_euler.x=body_pitch
    rig.pose.bones['body'].location=rig.data.bones['body'].matrix_local.to_3x3().inverted()@Vector((0,body_y,0))
    rig.pose.bones['head'].rotation_euler.x=head_pitch
    rig.pose.bones['neck'].location=rig.data.bones['neck'].matrix_local.to_3x3().inverted()@Vector((0,neck_back,0))
    rig.pose.bones['shell'].scale=(1+shell_pulse,1+shell_pulse,1+shell_pulse)
    rig.pose.bones['shell'].rotation_euler.x=shell_pitch;rig.pose.bones['tail'].rotation_euler.y=tail
    for name in FEET:rig.pose.bones[name].rotation_euler.x=legs*(1 if name.startswith('front') else -1)
    bpy.context.view_layer.update()
    if body_z<=.05:
        for name,points in FEET.items():
            pb=rig.pose.bones[name];deform=pb.matrix@pb.bone.matrix_local.inverted()
            lowest=min((deform@p).z for p in points)
            basis=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
            pb.location+=basis.to_3x3().inverted()@Vector((0,0,-lowest))
    for pb in rig.pose.bones:
        for channel in ['location','rotation_euler','scale']:pb.keyframe_insert(channel,frame=frame,group=pb.name)
CLIPS={
 'idle':[(1,{}),(24,{'body_z':.013,'head_pitch':-.018,'tail':.07}),(48,{'head_pitch':.01,'tail':-.035}),(72,{})],
 'attack':[(1,{}),(8,{'body_z':-.010,'head_pitch':.055,'shell_pulse':.008}),(13,{'body_z':.020,'head_pitch':-.055,'shell_pitch':-.008,'shell_pulse':.020}),(20,{'body_z':.005,'head_pitch':-.010,'shell_pulse':.006}),(27,{})],
 'skill':[(1,{}),(12,{'body_z':-.022,'neck_back':.018,'head_pitch':.052,'legs':.034,'shell_pulse':.012}),(20,{'body_z':.041,'head_pitch':-.072,'shell_pulse':.036,'tail':.09}),(28,{'body_z':.012,'head_pitch':.012,'shell_pulse':.018,'tail':-.04}),(35,{'body_z':.003,'shell_pulse':.005}),(42,{})],
 'hit':[(1,{}),(4,{'body_y':.04,'body_pitch':-.035,'head_pitch':.12,'neck_back':.036}),(10,{'body_y':.010,'head_pitch':.030}),(18,{})],
 'rest':[(1,{'body_z':-.025,'neck_back':.06,'head_pitch':.12,'legs':.05}),(36,{'body_z':-.030,'neck_back':.06,'head_pitch':.135,'legs':.05}),(72,{'body_z':-.025,'neck_back':.06,'head_pitch':.12,'legs':.05})],
 'fusion':[(1,{}),(12,{'body_z':-.04,'head_pitch':.08,'legs':.07,'shell_pulse':.014}),(23,{'body_z':.12,'head_pitch':-.13,'legs':-.11,'tail':.17,'shell_pulse':.034}),(31,{'body_z':-.028,'head_pitch':.06,'legs':.08}),(43,{'body_z':.06,'head_pitch':-.07}),(60,{})]}
rig.animation_data_create()
for name,keys in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame,kwargs in keys:setpose(frame,**kwargs)
    action.use_fake_user=True;track=rig.animation_data.nla_tracks.new();track.name=name
    track.strips.new(name,1,action).name=name;track.mute=True
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
def bounds(objects):
    pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    low=[min(p[a] for p in pts) for a in range(3)];high=[max(p[a] for p in pts) for a in range(3)]
    return {'min':low,'max':high,'dimensions':[high[a]-low[a] for a in range(3)]}
proportions={'head':bounds([head]),'shell_main':bounds([o for o in parts if o['bone']=='shell']),'whole':bounds(parts)}
proportions['head_to_main_shell']=proportions['head']['dimensions'][0]/proportions['shell_main']['dimensions'][0]
for ob in parts:
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in ob.data.vertices),ob.name
atlas.pack();rough.pack();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'leaf-turtle.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();merged=bpy.context.object
merged.name='LeafTurtle_SkinnedMesh';merged.data.materials.clear();merged.data.materials.append(MATS[1])
for polygon in merged.data.polygons:polygon.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
modifier=merged.modifiers.new('Runtime_LOD_preserve_skinning','DECIMATE');modifier.ratio=min(.68,28900/triangles)
bpy.ops.object.modifier_move_up(modifier=modifier.name);bpy.ops.object.modifier_apply(modifier=modifier.name)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'leaf-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'leaf-turtle.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)

scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=800;scene.render.resolution_y=680;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.64,.70,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='Studio_floor'
mat=bpy.data.materials.new('Warm_ivory_floor');mat.use_nodes=True
bsdf=mat.node_tree.nodes['Principled BSDF'];bsdf.inputs['Base Color'].default_value=(.72,.68,.57,1);bsdf.inputs['Roughness'].default_value=.6
floor.data.materials.append(mat)
for name,location,power,size,colour in [('Key',(-3,-4,6),650,4,(1,.91,.74)),('Fill',(4,-1,3),400,3,(.78,.90,1)),('Rim',(1,4,5),800,3,(1,.96,.84))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colour
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=location
    light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('ArtReviewCamera');camera=bpy.data.objects.new('ArtReviewCamera',data)
scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.8
views=[('front',(0,-6,2.2),(0,-.12,.92)),('three-quarter',(3.6,-5.4,3),(0,-.12,.95)),('side',(6,-.6,2.5),(0,0,.95))]
if '--no-render' not in sys.argv:
    for name,location,target in views:
        camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        data.ortho_scale=4.8 if name=='battle' else 3.8
        scene.render.filepath=str(HERE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'leaf-turtle-review-scene.blend'))
assert protected=={str(p.relative_to(ROOT)):sha(p) for p in protected_paths},'Protected stone source or runtime changed'
write(HERE/'candidate-manifest.json',{'status':'Leaf candidate-01: three preview views pending root review, no runtime promotion','species':'leaf','display_name':'叶子龟','character':'Warm inquisitive female leaf-shell turtle',
    'source_foundation':str(FOUNDATION.relative_to(ROOT)),'foundation_sha256':sha(FOUNDATION),'protected_inputs':protected,
    'proportions':proportions,'source_parts':len(parts),'layered_leaves':len(LEAVES),'small_natural_blossoms':2,'opaque_material':True,'leaf_seed':81207,
    'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'vertices':len(merged.data.vertices),'bones':len(rig.data.bones),'materials':len(merged.data.materials),
    'clips':{name:{'last_frame':max(frame for frame,_ in keys),'seconds':(max(frame for frame,_ in keys)-1)/30} for name,keys in CLIPS.items()},
    'atlas_parameters':ATLAS_PARAMETERS,'fbx_sha256':sha(OUT/'leaf-turtle.fbx'),'source_blend_sha256':sha(HERE/'leaf-turtle.blend'),
    'atlas_sha256':{p.name:sha(p) for p in OUT.glob('*.png')},'threads':2,'render_size':[800,680],'samples':32,
    'forward_blender':'-Y','up_blender':'+Z','fbx_export_forward':'-Z','fbx_export_up':'+Y','cocos_expected_forward':'+Z','battle_scale':.65,'ground_y_cocos':0,
    'notes':['Closed layered leaf meshes, raised lamina volume and analytic vein pigments; two tiny natural shell blossoms as in A4. No transparency or wearable accessories.','Source rig name changes but all ten deform bone names are retained.','No runtime or view files written.']})
print('LEAF_CANDIDATE01_GENERATED '+json.dumps({'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'fbx_sha256':sha(OUT/'leaf-turtle.fbx')}))







