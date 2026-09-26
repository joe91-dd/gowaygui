"""Original ink enemy sample; run with portable Blender 4.5 --background.

Creates editable topology, UV atlas, nine-bone skin, five actions and FBX import
candidate. No third-party mesh, photo, game extraction, or generated billboard.
The game definition is ENEMIES.ink / 小墨团, not a hermit crab.
"""
from pathlib import Path
import bpy
import bmesh
import math
import json
import hashlib
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/ink-blob/candidate-01'
OUT=SOURCE/'export'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('INK_BLOB_EDITABLE_PARTS')
bpy.context.scene.collection.children.link(CHAR)
PARTS=[]

# One 512px original palette atlas; no noisy detail used to hide the silhouette.
PALETTE=[(.030,.045,.070),(.055,.050,.083),(.052,.078,.110),(.090,.075,.117),
         (.90,.77,.54),(.25,.105,.034),(.012,.017,.027),(.95,.91,.79),
         (.24,.080,.099),(.042,.052,.083),(.090,.110,.15),(.12,.08,.135),
         (.7,.51,.31),(.1,.13,.17),(.16,.13,.18),(.028,.037,.060)]
SIZE=512; TILE=128
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32)
rough_pixels=np.ones_like(pixels)
for i,col in enumerate(PALETTE):
    x,y=i%4,i//4
    pixels[y*TILE:(y+1)*TILE,x*TILE:(x+1)*TILE,:3]=col
    rough_pixels[y*TILE:(y+1)*TILE,x*TILE:(x+1)*TILE,:3]=.31 if i in [4,5,6,7] else .43
