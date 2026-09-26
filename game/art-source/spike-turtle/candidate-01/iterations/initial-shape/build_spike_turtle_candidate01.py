"""Original spike-turtle first candidate. Blender -b -t 2 --python-exit-code 1.

Only spike-turtle/candidate-01 is written. Shared authored body/face/rig are
snapshotted from the approved c12b editable source; shell and expressions are new.
No runtime promotion, Cocos invocation, downloaded asset, or raster-texture input.
"""
import bpy, bmesh, hashlib, json, math, random, shutil, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT/'game/art-source/spike-turtle/candidate-01'
OUT = HERE/'export'; INPUT = HERE/'inputs'
for directory in [HERE, OUT, INPUT]: directory.mkdir(parents=True, exist_ok=True)
ORIGINAL = ROOT/'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle.blend'
FOUNDATION = INPUT/'authored-c12b-foundation.blend'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
protected_paths = [ORIGINAL, ROOT/'game/art-source/build_stone_turtle_candidate12b.py', ROOT/'game/art-source/stone_turtle_atlas.py']
protected_paths += [p for p in (ROOT/'game/assets/resources/models/stone-turtle').glob('*') if p.is_file()]
protected = {str(p.relative_to(ROOT)):sha(p) for p in protected_paths}
if not FOUNDATION.exists(): shutil.copy2(ORIGINAL, FOUNDATION)
assert sha(FOUNDATION) == sha(ORIGINAL), 'Frozen shared foundation mismatch; do not overwrite silently'
write(INPUT/'provenance.json', {'original_source':str(ORIGINAL.relative_to(ROOT)), 'sha256':sha(FOUNDATION),
    'reuse':'Self-authored c12b head/eyes/short limbs/rig. Shell, brows, mouth, atlas and six action curves are rebuilt by the spike candidate script.',
    'rights':'Original project-authored mesh; no external asset extraction.', 'raster_inputs':[]})
bpy.ops.wm.open_mainfile(filepath=str(FOUNDATION))
scene = bpy.context.scene; scene.render.fps=30
rig = next(o for o in scene.objects if o.type=='ARMATURE'); rig.name='SpikeTurtle_Rig'; rig.data.name='SpikeTurtle_skeleton'
CHAR=bpy.data.collections['STONE_TURTLE_EDITABLE_PARTS']; CHAR.name='SPIKE_TURTLE_EDITABLE_PARTS'
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
PALETTE=[(.59,.257,.043),(.86,.443,.073),(.72,.315,.045),(.95,.602,.147),
    (.37,.375,.117),(.56,.55,.208),(.85,.577,.182),(.65,.442,.110),
    (.215,.104,.020),(.96,.918,.734),(.22,.18,.055),(.030,.023,.013),
    (.91,.748,.303),(.44,.445,.139),(.96,.88,.557),(.34,.133,.025)]
ATLAS_PARAMETERS={'size':1024,'tile_grid':[4,4],'noise_seed':54123,'palette':PALETTE,
    'iris_colour':[.38,.207,.050],'iris_uv_center':[.5,.49], 'iris_uv_radii':[.415,.411],
    'pupil_uv_radii':[.302,.314],'raster_inputs':[],
    'provenance':'Local numeric pigment/grain generator; eye UV equations reused from self-authored stone_turtle_atlas.py.'}
