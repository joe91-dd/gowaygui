"""Original crystal-turtle candidate 01, actual mesh and opaque toy-crystal atlas.
Blender -b -t 2 --python-exit-code 1. Only crystal-turtle/candidate-01 is written.
Shared authored body, head and rig use a frozen local foundation. Crystals, face
details, opaque pigment atlas and six actions are generated here from editable
source parameters. No runtime promotion, external model, or raster-image edit.
"""
import bpy, bmesh, hashlib, json, math, random, shutil, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT/'game/art-source/crystal-turtle/candidate-01'
OUT = HERE/'export'; INPUT = HERE/'inputs'
for directory in [HERE, OUT, INPUT]: directory.mkdir(parents=True, exist_ok=True)
ORIGINAL = ROOT/'game/art-source/stone-turtle/candidate-12/c12b/stone-turtle.blend'
FOUNDATION = INPUT/'authored-c12b-foundation.blend'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
protected_paths=[ORIGINAL, ROOT/'game/art-source/build_stone_turtle_candidate12b.py',
    ROOT/'game/art-source/stone_turtle_atlas.py',ROOT/'game/art-source/build_spike_turtle_candidate02.py',
    ROOT/'game/art-source/spike-turtle/candidate-02/spike-turtle.blend',
    ROOT/'game/art-source/spike-turtle/candidate-02/export/spike-turtle.fbx']
for species in ['stone-turtle','spike-turtle']:
    protected_paths += [p for p in (ROOT/'game/assets/resources/models'/species).glob('*') if p.is_file() and not p.name.endswith('.meta')]
protected_paths=[p for p in protected_paths if p.is_file()]
protected = {str(p.relative_to(ROOT)):sha(p) for p in protected_paths}
if not FOUNDATION.exists(): shutil.copy2(ORIGINAL, FOUNDATION)
assert sha(FOUNDATION) == '53f828584edcc3d93c1b28a01883fe768db106a1fd44f27b5f95d729482a4ac3', 'Frozen shared foundation mismatch; do not overwrite silently'
write(INPUT/'provenance.json', {'original_source':str(ORIGINAL.relative_to(ROOT)), 'sha256':sha(FOUNDATION),
    'reuse':'Self-authored c12b head/eyes/short limbs/rig. Shell, brows, mouth, atlas and six action curves are rebuilt by this crystal candidate script.',
    'rights':'Original project-authored mesh; no external asset extraction.', 'raster_inputs':[]})
bpy.ops.wm.open_mainfile(filepath=str(FOUNDATION))
scene = bpy.context.scene; scene.render.fps=30
rig = next(o for o in scene.objects if o.type=='ARMATURE'); rig.name='CrystalTurtle_Rig'; rig.data.name='CrystalTurtle_skeleton'
CHAR=bpy.data.collections['STONE_TURTLE_EDITABLE_PARTS']; CHAR.name='CRYSTAL_TURTLE_EDITABLE_PARTS'
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
PALETTE=[(.024,.310,.530),(.028,.505,.735),(.070,.655,.845),(.350,.835,.950),
    (.205,.375,.215),(.390,.570,.325),(.770,.704,.315),(.440,.590,.350),
    (.026,.117,.079),(.923,.970,.911),(.075,.240,.195),(.017,.033,.026),
    (.670,.785,.555),(.265,.438,.305),(.885,.980,.950),(.046,.268,.367)]
ATLAS_PARAMETERS={'size':1024,'tile_grid':[4,4],'noise_seed':73161,'palette':PALETTE,
    'iris_colour':[.072,.237,.188],'iris_uv_center':[.5,.49], 'iris_uv_radii':[.415,.411],
    'pupil_uv_radii':[.302,.314],'raster_inputs':[],
    'provenance':'Local numeric pigment/grain generator; eye UV equations reused from self-authored stone_turtle_atlas.py.'}
