"""Non-destructive Blender refinement of AHOLO task 3513206 for internal review.
The generated source is retained. This is a local derived asset, not another API task.
"""
import bpy, bmesh, math, json, numpy as np, sys
from pathlib import Path
from mathutils import Vector, Quaternion
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'polished-yandun'
OUT.mkdir(parents=True,exist_ok=True)
QUICK='--quick' in sys.argv
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/yandun_glb.glb'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
body.name='Yandun_Surface'
bpy.context.view_layer.objects.active=body; body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
cs=np.array([v.co[:] for v in body.data.vertices]); lo=cs.min(0); hi=cs.max(0)
cs=(cs-np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]]))*2.4/(hi[2]-lo[2])
source_cs=cs.copy()
body.data.vertices.foreach_set('co',cs.ravel()); body.data.update()
original_mat=body.data.materials[0]
texture=next(n.image for n in original_mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
pixels=np.array(texture.pixels[:]).reshape(texture.size[1],texture.size[0],4)
uv=body.data.uv_layers.active.data

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)

# Broaden the muzzle and open the eye area without replacing the approved face.
# The falloff keeps the neck and rigid shoulder plates stationary.
headmask=smooth(1.52,1.73,cs[:,2])*(1-smooth(-.36,-.19,cs[:,1]))*(1-smooth(.28,.43,np.abs(cs[:,0])))
cs[:,0]*=1+.12*headmask
cs[:,2]+=.035*headmask
for sign in [-1,1]:
    dx=cs[:,0]-sign*.177; dz=cs[:,2]-1.825
    influence=np.exp(-((dx/.115)**2+(dz/.10)**2)*1.2)*(1-smooth(-.52,-.25,cs[:,1]))
    cs[:,2]+=dz*.28*influence
    # Ease the inner downward brow and relax the scowl.
    lift=np.exp(-(((cs[:,0]-sign*.106)/.10)**2+((cs[:,2]-1.87)/.045)**2))
    cs[:,2]+=.030*lift*(1-smooth(-.58,-.38,cs[:,1]))
body.data.vertices.foreach_set('co',cs.ravel()); body.data.update()

def material(name,color,rough=.45,metal=0,tex=None,emission=None,strength=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if tex:
        t=m.node_tree.nodes.new('ShaderNodeTexImage'); t.image=tex
        # glTF supports a constant baseColor factor multiplied by its embedded texture.
        mix=m.node_tree.nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
        mix.inputs[2].default_value=(*color,1)
        m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
    if emission:
        p.inputs['Emission Color'].default_value=(*emission,1);p.inputs['Emission Strength'].default_value=strength
    return m

skin=material('01_Honey_gold_skin',(1,.92,.73),.43,0,texture)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.055
stone=material('02_Charcoal_rock',(0.52,.52,.58),.67,.045,texture)
plate=material('03_Warm_ivory_plates',(1,.96,.86),.48,0,texture)
crystal=material('04_Sapphire_crystals',(.03,.65,1),.17,.30,texture, (.005,.16,.48),.23)
cp=crystal.node_tree.nodes.get('Principled BSDF');cp.inputs['Coat Weight'].default_value=.5;cp.inputs['Coat Roughness'].default_value=.12
detail=material('05_Facial_details',(1,1,1),.29,0,texture)
body.data.materials.clear()
for m in [skin,stone,plate,crystal,detail]:body.data.materials.append(m)
assign_counts=[0]*5; vertex_mats=np.zeros(len(cs),dtype=np.int8)
face_centers=[]; crystal_vertices=set()
for face in body.data.polygons:
    tuv=np.mean([uv[i].uv[:] for i in face.loop_indices],axis=0)
    r,g,b=pixels[min(int(tuv[1]*(texture.size[1]-1)),texture.size[1]-1),min(int(tuv[0]*(texture.size[0]-1)),texture.size[0]-1),:3]
    center=np.mean(cs[list(face.vertices)],axis=0); x,y,z=center
    blue=(b>r*1.16 and g>r*1.10 and b>g*.94 and b>.38)
    rock=(max(r,g,b)-min(r,g,b)<.24 and r<.78 and r<b*1.42 and r<g*1.42)
    face_region=z>1.62 and y<-.35 and abs(x)<.37
    ivory=abs(x)<.5 and y<-.32 and .56<z<1.58 and r>.45 and g>r*.72 and b>r*.50
    idx=3 if blue else 4 if face_region else 2 if ivory else 1 if rock else 0
    face.material_index=idx; assign_counts[idx]+=1
    for vi in face.vertices:vertex_mats[vi]=idx
    if idx==3:crystal_vertices.update(face.vertices)
    face.use_smooth=idx!=3

# Weld coincident GLB UV seam vertices before reducing density, preserving per-loop UVs.
# Decimating disconnected seam vertices directly makes small cracks in the face and hands.
bpy.context.view_layer.objects.active=body
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
high_mesh=body.data.copy();high_mesh.name='Yandun_high_detail_preserved';high_mesh.use_fake_user=True
dec=body.modifiers.new('Runtime_density_reduction','DECIMATE');dec.ratio=.58;dec.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=dec.name)
cs=np.array([v.co[:] for v in body.data.vertices])

