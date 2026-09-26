"""Original runner-crab c01: editable toy mesh, UV atlas, skin, five actions.

Run with Blender --background --factory-startup -t 2 --python-exit-code 1.
All outputs are confined to runner-crab/candidate-01; no runtime mutation.
"""
from pathlib import Path
import bpy, bmesh, math, json, hashlib, sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/runner-crab/candidate-01'
OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('RUNNER_CRAB_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS=[];FEET={};SPECS={}

# Original painted palette. Every visible part uses this one UV colour/roughness
# material. The single eye surface contains iris, pupil and small painted glint.
SIZE=512;TILE=128
PALETTE=[(.78,.225,.105),(.91,.70,.43),(.57,.115,.054),(.94,.405,.20),
         (.93,.85,.65),(.075,.027,.018),(.81,.315,.19),(.99,.91,.73),
         (.42,.090,.045),(.72,.18,.095),(.85,.48,.24),(.89,.64,.40),
         (.65,.19,.08),(.25,.11,.05),(.78,.56,.31),(.96,.77,.48)]
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32);rp=np.ones_like(pixels)
yy,xx=np.mgrid[0:TILE,0:TILE].astype(np.float32)
u=(xx+.5)/TILE;v=(yy+.5)/TILE
for index,col in enumerate(PALETTE):
    row,column=index//4,index%4
    shade=1+.055*np.cos((u-.5)*math.pi)*np.sin(v*math.pi)
    pixels[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=np.array(col)*shade[:,:,None]
    rp[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=.34 if index in (0,3,4,6) else .42
# Five soft shell freckles, painted rather than raised buttons.
tile=pixels[:TILE,:TILE,:3]
for cx,cy,r in [(.28,.61,.036),(.36,.69,.052),(.49,.735,.064),(.635,.70,.044),(.735,.625,.031)]:
    d=np.sqrt(((u-cx)/r)**2+((v-cy)/(r*.85))**2)
    a=np.clip((1-d)*10,0,1)*.55
    tile[:]=tile*(1-a[:,:,None])+np.array((.98,.64,.35))*a[:,:,None]
# Eye UV: one smooth closed ellipsoid; no separate pupil cap/card.
ex=u*2-1;ez=v*2-1
eye=np.ones((TILE,TILE,3),dtype=np.float32);eye[:]=(.94,.88,.72)
for rx,rz,col in [(.72,.78,(.23,.080,.029)),(.60,.68,(.019,.015,.012))]:
    d=np.sqrt(((ex-.025)/rx)**2+((ez+.015)/rz)**2);a=np.clip((1-d)/.035+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.19,.24,.135,.16),(.27,-.31,.047,.061)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.09+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.98,.89))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('RunnerCrab_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'runner-colour.png')
atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('RunnerCrab_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel())
rough.filepath_raw=str(OUT/'runner-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('RunnerCrab_Toy_Atlas');MAT.use_nodes=True
bsdf=MAT.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Specular IOR Level'].default_value=.5
bsdf.inputs['Metallic'].default_value=0
for image,input_name in [(atlas,'Base Color'),(rough,'Roughness')]:
    node=MAT.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    MAT.node_tree.links.new(node.outputs['Color'],bsdf.inputs[input_name])


def meshpart(name,vertices,faces,tile,bone='body',uv_axes=(0,2)):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free();me.update()
    ob=bpy.data.objects.new(name,me);CHAR.objects.link(ob);me.materials.append(MAT)
    ob['bone']=bone;ob['atlas_tile']=tile
    for face in me.polygons:face.use_smooth=True
    uv=me.uv_layers.new(name='ToyAtlasUV')
    mins=[min(p.co[i] for p in me.vertices) for i in uv_axes]
    spans=[max(p.co[i] for p in me.vertices)-mins[j] for j,i in enumerate(uv_axes)]
    for loop in me.loops:
        p=me.vertices[loop.vertex_index].co
        a=(p[uv_axes[0]]-mins[0])/max(spans[0],1e-8)
        b=(p[uv_axes[1]]-mins[1])/max(spans[1],1e-8)
        uv.data[loop.index].uv=((tile%4+.025+.95*a)/4,(tile//4+.025+.95*b)/4)
    PARTS.append(ob);return ob


def loft(name,rings,tile,bone='body',segments=32,uv_axes=(0,2)):
    vertices=[];faces=[]
    for z,rx,ry,cx,cy in rings:
        for j in range(segments):
            a=math.tau*j/segments
            vertices.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    for k in range(len(rings)-1):
        for j in range(segments):
            faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return meshpart(name,vertices,faces,tile,bone,uv_axes)


def ellipsoid(name,center,radii,tile,bone='body',segments=24,rings=12):
    c=Vector(center);vertices=[c+Vector((0,0,radii[2]))];faces=[]
    for k in range(1,rings):
        a=math.pi*k/rings
        for j in range(segments):
            b=math.tau*j/segments
            vertices.append(c+Vector((radii[0]*math.sin(a)*math.cos(b),radii[1]*math.sin(a)*math.sin(b),radii[2]*math.cos(a))))
    vertices.append(c-Vector((0,0,radii[2])));bottom=len(vertices)-1
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for k in range(rings-2):
        for j in range(segments):faces.append((1+k*segments+j,1+(k+1)*segments+j,1+(k+1)*segments+(j+1)%segments,1+k*segments+(j+1)%segments))
    for j in range(segments):faces.append((bottom,1+(rings-2)*segments+(j+1)%segments,1+(rings-2)*segments+j))
    return meshpart(name,[tuple(p) for p in vertices],faces,tile,bone)


def tube(name,points,radii,tile,bone='body',sides=12):
    points=[Vector(p) for p in points];vertices=[];faces=[]
    if isinstance(radii,(float,int)):radii=[radii]*len(points)
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
        a=tangent.cross(Vector((0,1,0)))
        if a.length<.1:a=tangent.cross(Vector((1,0,0)))
        a.normalize();b=tangent.cross(a).normalized()
        for j in range(sides):vertices.append(tuple(p+radii[i]*(a*math.cos(math.tau*j/sides)+b*math.sin(math.tau*j/sides))))
    for k in range(len(points)-1):
        for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
    return meshpart(name,vertices,faces,tile,bone)


# Domed oval carapace, cream belly and restrained rolled edge. No capsules or spikes.
body=loft('Rounded_coral_carapace',[
    (.275,.23,.17,0,.015),(.295,.29,.203,0,.01),(.335,.335,.235,0,0),
    (.40,.35,.25,0,0),(.47,.338,.242,0,.002),(.54,.285,.214,0,.018),
    (.595,.205,.164,0,.026),(.625,.11,.098,0,.027),(.634,.012,.012,0,.027)],0,segments=40,uv_axes=(0,1))
belly=ellipsoid('Cream_under_shell',(0,-.012,.295),(.302,.204,.075),1,segments=32)
rim=[]
for j in range(65):
    a=math.tau*j/64;rim.append((.332*math.cos(a),.232*math.sin(a),.346))
tube('Rolled_shell_edge',rim,.013,3,sides=8)

# Four distinct walking legs per side; gentle angled knee and round flattened toe.
for side,label in [(-1,'L'),(1,'R')]:
    for index,(hy,ky,ty,kx,tx) in enumerate([(-.14,-.21,-.36,.438,.455),(-.052,-.072,-.135,.493,.505),(.058,.100,.16,.490,.505),(.145,.24,.36,.432,.447)]):
        name=f'leg_{label}{index+1}';hip=(side*.27,hy,.315)
        points=[hip,(side*.33,hy+(ky-hy)*.35,.29),(side*kx,ky,.215),
                (side*(kx+.007),ky+(ty-ky)*.45,.12),(side*tx,ty,.028),
                (side*(tx-.01),ty+.008,.023)]
        leg=tube(name+'_curved_leg',points,[.028,.039,.036,.029,.028,.014],0 if index%2 else 6,name)
        FEET[name]=leg
        ellipsoid(name+'_round_knee',points[2],(.044,.04,.043),3,name,segments=12,rings=8)
        SPECS[name]=(hip,(hip[0],hip[1],hip[2]+.12),'root')

# Short arms and two small pincers. The inner jaw has its own child bone.
for side,label in [(-1,'L'),(1,'R')]:
    arm_name='claw_'+label;jaw_name='jaw_'+label
    palm=Vector((side*.385,-.285,.435))
    tube('Short_arm_'+label,[(side*.26,-.13,.35),(side*.32,-.205,.375),tuple(palm)],
         [.041,.047,.055],1,arm_name)
    ellipsoid('Round_pincer_palm_'+label,palm,(.088,.080,.096),6,arm_name,segments=24,rings=12)
    outer=[palm+Vector((side*x,-.008,z)) for x,z in [(.047,.025),(.073,.062),(.069,.106),(.047,.135),(.021,.147)]]
    inner=[palm+Vector((side*x,-.012,z)) for x,z in [(-.044,.027),(-.064,.070),(-.052,.115),(-.022,.139)]]
    tube('Fixed_round_finger_'+label,outer,[.030,.032,.029,.022,.008],1,arm_name,sides=12)
    tube('Moving_round_finger_'+label,inner,[.028,.030,.026,.007],1,jaw_name,sides=12)
    SPECS[arm_name]=((side*.26,-.13,.35),(side*.26,-.13,.55),'body')
    SPECS[jaw_name]=(tuple(palm+Vector((-side*.043,-.01,.025))),tuple(palm+Vector((-side*.043,-.01,.135))),arm_name)

# Tall but chunky stalks give the runner a distinct alert silhouette.
for side,label in [(-1,'L'),(1,'R')]:
    bone='eye_'+label;centre=Vector((side*.162,-.152,.808))
    tube('Eye_stalk_'+label,[(side*.135,-.115,.52),(side*.147,-.130,.65),(side*.16,-.143,.754)],
         [.039,.042,.043],1,bone,sides=16)
    ellipsoid('Coral_eye_socket_'+label,centre+Vector((0,.021,.008)),(.108,.078,.128),3,bone,segments=32,rings=14)
    eye=ellipsoid('Spherical_painted_eye_'+label,centre+Vector((0,-.022,0)),(.096,.071,.115),4,bone,segments=32,rings=16)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co-(centre+Vector((0,-.022,0)))
        a=max(.007,min(.993,.5+.5*p.x/.096));b=max(.007,min(.993,.5+.5*p.z/.115))
        eye.data.uv_layers.active.data[loop.index].uv=(a/4,(1+b)/4)
    # Small angled brow follows the upper globe, reading mischievous not angry.
    points=[(side*(.077+.16*i/10),-.184,.894+.009*i/10+.011*math.sin(math.pi*i/10)) for i in range(11)]
    tube('Soft_brow_'+label,points,[.006]+[.011]*9+[.006],2,bone,sides=8)
    SPECS[bone]=((side*.135,-.115,.52),(side*.135,-.115,.78),'body')

# A small curved smile, flush with the curved front of the shell.
def shell_front(x,z,lift=.003):
    hit,pos,normal,_=body.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    assert hit,(x,z)
    return pos+Vector((0,-lift,0))
mouth=[tuple(shell_front(-.083+.166*i/16,.383+.020*(2*i/16-1)**2)) for i in range(17)]
tube('Little_confident_smile',mouth,[.002]+[.007]*15+[.002],5,sides=8)
for side,label in [(-1,'L'),(1,'R')]:
    p=shell_front(side*.156,.410,.003)
    ellipsoid('Warm_cheek_'+label,p,(.028,.004,.014),2,segments=12,rings=6)

GROUND_OFFSET=min(v.co.z for ob in PARTS for v in ob.data.vertices)
for ob in PARTS:
    for v in ob.data.vertices:v.co.z-=GROUND_OFFSET

# All vertices are weighted; rigid shell/eye volumes preserve toy surfaces.
# Eight legs are independent, while body bob/claw anticipation are real skinning.
arm=bpy.data.armatures.new('RunnerCrab_skeleton')
rig=bpy.data.objects.new('RunnerCrab_Rig',arm);CHAR.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
ordered={'root':((0,0,0),(0,0,.12),None),'body':((0,0,.29),(0,0,.57),'root'),**SPECS}
# Child jaws follow claws; edit-bone order is insertion order from the builder.
for name,(head,tail,parent) in ordered.items():
    bone=arm.edit_bones.new(name);bone.head=(head[0],head[1],head[2]-GROUND_OFFSET if name!='root' else head[2])
    bone.tail=(tail[0],tail[1],tail[2]-GROUND_OFFSET if name!='root' else tail[2])
    if parent:bone.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
for ob in PARTS:
    ob.vertex_groups.new(name=ob['bone']).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('RunnerCrab_skin','ARMATURE');mod.object=rig;ob.parent=rig
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=30


def translate(name,xyz):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(xyz)


def rotate_world(name,xyz):
    # Vertically authored bones: local X=world X, local Y=world Z, local Z=-Y.
    pb=rig.pose.bones[name];pb.rotation_euler=(xyz[0],xyz[2],-xyz[1])


def pose(frame,phase=0,step=0,bob=0,sway=0,attack=0,open_jaw=0,recoil=0,tilt=0,eye=0,exit_scale=1):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].scale=(exit_scale,)*3
    translate('body',(sway,recoil,bob));rotate_world('body',(tilt,0,-sway*.4))
    for index,(name,leg) in enumerate(FEET.items()):
        phase_offset=math.pi*((index%4+index//4)%2)
        p=phase+phase_offset;lift=max(0,math.sin(p))*step*.60
        translate(name,(0,math.cos(p)*step,lift))
        rotate_world(name,(math.sin(p)*step*.4,0,math.cos(p)*step*.35))
    for side,label in [(-1,'L'),(1,'R')]:
        rotate_world('claw_'+label,(-attack*.58,side*attack*.22,side*(-.10*open_jaw)))
        translate('claw_'+label,(-side*.025*attack,-.10*attack,.032*attack))
        rotate_world('jaw_'+label,(0,side*open_jaw*.24,0))
        rotate_world('eye_'+label,(eye*.06,side*eye*.10,side*eye*.045))
    bpy.context.view_layer.update()
    # Keep each stance foot precisely on the floor at each authored frame.
    for index,(name,leg) in enumerate(FEET.items()):
        pb=rig.pose.bones[name];deform=pb.matrix@pb.bone.matrix_local.inverted()
        lowest=min((deform@v.co).z for v in leg.data.vertices)
        target=max(0,math.sin(phase+math.pi*((index%4+index//4)%2)))*step*.60*exit_scale
        basis=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
        pb.location+=basis.to_3x3().inverted()@Vector((0,0,target-lowest))
    for pb in rig.pose.bones:
        for prop in ('location','rotation_euler','scale'):pb.keyframe_insert(prop,frame=frame,group=pb.name)


CLIPS={
    'idle':[(1,{}),(16,{'bob':.008,'eye':.25,'open_jaw':.10}),(31,{}),(46,{'bob':.005,'eye':-.15}),(61,{})],
    'walk':[(1,{'phase':0,'step':.072}),(4,{'phase':math.pi/2,'step':.072,'bob':.012,'sway':-.01,'eye':.18}),
            (7,{'phase':math.pi,'step':.072}),(10,{'phase':math.pi*1.5,'step':.072,'bob':.012,'sway':.01,'eye':-.18}),
            (13,{'phase':math.tau,'step':.072})],
    'attack':[(1,{}),(5,{'attack':-.25,'recoil':.028,'bob':-.012,'open_jaw':1,'eye':.3}),
              (9,{'attack':1,'recoil':-.035,'bob':.012,'open_jaw':-.28,'tilt':.055,'eye':-.1}),
              (13,{'attack':.55,'open_jaw':.12}),(22,{})],
    'hit':[(1,{}),(4,{'recoil':.048,'bob':-.018,'tilt':-.12,'eye':.8,'open_jaw':.6}),
           (8,{'recoil':-.012,'bob':.008,'eye':-.22}),(16,{})],
    'exit':[(1,{}),(5,{'bob':.034,'eye':.85,'open_jaw':.9}),(11,{'bob':-.070,'tilt':-.08,'open_jaw':.5}),
            (18,{'bob':-.070,'exit_scale':.40,'eye':.4}),(25,{'exit_scale':.035})],
}
rig.animation_data_create()
for name,keys in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame,kwargs in keys:pose(frame,**kwargs)
    action.use_fake_user=True
    # Linear dense interpolation is deterministic; smoothen anticipation by
    # authored intermediate poses, without Bezier foot overshoot into ground.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,action)
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=bpy.data.actions['idle'].slots[0]
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'runner-crab.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();merged=bpy.context.object;merged.name='RunnerCrab_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
assert triangles<=12000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'runner-crab.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'runner-crab.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dimensions=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats={'version':'runner-crab-candidate-01','enemy_kind':'runner','display_name':'快跑蟹',
       'vertices':len(merged.data.vertices),'triangles':triangles,'mesh_count':1,'material_count':1,
       'material_name':MAT.name,'bones':list(ordered),'bone_count':len(arm.bones),'walking_legs':8,
       'texture_size':[512,512],'roughness':'RGB grayscale 0.34–0.42; alpha 1; Non-Color; nonmetal F0 0.04',
       'clips':{k:{'name':'RunnerCrab_Rig|'+k,'first':1,'last':v[-1][0],'seconds':(v[-1][0]-1)/30} for k,v in CLIPS.items()},
       'loops':['idle','walk'],'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dimensions,
       'recommended_scale':.83,'dimensions_at_recommended_scale':[value*.83 for value in dimensions],
       'forward':'Blender -Y; FBX axis_forward=-Z/axis_up=Y; expected Cocos +Z as ink contract, actual Cocos import pending',
       'origin':'Blender Z=0/Cocos Y=0 foot origin; in-place animation, movement belongs to core/view',
       'fbx_sha256':hashlib.sha256((OUT/'runner-crab.fbx').read_bytes()).hexdigest(),
       'source':'Original scripted mesh, UV artwork, rig and animation. A4, island and project ink c02 used only as internal style references. No external stock asset.',
       'status':'Isolated first review candidate; no runtime promotion, not final art acceptance.'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# Match the ink sample's actual studio, exposure, soft key/fill/rim and AgX.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1000;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
fm=bpy.data.materials.new('REVIEW_ONLY_warm_sand');fm.use_nodes=True
fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
floor=bpy.context.object;floor.name='REVIEW_ONLY_floor';floor.data.materials.append(fm)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    ld=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    ob=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Runner_review_camera');cam=bpy.data.objects.new(cd.name,cd)
scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
def aim(loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale
aim((2.5,-4.8,2.25),(0,-.01,.44),1.52)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'runner-crab-review-scene.blend'))
for name,loc,target,scale in ([] if '--no-render' in sys.argv else [
    ('front',(0,-5,.75),(0,-.015,.45),1.47),
    ('three-quarter',(2.5,-4.8,2.25),(0,-.01,.44),1.52),
    ('battle-angle',(3.8,-5.2,5.3),(0,-.01,.39),1.58)]):
    aim(loc,target,scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('RUNNER_CRAB_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)
