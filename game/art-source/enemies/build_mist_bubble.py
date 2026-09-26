"""Original mist enemy: opaque connected cloud shell, authored UV, skin and actions.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
Outputs are isolated in mist-bubble/candidate-01. No runtime or other source edits.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'game/art-source/enemies/mist-bubble/candidate-01'
OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('MIST_BUBBLE_EDITABLE_PARTS');bpy.context.scene.collection.children.link(CHAR)
PARTS=[];FEET={}

SIZE=512;TILE=128
PALETTE=[(.57,.48,.69),(.43,.35,.56),(.79,.72,.84),(.66,.59,.75),
         (.95,.90,.94),(.095,.061,.16),(.71,.63,.78),(.42,.29,.49),
         (.53,.43,.63),(.84,.75,.82),(.68,.60,.78),(.35,.30,.43),
         (.64,.54,.72),(.48,.37,.57),(.77,.67,.78),(.89,.83,.91)]
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32);rp=np.ones_like(pixels)
yy,xx=np.mgrid[0:TILE,0:TILE].astype(np.float32);u=(xx+.5)/TILE;v=(yy+.5)/TILE
for index,col in enumerate(PALETTE):
    row,column=index//4,index%4
    shade=.96+.055*np.sin(v*math.pi)+.018*np.cos((u-.5)*math.pi)
    pixels[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=np.array(col)*shade[:,:,None]
    rp[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=.44 if index not in (4,5) else .34
ex=u*2-1;ez=v*2-1
eye=np.ones((TILE,TILE,3),dtype=np.float32);eye[:]=(.95,.90,.94)
for rx,rz,col in [(.75,.82,(.30,.16,.36)),(.61,.70,(.041,.026,.069))]:
    d=np.sqrt(((ex-.02)/rx)**2+((ez+.025)/rz)**2);a=np.clip((1-d)/.04+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.23,.29,.16,.175),(.28,-.31,.045,.055)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.07+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.98,1))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('MistBubble_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'mist-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('MistBubble_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel());rough.filepath_raw=str(OUT/'mist-roughness.png')
rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('MistBubble_Toy_Atlas');MAT.use_nodes=True
bsdf=MAT.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Metallic'].default_value=0
bsdf.inputs['Specular IOR Level'].default_value=.5;bsdf.inputs['Alpha'].default_value=1
bsdf.inputs['Transmission Weight'].default_value=0
for image,input_name in [(atlas,'Base Color'),(rough,'Roughness')]:
    node=MAT.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    MAT.node_tree.links.new(node.outputs['Color'],bsdf.inputs[input_name])

def assign_uv(ob,tile,axes=(0,2)):
    me=ob.data
    for existing in list(me.uv_layers):me.uv_layers.remove(existing)
    uv=me.uv_layers.new(name='ToyAtlasUV')
    mins=[min(p.co[i] for p in me.vertices) for i in axes]
    spans=[max(p.co[i] for p in me.vertices)-mins[j] for j,i in enumerate(axes)]
    for loop in me.loops:
        p=me.vertices[loop.vertex_index].co
        a=(p[axes[0]]-mins[0])/max(spans[0],1e-8);b=(p[axes[1]]-mins[1])/max(spans[1],1e-8)
        uv.data[loop.index].uv=((tile%4+.025+.95*a)/4,(tile//4+.025+.95*b)/4)

def meshpart(name,vertices,faces,tile,bone='body'):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free();me.update()
    ob=bpy.data.objects.new(name,me);CHAR.objects.link(ob);me.materials.append(MAT)
    ob['bone']=bone;ob['atlas_tile']=tile
    for face in me.polygons:face.use_smooth=True
    assign_uv(ob,tile);PARTS.append(ob);return ob

def ellipsoid(name,center,radii,tile,bone='body',segments=24,rings=12):
    c=Vector(center);vertices=[tuple(c+Vector((0,0,radii[2])))];faces=[]
    for k in range(1,rings):
        a=math.pi*k/rings
        for j in range(segments):
            b=math.tau*j/segments
            vertices.append(tuple(c+Vector((radii[0]*math.sin(a)*math.cos(b),radii[1]*math.sin(a)*math.sin(b),radii[2]*math.cos(a)))))
    vertices.append(tuple(c-Vector((0,0,radii[2]))));bottom=len(vertices)-1
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for k in range(rings-2):
        for j in range(segments):faces.append((1+k*segments+j,1+(k+1)*segments+j,1+(k+1)*segments+(j+1)%segments,1+k*segments+(j+1)%segments))
    for j in range(segments):faces.append((bottom,1+(rings-2)*segments+(j+1)%segments,1+(rings-2)*segments+j))
    return meshpart(name,vertices,faces,tile,bone)

def tube(name,points,radii,tile,bone='face',sides=10):
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

# Six large volumes become ONE watertight shell; no transparent overlap layers.
# Large scallops retain an asymmetric cloud silhouette, unlike the ink teardrop.
LOBES=[((0,-.005,.43),(.34,.262,.31)),((-.275,.018,.50),(.245,.233,.255)),
       ((.278,.025,.545),(.247,.237,.255)),((-.173,.040,.752),(.231,.22,.231)),
       ((.135,.067,.812),(.253,.226,.252)),((.025,.195,.595),(.27,.185,.29))]
for index,(centre,radii) in enumerate(LOBES):ellipsoid('Cloud_form_'+str(index+1),centre,radii,0,segments=32,rings=20)
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=PARTS[0];bpy.ops.object.join();body=bpy.context.object
body.name='Continuous_six_lobe_cloud';PARTS=[body]
body.data.remesh_voxel_size=.018;body.data.use_remesh_preserve_volume=True
bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Soften_foam_necks','SMOOTH');smooth.factor=1.15;smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
pre_tri=sum(len(p.vertices)-2 for p in body.data.polygons)
dec=body.modifiers.new('Cloud_mobile_topology','DECIMATE');dec.ratio=min(1,5000/pre_tri)
bpy.ops.object.modifier_apply(modifier=dec.name)
for poly in body.data.polygons:poly.use_smooth=True
body.data.materials.clear();body.data.materials.append(MAT);assign_uv(body,0)
body['bone']='body';body['atlas_tile']=0
bpy.ops.object.select_all(action='DESELECT')

# Four short plush toes: rounded, no fins, no hard crab joints.
for side,label in [(-1,'L'),(1,'R')]:
    for index,(y,x,rx,ry,rz) in enumerate([(-.16,.247,.092,.136,.067),(.16,.25,.095,.127,.061)]):
        name=f'foot_{label}{index+1}'
        foot=ellipsoid('Short_soft_'+name,(side*x,y,rz),(rx,ry,rz),1,name,segments=24,rings=12)
        # A rounded toe continues up/inward into a short soft ankle. The first
        # render exposed an air gap between a plain ellipsoid and the cloud.
        # Deform this same closed mesh; no extra transparent or floating parts.
        for vertex in foot.data.vertices:
            t=max(0,(vertex.co.z-rz)/rz)
            vertex.co.z+=.23*t;vertex.co.x-=side*.035*t
            vertex.co.y+=(-1 if y>0 else 1)*.07*t
        foot.data.update();assign_uv(foot,1)
        FEET[name]=foot

def front_surface(x,z,offset=.004):
    hit,position,normal,_=body.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
    assert hit,(x,z)
    return position+Vector((0,-offset,0))

for side,label in [(-1,'L'),(1,'R')]:
    centre=front_surface(side*.142,.535,.017)
    eye=ellipsoid('Spherical_painted_eye_'+label,centre,(.111,.052,.132),4,'face',segments=32,rings=16)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co-centre
        a=max(.007,min(.993,.5+.5*p.x/.111));b=max(.007,min(.993,.5+.5*p.z/.132))
        eye.data.uv_layers.active.data[loop.index].uv=(a/4,(1+b)/4)
    # Short raised lids follow the curved shell; alert but not the ink brows.
    points=[tuple(front_surface(side*(.064+.155*i/12),.682+.017*math.sin(math.pi*i/12)-.009*i/12,.016)) for i in range(13)]
    tube('Soft_eyelid_'+label,points,[.004]+[.012]*11+[.004],1)
    cheek=front_surface(side*.272,.389,.002)
    ellipsoid('Soft_cheek_'+label,cheek,(.040,.006,.020),9,'face',segments=16,rings=8)
# Small pursed mouth distinguishes the airy defender from the ink smile.
mouth=front_surface(0,.335,.007)
ellipsoid('Pursed_mouth_shadow',mouth,(.030,.014,.027),5,'face',segments=20,rings=10)
rim=[]
for index in range(25):
    angle=math.tau*index/24
    rim.append(tuple(front_surface(.034*math.cos(angle),.335+.030*math.sin(angle),.018)))
tube('Soft_mouth_rim',rim,.0055,3,sides=8)

arm=bpy.data.armatures.new('MistBubble_skeleton');rig=bpy.data.objects.new('MistBubble_Rig',arm);CHAR.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
SPECS={'root':((0,0,0),(0,0,.12),None),'body':((0,0,.27),(0,0,.54),'root'),
       'face':((0,-.10,.40),(0,-.10,.66),'body'),
       'puff_L':((-.22,.02,.54),(-.22,.02,.75),'body'),
       'puff_R':((.23,.035,.55),(.23,.035,.76),'body'),
       'crown':((0,.045,.71),(0,.045,.95),'body')}
for name in FEET:
    side=-1 if '_L' in name else 1;y=-.12 if name.endswith('1') else .13
    SPECS[name]=((side*.22,y,.075),(side*.22,y,.19),'root')
for name,(head,tail,parent) in SPECS.items():
    bone=arm.edit_bones.new(name);bone.head=head;bone.tail=tail
    if parent:bone.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
for ob in PARTS:
    if ob==body:
        groups={name:ob.vertex_groups.new(name=name) for name in ('body','puff_L','puff_R','crown')}
        for vertex in ob.data.vertices:
            x,y,z=vertex.co
            left=max(0,min(1,(-x-.18)/.25))*max(0,min(1,(z-.29)/.27))*.40
            right=max(0,min(1,(x-.18)/.25))*max(0,min(1,(z-.32)/.28))*.40
            crown=max(0,min(1,(z-.70)/.30))*.50
            weights={'body':1-left-right-crown,'puff_L':left,'puff_R':right,'crown':crown}
            for name,value in weights.items():
                if value>0:groups[name].add([vertex.index],value,'REPLACE')
    else:ob.vertex_groups.new(name=ob['bone']).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('MistBubble_skin','ARMATURE');mod.object=rig;ob.parent=rig
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=30

def translate(name,xyz):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(xyz)
def rotate(name,xyz):rig.pose.bones[name].rotation_euler=(xyz[0],xyz[2],-xyz[1])
def scale(name,xyz):rig.pose.bones[name].scale=(xyz[0],xyz[2],xyz[1])
def pose(frame,phase=0,step=0,bob=0,sway=0,breath=0,lean=0,recoil=0,squash=0,exit_scale=1):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].scale=(exit_scale,)*3
    translate('body',(sway,recoil,bob));rotate('body',(lean,0,-sway*.35))
    scale('body',(1+breath*.075+squash*.12,1+breath*.06,1+breath*.04-squash*.14))
    translate('crown',(0,0,breath*.025));rotate('crown',(0,0,sway*.4))
    for side,label in [(-1,'L'),(1,'R')]:
        translate('puff_'+label,(side*breath*.015,0,math.sin(phase+side*.35)*step*.12))
        scale('puff_'+label,(1+breath*.025,1+breath*.025,1+breath*.025))
    for index,(name,foot) in enumerate(FEET.items()):
        p=phase+math.pi*((index%2+index//2)%2)
        lift=max(0,math.sin(p))*step*.7
        translate(name,(0,math.cos(p)*step,lift));rotate(name,(math.sin(p)*step*.2,0,math.cos(p)*step*.4))
    bpy.context.view_layer.update()
    for index,(name,foot) in enumerate(FEET.items()):
        pb=rig.pose.bones[name];deform=pb.matrix@pb.bone.matrix_local.inverted()
        lowest=min((deform@v.co).z for v in foot.data.vertices)
        target=max(0,math.sin(phase+math.pi*((index%2+index//2)%2)))*step*.7*exit_scale
        basis=pb.parent.matrix@pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
        pb.location+=basis.to_3x3().inverted()@Vector((0,0,target-lowest))
    for pb in rig.pose.bones:
        for prop in ('location','rotation_euler','scale'):pb.keyframe_insert(prop,frame=frame,group=pb.name)

CLIPS={
 'idle':[(1,{}),(19,{'breath':.50,'bob':.006}),(37,{}),(55,{'breath':.28,'bob':.004}),(73,{})],
 'walk':[(1,{'phase':0,'step':.046}),(7,{'phase':math.pi/2,'step':.046,'bob':.014,'sway':-.012,'breath':.13}),
         (13,{'phase':math.pi,'step':.046}),(19,{'phase':math.pi*1.5,'step':.046,'bob':.014,'sway':.012,'breath':.13}),
         (25,{'phase':math.tau,'step':.046})],
 'attack':[(1,{}),(10,{'breath':1,'recoil':.035,'bob':.014,'lean':-.035}),
           (17,{'breath':-.25,'recoil':-.085,'lean':.11,'squash':.17,'bob':.015}),
           (24,{'breath':.16,'recoil':-.03,'lean':.02}),(37,{})],
 'hit':[(1,{}),(4,{'squash':.63,'recoil':.037,'lean':-.055,'sway':.022}),
        (10,{'squash':-.12,'breath':.16,'bob':.009}),(19,{})],
 'exit':[(1,{}),(8,{'breath':.65,'bob':.030}),(16,{'squash':.9,'exit_scale':.75}),
         (24,{'squash':.2,'exit_scale':.27}),(31,{'exit_scale':.025})],
}
rig.animation_data_create()
for name,keys in CLIPS.items():
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame,kwargs in keys:pose(frame,**kwargs)
    action.use_fake_user=True
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,action)
rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=bpy.data.actions['idle'].slots[0];scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mist-bubble.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.join();merged=bpy.context.object;merged.name='MistBubble_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(p.vertices)-2 for p in merged.data.polygons);assert triangles<=12000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'mist-bubble.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'mist-bubble.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dimensions=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats={'version':'mist-bubble-candidate-01','enemy_kind':'mist','display_name':'雾泡怪',
 'vertices':len(merged.data.vertices),'triangles':triangles,'mesh_count':1,'material_count':1,'material_name':MAT.name,
 'bones':list(SPECS),'bone_count':len(arm.bones),'walking_feet':4,'connected_cloud_shells':1,'large_cloud_lobes':6,
 'source_lobe_specs':LOBES,'opaque':True,'texture_size':[512,512],
 'roughness':'RGB grayscale .34/.44, alpha 1; Non-Color; metallic 0; F0 .04',
 'clips':{k:{'name':'MistBubble_Rig|'+k,'first':1,'last':v[-1][0],'seconds':(v[-1][0]-1)/30} for k,v in CLIPS.items()},
 'loops':['idle','walk'],'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dimensions,
 'recommended_scale':.83,'dimensions_at_recommended_scale':[value*.83 for value in dimensions],
 'forward':'Blender -Y; FBX axis_forward=-Z/axis_up=Y; expected Cocos +Z, actual Cocos import pending',
 'origin':'Blender Z=0 / Cocos Y=0 foot origin; in-place actions; runtime controls translation',
 'fbx_sha256':hashlib.sha256((OUT/'mist-bubble.fbx').read_bytes()).hexdigest(),
 'source':'Original scripted connected cloud geometry, UV palette/eyes, skin and motion; only internal A4, island and ink used as style references. No external asset or transparent particle layers.',
 'status':'Isolated first review candidate; not promoted and not final art acceptance'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=920;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
fm=bpy.data.materials.new('REVIEW_ONLY_warm_sand');fm.use_nodes=True
fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object
floor.name='REVIEW_ONLY_floor';floor.data.materials.append(fm)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    ld=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    ob=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,.5))-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Mist_review_camera');cam=bpy.data.objects.new(cd.name,cd);scene.collection.objects.link(cam)
scene.camera=cam;cd.type='ORTHO'
def aim(loc,target,scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale
aim((2.5,-4.8,2.35),(0,0,.53),1.65)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mist-bubble-review-scene.blend'))
if '--no-render' not in sys.argv:
    for name,loc,target,view_scale in [('front',(0,-5,1.4),(0,0,.52),1.53),('three-quarter',(2.5,-4.8,2.35),(0,0,.53),1.65)]:
        aim(loc,target,view_scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('MIST_BUBBLE_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)
