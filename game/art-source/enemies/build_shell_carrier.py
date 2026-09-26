"""Original shell-carrier c01: editable toy mesh, UV atlas, skin, five actions.

Run with Blender --background --factory-startup -t 2 --python-exit-code 1.
All outputs are confined to shell-carrier/candidate-01; no runtime mutation.
"""
from pathlib import Path
import bpy, bmesh, math, json, hashlib, sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/shell-carrier/candidate-01'
OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
REFERENCES=[ROOT/'game/art-source/enemies/build_armored_crab.py',ROOT/'game/art-source/enemies/armored-crab/candidate-01/armored-crab.blend',ROOT/'game/art-source/enemies/runner-crab/candidate-01/runner-crab.blend']
REFERENCE_HASHES={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in REFERENCES}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('SHELL_CARRIER_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS=[];FEET={};SPECS={}

# Original painted palette. Every visible part uses this one UV colour/roughness
# material. The single eye surface contains iris, pupil and small painted glint.
SIZE=512;TILE=128
PALETTE=[(.53,.235,.165),(.89,.76,.54),(.17,.10,.075),(.77,.48,.34),
         (.94,.88,.72),(.045,.034,.029),(.46,.195,.135),(.95,.84,.65),
         (.35,.14,.10),(.66,.35,.255),(.69,.45,.31),(.66,.43,.24),
         (.79,.56,.38),(.37,.225,.15),(.80,.62,.39),(.91,.77,.56)]
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
for rx,rz,col in [(.72,.78,(.29,.17,.085)),(.60,.68,(.031,.024,.018))]:
    d=np.sqrt(((ex-.025)/rx)**2+((ez+.015)/rz)**2);a=np.clip((1-d)/.035+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.19,.24,.135,.16),(.27,-.31,.047,.061)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.09+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.98,.89))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('ShellCarrier_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'carrier-colour.png')
atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('ShellCarrier_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel())
rough.filepath_raw=str(OUT/'carrier-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('ShellCarrier_Toy_Atlas');MAT.use_nodes=True
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
    # Continuous transported frames avoid the directional flips found while
    # reviewing the snail shell. This is an independent original crab source.
    points=[Vector(p) for p in points];vertices=[];faces=[]
    if isinstance(radii,(float,int)):radii=[radii]*len(points)
    tangents=[(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized() for i in range(len(points))]
    axes=[Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))]
    reference=min(axes,key=lambda axis:abs(axis.dot(tangents[0])))
    normals=[tangents[0].cross(reference).normalized()]
    for i in range(1,len(points)):
        n=tangents[i-1].rotation_difference(tangents[i])@normals[-1]
        n-=tangents[i]*n.dot(tangents[i]);n.normalize();normals.append(n)
    for i,p in enumerate(points):
        a=normals[i];b=tangents[i].cross(a).normalized()
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


# An uncovered warm-red crab body, with a separate fan-shell load at the rear.
# No segmented iron armor is carried over; the shell is a genuine thick volume.
body=loft('Rounded_carrier_body',[
    (.175,.28,.17,0,.018),(.205,.37,.235,0,.016),(.265,.431,.287,0,.018),
    (.35,.448,.299,0,.027),(.435,.423,.286,0,.032),(.52,.345,.246,0,.042),
    (.578,.23,.169,0,.05),(.606,.10,.08,0,.05),(.609,.01,.01,0,.05)],6,segments=40,uv_axes=(0,1))
belly=ellipsoid('Cream_carrier_belly',(0,-.005,.19),(.382,.254,.074),1,segments=28,rings=10)

def carried_fan():
    angular=49;radial=10;vertices=[];faces=[]
    # A broad scalloped bivalve: small hinge, bowed exterior, shallow broad ribs.
    # The front face and back face are joined into one opaque closed solid.
    for layer in (0,1):
        for ri in range(radial+1):
            r=.07+.93*ri/radial
            for ai in range(angular+1):
                alpha=-1.10+2.20*ai/angular;phase=math.tau*7*ai/angular
                ridge=(.5+.5*math.cos(phase))**3
                scallop=1+.017*math.cos(phase)*r**5
                x=.535*r*math.sin(alpha)/math.sin(1.10)*scallop
                z=.478+.690*r*math.cos(alpha)*scallop
                y=.135+.102*r-.145*math.sin(math.pi*r)
                y-=.019*ridge*max(0,math.sin(math.pi*r))**.65
                if layer:y+=.075+.016*math.sin(math.pi*r)
                vertices.append((x,y,z))
    count=(radial+1)*(angular+1)
    for layer in (0,1):
        offset=layer*count
        for ri in range(radial):
            for ai in range(angular):
                quad=(offset+ri*(angular+1)+ai,offset+ri*(angular+1)+ai+1,offset+(ri+1)*(angular+1)+ai+1,offset+(ri+1)*(angular+1)+ai)
                faces.append(quad if layer==0 else tuple(reversed(quad)))
    wall_start=len(faces)
    boundary=list(range(angular+1))+[ri*(angular+1)+angular for ri in range(1,radial+1)]
    boundary += [radial*(angular+1)+ai for ai in range(angular-1,-1,-1)]+[ri*(angular+1) for ri in range(radial-1,0,-1)]
    for i,a in enumerate(boundary):
        b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+count,a+count))
    ob=meshpart('Large_carried_fan_shell',vertices,faces,3,'carried_shell')
    # Cream colour follows the real radial ribs. The other face stays warm peach.
    for poly in ob.data.polygons:
        if poly.index<radial*angular:
            ai=poly.index%angular;ri=poly.index//angular
            if math.cos(math.tau*7*(ai+.5)/angular)>.50:
                for li in poly.loop_indices:
                    old=ob.data.uv_layers.active.data[li].uv.copy()
                    ob.data.uv_layers.active.data[li].uv=(old.x,old.y+.25)
        elif poly.index>=wall_start:
            for li in poly.loop_indices:ob.data.uv_layers.active.data[li].uv=((1+.5)/4,.5/4)
    # Bevel only substantial boundary bends; body, eyes and claws are unaffected.
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
    bevel=ob.modifiers.new('Rounded_fan_edges','BEVEL');bevel.width=.010;bevel.segments=2
    bevel.limit_method='ANGLE';bevel.angle_limit=.55
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for poly in ob.data.polygons:poly.use_smooth=True
    ob.select_set(False);return ob