def build_atlas(directory):
    directory=Path(directory); directory.mkdir(parents=True,exist_ok=True)
    size=ATLAS_PARAMETERS['size']; tile=size//4; pixels=np.ones((size,size,4),dtype=np.float32)
    yy,xx=np.mgrid[0:tile,0:tile].astype(np.float32); rng=np.random.default_rng(ATLAS_PARAMETERS['noise_seed'])
    for index,base in enumerate(PALETTE):
        noise=rng.normal(0,.0025,(tile,tile)); warm_band=.004*np.sin(xx*.044+np.sin(yy*.027))*np.sin(yy*.033)
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
            rgba[:,:,:3]=rgba[:,:,:3]*(1-pupil)+np.array((.023,.018,.011))*pupil
            for cx,cy,rx,ry,colour in [(.405,.665,.056,.067,(.99,.976,.91)),(.632,.363,.019,.025,(.89,.835,.61))]:
                glint=np.clip((1-np.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2))*tile/1.4,0,1)[:,:,None]
                rgba[:,:,:3]=rgba[:,:,:3]*(1-glint)+np.array(colour)*glint
        pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile]=rgba
    atlas=bpy.data.images.new('SpikeTurtle_Colour_1024',width=size,height=size,alpha=True)
    atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(directory/'spike-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    rough_pixels=np.ones((size,size,4),dtype=np.float32)
    for index in range(16):
        roughness=.32 if index<4 else (.19 if index in (9,10,11,14) else .44)
        rough_pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile,:3]=roughness
    rough=bpy.data.images.new('SpikeTurtle_Roughness_1024',width=size,height=size,alpha=True)
    rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rough_pixels.ravel())
    rough.filepath_raw=str(directory/'spike-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
    return atlas,rough

atlas,rough=build_atlas(OUT); write(HERE/'atlas-parameters.json',ATLAS_PARAMETERS)
MATS=[]
for index in range(16):
    mat=bpy.data.materials.new('SpikeAtlas_%02d'%index);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Specular IOR Level'].default_value=.32
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

# A4's assured boyish expression: one brow peaks slightly higher, the smile
# rises gently to one side. The embedded c12b eye/eyelid geometry stays intact.
head=bpy.data.objects['Head_sculpt']
def face_z(z):return .75+(z-.75)*1.15-.20
def surface(x,z,lift=0):
    hit,point,normal,_=head.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    assert hit,('facial feature outside head',x,z)
    return point+Vector((0,-lift,0))
for sign,label in [(-1,'L'),(1,'R')]:
    points=[]
    for j in range(19):
        t=j/18;z=1.013+.035*t+(.074 if sign==1 else .059)*math.sin(math.pi*t)
        points.append(surface(sign*(.168+.261*t),face_z(z),.014))
    tube('Spirited_brow_'+label,points,.057,12,sides=14)
points=[surface(t*.343,face_z(.655+.042*t*t+.012*t),.0025) for t in [-1+2*j/32 for j in range(33)]]
tube('Confident_closed_grin',points,.007,8,sides=10)
for sign in [-1,1]:
    points=[surface(sign*x,face_z(z+(.012 if sign==1 else -.008)),.0018) for x,z in [(.340,.695),(.358,.709),(.365,.727)]]
    tube('Smirk_crease_'+str(sign),points,.0045,7,sides=8)

# New low dome, broad lobed amber scutes and integrated soft pointed crowns.
RX,RY,Z,H=.97,1.075,.46,.96
def shell_surface(u,v,offset=0):
    r=max(.00001,math.hypot(u,v));angle=min(1,r)*math.pi/2
    s=math.sin(angle);h=math.cos(angle)
    point=Vector((RX*u/r*s,RY*v/r*s,Z+H*h))
    normal=Vector((u/r*s/RX,v/r*s/RY,h/H)).normalized()
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
objmesh('Amber_carapace_continuous_base',vertices,faces,15)
sites=[(0,.06)]
for count,radius,rotation in [(6,.39,.17),(12,.81,.07)]:
    for j in range(count):
        angle=2*math.pi*j/count+rotation;sites.append((radius*math.cos(angle),radius*math.sin(angle)))
boundary=[(math.cos(j*2*math.pi/72),math.sin(j*2*math.pi/72)) for j in range(72)]
def clip(poly,nx,ny,d):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        fa=a[0]*nx+a[1]*ny-d;fb=b[0]*nx+b[1]*ny-d
        if fa<=0:result.append(a)
        if (fa<=0)!=(fb<=0):
            t=fa/(fa-fb);result.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
    return result
for index,site in enumerate(sites):
    poly=boundary[:]
    for other in sites:
        if other!=site:poly=clip(poly,other[0]-site[0],other[1]-site[1],(other[0]**2+other[1]**2-site[0]**2-site[1]**2)/2)
    center=Vector((sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly)))
    cp,normal=shell_surface(center.x,center.y);n=len(poly);vs=[];fs=[]
    for factor,depth in [(1.0,.010),(.97,.043),(.85,.088),(.65,.104),(.08,.111)]:
        for p in poly:
            u,v=center+(Vector(p)-center)*factor*.976
            point,_=shell_surface(u,v,depth)
            if factor<=.85:point-=normal*((point-cp).dot(normal)-depth)*.64
            vs.append(tuple(point))
    for ring in range(4):
        for j in range(n):fs.append((ring*n+j,ring*n+(j+1)%n,(ring+1)*n+(j+1)%n,(ring+1)*n+j))
    fs.extend([tuple(range(n-1,-1,-1)),tuple(4*n+j for j in range(n))])
    objmesh('Amber_lobed_scute_%02d'%index,vs,fs,[1,2,0,1,3,2][index%6])

