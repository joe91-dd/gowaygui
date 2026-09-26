"""Original armored-crab c01: editable toy mesh, UV atlas, skin, five actions.

Run with Blender --background --factory-startup -t 2 --python-exit-code 1.
All outputs are confined to armored-crab/candidate-01; no runtime mutation.
"""
from pathlib import Path
import bpy, bmesh, math, json, hashlib, sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/armored-crab/candidate-01'
OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('ARMORED_CRAB_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS=[];FEET={};SPECS={}

# Original painted palette. Every visible part uses this one UV colour/roughness
# material. The single eye surface contains iris, pupil and small painted glint.
SIZE=512;TILE=128
PALETTE=[(.19,.285,.34),(.82,.72,.51),(.075,.12,.15),(.285,.405,.46),
         (.93,.85,.65),(.042,.052,.053),(.13,.22,.27),(.98,.91,.76),
         (.115,.185,.23),(.23,.335,.385),(.41,.48,.48),(.79,.66,.43),
         (.33,.425,.46),(.18,.285,.24),(.72,.60,.39),(.90,.80,.57)]
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32);rp=np.ones_like(pixels)
yy,xx=np.mgrid[0:TILE,0:TILE].astype(np.float32)
u=(xx+.5)/TILE;v=(yy+.5)/TILE
for index,col in enumerate(PALETTE):
    row,column=index//4,index%4
    shade=1+.055*np.cos((u-.5)*math.pi)*np.sin(v*math.pi)
    pixels[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=np.array(col)*shade[:,:,None]
    rp[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=.38 if index in (0,3,4,6,9,12) else .45
# Broad, restrained value shading, no copied scratches or metal photographs.
# Cream seams are genuine shallow panel side walls with their own UV tile.
# Eye UV: one smooth closed ellipsoid; no separate pupil cap/card.
ex=u*2-1;ez=v*2-1
eye=np.ones((TILE,TILE,3),dtype=np.float32);eye[:]=(.94,.88,.72)
for rx,rz,col in [(.72,.78,(.13,.21,.14)),(.60,.68,(.016,.022,.020))]:
    d=np.sqrt(((ex-.025)/rx)**2+((ez+.015)/rz)**2);a=np.clip((1-d)/.035+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.19,.24,.135,.16),(.27,-.31,.047,.061)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.09+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.98,.89))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('ArmoredCrab_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'armored-colour.png')
atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('ArmoredCrab_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel())
rough.filepath_raw=str(OUT/'armored-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('ArmoredCrab_Toy_Atlas');MAT.use_nodes=True
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


def soft_tube(name,points,radii,tile,bone):
    """Round a pincer finger's authored bend without increasing the whole mesh."""
    points=[Vector(p) for p in points];smooth=[];widths=[]
    for i in range(len(points)-1):
        p0,p1,p2,p3=points[max(0,i-1)],points[i],points[i+1],points[min(len(points)-1,i+2)]
        for sub in range(3):
            t=sub/3
            smooth.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
            widths.append(radii[i]*(1-t)+radii[i+1]*t)
    smooth.append(points[-1]);widths.append(radii[-1])
    return tube(name,smooth,widths,tile,bone,sides=12)


# A new squat body plan: wide abdomen, low eyes and six broad armored sectors.
# The shared runner helpers author actual geometry; no runner mesh is recolored.
body=loft('Broad_bluegray_body',[
    (.175,.28,.17,0,.018),(.205,.37,.235,0,.016),(.265,.443,.29,0,.018),
    (.35,.467,.314,0,.027),(.445,.445,.299,0,.032),(.53,.36,.254,0,.042),
    (.60,.245,.18,0,.05),(.626,.10,.09,0,.05),(.629,.01,.01,0,.05)],6,segments=40,uv_axes=(0,1))
belly=ellipsoid('Thick_cream_belly',(0,-.005,.19),(.39,.258,.074),1,segments=28,rings=10)

def armor_sector(index):
    angular=8;radii=[.31,.44,.61,.77,.90,.974];vertices=[];faces=[]
    start=math.tau*index/6+.027;end=math.tau*(index+1)/6-.027
    for layer in (0,1):
        for r in radii:
            for step in range(angular+1):
                angle=start+(end-start)*step/angular
                z=.385+.30*math.sqrt(max(0,1-r*r))+(0 if layer==0 else -.028)
                vertices.append((.493*r*math.cos(angle),.057+.345*r*math.sin(angle),z))
    count=len(radii)*(angular+1)
    for layer in (0,1):
        offset=layer*count
        for ri in range(len(radii)-1):
            for ai in range(angular):
                quad=(offset+ri*(angular+1)+ai,offset+ri*(angular+1)+ai+1,offset+(ri+1)*(angular+1)+ai+1,offset+(ri+1)*(angular+1)+ai)
                faces.append(quad if layer==0 else tuple(reversed(quad)))
    wall_start=len(faces)
    boundary=list(range(angular+1))
    boundary += [ri*(angular+1)+angular for ri in range(1,len(radii))]
    boundary += [(len(radii)-1)*(angular+1)+ai for ai in range(angular-1,-1,-1)]
    boundary += [ri*(angular+1) for ri in range(len(radii)-2,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+count,a+count))
    ob=meshpart('Rounded_armor_plate_'+str(index+1),vertices,faces,[0,9,0,12,9,0][index],uv_axes=(0,1))
    for poly in list(ob.data.polygons)[wall_start:]:
        for li in poly.loop_indices:ob.data.uv_layers.active.data[li].uv=((1+.5)/4,.5/4)
    return ob
for index in range(6):armor_sector(index)
ellipsoid('Rounded_central_keystone',(0,.057,.667),(.176,.126,.041),3,segments=24,rings=10)
# A continuous lower bumper reads as thickness, rather than a coat of paint.
loft('Thick_rolled_shell_bumper',[
    (.252,.41,.265,0,.037),(.27,.456,.303,0,.035),
    (.296,.478,.319,0,.036),(.316,.466,.313,0,.036)],0,segments=40,uv_axes=(0,1))
rim=[]
for j in range(41):
    a=math.tau*j/40;rim.append((.464*math.cos(a),.036+.305*math.sin(a),.306))
tube('Restrained_cream_bumper_seam',rim,.008,1,sides=6)

# Eight short broad legs. Upper/lower profiles swell smoothly around the knee.
for side,label in [(-1,'L'),(1,'R')]:
    for index,(hy,ky,ty,kx,tx) in enumerate([(-.155,-.235,-.365,.487,.493),(-.058,-.084,-.15,.556,.565),(.064,.110,.18,.593,.605),(.16,.265,.37,.510,.526)]):
        name=f'leg_{label}{index+1}';hip=(side*.362,hy,.25)
        points=[hip,(side*.414,hy+(ky-hy)*.30,.244),(side*kx,ky,.185),
                (side*(kx+.007),ky+(ty-ky)*.45,.117),(side*tx,ty,.047),
                (side*(tx-.003),ty+.004,.023)]
        leg=soft_tube(name+'_curved_leg',points,[.041,.057,.064,.060,.047,.012],6,name)
        FEET[name]=leg
        SPECS[name]=(hip,(hip[0],hip[1],hip[2]+.12),'root')

# Larger rounded pinching mitts, held nearer to the body at rest.
for side,label in [(-1,'L'),(1,'R')]:
    arm_name='claw_'+label;jaw_name='jaw_'+label
    palm=Vector((side*.535,-.303,.345))
    soft_tube('Thick_short_arm_'+label,[(side*.34,-.115,.28),(side*.447,-.237,.30),tuple(palm)],
              [.068,.077,.070],1,arm_name)
    ellipsoid('Heavy_round_pincer_palm_'+label,palm,(.132,.104,.124),3,arm_name,segments=24,rings=12)
    # Thick rounded fingers keep a visible slot; they are not pointed talons.
    outer=[palm+Vector((side*x,-.008,z)) for x,z in [(.071,.035),(.100,.090),(.085,.150),(.053,.183),(.020,.193)]]
    inner=[palm+Vector((side*x,-.012,z)) for x,z in [(-.066,.043),(-.084,.103),(-.060,.165),(-.017,.184)]]
    soft_tube('Heavy_fixed_finger_'+label,outer,[.041,.045,.040,.032,.009],1,arm_name)
    soft_tube('Heavy_moving_finger_'+label,inner,[.040,.043,.036,.008],1,jaw_name)
    SPECS[arm_name]=((side*.34,-.115,.28),(side*.34,-.115,.49),'body')
    SPECS[jaw_name]=(tuple(palm+Vector((-side*.064,-.01,.038))),tuple(palm+Vector((-side*.064,-.01,.158))),arm_name)

# Eyes are held low against the front armor, with thick brow ridges.
for side,label in [(-1,'L'),(1,'R')]:
    bone='eye_'+label;centre=Vector((side*.18,-.279,.545))
    tube('Short_protected_eye_stalk_'+label,[(side*.155,-.223,.35),(side*.177,-.26,.443),(side*.18,-.275,.514)],
         [.047,.052,.048],1,bone,sides=16)
    ellipsoid('Protected_eye_socket_'+label,centre+Vector((0,.022,.009)),(.119,.083,.137),0,bone,segments=24,rings=12)
    eye=ellipsoid('Spherical_painted_eye_'+label,centre+Vector((0,-.025,0)),(.105,.073,.112),4,bone,segments=32,rings=16)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co-(centre+Vector((0,-.025,0)))
        a=max(.007,min(.993,.5+.5*p.x/.105));b=max(.007,min(.993,.5+.5*p.z/.112))
        eye.data.uv_layers.active.data[loop.index].uv=(a/4,(1+b)/4)
    brow=[(side*(.098+.158*i/10),-.315-.02*math.sin(math.pi*i/10),.642+.023*i/10+.007*math.sin(math.pi*i/10)) for i in range(11)]
    tube('Heavy_soft_brow_'+label,brow,[.009]+[.021]*9+[.009],1,bone,sides=10)
    SPECS[bone]=((side*.155,-.223,.35),(side*.155,-.223,.57),'body')

def shell_front(x,z,lift=.004):
    hit,pos,normal,_=body.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    assert hit,(x,z)
    return pos+Vector((0,-lift,0))
mouth=[tuple(shell_front(-.096+.192*i/16,.312+.019*(2*i/16-1)**2)) for i in range(17)]
tube('Stubborn_small_smile',mouth,[.003]+[.008]*15+[.003],5,sides=8)
for side,label in [(-1,'L'),(1,'R')]:
    p=shell_front(side*.255,.365,.002)
    ellipsoid('Subtle_cheek_'+label,p,(.030,.005,.014),9,segments=12,rings=6)

GROUND_OFFSET=min(v.co.z for ob in PARTS for v in ob.data.vertices)
for ob in PARTS:
    for v in ob.data.vertices:v.co.z-=GROUND_OFFSET

# All vertices are weighted; rigid shell/eye volumes preserve toy surfaces.
# Eight legs are independent, while body bob/claw anticipation are real skinning.
arm=bpy.data.armatures.new('ArmoredCrab_skeleton')
rig=bpy.data.objects.new('ArmoredCrab_Rig',arm);CHAR.objects.link(rig)
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
    mod=ob.modifiers.new('ArmoredCrab_skin','ARMATURE');mod.object=rig;ob.parent=rig
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
    'idle':[(1,{}),(19,{'bob':.004,'eye':.10,'open_jaw':.08}),(37,{}),(55,{'bob':.003,'eye':-.08}),(73,{})],
    'walk':[(1,{'phase':0,'step':.035}),(7,{'phase':math.pi/2,'step':.035,'bob':.009,'sway':-.009,'eye':.08}),
            (13,{'phase':math.pi,'step':.035}),(19,{'phase':math.pi*1.5,'step':.035,'bob':.009,'sway':.009,'eye':-.08}),
            (25,{'phase':math.tau,'step':.035})],
    'attack':[(1,{}),(9,{'attack':-.18,'recoil':.02,'bob':-.009,'open_jaw':.85,'eye':.12}),
              (16,{'attack':.9,'recoil':-.025,'bob':-.012,'open_jaw':-.25,'tilt':.035}),
              (22,{'attack':.43,'open_jaw':.08}),(34,{})],
    'hit':[(1,{}),(4,{'recoil':.022,'bob':-.012,'tilt':-.055,'eye':.25,'open_jaw':.25}),
           (9,{'recoil':-.007,'bob':.004,'eye':-.08}),(16,{})],
    'exit':[(1,{}),(8,{'bob':.018,'eye':.4,'open_jaw':.5}),(15,{'bob':-.065,'tilt':-.06,'open_jaw':.25}),
            (22,{'bob':-.045,'exit_scale':.38,'eye':.2}),(28,{'exit_scale':.025})],
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
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'armored-crab.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();merged=bpy.context.object;merged.name='ArmoredCrab_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
assert triangles<=14000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'armored-crab.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'armored-crab.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dimensions=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats={'version':'armored-crab-candidate-01','enemy_kind':'armored','display_name':'铁壳蟹',
       'vertices':len(merged.data.vertices),'triangles':triangles,'mesh_count':1,'material_count':1,
       'material_name':MAT.name,'bones':list(ordered),'bone_count':len(arm.bones),'walking_legs':8,
       'texture_size':[512,512],'roughness':'RGB grayscale 0.38–0.45; alpha 1; Non-Color; nonmetal F0 0.04',
       'clips':{k:{'name':'ArmoredCrab_Rig|'+k,'first':1,'last':v[-1][0],'seconds':(v[-1][0]-1)/30} for k,v in CLIPS.items()},
       'loops':['idle','walk'],'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dimensions,
       'recommended_scale':.90,'dimensions_at_recommended_scale':[value*.90 for value in dimensions],
       'forward':'Blender -Y; FBX axis_forward=-Z/axis_up=Y; expected Cocos +Z as ink contract, actual Cocos import pending',
       'origin':'Blender Z=0/Cocos Y=0 foot origin; in-place animation, movement belongs to core/view',
       'fbx_sha256':hashlib.sha256((OUT/'armored-crab.fbx').read_bytes()).hexdigest(),
       'source':'Original scripted mesh, UV artwork, rig and animation. A4, island and approved project runner c01 used only as internal style references; shared procedural helpers retained, body/armor/legs/claws/eye placement and timing newly authored. No external stock asset.',
       'status':'Isolated first review candidate; no runtime promotion, not final art acceptance.'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# Match the ink sample's actual studio, exposure, soft key/fill/rim and AgX.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=920;scene.render.resolution_y=820;scene.render.resolution_percentage=100
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
aim((2.5,-4.8,2.35),(0,-.01,.34),1.84)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'armored-crab-review-scene.blend'))
for name,loc,target,scale in ([] if '--no-render' in sys.argv else [
    ('front',(0,-5,1.3),(0,-.04,.33),1.71),
    ('three-quarter',(2.5,-4.8,2.35),(0,-.01,.34),1.84),
    ('side',(5,-.10,1.18),(0,-.01,.34),1.63)]):
    aim(loc,target,scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('ARMORED_CRAB_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)