# The generated fist touches the thigh in the source and has connecting triangles.
# Split both arm surfaces from the torso, cap the hidden cuts, then retain a point-domain
# anatomical tag. This prevents a fist from ever inheriting shin weights.
patch=material('06_Hidden_joint_surface',(.66,.31,.068),.47)
body.data.materials.append(patch);patch_index=len(body.data.materials)-1
labels=[]
for face in body.data.polygons:
    x,y,z=face.center;ax=abs(x)
    fist_volume=((ax-.79)/.265)**2+((y+.46)/.25)**2+((z-.65)/.23)**2
    hand=(.44<z<.88 and fist_volume<1.38)
    arm=(.78<z<1.64 and ax>.57 and y<.22)
    labels.append((1 if x>0 else 2) if (hand or arm) else 0)
source_geometry=body.data.copy();parts=[]
for part_id in [0,1,2]:
    bm=bmesh.new();bm.from_mesh(source_geometry);bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if labels[f.index]!=part_id],context='FACES')
    # Remove disconnected slivers left by the AI surface at hand/thigh and shell/shoulder contacts.
    remaining=set(bm.faces);components=[]
    while remaining:
        start=remaining.pop();stack=[start];component=[start]
        while stack:
            current=stack.pop()
            for edge in current.edges:
                for adjacent in edge.link_faces:
                    if adjacent in remaining:remaining.remove(adjacent);stack.append(adjacent);component.append(adjacent)
        components.append(component)
    components.sort(key=len,reverse=True)
    discard=[f for i,component in enumerate(components) if (part_id and i>0) or (not part_id and len(component)<80) for f in component]
    if discard:bmesh.ops.delete(bm,geom=discard,context='FACES')
    boundary=[e for e in bm.edges if e.is_boundary]
    if boundary:
        added=bmesh.ops.holes_fill(bm,edges=boundary,sides=0).get('faces',[])
        for face in added:face.material_index=1 if face.calc_center_median().z>1.20 else patch_index;face.smooth=True
        if added:bmesh.ops.triangulate(bm,faces=list(added))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    me=bpy.data.meshes.new('Anatomical_part_'+str(part_id));bm.to_mesh(me);bm.free()
    for ma in body.data.materials:me.materials.append(ma)
    tag=me.attributes.new('anatomical_part','INT','POINT')
    for d in tag.data:d.value=part_id
    ob=bpy.data.objects.new('Yandun_part_'+str(part_id),me);bpy.context.collection.objects.link(ob);parts.append(ob)
bpy.data.objects.remove(body,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in parts:ob.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=parts[0];body.name='Yandun_Surface'
cs=np.array([v.co[:] for v in body.data.vertices]);part_ids=[d.value for d in body.data.attributes['anatomical_part'].data]

# Localized joint weights: shell stays attached to the thorax, wrists and toes have their own bones.
arm_data=bpy.data.armatures.new('Yandun_skeleton')
rig=bpy.data.objects.new('Yandun_Rig',arm_data);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);body.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
bone_defs={
 'root':((0,0,0),(0,0,.35),None),
 'pelvis':((0,0,.60),(0,0,.92),'root'),
 'chest':((0,0,.92),(0,-.05,1.49),'pelvis'),
 'head':((0,-.31,1.55),(0,-.38,1.96),'chest'),
}
for side,sgn in [('L',1),('R',-1)]:
    bone_defs.update({
      'upperarm.'+side:((sgn*.53,-.12,1.46),(sgn*.76,-.29,1.12),'chest'),
      'forearm.'+side:((sgn*.76,-.29,1.12),(sgn*.80,-.40,.79),'upperarm.'+side),
      'hand.'+side:((sgn*.80,-.40,.79),(sgn*.78,-.43,.54),'forearm.'+side),
      'thigh.'+side:((sgn*.30,.0,.68),(sgn*.41,-.05,.39),'pelvis'),
      'shin.'+side:((sgn*.41,-.05,.39),(sgn*.43,-.12,.17),'thigh.'+side),
      'foot.'+side:((sgn*.43,-.12,.17),(sgn*.43,-.45,.07),'shin.'+side),
    })