# Deliberate large-spike placement rather than uniformly tiled cones.
SPIKES=[(-.31,-.25,.39,.22),(.32,-.20,.47,.235),(-.34,.32,.44,.23),(.30,.37,.41,.22),
    (0,.70,.30,.20),(-.72,-.02,.30,.19),(.72,.07,.34,.195),(-.66,.48,.26,.18),(.65,.49,.27,.18)]
for index,(u,v,length,radius) in enumerate(SPIKES):
    base,normal=shell_surface(u,v,.077)
    # Upper crowns stand up, flank spines tilt out gently. The tip is blunt.
    direction=(normal*.72+Vector((u*.15,v*.10,.48))).normalized()
    tangent=direction.cross(Vector((0,1,0))).normalized();bitangent=direction.cross(tangent).normalized()
    sides=5;phase=.30+index*.37;vs=[];fs=[]
    for t,r in [(0,.83),(.055,1.0),(.20,.88),(.87,.12),(.97,.038),(1,.010)]:
        center=base+direction*(length*t)+Vector((u*.055*t*t,v*.075*t*t,0))
        for j in range(sides):
            angle=phase+2*math.pi*j/sides
            vs.append(tuple(center+radius*r*(tangent*math.cos(angle)+bitangent*math.sin(angle))))
    for ring in range(5):
        for j in range(sides):fs.append((ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple(5*sides+j for j in range(sides))])
    spike=objmesh('Rounded_amber_spike_%02d'%index,vs,fs,3 if index%3 else 1,smooth=False)
    bpy.ops.object.select_all(action='DESELECT');spike.select_set(True);bpy.context.view_layer.objects.active=spike
    bevel=spike.modifiers.new('Soft_ceramic_ridge_bevel','BEVEL');bevel.width=.016;bevel.segments=2
    bpy.ops.object.modifier_move_up(modifier=bevel.name);bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Apply UV after bevel so every new loop stays within the intended tile.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.1519,island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
    tile=spike['atlas_tile']
    for uv in spike.data.uv_layers.active.data:uv.uv=((tile%4+.04+uv.uv.x*.92)/4,(tile//4+.04+uv.uv.y*.92)/4)
    # A hard broad ridge with smooth bevel bands, not a generic smooth cone.
    for p in spike.data.polygons:p.use_smooth=p.area<.007
    spike.select_set(False)

# Scalloped warm perimeter establishes a single shell silhouette at phone scale.
for j in range(15):
    a=2*math.pi*j/15;vs=[];fs=[];n=5
    outline=[(-.19,.55,.985),(.19,.55,.985),(.17,.415,1.025),(0,.375,1.064),(-.17,.415,1.025)]
    center=Vector((RX*math.cos(a),RY*math.sin(a),.49));normal=Vector((math.cos(a),math.sin(a),.12)).normalized()
    for factor,depth in [(1,0),(.85,.047),(.58,.078),(.10,.077)]:
        for da,z,radius in outline:
            point=Vector((RX*radius*math.cos(a+da),RY*radius*math.sin(a+da),z))
            vs.append(tuple(center+(point-center)*factor+normal*depth))
    for ring in range(3):
        for k in range(n):fs.append((ring*n+k,ring*n+(k+1)%n,(ring+1)*n+(k+1)%n,(ring+1)*n+k))
    fs.extend([tuple(range(n-1,-1,-1)),tuple(3*n+k for k in range(n))])
    objmesh('Amber_scallop_%02d'%j,vs,fs,[1,2,3,1][j%4],subdiv=1)

# Six new clips keep shared bone names and blend-friendly endpoints. Attack is
# an anchored low-head shell charge/release, skill a longer spined-shell brace.
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
 'attack':[(1,{}),(7,{'body_z':-.025,'neck_back':.027,'head_pitch':.105,'legs':.05,'shell_pitch':-.045,'shell_pulse':.016}),(11,{'body_z':.018,'head_pitch':-.045,'shell_pitch':.032,'shell_pulse':.032}),(17,{'body_z':-.008,'shell_pitch':-.009,'head_pitch':.01}),(27,{})],
 'skill':[(1,{}),(10,{'body_z':-.04,'head_pitch':.14,'neck_back':.040,'legs':.075,'shell_pitch':-.04,'shell_pulse':.025}),(18,{'body_z':-.025,'head_pitch':.09,'legs':.07,'shell_pitch':-.065,'shell_pulse':.058}),(23,{'body_z':.035,'head_pitch':-.085,'shell_pitch':.045,'shell_pulse':.027}),(30,{'body_z':-.016,'shell_pitch':-.020,'head_pitch':.035}),(42,{})],
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
proportions={'head':bounds([head]),'shell_main':bounds([o for o in parts if o.name.startswith('Amber_lobed_scute_')]),'whole':bounds(parts)}
proportions['head_to_main_shell']=proportions['head']['dimensions'][0]/proportions['shell_main']['dimensions'][0]
for ob in parts:
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in ob.data.vertices),ob.name
atlas.pack();rough.pack();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'spike-turtle.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();merged=bpy.context.object
merged.name='SpikeTurtle_SkinnedMesh';merged.data.materials.clear();merged.data.materials.append(MATS[1])
for polygon in merged.data.polygons:polygon.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
modifier=merged.modifiers.new('Runtime_LOD_preserve_skinning','DECIMATE');modifier.ratio=min(.68,28900/triangles)
bpy.ops.object.modifier_move_up(modifier=modifier.name);bpy.ops.object.modifier_apply(modifier=modifier.name)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'spike-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'spike-turtle.glb'),use_selection=True,export_format='GLB',
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
views=[('front',(0,-6,2.2),(0,-.12,.92)),('three-quarter',(3.6,-5.4,3),(0,-.12,.95)),('side',(6,-.6,2.5),(0,0,.95)),('battle',(4.8,-7.4,8.8),(0,-.05,.75))]
if '--no-render' not in sys.argv:
    for name,location,target in views:
        camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        data.ortho_scale=4.8 if name=='battle' else 3.8
        scene.render.filepath=str(HERE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'spike-turtle-review-scene.blend'))