load=carried_fan()
ellipsoid('Rounded_shell_hinge',(0,.108,.49),(.123,.080,.072),1,'carried_shell',segments=24,rings=10)
SPECS['carried_shell']=((0,.115,.465),(0,.115,.77),'body')

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

# Rounded forward pincers remain compact: the carried shell is the elite cue.
for side,label in [(-1,'L'),(1,'R')]:
    arm_name='claw_'+label;jaw_name='jaw_'+label
    palm=Vector((side*.535,-.323,.335))
    soft_tube('Thick_short_arm_'+label,[(side*.34,-.115,.28),(side*.447,-.237,.30),tuple(palm)],
              [.068,.077,.070],1,arm_name)
    ellipsoid('Heavy_round_pincer_palm_'+label,palm,(.125,.103,.120),0,arm_name,segments=24,rings=12)
    # Thick rounded fingers keep a visible slot; they are not pointed talons.
    outer=[palm+Vector((side*x,-.008,z)) for x,z in [(.071,.035),(.100,.090),(.085,.150),(.053,.183),(.020,.193)]]
    inner=[palm+Vector((side*x,-.012,z)) for x,z in [(-.066,.043),(-.084,.103),(-.060,.165),(-.017,.184)]]
    soft_tube('Heavy_fixed_finger_'+label,outer,[.041,.045,.040,.032,.009],1,arm_name)
    soft_tube('Heavy_moving_finger_'+label,inner,[.040,.043,.036,.008],1,jaw_name)
    SPECS[arm_name]=((side*.34,-.115,.28),(side*.34,-.115,.49),'body')
    SPECS[jaw_name]=(tuple(palm+Vector((-side*.064,-.01,.038))),tuple(palm+Vector((-side*.064,-.01,.158))),arm_name)