for n,(h,t,parent) in bone_defs.items():
    eb=arm_data.edit_bones.new(n);eb.head=h;eb.tail=t
    if n.startswith(('upperarm.','forearm.','hand.')):eb.align_roll(Vector((0,-1,0)))
    if parent:eb.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for p in rig.pose.bones:p.rotation_mode='XYZ'
groups={n:body.vertex_groups.new(name=n) for n in bone_defs}
bone_names=list(bone_defs);bone_idx={n:i for i,n in enumerate(bone_names)};all_weights=np.zeros((len(cs),len(bone_names)),dtype=np.float32)
for vi,(x,y,z) in enumerate(cs):
    ax=abs(x);side='L' if x>=0 else 'R'
    if part_ids[vi] in [1,2]:
        if z<.77:weights={'hand.'+side:1}
        elif z<.88:
            v=float(smooth(.77,.88,z));weights={'hand.'+side:1-v,'forearm.'+side:v}
        elif z<1.13:weights={'forearm.'+side:1}
        elif z<1.27:
            v=float(smooth(1.13,1.27,z));weights={'forearm.'+side:1-v,'upperarm.'+side:v}
        else:weights={'upperarm.'+side:1}
    elif z<.69 and ax>.17:
        if z<.23:weights={'foot.'+side:1}
        elif z<.40:
            v=float(smooth(.23,.40,z));weights={'foot.'+side:1-v,'shin.'+side:v}
        elif z<.54:
            v=float(smooth(.40,.54,z));weights={'shin.'+side:1-v,'thigh.'+side:v}
        else:
            v=float(smooth(.58,.70,z));weights={'thigh.'+side:1-v,'pelvis':v}
    elif z>1.53 and y<-.28 and ax<.40:
        v=float(smooth(1.53,1.64,z)*(1-smooth(-.36,-.22,y)))
        weights={'head':v,'chest':1-v}
    else:
        v=float(smooth(.66,1.01,z));weights={'pelvis':1-v,'chest':v}
    total=sum(weights.values())
    for n,w in weights.items():
        if w>.0001:all_weights[vi,bone_idx[n]]=float(w/total)
# Diffuse weights over the welded surface graph to avoid abrupt boundaries within knuckles/plates.
edges=np.array([e.vertices[:] for e in body.data.edges]);ea=edges[:,0];eb=edges[:,1]
degrees=np.bincount(np.concatenate([ea,eb]),minlength=len(cs)).astype(np.float32)
for _ in range(14):
    accum=np.zeros_like(all_weights);np.add.at(accum,ea,all_weights[eb]);np.add.at(accum,eb,all_weights[ea])
    all_weights=all_weights*.38+accum/np.maximum(degrees[:,None],1)*.62
all_weights/=np.maximum(all_weights.sum(axis=1,keepdims=True),.000001)
for vi,row in enumerate(all_weights):
    # Keep at most four influences so the GLB remains compatible with mobile skinning.
    chosen=np.argsort(row)[-4:];total=float(row[chosen].sum())
    for i in chosen:
        if row[i]>.0001:groups[bone_names[i]].add([vi],float(row[i]/total),'REPLACE')