assert protected=={str(p.relative_to(ROOT)):sha(p) for p in protected_paths},'Protected stone source or runtime changed'
write(HERE/'candidate-manifest.json',{'status':'Isolated candidate, not runtime or final aesthetic acceptance','species':'spike','display_name':'刺刺龟','character':'Boyish confident amber-shell turtle',
    'source_foundation':str(FOUNDATION.relative_to(ROOT)),'foundation_sha256':sha(FOUNDATION),'protected_inputs':protected,
    'proportions':proportions,'source_parts':len(parts),'large_spikes':len(SPIKES),'scutes':len(sites),'perimeter_scutes':15,
    'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'vertices':len(merged.data.vertices),'bones':len(rig.data.bones),'materials':len(merged.data.materials),
    'clips':{name:{'last_frame':max(frame for frame,_ in keys),'seconds':(max(frame for frame,_ in keys)-1)/30} for name,keys in CLIPS.items()},
    'atlas_parameters':ATLAS_PARAMETERS,'fbx_sha256':sha(OUT/'spike-turtle.fbx'),'source_blend_sha256':sha(HERE/'spike-turtle.blend'),
    'atlas_sha256':{p.name:sha(p) for p in OUT.glob('*.png')},'threads':2,'render_size':[800,680],'samples':32,
    'forward_blender':'-Y','up_blender':'+Z','fbx_export_forward':'-Z','fbx_export_up':'+Y','cocos_expected_forward':'+Z','battle_scale':.65,'ground_y_cocos':0,
    'notes':['No projectile geometry; view code owns future spike projectiles.','Source rig name changes but all ten deform bone names are retained.','No runtime or view files written.']})
print('SPIKE_CANDIDATE01_GENERATED '+json.dumps({'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'fbx_sha256':sha(OUT/'spike-turtle.fbx')}))