# Warm low eyes and soft lids retain the family resemblance of the crab enemies.
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
    tube('Carrier_soft_brow_'+label,brow,[.007]+[.017]*9+[.007],1,bone,sides=10)
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
arm=bpy.data.armatures.new('ShellCarrier_skeleton')
rig=bpy.data.objects.new('ShellCarrier_Rig',arm);CHAR.objects.link(rig)
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
    mod=ob.modifiers.new('ShellCarrier_skin','ARMATURE');mod.object=rig;ob.parent=rig
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
    rotate_world('carried_shell',(.014*math.sin(phase)-tilt*.30,0,sway*.4))
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
    'idle':[(1,{}),(22,{'bob':.004,'eye':.10,'open_jaw':.06}),(43,{}),(64,{'bob':.003,'eye':-.06}),(85,{})],
    'walk':[(1,{'phase':0,'step':.036}),(9,{'phase':math.pi/2,'step':.036,'bob':.009,'sway':-.008}),
            (17,{'phase':math.pi,'step':.036}),(25,{'phase':math.pi*1.5,'step':.036,'bob':.009,'sway':.008}),
            (33,{'phase':math.tau,'step':.036})],
    'attack':[(1,{}),(10,{'attack':-.16,'recoil':.018,'bob':-.007,'open_jaw':.75,'eye':.10}),
              (18,{'attack':.82,'recoil':-.024,'bob':-.010,'open_jaw':-.20,'tilt':.026}),
              (27,{'attack':.33,'open_jaw':.07}),(40,{})],
    'hit':[(1,{}),(4,{'recoil':.025,'bob':-.011,'tilt':-.045,'eye':.22,'open_jaw':.20}),
           (11,{'recoil':-.006,'bob':.003,'eye':-.06}),(19,{})],
    'exit':[(1,{}),(9,{'bob':.016,'eye':.35,'open_jaw':.42}),(18,{'bob':-.045,'tilt':-.045,'open_jaw':.20,'exit_scale':.8}),
            (27,{'bob':-.025,'exit_scale':.35,'eye':.15}),(34,{'exit_scale':.025})],
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
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shell-carrier.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();merged=bpy.context.object;merged.name='ShellCarrier_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons)
assert triangles<=16000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'shell-carrier.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'shell-carrier.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],
        'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dimensions=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats={'version':'shell-carrier-candidate-01','enemy_kind':'elite','display_name':'搬壳大蟹',
       'vertices':len(merged.data.vertices),'triangles':triangles,'mesh_count':1,'material_count':1,
       'material_name':MAT.name,'bones':list(ordered),'bone_count':len(arm.bones),'walking_legs':8,
       'texture_size':[512,512],'roughness':'RGB grayscale 0.38–0.45; alpha 1; Non-Color; nonmetal F0 0.04',
       'clips':{k:{'name':'ShellCarrier_Rig|'+k,'first':1,'last':v[-1][0],'seconds':(v[-1][0]-1)/30} for k,v in CLIPS.items()},
       'loops':['idle','walk'],'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dimensions,
       'recommended_scale':1.0,'dimensions_at_recommended_scale':dimensions,
       'forward':'Blender -Y; FBX axis_forward=-Z/axis_up=Y; expected Cocos +Z as ink contract, actual Cocos import pending',
       'origin':'Blender Z=0/Cocos Y=0 foot origin; in-place animation, movement belongs to core/view',
       'fbx_sha256':hashlib.sha256((OUT/'shell-carrier.fbx').read_bytes()).hexdigest(),
       'source':'Project-original editable model: shared crab limb/eye construction and rig helpers from approved runner/armored sources; new uncovered carrier body, original closed scalloped fan load, transported curve frames, warm palette and carrying timing. Internal A direction only; no external stock asset.',
       'mechanism':'core elite: hp900 armor25 resist25 speed.6 attack40 interval1.5 range.9 leak3. Shell is a visual load, not an extra ability.',
       'shape_note':'Elite scale only: 1.0 suggested, do not multiply the old procedural elite 1.3 factor again; compact claws, rear carried fan shell.',
       'protected_reference_hashes':REFERENCE_HASHES,
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
aim((2.6,-4.8,2.55),(0,.03,.55),1.97)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'shell-carrier-review-scene.blend'))
for name,loc,target,scale in ([] if '--no-render' in sys.argv else [
    ('three-quarter',(2.6,-4.8,2.55),(0,.03,.55),1.97),
    ('battle-angle',(2.8,-4.9,5.20),(0,0,.56),2.04)]):
    aim(loc,target,scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
for path,digest in REFERENCE_HASHES.items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,'Protected source changed: '+path
print('SHELL_CARRIER_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)