body.parent=rig
mod=body.modifiers.new('Skeleton_deformation','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True

# Curved crystalline veins hug the source surface; runtime glow travels along these anchored paths.
# Their independent geometry is positioned from ray hits, never a billboard over the portrait.
glow=material('06_Crystal_filament',(.10,.8,1),.18,.15,None,(.08,.72,1),2.4)
inlay_specs=[('back_crown',[(0,-.15,2.02),(.015,-.15,2.14),(-.025,-.15,2.26),(0,-.15,2.34)],'chest')]
assets=[body]

def parent_bone(obj,bone):
    world=obj.matrix_world.copy();obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone
    bpy.context.view_layer.update();obj.matrix_world=world

# Separate optical surfaces give the eyes real depth and moving reflections.
# All eye parts are attached to the head bone and can be edited in the .blend.
extras=[];lids=[]
white=material('07_Eye_sclera',(.88,.84,.71),.26)
iris=material('08_Amber_iris',(.45,.15,.018),.23,.10)
iris_light=material('09_Amber_iris_light',(.78,.31,.029),.21,.12)
limbal=material('10_Iris_outer_edge',(.065,.024,.009),.27)
pupil=material('11_Pupil',(.009,.005,.003),.12)
lidmat=material('12_Golden_eyelids',(.91,.48,.105),.42)
iris_surface=material('08_Living_amber_iris',(1,1,1),.20,0)
ip=iris_surface.node_tree.nodes.get('Principled BSDF');ip.inputs['Coat Weight'].default_value=.85;ip.inputs['Coat Roughness'].default_value=.07
vc=iris_surface.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Iris_color';iris_surface.node_tree.links.new(vc.outputs['Color'],ip.inputs['Base Color'])
glint_mat=material('09_Corneal_catchlight',(.92,.98,1),.08,0,None,(.40,.52,.65),.30)
def ellipsoid(name,center,scale,mat,angle=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=center)
    ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.rotation_euler.z=angle
    ob.data.materials.append(mat)
    for f in ob.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    parent_bone(ob,'head');extras.append(ob);return ob
for side,sgn in [('L',1),('R',-1)]:
    angle=sgn*.48;normal=Vector((math.sin(angle),-math.cos(angle),0));tangent=Vector((math.cos(angle),math.sin(angle),0))
    ec=Vector((sgn*.192,-.702,1.838))-normal*.019
    eye=ellipsoid('Eye_white_'+side,ec,(.077,.034,.082),white,angle)
    # One curved optical surface, rather than stacked disks, avoids a button-eye silhouette.
    iv=[];ifaces=[];icol=[];rings=18;segments=72
    for j in range(rings+1):
        rad=max(.0001,j/rings)
        for i in range(segments):
            a=i/segments*math.tau;xx=math.cos(a)*.057*rad-sgn*.006;zz=math.sin(a)*.066*rad-.003
            yy=.036*math.sqrt(max(0,1-(xx/.077)**2-(zz/.082)**2))+.0012
            iv.append(tuple(ec+tangent*xx+normal*yy+Vector((0,0,zz))))
            if rad<.59:rgb=(.006,.003,.0015)
            elif rad>.94:rgb=(.031,.011,.003)
            else:
                fiber=.83+.17*math.sin(i*2.7+rad*25)
                warmth=.85+.20*(1-math.sin(a))
                rgb=(.34*fiber*warmth,.105*fiber*warmth,.013*fiber)
            icol.append((*rgb,1))
    for j in range(rings):
        for i in range(segments):
            n=(i+1)%segments;aa=j*segments;bb=(j+1)*segments;ifaces.append((aa+i,aa+n,bb+n,bb+i))
    ime=bpy.data.meshes.new('Curved_iris_'+side);ime.from_pydata(iv,[],ifaces);ime.update()
    colors=ime.color_attributes.new(name='Iris_color',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(colors.data,icol):v.color=c
    iob=bpy.data.objects.new('Eye_iris_'+side,ime);bpy.context.collection.objects.link(iob);ime.materials.append(iris_surface)
    for f in ime.polygons:f.use_smooth=True
    parent_bone(iob,'head');extras.append(iob)
    for idx,(gx,gz,sz) in enumerate([(-.018,.024,.008),(.019,-.025,.0035)]):
        gy=.036*math.sqrt(max(0,1-(gx/.077)**2-(gz/.082)**2))+.0028
        ellipsoid('Eye_catchlight_'+side+str(idx),ec+tangent*gx+normal*gy+Vector((0,0,gz)),(sz,.0013,sz*1.25),glint_mat,angle)
    # A top eyelid patch follows the eye curvature; closing uses a morph, not a black overlay.
    verts=[];closed=[];faces=[];cols=28;rows=10
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            xn=-1+2*i/cols;h=math.sqrt(max(0,1-xn*xn))
            for target,lower in [(verts,.61),(closed,-.99)]:
                zn=h*(lower+(1-lower)*t)
                yy=math.sqrt(max(0,1-xn*xn-zn*zn))*.040+.004
                pt=ec+tangent*(xn*.080)+Vector((0,0,zn*.085))+normal*yy
                target.append(tuple(pt))
    for j in range(rows):
        for i in range(cols):
            a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
    me=bpy.data.meshes.new('Eyelid_mesh_'+side);me.from_pydata(verts,[],faces);me.update()
    lid=bpy.data.objects.new('Eyelid_'+side,me);bpy.context.collection.objects.link(lid);lid.data.materials.append(lidmat)
    for f in me.polygons:f.use_smooth=True
    lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='Blink')
    for v,co in zip(key.data,closed):v.co=co
    parent_bone(lid,'head');extras.append(lid);lids.append(lid)

# Animation clips have anticipation, strike, follow-through and recovery, with planted feet.
def reset_pose():
    for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
def posekey(frame,rotations={},positions={}):
    reset_pose()
    for n,rot in rotations.items():
        if n.startswith(('upperarm.','forearm.','hand.')):rot=(-rot[0],rot[1],-rot[2])
        rig.pose.bones[n].rotation_euler=tuple(math.radians(a) for a in rot)
    for n,loc in positions.items():rig.pose.bones[n].location=loc
    for b in rig.pose.bones:
        b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('location',frame=frame);b.keyframe_insert('scale',frame=frame)
def action(name,frames):
    reset_pose();a=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=a
    for frame,rots,pos in frames:posekey(frame,rots,pos)
    for fc in a.fcurves:
        for kp in fc.keyframe_points:kp.interpolation='BEZIER'
    track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,0,a);strip.action_frame_start=0;strip.action_frame_end=frames[-1][0]
    track.mute=True
    rig.animation_data.action=None
    return a

