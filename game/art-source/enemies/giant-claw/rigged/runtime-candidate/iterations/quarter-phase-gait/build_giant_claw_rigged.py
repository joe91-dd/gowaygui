"""Rig approved giant-claw geometry in an isolated candidate. No runtime writes.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
This builder exports and saves a review scene; it does not render images.
"""
from pathlib import Path
import bpy,math,json,hashlib
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
C01=ROOT/'game/art-source/enemies/giant-claw/candidate-01'
HERE=ROOT/'game/art-source/enemies/giant-claw/rigged/runtime-candidate'
OUT=HERE/'export';OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,obj):(HERE/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def require(value,message):
    if not value:raise RuntimeError(message)
require(sha(C01/'giant-claw-prototype.blend')=='cd579fb4c56cf276d9a02dec9267a354e0442e4875683d0a7ae48de3704924e0','Approved prototype changed')
protected={p.relative_to(ROOT).as_posix():sha(p) for p in C01.rglob('*') if p.is_file()}
original_generator=ROOT/'game/art-source/enemies/build_giant_claw_prototype.py'
protected[original_generator.relative_to(ROOT).as_posix()]=sha(original_generator)
prior=json.loads((C01/'model-stats.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(C01/'giant-claw-prototype.blend'),load_ui=False,use_scripts=False)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.fps=30
oldroot=bpy.data.objects['GiantClaw_Prototype'];collection=oldroot.users_collection[0]
parts=[o for o in scene.objects if o.type=='MESH' and o.parent==oldroot]
require(len(parts)==36 and not bpy.data.actions,'Unexpected prototype contents')
material=bpy.data.materials['GiantClaw_Toy_Atlas']
for name,image_name in [('giant-colour.png','GiantClaw_Colour_512'),('giant-roughness.png','GiantClaw_Roughness_512')]:
    (OUT/name).write_bytes((C01/'textures'/name).read_bytes())
    image=bpy.data.images[image_name];image.filepath_raw=str(OUT/name);image.pack()
# Preserve every approved vertex, polygon, UV, material, and object transform.
# The common original authoring-height shift is used only to place new bones.
body=bpy.data.objects['Wide_sturdy_boss_body']
zshift=min(v.co.z for v in body.data.vertices)-.185
def at(x,y,z):return (x,y,z+zshift)
ordered={'root':((0,0,0),(0,0,.12),None),'body':(at(0,0,.45),at(0,0,.66),'root')}
for side,label in [(-1,'L'),(1,'R')]:
    for i,hy in enumerate((-.21,-.076,.086,.25)):
        ordered[f'leg_{label}{i+1}']=(at(side*.527,hy,.36),at(side*.527,hy,.52),'root')
ordered.update({
    'claw_R':(at(.49,-.125,.46),at(.49,-.125,.68),'body'),
    'jaw_R':(at(.688,-.535,.731),at(.688,-.535,.91),'claw_R'),
    'claw_L':(at(-.49,-.12,.39),at(-.49,-.12,.56),'body'),
    'jaw_L':(at(-.773,-.403,.533),at(-.773,-.403,.68),'claw_L'),
    'eye_L':(at(-.244,-.355,.69),at(-.244,-.355,.86),'body'),
    'eye_R':(at(.244,-.355,.707),at(.244,-.355,.877),'body'),
})
armature=bpy.data.armatures.new('GiantClaw_skeleton')
rig=bpy.data.objects.new('GiantClaw_Rig',armature);collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in ordered.items():
    bone=armature.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
feet={}
for ob in parts:
    joint=ob['planned_joint'];require(joint in ordered,'Unknown joint '+joint)
    ob['bone']=joint
    group=ob.vertex_groups.new(name=joint)
    if joint.startswith('leg_'):
        # Soft toy leg roots remain attached to body. First four of the 16
        # existing rings blend body -> moving leg; no mesh reshaping occurs.
        require(len(ob.data.vertices)==192,'Unexpected approved leg topology')
        body_group=ob.vertex_groups.new(name='body')
        for v in ob.data.vertices:
            ring=v.index//12;t=max(0,min(1,ring/4));weight=t*t*(3-2*t)
            if weight>0:group.add([v.index],weight,'REPLACE')
            if weight<1:body_group.add([v.index],1-weight,'REPLACE')
        feet[joint]=ob
    else:group.add(list(range(len(ob.data.vertices))),1,'REPLACE')
    modifier=ob.modifiers.new('GiantClaw_skin','ARMATURE');modifier.object=rig
    transform=ob.matrix_world.copy();ob.parent=rig;ob.matrix_world=transform
bpy.data.objects.remove(oldroot,do_unlink=True)
for pb in rig.pose.bones:pb.rotation_mode='XYZ'

def translate(name,xyz):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(xyz)
def rotate(name,xyz):
    rig.pose.bones[name].rotation_euler=(xyz[0],xyz[2],-xyz[1])
def pose(frame,phase=0,step=0,lift=0,bob=0,sway=0,wind=0,strike=0,close=0,recoil=0,tilt=0,eye=0,exit_scale=1):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].scale=(exit_scale,)*3
    translate('body',(sway,recoil,bob));rotate('body',(tilt,0,-sway*.3))
    for name in feet:
        side=-1 if '_L' in name else 1;index=int(name[-1])-1
        p=phase+index*math.pi/2+(math.pi if side==1 else 0)
        translate(name,(0,math.cos(p)*step,max(0,math.sin(p))*lift))
        rotate(name,(math.sin(p)*step*.30,0,math.cos(p)*step*.20))
    # A quick directed pincer impulse suits the existing bolt event. It is
    # neither a repeated ground slam nor a separate summon animation.
    rotate('claw_R',(-wind*.10+strike*.13,0,wind*.025))
    translate('claw_R',(0,wind*.016-strike*.085,wind*.018-strike*.015))
    rotate('jaw_R',(0,close*.045,0));translate('jaw_R',(close*.012,0,close*.055))
    rotate('claw_L',(-strike*.035,0,-wind*.030));translate('claw_L',(0,strike*.012,0))
    rotate('jaw_L',(0,-close*.035,0))
    for side,label in [(-1,'L'),(1,'R')]:rotate('eye_'+label,(eye*.020,side*eye*.023,side*eye*.012))
    bpy.context.view_layer.update()
    # Fully weighted distal rings determine stance contact; proximal blended
    # vertices are far above the floor and retain their body attachment.
    for name,ob in feet.items():
        pb=rig.pose.bones[name];deform=pb.matrix@pb.bone.matrix_local.inverted()
        lowest=min((deform@v.co).z for v in ob.data.vertices if v.index//12>=4)
        side=-1 if '_L' in name else 1;index=int(name[-1])-1
        p=phase+index*math.pi/2+(math.pi if side==1 else 0)
        target=max(0,math.sin(p))*lift*exit_scale
        basis=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
        pb.location+=basis.to_3x3().inverted()@Vector((0,0,target-lowest))
    for pb in rig.pose.bones:
        for prop in ('location','rotation_euler','scale'):pb.keyframe_insert(prop,frame=frame,group=pb.name)

clips={
    'idle':[(1,{}),(22,{'bob':.005,'eye':.10,'close':.055}),(43,{}),
            (64,{'bob':.004,'eye':-.075,'close':.025}),(85,{})],
    'walk':[(1,{'phase':0,'step':.055,'lift':.060}),
            (10,{'phase':math.pi/2,'step':.055,'lift':.060,'bob':.010,'sway':-.006}),
            (19,{'phase':math.pi,'step':.055,'lift':.060}),
            (28,{'phase':math.pi*1.5,'step':.055,'lift':.060,'bob':.010,'sway':.006}),
            (37,{'phase':math.tau,'step':.055,'lift':.060})],
    'attack':[(1,{}),(3,{'wind':1,'close':-.20,'recoil':.009,'eye':.12}),
              (6,{'strike':1,'close':.85,'recoil':-.015,'bob':-.004,'tilt':.012}),
              (10,{'strike':.25,'close':.20,'recoil':.002}),(16,{})],
    'hit':[(1,{}),(4,{'recoil':.024,'bob':-.009,'tilt':-.030,'eye':.22,'close':-.10}),
           (9,{'recoil':-.005,'bob':.003,'eye':-.06}),(16,{})],
    'exit':[(1,{}),(7,{'bob':.015,'eye':.25,'close':-.20}),
            (16,{'bob':-.022,'tilt':-.025,'close':.15,'exit_scale':.80}),
            (27,{'bob':-.010,'exit_scale':.30}),(37,{'exit_scale':.02})],
}
rig.animation_data_create()
for name,keys in clips.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame,values in keys:pose(frame,**values)
    action.use_fake_user=True
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for point in fc.keyframe_points:point.interpolation='LINEAR'
    track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,action)
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=bpy.data.actions['idle'].slots[0]
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'giant-claw.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();merged=bpy.context.object;merged.name='GiantClaw_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(material)
for p in merged.data.polygons:p.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
require(triangles==21208 and len(merged.data.vertices)==10674,'Approved mesh budget changed')
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'giant-claw.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
stats={'version':'giant-claw-runtime-candidate-01','enemy_kind':'boss','display_name':'巨钳蟹',
    'status':'isolated rigged runtime candidate; not copied to resources or finally accepted in Cocos',
    'triangles':triangles,'vertices':len(merged.data.vertices),'mesh_count':1,'material_count':1,
    'material_name':material.name,'bones':list(ordered),'bone_count':len(ordered),'walking_legs':8,
    'clips':{name:{'name':'GiantClaw_Rig|'+name,'first':1,'last':keys[-1][0],'seconds':(keys[-1][0]-1)/30} for name,keys in clips.items()},
    'loops':['idle','walk'],'bounds_blender_xyz':bounds,'recommended_scale':1.0,
    'dimensions_blender_xyz':[bounds['max'][i]-bounds['min'][i] for i in range(3)],
    'forward':'Blender -Y/Z up; FBX -Z forward/Y up; expected Cocos +Z, actual importer not yet checked',
    'fbx_sha256':sha(OUT/'giant-claw.fbx'),'protected_reference_hashes':protected,
    'source':'Approved project-original giant-claw c01 exact geometry/material, new single skeleton/weights and five authored actions. No external stock asset.',
    'attack_contract':{'interval_seconds':1.8,'range':3,'core_movement_pause_seconds':.3,
        'attack_animation_seconds':.5,'main_impulse_frame':6,'main_impulse_seconds':5/30,
        'damage_timing':'core event tick; animation never schedules damage or cooldown',
        'existing_special_events':'crabSlam every third attack; crabSummon once at half hp. No new attacks or extra skill take.'},
    'skin_note':'Rigid body/eyes/claws, first four existing rings of each leg blend body->leg; distal stance rings explicitly grounded at authored keys',
    'prototype_sha256':sha(C01/'giant-claw-prototype.blend')}
write('model-stats.json',stats)

# Save the same approved family studio; no render call in this builder.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=900;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
fm=bpy.data.materials.new('REVIEW_ONLY_warm_sand');fm.use_nodes=True
fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='REVIEW_ONLY_floor';floor.data.materials.append(fm)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    data=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=col
    ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('GiantClaw_action_camera');camera=bpy.data.objects.new(data.name,data)
scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=3.14
camera.location=(3.35,-5.5,3.2);camera.rotation_euler=(Vector((.06,0,.6))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'giant-claw-review-scene.blend'))
for name,digest in protected.items():require(sha(ROOT/name)==digest,'Frozen prototype source changed '+name)
write('prototype-preservation.json',{'status':'pass','files':protected,'writes_to_original_prototype':False})
print('GIANT_CLAW_RIG_BUILD_COMPLETE '+json.dumps({'triangles':triangles,'bones':len(ordered),'clips':stats['clips'],'fbx_sha256':stats['fbx_sha256'],'render_started':False}),flush=True)
