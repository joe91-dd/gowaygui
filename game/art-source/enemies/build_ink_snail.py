"""Original ink-snail c01: soft mollusc, thick spiral shell, short ink spout.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
Writes only ink-snail/candidate-01; no runtime/meta/Cocos or other model changes.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3];SOURCE=ROOT/'game/art-source/enemies/ink-snail/candidate-01'
OUT=SOURCE/'export';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
CHAR=bpy.data.collections.new('INK_SNAIL_EDITABLE_PARTS');bpy.context.scene.collection.children.link(CHAR)
PARTS=[];SOLE=[]
SIZE=512;TILE=128
PALETTE=[(.19,.36,.34),(.56,.35,.17),(.86,.69,.43),(.68,.47,.25),
         (.95,.89,.74),(.032,.052,.061),(.24,.43,.40),(.73,.61,.39),
         (.13,.25,.255),(.48,.58,.46),(.75,.56,.31),(.42,.29,.16),
         (.31,.48,.42),(.16,.29,.28),(.91,.76,.51),(.80,.67,.44)]
pixels=np.ones((SIZE,SIZE,4),dtype=np.float32);rp=np.ones_like(pixels)
yy,xx=np.mgrid[0:TILE,0:TILE].astype(np.float32);u=(xx+.5)/TILE;v=(yy+.5)/TILE
for index,col in enumerate(PALETTE):
    row,column=index//4,index%4
    shade=.955+.075*np.sin(v*math.pi)+.025*np.cos((u-.5)*math.pi)
    pixels[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=np.array(col)*shade[:,:,None]
    rp[row*TILE:(row+1)*TILE,column*TILE:(column+1)*TILE,:3]=.38 if index in (1,2,3,7,10,14,15) else .43
rp[TILE:2*TILE,:TILE,:3]=.31
ex=u*2-1;ez=v*2-1
eye=np.ones((TILE,TILE,3),dtype=np.float32);eye[:]=(.95,.89,.74)
for rx,rz,col in [(.76,.79,(.26,.27,.13)),(.62,.68,(.019,.032,.031))]:
    d=np.sqrt(((ex-.025)/rx)**2+((ez+.02)/rz)**2);a=np.clip((1-d)/.04+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array(col)*a[:,:,None]
for cx,cz,rx,rz in [(-.20,.27,.15,.175),(.27,-.29,.045,.055)]:
    d=np.sqrt(((ex-cx)/rx)**2+((ez-cz)/rz)**2);a=np.clip((1-d)/.07+.5,0,1)
    eye=eye*(1-a[:,:,None])+np.array((1,.99,.91))*a[:,:,None]
pixels[TILE:2*TILE,:TILE,:3]=eye
atlas=bpy.data.images.new('InkSnail_Colour_512',width=SIZE,height=SIZE,alpha=True)
atlas.pixels.foreach_set(pixels.ravel());atlas.filepath_raw=str(OUT/'snail-colour.png');atlas.file_format='PNG';atlas.save();atlas.pack()
rough=bpy.data.images.new('InkSnail_Roughness_512',width=SIZE,height=SIZE,alpha=True)
rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(rp.ravel());rough.filepath_raw=str(OUT/'snail-roughness.png')
rough.file_format='PNG';rough.save();rough.pack()
MAT=bpy.data.materials.new('InkSnail_Toy_Atlas');MAT.use_nodes=True
p=MAT.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=0
p.inputs['Specular IOR Level'].default_value=.5;p.inputs['Alpha'].default_value=1;p.inputs['Transmission Weight'].default_value=0
for image,input_name in [(atlas,'Base Color'),(rough,'Roughness')]:
    node=MAT.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;MAT.node_tree.links.new(node.outputs['Color'],p.inputs[input_name])

def uv(ob,tile,axes=(0,2)):
    me=ob.data
    for old in list(me.uv_layers):me.uv_layers.remove(old)
    layer=me.uv_layers.new(name='ToyAtlasUV')
    mins=[min(v.co[i] for v in me.vertices) for i in axes];spans=[max(v.co[i] for v in me.vertices)-mins[j] for j,i in enumerate(axes)]
    for loop in me.loops:
        vertex=me.vertices[loop.vertex_index].co;a=(vertex[axes[0]]-mins[0])/max(spans[0],1e-8);b=(vertex[axes[1]]-mins[1])/max(spans[1],1e-8)
        layer.data[loop.index].uv=((tile%4+.025+.95*a)/4,(tile//4+.025+.95*b)/4)
def meshpart(name,vertices,faces,tile,bone='body'):
    me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(vertices,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(me);bm.free();me.update()
    ob=bpy.data.objects.new(name,me);CHAR.objects.link(ob);me.materials.append(MAT)
    ob['bone']=bone;ob['atlas_tile']=tile
    for poly in me.polygons:poly.use_smooth=True
    uv(ob,tile);PARTS.append(ob);return ob
def ellipsoid(name,center,radii,tile,bone='body',segments=24,rings=12):
    c=Vector(center);vertices=[tuple(c+Vector((0,0,radii[2])))];faces=[]
    for k in range(1,rings):
        a=math.pi*k/rings
        for j in range(segments):
            b=math.tau*j/segments;vertices.append(tuple(c+Vector((radii[0]*math.sin(a)*math.cos(b),radii[1]*math.sin(a)*math.sin(b),radii[2]*math.cos(a)))))
    vertices.append(tuple(c-Vector((0,0,radii[2]))));bottom=len(vertices)-1
    for j in range(segments):faces.append((0,1+j,1+(j+1)%segments))
    for k in range(rings-2):
        for j in range(segments):faces.append((1+k*segments+j,1+(k+1)*segments+j,1+(k+1)*segments+(j+1)%segments,1+k*segments+(j+1)%segments))
    for j in range(segments):faces.append((bottom,1+(rings-2)*segments+(j+1)%segments,1+(rings-2)*segments+j))
    return meshpart(name,vertices,faces,tile,bone)
def loft(name,rings,tile,bone='body',segments=40):
    vertices=[];faces=[]
    for z,rx,ry,cy in rings:
        for j in range(segments):
            angle=math.tau*j/segments;vertices.append((rx*math.cos(angle),cy+ry*math.sin(angle),z))
    for k in range(len(rings)-1):
        for j in range(segments):faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
    return meshpart(name,vertices,faces,tile,bone)
def tube(name,points,radii,tile,bone='shell',sides=8):
    points=[Vector(p) for p in points];vertices=[];faces=[]
    if isinstance(radii,(float,int)):radii=[radii]*len(points)
    for i,point in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized();a=tangent.cross(Vector((0,1,0)))
        if a.length<.1:a=tangent.cross(Vector((1,0,0)))
        a.normalize();b=tangent.cross(a).normalized()
        for j in range(sides):vertices.append(tuple(point+radii[i]*(a*math.cos(math.tau*j/sides)+b*math.sin(math.tau*j/sides))))
    for k in range(len(points)-1):
        for j in range(sides):faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
    return meshpart(name,vertices,faces,tile,bone)

# Broad soft foot and a short rounded tail; no hard legs or wheeled undercarriage.
foot=loft('Continuous_gliding_soft_foot',[
    (0,.175,.39,.025),(.020,.235,.48,.025),(.050,.270,.565,.030),(.095,.273,.568,.030),
    (.14,.245,.51,.016),(.182,.205,.405,-.06),(.208,.154,.27,-.13),(.22,.04,.07,-.18)],0,'sole')
SOLE.append(foot)
points=[]
for index in range(49):
    a=math.tau*index/48;points.append((.265*math.cos(a),.029+.555*math.sin(a),.045))
sole_rim=tube('Soft_cream_sole_edge',points,.011,7,'sole',sides=8);SOLE.append(sole_rim)
head=ellipsoid('Round_snail_head',(0,-.303,.275),(.224,.226,.210),6,'head',segments=28,rings=16)
# A substantial sealed shell: 0.51 wide, 0.69 deep, 0.76 tall, above the foot.
shell=ellipsoid('Thick_ochre_shell',(0,.115,.540),(.255,.345,.380),3,'shell',segments=40,rings=24)
# Raised broad spiral ridges follow both curved shell sides. These are actual
# shaded geometry, not a spiral decal on a thin disc or a borrowed texture.
for side,label in [(-1,'L'),(1,'R')]:
    spiral=[];widths=[]
    for index in range(113):
        t=11.20*index/112;q=.047+.075*t;angle=t+2.04
        y=.115+.345*q*math.cos(angle);z=.540+.380*q*math.sin(angle)
        x=side*(.255*math.sqrt(max(0,1-q*q))+.007)
        spiral.append((x,y,z));widths.append(.007+.013*math.sin(math.pi*(index/112)*.85)**.65)
    tube('Raised_spiral_'+label,spiral,widths,2,sides=8)
    edge=[]
    for index in range(49):
        a=math.tau*index/48;q=.946
        edge.append((side*(.255*math.sqrt(1-q*q)+.005),.115+.345*q*math.cos(a),.540+.380*q*math.sin(a)))
    tube('Thick_rolled_shell_lip_'+label,edge,.015,1,sides=8)

# Low, soft eye stems remain protected in the head silhouette.
for side,label in [(-1,'L'),(1,'R')]:
    bone='eye_'+label
    ellipsoid('Short_eye_stem_'+label,(side*.128,-.409,.432),(.060,.075,.114),0,bone,segments=20,rings=10)
    center=Vector((side*.132,-.465,.504))
    eye=ellipsoid('Spherical_painted_eye_'+label,center,(.089,.046,.101),4,bone,segments=28,rings=16)
    for loop in eye.data.loops:
        p=eye.data.vertices[loop.vertex_index].co-center
        a=max(.007,min(.993,.5+.5*p.x/.089));b=max(.007,min(.993,.5+.5*p.z/.101))
        eye.data.uv_layers.active.data[loop.index].uv=(a/4,(1+b)/4)
    brow=[(side*(.066+.135*i/10),-.47-.012*math.sin(math.pi*i/10),.590+.013*math.sin(math.pi*i/10)-.012*i/10) for i in range(11)]
    tube('Soft_watchful_lid_'+label,brow,[.003]+[.011]*9+[.003],0,bone,sides=8)

# Actual short recessed ink spout. Its dark cavity is inside the closed mesh;
# it is not a protruding gun barrel and does not contain a separate projectile.
rings=[(-.450,.278,.062,.052),(-.491,.282,.072,.060),(-.532,.292,.070,.057),
       (-.553,.298,.062,.052),(-.558,.298,.043,.036),(-.523,.292,.038,.032),(-.506,.287,.003,.003)]
vertices=[];faces=[];segments=28
for y,z,rx,rz in rings:
    for index in range(segments):
        a=math.tau*index/segments;vertices.append((rx*math.cos(a),y,z+rz*math.sin(a)))
for k in range(len(rings)-1):
    for j in range(segments):faces.append((k*segments+j,k*segments+(j+1)%segments,(k+1)*segments+(j+1)%segments,(k+1)*segments+j))
faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+j for j in range(segments))])
spout=meshpart('Short_recessed_ink_spout',vertices,faces,8,'spout')
for poly in spout.data.polygons:
    if poly.index>=4*segments:
        for li in poly.loop_indices:spout.data.uv_layers.active.data[li].uv=((1+.5)/4,(1+.5)/4)
    elif poly.index>=2*segments:
        for li in poly.loop_indices:spout.data.uv_layers.active.data[li].uv=((1+.5)/4,(2+.5)/4)

arm=bpy.data.armatures.new('InkSnail_skeleton');rig=bpy.data.objects.new('InkSnail_Rig',arm);CHAR.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
SPECS={'root':((0,0,0),(0,0,.11),None),'body':((0,-.04,.15),(0,-.04,.35),'root'),
       'sole_front':((0,-.27,.04),(0,-.27,.15),'root'),'sole_rear':((0,.30,.04),(0,.30,.15),'root'),
       'head':((0,-.25,.24),(0,-.25,.45),'body'),'shell':((0,.115,.25),(0,.115,.56),'body'),
       'eye_L':((-.128,-.40,.37),(-.128,-.40,.54),'head'),'eye_R':((.128,-.40,.37),(.128,-.40,.54),'head'),
       'spout':((0,-.454,.28),(0,-.454,.39),'head')}
for name,(headp,tail,parent) in SPECS.items():
    bone=arm.edit_bones.new(name);bone.head=headp;bone.tail=tail
    if parent:bone.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
for ob in PARTS:
    if ob in SOLE:
        front=ob.vertex_groups.new(name='sole_front');rear=ob.vertex_groups.new(name='sole_rear')
        for vertex in ob.data.vertices:
            w=max(0,min(1,(.40-vertex.co.y)/.78))
            if w>0:front.add([vertex.index],w,'REPLACE')
            if w<1:rear.add([vertex.index],1-w,'REPLACE')
    else:ob.vertex_groups.new(name=ob['bone']).add(list(range(len(ob.data.vertices))),1,'REPLACE')
    mod=ob.modifiers.new('InkSnail_skin','ARMATURE');mod.object=rig;ob.parent=rig
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=30
def translate(name,xyz):
    pb=rig.pose.bones[name];pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector(xyz)
def rotate(name,xyz):rig.pose.bones[name].rotation_euler=(xyz[0],xyz[2],-xyz[1])
def scale(name,xyz):rig.pose.bones[name].scale=(xyz[0],xyz[2],xyz[1])
def pose(frame,phase=0,glide=0,bob=0,head=0,recoil=0,spit=0,eye=0,shrink=1,squash=0):
    for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
    rig.pose.bones['root'].scale=(shrink,)*3
    translate('sole_front',(0,math.sin(phase)*glide*.35,max(0,math.sin(phase))*glide*.40))
    translate('sole_rear',(0,-math.sin(phase)*glide*.35,max(0,-math.sin(phase))*glide*.40))
    translate('body',(0,recoil,bob));rotate('shell',(-recoil*.40,0,0))
    rotate('head',(head,0,0));translate('head',(0,-spit*.018,0));scale('head',(1+squash*.06,1,1-squash*.08))
    translate('spout',(0,-spit*.043,0));scale('spout',(1+spit*.1,1+spit*.15,1+spit*.12))
    for side,label in [(-1,'L'),(1,'R')]:rotate('eye_'+label,(eye*.1,side*eye*.12,0))
    for pb in rig.pose.bones:
        for prop in ('location','rotation_euler','scale'):pb.keyframe_insert(prop,frame=frame,group=pb.name)
CLIPS={
 'idle':[(1,{}),(22,{'bob':.004,'eye':.10}),(43,{}),(64,{'bob':.003,'eye':-.07}),(85,{})],
 'walk':[(1,{'phase':0,'glide':.018}),(10,{'phase':math.pi/2,'glide':.018,'bob':.004,'head':.012}),
         (19,{'phase':math.pi,'glide':.018}),(28,{'phase':math.pi*1.5,'glide':.018,'bob':.004,'head':-.008}),
         (37,{'phase':math.tau,'glide':.018})],
 'attack':[(1,{}),(10,{'head':-.060,'recoil':.013,'squash':.3,'eye':.2}),
           (16,{'head':.075,'recoil':.030,'spit':1,'eye':-.12}),(23,{'head':.025,'spit':.25}),
           (37,{})],
 'hit':[(1,{}),(4,{'head':-.09,'recoil':.032,'squash':.55,'eye':.3}),
        (10,{'head':.016,'recoil':-.007,'eye':-.08}),(19,{})],
 'exit':[(1,{}),(8,{'head':-.1,'recoil':.025,'squash':.5,'eye':.5}),
         (17,{'shrink':.75,'squash':.8}),(25,{'shrink':.30,'head':-.12}),(34,{'shrink':.025})],
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
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-snail.blend'))
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS:ob.select_set(True)
bpy.context.view_layer.objects.active=foot;bpy.ops.object.join();merged=bpy.context.object;merged.name='InkSnail_SkinnedMesh'
merged.data.materials.clear();merged.data.materials.append(MAT)
for poly in merged.data.polygons:poly.material_index=0
triangles=sum(len(poly.vertices)-2 for poly in merged.data.polygons);assert triangles<=14000,triangles
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'ink-snail.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},
    add_leaf_bones=False,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,
    bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_force_startend_keying=True,
    bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE/'ink-snail.glb'),use_selection=True,export_format='GLB',
    export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=True,export_yup=True)
bounds={'min':[min(v.co[i] for v in merged.data.vertices) for i in range(3)],'max':[max(v.co[i] for v in merged.data.vertices) for i in range(3)]}
dims=[bounds['max'][i]-bounds['min'][i] for i in range(3)]
stats={'version':'ink-snail-candidate-01','enemy_kind':'snail','display_name':'吐墨螺','vertices':len(merged.data.vertices),
 'triangles':triangles,'mesh_count':1,'material_count':1,'material_name':MAT.name,'bones':list(SPECS),'bone_count':len(arm.bones),
 'texture_size':[512,512],'opaque':True,'roughness':'RGB gray .31 / .38 / .43; alpha 1; Non-Color; F0 .04, nonmetal',
 'clips':{k:{'name':'InkSnail_Rig|'+k,'first':1,'last':v[-1][0],'seconds':(v[-1][0]-1)/30} for k,v in CLIPS.items()},
 'loops':['idle','walk'],'bounds_blender_xyz':bounds,'dimensions_blender_xyz':dims,
 'recommended_scale':.93,'dimensions_at_recommended_scale':[v*.93 for v in dims],
 'forward':'Blender -Y; FBX -Z forward/Y up; expected Cocos +Z, actual import pending',
 'origin':'Blender Z=0 / expected Cocos Y=0 foot plane; all actions in place',
 'shell_dimensions_xyz':[.51,.69,.76],'shell_spiral':'Two genuine surface-following raised spirals, 1.78 turns each; broad sealed shell, not a decal or thin disc',
 'projectile_anchor_blender':[0,-.56,.29],'projectile_note':'Visual handoff only: actual ranged attack and projectile events stay in core/view; no new mechanic.',
 'fbx_sha256':hashlib.sha256((OUT/'ink-snail.fbx').read_bytes()).hexdigest(),
 'source':'Original scripted soft body, sealed shell, geometric spirals, recessed spout, UV eye art, skin and actions. Internal A direction and approved enemy materials only. No external assets.',
 'status':'Isolated source review candidate, not runtime-promoted or final art acceptance'}
(SOURCE/'model-stats.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')

scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.04
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=980;scene.render.resolution_y=820;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.50,.60,.72,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.38
fm=bpy.data.materials.new('REVIEW_ONLY_sand');fm.use_nodes=True;fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.56,.49,.36,1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.78
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;floor.name='REVIEW_ONLY_floor';floor.data.materials.append(fm)
for name,loc,power,size,col in [('Key',(-3,-4,5),480,3.2,(1,.92,.81)),('Fill',(4,-1,3),350,3,(.78,.90,1)),('Rim',(0,3,4),620,2.8,(.89,.96,1))]:
    ld=bpy.data.lights.new('REVIEW_ONLY_'+name,'AREA');ld.energy=power;ld.shape='DISK';ld.size=size;ld.color=col
    ob=bpy.data.objects.new(ld.name,ld);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,.45))-ob.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Ink_snail_review_camera');cam=bpy.data.objects.new(cd.name,cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
def aim(loc,target,view_scale):
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=view_scale
aim((3.8,-4.7,2.30),(0,-.015,.42),1.7)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'ink-snail-review-scene.blend'))
if '--no-render' not in sys.argv:
    for name,loc,target,view_scale in [('front',(0,-5,1.45),(0,-.015,.42),1.50),('three-quarter',(3.8,-4.7,2.3),(0,-.015,.42),1.7),('side',(5,-.03,1.2),(0,.015,.44),1.63)]:
        aim(loc,target,view_scale);scene.render.filepath=str(SOURCE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('INK_SNAIL_BUILD_COMPLETE '+json.dumps(stats,ensure_ascii=False),flush=True)