idle=action('Idle',[
 (0,{},{}),(30,{'chest':(-1.2,0,0),'head':(0,0,-1),'upperarm.L':(-1,0,-1.3),'upperarm.R':(1,0,1.3)},{}),
 (60,{},{}),(90,{'chest':(.5,0,0),'head':(0,0,1),'upperarm.L':(.5,0,.5),'upperarm.R':(-.5,0,-.5)},{}),(120,{},{}),])
attack=action('Attack_Combo',[
 (0,{},{}),
 (8,{'chest':(-4,0,-9),'head':(0,0,6),'upperarm.R':(12,12,12),'forearm.R':(-25,0,-8),'upperarm.L':(-5,0,-8)},{}),
 (14,{'chest':(8,0,10),'head':(-2,0,-4),'upperarm.R':(-66,-10,-9),'forearm.R':(8,0,0),'hand.R':(6,0,0),'upperarm.L':(-12,0,-10)},{}),
 (18,{'chest':(6,0,8),'upperarm.R':(-62,-6,-8),'forearm.R':(4,0,0)},{}),
 (28,{'chest':(-5,0,10),'head':(0,0,-5),'upperarm.L':(12,-12,-12),'forearm.L':(-24,0,8),'upperarm.R':(-10,0,8)},{}),
 (35,{'chest':(8,0,-10),'head':(-2,0,5),'upperarm.L':(-66,10,9),'forearm.L':(8,0,0),'hand.L':(6,0,0)},{}),
 (40,{'chest':(6,0,-7),'upperarm.L':(-60,6,8),'forearm.L':(2,0,0)},{}),
 (56,{},{}),])
skill=action('Rock_Storm',[
 (0,{},{}),(12,{'chest':(8,0,0),'head':(-4,0,0),'upperarm.L':(-16,0,-18),'upperarm.R':(-16,0,18),'forearm.L':(-22,0,0),'forearm.R':(-22,0,0)},{}),
 (22,{'chest':(-7,0,0),'head':(4,0,0),'upperarm.L':(-35,0,-40),'upperarm.R':(-35,0,40),'forearm.L':(-12,0,0),'forearm.R':(-12,0,0)},{}),
 (38,{'chest':(-3,0,-4),'head':(0,0,4),'upperarm.L':(-30,0,-35),'upperarm.R':(-30,0,35)},{}),
 (54,{'chest':(-3,0,4),'head':(0,0,-4),'upperarm.L':(-30,0,-35),'upperarm.R':(-30,0,35)},{}),
 (68,{'chest':(7,0,0),'head':(-3,0,0),'upperarm.L':(-10,0,-15),'upperarm.R':(-10,0,15)},{}),(86,{},{}),])
hit=action('Hit',[(0,{},{}),(4,{'chest':(-8,0,4),'head':(6,0,-3),'upperarm.L':(-8,0,-10),'upperarm.R':(-6,0,10)},{}),(10,{'chest':(3,0,-2),'head':(-2,0,1)},{}),(23,{},{}),])
entrance=action('Greeting',[(0,{},{}),(14,{'head':(-4,0,-10),'upperarm.L':(-30,0,-20),'forearm.L':(-40,0,0)},{}),(28,{'head':(2,0,-8),'upperarm.L':(-34,0,-18),'forearm.L':(-35,0,0),'hand.L':(0,0,12)},{}),(42,{'head':(-2,0,-6),'upperarm.L':(-30,0,-20),'forearm.L':(-40,0,0),'hand.L':(0,0,-12)},{}),(66,{},{}),])
reset_pose()