atlas=bpy.data.images.new('InkBlob_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'ink-colour.png')
atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('InkBlob_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rough_pixels.ravel())
rough.filepath_raw=str(OUT/'ink-roughness.png');rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('InkBlob_Toy_Atlas');MAT.use_nodes=True
p=MAT.node_tree.nodes.get('Principled BSDF');p.inputs['Specular IOR Level'].default_value=.30
tex=MAT.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas
MAT.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
rt=MAT.node_tree.nodes.new('ShaderNodeTexImage');rt.image=rough
MAT.node_tree.links.new(rt.outputs['Color'],p.inputs['Roughness'])

def meshpart(name,verts,faces,tile,bone='body',subdiv=0):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);CHAR.objects.link(ob)
    ob.data.materials.append(MAT);ob['bone']=bone;ob['atlas_tile']=tile
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    for face in me.polygons:face.use_smooth=True
    if subdiv:
        mod=ob.modifiers.new('Authored_surface_smoothing','SUBSURF');mod.levels=subdiv
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.2,island_margin=.035)
    bpy.ops.object.mode_set(mode='OBJECT')
    for uv in ob.data.uv_layers.active.data:
        uv.uv=((tile%4+.055+uv.uv.x*.89)/4,(tile//4+.055+uv.uv.y*.89)/4)
    ob.select_set(False);PARTS.append(ob);return ob

def loft(name,rings,tile,bone='body',segments=24,subdiv=1,shape=1):
    # z, x radius, y radius, x offset, y offset. Deliberately sculpted profiles.
    vs=[];fs=[]
    for z,rx,ry,cx,cy in rings:
        for j in range(segments):
            a=math.tau*j/segments
            x=math.copysign(abs(math.cos(a))**shape,math.cos(a))
            y=math.copysign(abs(math.sin(a))**shape,math.sin(a))
            vs.append((cx+rx*x,cy+ry*y,z))
    for k in range(len(rings)-1):
        for j in range(segments):fs.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    fs.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return meshpart(name,vs,fs,tile,bone,subdiv)

# A single closed main surface: broad cheeks and flattened lower body rise into
# an off-centre swept ink-drop crest. Not a spherical body plus floating hat.
body=loft('Continuous_ink_body',[
    (.055,.19,.21,0,.015),(.082,.36,.32,0,.005),(.14,.475,.365,0,0),
    (.28,.535,.414,0,-.010),(.47,.53,.452,-.01,-.010),(.65,.478,.435,-.014,.015),
    (.80,.380,.350,-.004,.039),(.925,.257,.254,.025,.070),
    (1.03,.15,.166,.065,.118),(1.105,.088,.097,.108,.174),
    (1.142,.037,.044,.141,.226),(1.131,.006,.008,.158,.260)],0,segments=32,subdiv=1,shape=.91)
for v in body.data.vertices:
    x,y,z=v.co
    front=max(0,min(1,(-y-.12)/.22))
    cheeks=math.exp(-((abs(x)-.27)/.13)**2-((z-.42)/.13)**2)
    sockets=math.exp(-((abs(x)-.207)/.105)**2-((z-.595)/.135)**2)
    v.co.y+=front*(-.026*cheeks+.019*sockets)
body.data.update()

def surface(x,z,lift=.003):
    hit,pos,n,_=body.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
    assert hit,('face outside body',x,z)
    return pos+Vector((0,-lift,0)),n

def ellipsoid(name,center,radii,tile,bone='face',seg=20,rings=10,normal=None):
    # Small eye/cheek details only; main silhouette uses the closed loft above.
    c=Vector(center);vs=[c+Vector((0,0,radii[2]))]
    for k in range(1,rings):
        a=math.pi*k/rings
        for j in range(seg):
            b=math.tau*j/seg;vs.append(c+Vector((radii[0]*math.sin(a)*math.cos(b),radii[1]*math.sin(a)*math.sin(b),radii[2]*math.cos(a))))
    vs.append(c+Vector((0,0,-radii[2])));bottom=len(vs)-1
    fs=[]
    for j in range(seg):fs.append((0,1+j,1+(j+1)%seg))
    for k in range(rings-2):
        for j in range(seg):fs.append((1+k*seg+j,1+(k+1)*seg+j,1+(k+1)*seg+(j+1)%seg,1+k*seg+(j+1)%seg))
    for j in range(seg):fs.append((bottom,1+(rings-2)*seg+(j+1)%seg,1+(rings-2)*seg+j))
    if normal:
        q=Vector((0,-1,0)).rotation_difference(Vector(normal));vs=[c+q@(v-c) for v in vs]
    return meshpart(name,[tuple(v) for v in vs],fs,tile,bone)

def tube(name,points,radius,tile,bone='face',sides=6):
    vs=[];fs=[];pts=[Vector(p) for p in points]
    for i,pos in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        a=tangent.cross(Vector((0,1,0)))
        if a.length<.1:a=tangent.cross(Vector((1,0,0)))
        a.normalize();b=tangent.cross(a).normalized()
        rr=radius*(.45+.55*math.sin(math.pi*i/(len(pts)-1))**.35)
        for j in range(sides):vs.append(tuple(pos+rr*(a*math.cos(math.tau*j/sides)+b*math.sin(math.tau*j/sides))))
    for k in range(len(pts)-1):
        for j in range(sides):fs.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    fs.extend([tuple(range(sides-1,-1,-1)),tuple((len(pts)-1)*sides+j for j in range(sides))])
    return meshpart(name,vs,fs,tile,bone)

# Four soft lobed walking contacts, slender at attachment and broad at the toe.
FEET={}
for side,lab in [(-1,'L'),(1,'R')]:
    for front,suffix in [(True,'F'),(False,'R')]:
        name='foot_'+lab+suffix;y=-.25 if front else .245;x=side*.385
        toe_y=y+(-.18 if front else .13)
        foot=loft(name+'_flipper',[(.008,.095,.08,x+side*.14,toe_y),(.024,.155,.145,x+side*.115,toe_y),
            (.072,.16,.151,x+side*.09,toe_y+.015),(.128,.122,.128,x+side*.045,y),(.202,.052,.073,x,y)],9,name,segments=16,subdiv=1,shape=.85)
        FEET[name]=foot
        # One restrained sculptural groove: no individual human-like fingers.
        if front:
            tube(name+'_crease',[(x+side*.07,toe_y-.09,.096),(x+side*.095,toe_y-.08,.113),(x+side*.13,toe_y-.04,.116)],.006,2,name)
tail=loft('Swept_trailing_drop',[(.03,.11,.08,.055,.29),(.08,.17,.18,.045,.40),(.15,.13,.17,.022,.46),(.21,.065,.08,-.004,.55),(.24,.008,.009,-.023,.615)],2,'tail',segments=16,subdiv=1)

# Clear warm eyes contrast the dark body. Socket geometry is flush with body,
# pupil is frontal and brows slant very gently: troublesome, never frightening.
for side,lab in [(-1,'L'),(1,'R')]:
    ep,en=surface(side*.205,.585,0)
    normal=Vector((en.x*.30,en.y,en.z*.25)).normalized()
    ellipsoid('Warm_eye_'+lab,ep-normal*.015,(.113,.043,.143),4,normal=normal)
    ellipsoid('Amber_iris_'+lab,ep+normal*.024+Vector((side*.006,0,-.008)),(.068,.018,.091),5,normal=normal)
    ellipsoid('Pupil_'+lab,ep+normal*.038+Vector((side*.006,0,-.006)),(.045,.012,.070),6,seg=16,rings=8,normal=normal)
    ellipsoid('Catchlight_'+lab,ep+normal*.050+Vector((-.018,0,.024)),(.020,.006,.025),7,seg=12,rings=8,normal=normal)
    ellipsoid('Small_catchlight_'+lab,ep+normal*.051+Vector((.022,0,-.030)),(.007,.003,.009),7,seg=8,rings=6,normal=normal)
    brow=[tuple(surface(side*(.104+.191*k/8),.748+.013*k/8+.010*math.sin(math.pi*k/8),.004)[0]) for k in range(9)]
    tube('Soft_brow_'+lab,brow,.020,2)
    cp,cn=surface(side*.348,.418,.001)
    ellipsoid('Muted_cheek_'+lab,cp,(.052,.005,.025),8,seg=14,rings=6,normal=cn)
mouth=[tuple(surface(-.145+.29*k/16,.335+.025*((k/16*2-1)**2)+.008*(k/16),.003)[0]) for k in range(17)]
tube('Crooked_little_mouth',mouth,.014,6)
# Tiny cream lower-lip glint stays fully within the mouth rather than fangs.
lip=[tuple(surface(-.061+.090*k/8,.329+.004*math.sin(math.pi*k/8),.005)[0]) for k in range(9)]
tube('Warm_lower_lip',lip,.006,12)

# Nine named bones. Body has a continuous gradient into its crest and ground
# contacts, so squash/recoil is actual deformation rather than object swapping.
arm=bpy.data.armatures.new('InkBlob_skeleton');rig=bpy.data.objects.new('InkBlob_Rig',arm);CHAR.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
SPECS={'root':((0,0,0),(0,0,.12),None),'body':((0,0,.23),(0,0,.67),'root'),
       'crown':((0,.05,.73),(.06,.10,1.1),'body'),'face':((0,-.26,.38),(0,-.26,.69),'body'),
       'tail':((.025,.29,.1),(.025,.29,.30),'root')}
for name in FEET:
    side=-1 if name[5]=='L' else 1;y=-.25 if name.endswith('F') else .245
    SPECS[name]=((side*.385,y,.12),(side*.385,y,.32),'root')
for name,(head,tail,parent) in SPECS.items():
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
for ob in PARTS:
    if ob==body:
        groups={n:ob.vertex_groups.new(name=n) for n in ['root','body','crown']}
        for v in ob.data.vertices:
            wroot=max(0,min(.80,(.27-v.co.z)/.24));wcrown=max(0,min(.92,(v.co.z-.65)/.50))
            weights={'root':wroot,'crown':wcrown,'body':1-wroot-wcrown}
            for n,w in weights.items():
                if w>0:groups[n].add([v.index],w,'REPLACE')
    else:ob.vertex_groups.new(name=ob['bone']).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('InkBlob_skin','ARMATURE');mod.object=rig;ob.parent=rig
for b in rig.pose.bones:b.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=30

def translate(name,xyz):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(xyz)

def pose(frame,squash=0,lean=0,sway=0,crest=0,step=0,phase=0,recoil=0,exit_scale=1,blink=1):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['body'].scale=(1+squash*.42,1+squash*.28,1-squash)
    translate('body',(sway,recoil,-squash*.10))
    rig.pose.bones['body'].rotation_euler.x=lean
    rig.pose.bones['crown'].rotation_euler.y=crest
    rig.pose.bones['face'].scale=(1,1,blink)
    for i,name in enumerate(['foot_LF','foot_RF','foot_LR','foot_RR']):
        p=phase+(math.pi if i in [1,2] else 0)
        translate(name,(0,math.cos(p)*step,max(0,math.sin(p))*abs(step)*.38))
        rig.pose.bones[name].rotation_euler.z=math.sin(p)*step*.7
    rig.pose.bones['tail'].rotation_euler.y=crest*.65
    # Retreat is a short implosion/ink pancake, intended to be removed at end.
    rig.pose.bones['root'].scale=(exit_scale,exit_scale,exit_scale)
    for pb in rig.pose.bones:
        for prop in ['location','rotation_euler','scale']:pb.keyframe_insert(prop,frame=frame,group=pb.name)

CLIPS={
 'idle':[(1,{}),(16,{'squash':-.025,'crest':-.035}),(31,{'squash':.018,'crest':.035}),(42,{'blink':.38}),(45,{}),(61,{})],
 'walk':[(1,{'step':.11,'phase':0}),(5,{'step':.11,'phase':math.pi/2,'squash':.035,'sway':-.012,'crest':.055}),
         (9,{'step':.11,'phase':math.pi}),(13,{'step':.11,'phase':math.pi*1.5,'squash':.035,'sway':.012,'crest':-.055}),(17,{'step':.11,'phase':math.tau})],
 'attack':[(1,{}),(6,{'squash':.16,'recoil':.06,'crest':-.14}),(10,{'squash':-.06,'lean':.20,'recoil':-.115,'crest':.15}),(15,{'squash':.045,'lean':.045,'recoil':-.025}),(24,{})],
 'hit':[(1,{}),(4,{'squash':.13,'lean':-.18,'recoil':.095,'crest':-.16,'blink':.48}),(9,{'squash':-.025,'lean':.03,'crest':.06}),(16,{})],
 'exit':[(1,{}),(6,{'squash':-.08,'crest':.17,'blink':.40}),(13,{'squash':.63,'crest':-.20,'blink':.10}),(20,{'squash':.82,'exit_scale':.45,'blink':.10}),(26,{'squash':.85,'exit_scale':.015,'blink':.10})],
}
rig.animation_data_create()
for name,keys in CLIPS.items():
    a=bpy.data.actions.new(name);rig.animation_data.action=a
    for frame,kwargs in keys:pose(frame,**kwargs)
    a.use_fake_user=True
    track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True
    track.strips.new(name,1,a)
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-blob.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=PARTS[0];bpy.ops.object.join();merged=bpy.context.object;merged.name='InkBlob_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for f in merged.data.polygons:f.material_index=0
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'ink-blob.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'ink-blob.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
stats={'version':'ink-blob-sample-01','enemy_kind':'ink','display_name':'小墨团',
       'vertices':len(merged.data.vertices),'triangles':sum(len(f.vertices)-2 for f in merged.data.polygons),
       'mesh_count':1,'material_count':1,'bone_count':len(arm.bones),'texture_size':[512,512],
       'clips':{k:round((v[-1][0]-1)/30,6) for k,v in CLIPS.items()},'loops':['idle','walk'],
       'forward':'Blender -Y; expected Cocos +Z, to verify during real import',
       'origin':'Z=0 floor in Blender; Y=0 floor in Cocos; no root motion',
       'fbx_sha256':hashlib.sha256((OUT/'ink-blob.fbx').read_bytes()).hexdigest(),
       'source':'Original authored mesh/UV atlas/rig/keyframes. Project A image is concept reference only.',
       'status':'Isolated import candidate; not connected to gameplay; not final aesthetic acceptance.'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

# Neutral physical studio. Save it before rendering so rerenders remain exact.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=3
scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
floor_mat=bpy.data.materials.new('Studio_warm_sand');floor_mat.use_nodes=True
floor_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
floor_mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='REVIEW_ONLY_floor';floor.data.materials.append(floor_mat)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    ob=bpy.data.objects.new(name,ld);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Ink_sample_camera');cam=bpy.data.objects.new('Ink_sample_camera',cd)
scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=2.12
cam.location=(2.5,-4.8,2.5);cam.rotation_euler=(Vector((0,-.015,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-blob-review-scene.blend'))
for name,loc,scale in [('close-up',(2.5,-4.8,2.5),2.12),('battle-angle',(3.8,-5.2,5.3),2.12),('front',(0,-5,1.7),1.95)]:
    cd.ortho_scale=scale;cam.location=loc;cam.rotation_euler=(Vector((0,-.015,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('INK_BLOB_SAMPLE_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)