def build_atlas(directory):
    directory=Path(directory); directory.mkdir(parents=True,exist_ok=True)
    size=ATLAS_PARAMETERS['size']; tile=size//4; pixels=np.ones((size,size,4),dtype=np.float32)
    yy,xx=np.mgrid[0:tile,0:tile].astype(np.float32); rng=np.random.default_rng(ATLAS_PARAMETERS['noise_seed'])
    for index,base in enumerate(PALETTE):
        noise=rng.normal(0,.0025,(tile,tile)); warm_band=.004*np.sin(xx*.044+np.sin(yy*.027))*np.sin(yy*.033)
        if index<4:
            # Very faint dyed depth variation supports polished opaque facets;
            # it never supplies geometry, fake edge lines or alpha transparency.
            warm_band += .011*np.exp(-((xx/tile-.56)/.36)**2-((yy/tile-.53)/.49)**2)
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
            rgba[:,:,:3]=rgba[:,:,:3]*(1-pupil)+np.array((.014,.028,.022))*pupil
            for cx,cy,rx,ry,colour in [(.405,.665,.056,.067,(.965,.995,.978)),(.632,.363,.019,.025,(.730,.912,.834))]:
                glint=np.clip((1-np.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2))*tile/1.4,0,1)[:,:,None]
                rgba[:,:,:3]=rgba[:,:,:3]*(1-glint)+np.array(colour)*glint
        pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile]=rgba
    atlas=bpy.data.images.new('CrystalTurtle_Colour_1024',width=size,height=size,alpha=True)
    atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(directory/'crystal-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
    rough_pixels=np.ones((size,size,4),dtype=np.float32)
    for index in range(16):
        roughness=.23 if index<4 else (.18 if index in (9,10,11,14) else .44)
        rough_pixels[index//4*tile:(index//4+1)*tile,index%4*tile:(index%4+1)*tile,:3]=roughness
    rough=bpy.data.images.new('CrystalTurtle_Roughness_1024',width=size,height=size,alpha=True)
    rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rough_pixels.ravel())
    rough.filepath_raw=str(directory/'crystal-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
    return atlas,rough

atlas,rough=build_atlas(OUT); write(HERE/'atlas-parameters.json',ATLAS_PARAMETERS)
MATS=[]
for index in range(16):
    mat=bpy.data.materials.new('CrystalAtlas_%02d'%index);mat.use_nodes=True
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

# A4 attentive female character: light symmetric curved brows, green iris,
# restrained smile and one tiny outer-corner lash each. Body/eyes stay unchanged.
head=bpy.data.objects['Head_sculpt']
def face_z(z):return .75+(z-.75)*1.15-.20
def surface(x,z,lift=0):
    hit,point,normal,_=head.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    assert hit,('facial feature outside head',x,z)
    return point+Vector((0,-lift,0))
for sign,label in [(-1,'L'),(1,'R')]:
    points=[]
    for j in range(17):
        t=j/16;z=1.038+.010*t+.057*math.sin(math.pi*t)
        points.append(surface(sign*(.183+.232*t),face_z(z),.012))
    tube('Attentive_curved_brow_'+label,points,.032,13,sides=12)
    lash=[surface(sign*x,face_z(z),.010) for x,z in [(.454,.981),(.477,.986),(.493,1.006)]]
    tube('Restrained_outer_eye_accent_'+label,lash,.0075,8,sides=10)
mouth=[surface(t*.327,face_z(.657+.029*t*t),.0025) for t in [-1+2*j/30 for j in range(31)]]
tube('Warm_restrained_smile',mouth,.0063,8,sides=10)

# A low blue carapace supports clustered cut crystals, not a recolored spike shell.
RX,RY,Z,H=.91,1.025,.46,.77
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
objmesh('Crystal_shell_core',vertices,faces,15)

def crystal(name,base,direction,height,radius,tile,phase=0,low=False):
    direction=direction.normalized()
    tangent=direction.cross(Vector((0,1,0))).normalized();bitangent=direction.cross(tangent).normalized()
    sides=6;vertices=[];faces=[]
    profile=[(0,.63),(.13,.95),(.37,1),(.72,.72),(.96,.11)] if low else [(0,.68),(.05,.94),(.16,1),(.59,.97),(.74,.73),(.985,.045)]
    for ring,(t,r) in enumerate(profile):
        for j in range(sides):
            angle=phase+2*math.pi*j/sides
            shoulder_variation=(.037*math.sin(j*1.27+phase) if ring in (2,3) else 0)
            center=base+direction*(height*(t+shoulder_variation))+tangent*(height*.05*t*t)
            vertices.append(tuple(center+radius*r*(tangent*math.cos(angle)+bitangent*math.sin(angle)*.88)))
    for ring in range(len(profile)-1):
        for j in range(sides):faces.append((ring*sides+j,ring*sides+(j+1)%sides,(ring+1)*sides+(j+1)%sides,(ring+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(profile)-1)*sides+j for j in range(sides))])
    ob=objmesh(name,vertices,faces,tile,smooth=False)
    # Bevel faces carry a pale blue pigment tile on real rounded edges.
    # This remains one opaque atlas material after export mesh merging.
    ob.data.materials.append(MATS[2]);ob.data.materials.append(MATS[3])
    for polygon in ob.data.polygons:
        polygon.material_index=1 if polygon.normal.z>.46 and polygon.index%3!=0 else 0
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bevel=ob.modifiers.new('True_rounded_crystal_edges','BEVEL')
    bevel.width=min(.024,radius*.105);bevel.segments=3;bevel.material=2;bevel.harden_normals=True
    bpy.ops.object.modifier_move_up(modifier=bevel.name);bpy.ops.object.modifier_apply(modifier=bevel.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.1519,island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
    tile_map=[tile,2,3]
    for polygon in ob.data.polygons:
        colour_tile=tile_map[polygon.material_index]
        polygon.use_smooth=polygon.material_index==2
        for li in polygon.loop_indices:
            uv=ob.data.uv_layers.active.data[li]
            uv.uv=((colour_tile%4+.04+uv.uv.x*.92)/4,(colour_tile//4+.04+uv.uv.y*.92)/4)
    ob.select_set(False)
    return ob

# Seven deliberately different main crystals, including the high central prism.
CRYSTALS=[(0,.045,.70,.280,False),(-.35,.30,.52,.238,False),(.36,.29,.56,.242,False),
    (-.51,-.19,.45,.240,False),(.53,-.15,.43,.240,False),(0,-.47,.35,.267,True),(.06,.61,.41,.227,False)]
rng=random.Random(73161)
for j in range(11):
    a=2*math.pi*j/11+.10
    r=.765+rng.uniform(-.018,.018)
    CRYSTALS.append((r*math.cos(a),r*math.sin(a),rng.uniform(.24,.33),rng.uniform(.202,.238),True))
for index,(u,v,height,radius,low) in enumerate(CRYSTALS):
    base,normal=shell_surface(u,v,-.035 if index==0 else -.017)
    direction=(normal*(.27 if index==0 else .43)+Vector((u*.12,v*.08,.86))).normalized()
    crystal('Crystal_shard_%02d'%index,base,direction,height,radius,[1,2,1,0,1,2][index%6],.18+index*.41,low)
# Smaller low cut gems close the perimeter with a scalloped icy silhouette.
for j in range(14):
    angle=2*math.pi*j/14+.065;u=.965*math.cos(angle);v=.965*math.sin(angle)
    base,normal=shell_surface(u,v,-.005)
    direction=(normal*.55+Vector((0,0,.70))).normalized()
    crystal('Crystal_rim_gem_%02d'%j,base,direction,.185,.180,1 if j%3 else 2,angle+.25,True)
# Match the approved family's main shell footprint, preserving head/limbs.
shell_parts=[ob for ob in parts if ob['bone']=='shell']
shell_min=min(v.co.x for ob in shell_parts for v in ob.data.vertices)
shell_max=max(v.co.x for ob in shell_parts for v in ob.data.vertices)
shell_center=(shell_min+shell_max)/2
for ob in shell_parts:
    for v in ob.data.vertices:v.co.x=(v.co.x-shell_center)*(2.03/(shell_max-shell_min))
    ob.data.update()

# Six clips keep shared bone names and blend-friendly endpoints. Crystal attack
# is a measured focus/release; skill lifts the crystal carapace in a soft pulse.
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
 'attack':[(1,{}),(8,{'body_z':.008,'head_pitch':-.075,'shell_pulse':.009}),(13,{'body_z':.022,'head_pitch':.035,'shell_pitch':.014,'shell_pulse':.026}),(20,{'body_z':.006,'head_pitch':-.012,'shell_pulse':.008}),(27,{})],
 'skill':[(1,{}),(12,{'body_z':-.018,'neck_back':.022,'head_pitch':.065,'legs':.035,'shell_pulse':.018}),(20,{'body_z':.032,'head_pitch':-.085,'shell_pulse':.045}),(28,{'body_z':.008,'head_pitch':.015,'shell_pulse':.017}),(35,{'body_z':.003,'shell_pulse':.005}),(42,{})],
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
atlas.pack();rough.pack();bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'crystal-turtle.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();merged=bpy.context.object
merged.name='CrystalTurtle_SkinnedMesh';merged.data.materials.clear();merged.data.materials.append(MATS[1])
for polygon in merged.data.polygons:polygon.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
modifier=merged.modifiers.new('Runtime_LOD_preserve_skinning','DECIMATE');modifier.ratio=min(.68,28900/triangles)
bpy.ops.object.modifier_move_up(modifier=modifier.name);bpy.ops.object.modifier_apply(modifier=modifier.name)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'crystal-turtle.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(HERE/'crystal-turtle.glb'),use_selection=True,export_format='GLB',
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
views=[('front',(0,-6,2.2),(0,-.12,.92)),('three-quarter',(3.6,-5.4,3),(0,-.12,.95)),('battle',(4.8,-7.4,8.8),(0,-.05,.75))]
if '--no-render' not in sys.argv:
    for name,location,target in views:
        camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        data.ortho_scale=4.8 if name=='battle' else 3.8
        scene.render.filepath=str(HERE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'crystal-turtle-review-scene.blend'))
assert protected=={str(p.relative_to(ROOT)):sha(p) for p in protected_paths},'Protected stone source or runtime changed'
write(HERE/'candidate-manifest.json',{'status':'Crystal candidate-01: three preview views, no runtime promotion','species':'crystal','display_name':'水晶龟','character':'Attentive female blue-crystal turtle',
    'source_foundation':str(FOUNDATION.relative_to(ROOT)),'foundation_sha256':sha(FOUNDATION),'protected_inputs':protected,
    'proportions':proportions,'source_parts':len(parts),'main_crystals':len(CRYSTALS),'rim_gems':14,'opaque_material':True,'crystal_seed':73161,
    'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'vertices':len(merged.data.vertices),'bones':len(rig.data.bones),'materials':len(merged.data.materials),
    'clips':{name:{'last_frame':max(frame for frame,_ in keys),'seconds':(max(frame for frame,_ in keys)-1)/30} for name,keys in CLIPS.items()},
    'atlas_parameters':ATLAS_PARAMETERS,'fbx_sha256':sha(OUT/'crystal-turtle.fbx'),'source_blend_sha256':sha(HERE/'crystal-turtle.blend'),
    'atlas_sha256':{p.name:sha(p) for p in OUT.glob('*.png')},'threads':2,'render_size':[800,680],'samples':32,
    'forward_blender':'-Y','up_blender':'+Z','fbx_export_forward':'-Z','fbx_export_up':'+Y','cocos_expected_forward':'+Z','battle_scale':.65,'ground_y_cocos':0,
    'notes':['Opaque mobile crystal impression from real bevels, pigmented facets and roughness; no transmission or transparent sort dependency.','Source rig name changes but all ten deform bone names are retained.','No runtime or view files written.']})
print('CRYSTAL_CANDIDATE01_GENERATED '+json.dumps({'triangles':sum(len(p.vertices)-2 for p in merged.data.polygons),'fbx_sha256':sha(OUT/'crystal-turtle.fbx')}))