# Socket metadata drives in-engine VFX in local bone coordinates.
sockets=[]
for name,loc,bone in [
 ('FX_Crown',(0,0,2.3),'chest'),('FX_Wrist_L',(.94,-.22,.85),'forearm.L'),('FX_Wrist_R',(-.94,-.22,.85),'forearm.R'),
 ('FX_Toe_L',(.44,-.45,.09),'foot.L'),('FX_Toe_R',(-.44,-.45,.09),'foot.R'),
 ('FX_Fist_L',(.87,-.32,.67),'hand.L'),('FX_Fist_R',(-.87,-.32,.67),'hand.R')]:
    obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);obj.location=loc
    parent_bone(obj,bone);sockets.append(obj)
rig['asset_use']='Internal evaluation only: commercial entitlement unverified'
rig['source_task']='3513206';rig['source_region']='cn'
rig['clip_events']=json.dumps({'Attack_Combo':{'impacts':[14/30,35/30]},'Rock_Storm':{'release':22/30,'end':68/30}})

scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=0;scene.frame_end=120
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=False
bpy.ops.object.select_all(action='DESELECT')
for ob in [rig,body]+sockets+extras:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT/'yandun-polished.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_skins=True,export_morph=True,export_extras=True,export_apply=False)
for t in rig.animation_data.nla_tracks:t.mute=True
rig.animation_data.action=idle;scene.frame_set(0)

# A grounded neutral stage and photographic lights distinguish rock, skin and polished crystal.
ground=material('Stage_warm_sand',(.59,.55,.45),.85)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.007))
bpy.context.object.name='Shadow_receiver';bpy.context.object.data.materials.append(ground)
world=bpy.data.worlds.new('Daylight');world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.50,.69,.88,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35;scene.world=world
def area(name,loc,power,size,col):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=col
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm_key',(-3,-4,5),480,3,(1,.87,.68))
area('Ocean_fill',(4,-2,3),130,4,(.62,.82,1))
area('Crystal_rim',(1,2.4,4),540,2,(.48,.80,1))
camdata=bpy.data.cameras.new('Review_camera');cam=bpy.data.objects.new('Review_camera',camdata);bpy.context.collection.objects.link(cam)
camdata.type='ORTHO';camdata.ortho_scale=2.98;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24 if QUICK else 48;scene.cycles.use_denoising=True
scene.render.resolution_x=720 if QUICK else 1000;scene.render.resolution_y=840 if QUICK else 1120;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.use_nodes=True; nt=scene.node_tree;nt.nodes.clear();rl=nt.nodes.new('CompositorNodeRLayers');gl=nt.nodes.new('CompositorNodeGlare');gl.glare_type='FOG_GLOW';gl.threshold=1.5;gl.quality='HIGH';gl.mix=-.94;comp=nt.nodes.new('CompositorNodeComposite');nt.links.new(rl.outputs['Image'],gl.inputs['Image']);nt.links.new(gl.outputs['Image'],comp.inputs['Image'])
def render(name,loc,clip=idle,frame=0):
    if '--no-render' in sys.argv:return
    rig.animation_data.action=clip;scene.frame_set(frame)
    cam.location=loc;cam.rotation_euler=(Vector((0,-.02,1.19))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yandun-polished.blend'))
render('front',(0,-6,2.3))
render('quarter',(3,-6,2.7))
if not QUICK:
    render('back',(2,6,2.8));render('attack',(3,-6,2.7),attack,14);render('skill',(3,-6,2.7),skill,38)
    rig.animation_data.action=idle;scene.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'yandun-polished.blend'))
report={'time':datetime.now(timezone.utc).isoformat(),'sourceTaskId':3513206,'sourceTriangles':188641,'runtimeTriangles':sum(len(p.vertices)-2 for p in body.data.polygons),'vertices':len(body.data.vertices),'bones':len(rig.data.bones),'animations':[a.name for a in [idle,attack,skill,hit,entrance]],'materialFaceCountsBeforeReduction':assign_counts,'license':'internal-evaluation-pending-confirmation','limitations':['Generated triangulated topology, locally reduced; not manual quad retopology','Face expression and skinning need visual approval before production integration','No commercial license has been established for this trial asset']}
(OUT/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('POLISH_COMPLETE '+json.dumps(report))
