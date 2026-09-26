"""Validate actual FBX and editable source, render real geometry in isolation.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
Append -- --no-render for technical checks only. No runtime resources are edited.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
from mathutils import Vector

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
STATS=json.loads((HERE/'model-stats.json').read_text(encoding='utf-8'))
bpy.context.preferences.filepaths.save_version=0
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,data):(HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def require(condition,message):
    if not condition:raise RuntimeError(message)
def action(rig,name):
    candidates=[a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]==name]
    chosen=next((a for a in candidates if any('MistBubble' in s.identifier for s in a.slots)),candidates[0])
    data=rig.animation_data_create();data.use_nla=False;data.action=None
    for pb in rig.pose.bones:pb.matrix_basis.identity()
    data.action=chosen
    if len(chosen.slots):data.action_slot=chosen.slots[0]
    return chosen
def sample(mesh,frame):
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame));bpy.context.view_layer.update()
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
    try:vertices=[evaluated.matrix_world@v.co for v in data.vertices]
    finally:evaluated.to_mesh_clear()
    require(all(math.isfinite(x) for v in vertices for x in v),'Non-finite animated vertex')
    return vertices
def distance(a,b):return max((x-y).length for x,y in zip(a,b))

def verify_fbx():
    path=HERE/'export/mist-bubble.fbx';require(sha(path)==STATS['fbx_sha256'],'FBX differs from recorded build')
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(rigs)==len(meshes)==1,'Expected one rig and one mesh');rig,mesh=rigs[0],meshes[0]
    require(set(b.name for b in rig.data.bones)==set(STATS['bones']),'Bone contract changed')
    require(len(mesh.data.materials)==1 and len(mesh.data.uv_layers)==1,'Expected one material/UV')
    triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    require(triangles==STATS['triangles'] and triangles<=12000,'Triangle budget/count mismatch')
    groups={group.index:group.name for group in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        weights=[g.weight for g in vertex.groups if groups[g.group] in STATS['bones']]
        require(weights and abs(sum(weights)-1)<.0001,'Invalid skin weight')
    report={'status':'pass','fbx_sha256':sha(path),'triangles':triangles,'vertices':len(mesh.data.vertices),
            'materials':[m.name for m in mesh.data.materials],'bones':[b.name for b in rig.data.bones],'clips':{},
            'method':'Imported FBX, selected actual Blender action slots, evaluated every half frame; not a Cocos acceptance test.'}
    for name,expected in STATS['clips'].items():
        clip=action(rig,name);first,last=map(float,clip.frame_range)
        require(abs(first-expected['first'])<.001 and abs(last-expected['last'])<.001,'Clip range mismatch')
        start=sample(mesh,first);motion=0;lowest=10;highest=-10
        for index in range(int((last-first)*2)+1):
            vertices=sample(mesh,first+index*.5)
            motion=max(motion,distance(start,vertices));lowest=min(lowest,min(v.z for v in vertices));highest=max(highest,max(v.z for v in vertices))
        finish=sample(mesh,last);seam=distance(start,finish)
        require(motion>.001,'Static action '+name);require(lowest>-.002,'Ground penetration '+name+' '+str(lowest))
        if name in ('idle','walk','attack','hit'):require(seam<.0001,'Unreturned pose '+name)
        if name=='exit':require(max(v.z for v in finish)<.08,'Exit did not shrink away')
        report['clips'][name]={'imported_action_name':clip.name,'first':first,'last':last,'seconds':(last-first)/30,
            'samples':int((last-first)*2)+1,'maximum_vertex_motion_m':motion,'minimum_z_m':lowest,
            'maximum_z_m':highest,'first_last_seam_m':seam,'loop':name in STATS['loops']}
    action(rig,'idle');vertices=sample(mesh,1)
    report['bounds_world_xyz']={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
    for i in range(3):
        for side in ('min','max'):require(abs(report['bounds_world_xyz'][side][i]-STATS['bounds_blender_xyz'][side][i])<.0001,'Round-trip bounds differ')
    require(abs(report['bounds_world_xyz']['min'][2])<.0001,'Foot origin not zero')
    write('round-trip-check.json',report);print('MIST_FBX_VERIFICATION_PASS '+json.dumps(report['clips']),flush=True)

def verify_source():
    report={'status':'pass','files':{}}
    for name in ('mist-bubble.blend','mist-bubble-review-scene.blend'):
        path=HERE/name;before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['MistBubble_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('MistBubble_Colour_','MistBubble_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Missing packed atlas')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        mat=bpy.data.materials['MistBubble_Toy_Atlas'];p=mat.node_tree.nodes.get('Principled BSDF')
        require(p.inputs['Alpha'].default_value==1 and p.inputs['Transmission Weight'].default_value==0,'Expected opaque non-transmitting surface')
        if name=='mist-bubble.blend':
            require(len([o for o in meshes if o.name.startswith('Short_soft_foot_')])==4,'Expected four short feet')
            body=bpy.data.objects['Continuous_six_lobe_cloud'];entry['editable_parts']=len(meshes)
            for ob in meshes:
                bm=bmesh.new();bm.from_mesh(ob.data)
                try:
                    require(all(e.is_manifold for e in bm.edges),'Non-manifold '+ob.name)
                    require(bm.calc_volume(signed=True)>0,'Inward/zero-volume '+ob.name)
                    if ob==body:
                        remaining=set(bm.verts);components=0
                        while remaining:
                            components+=1;todo=[remaining.pop()]
                            while todo:
                                vertex=todo.pop()
                                for edge in vertex.link_edges:
                                    other=edge.other_vert(vertex)
                                    if other in remaining:remaining.remove(other);todo.append(other)
                        require(components==1,'Cloud body is overlapping separate spheres')
                        entry['cloud_connected_components']=components
                finally:bm.free()
            eyes=[o for o in meshes if o.name.startswith('Spherical_painted_eye_')]
            require(len(eyes)==2 and all(len(o.data.vertices)>450 for o in eyes),'Missing curved closed eyes')
            entry['eye_vertices']={o.name:len(o.data.vertices) for o in eyes}
        require(sha(path)==before,'Source changed during validation');report['files'][name]=entry
    write('source-check.json',report);print('MIST_SOURCE_VERIFICATION_PASS',flush=True)

def aim(camera,location,target,scale=None):
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    if scale is not None:camera.data.type='ORTHO';camera.data.ortho_scale=scale
def setup(scene,x=920,y=900,samples=24):
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=samples
    scene.render.resolution_x=x;scene.render.resolution_y=y;scene.render.resolution_percentage=100
def studio():
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'mist-bubble-review-scene.blend'),load_ui=False,use_scripts=False)
    return bpy.context.scene,bpy.data.objects['MistBubble_Rig'],bpy.data.objects['MistBubble_SkinnedMesh']
def freeze(mesh,name,location,scale=1,heading=0):
    data=bpy.data.meshes.new_from_object(mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    ob=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(ob)
    ob.location=location;ob.scale=(scale,)*3;ob.rotation_euler.z=heading;return ob
def append_actor(path,prefix):
    with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.objects=[n for n in src.objects if n in (prefix+'_Rig',prefix+'_SkinnedMesh')]
    for ob in dst.objects:bpy.context.scene.collection.objects.link(ob)
    return next(o for o in dst.objects if o.type=='ARMATURE'),next(o for o in dst.objects if o.type=='MESH')

def render_static():
    scene,rig,mesh=studio();setup(scene);action(rig,'idle');scene.frame_set(1)
    for name,location,target,view_scale in [
        ('front',(0,-5,1.4),(0,0,.52),1.53),
        ('three-quarter',(2.5,-4.8,2.35),(0,0,.53),1.65),
        ('battle-angle',(0,-4.9,4.53),(0,0,.5),1.65)]:
        aim(scene.camera,location,target,view_scale);scene.render.filepath=str(HERE/('render-'+name+'.png'))
        bpy.ops.render.render(write_still=True)

def render_context():
    environment=ROOT/'game/art-source/environment/tidal-island-review-scene.blend';before=sha(environment)
    bpy.ops.wm.open_mainfile(filepath=str(environment),load_ui=False,use_scripts=False)
    scene=bpy.context.scene;setup(scene,1280,720,20)
    ar,am=append_actor(HERE/'mist-bubble-review-scene.blend','MistBubble');action(ar,'idle');scene.frame_set(1);bpy.context.view_layer.update()
    freeze(am,'Mist_real_battle_scale',(-4.8,0,.064),.83,math.pi/2);ar.hide_render=True;am.hide_render=True
    camera=scene.camera;camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL';camera.data.sensor_height=24
    camera.data.lens=12/math.tan(math.radians(42)/2);aim(camera,(0,-18,15),(0,0,.2))
    scene.render.filepath=str(HERE/'render-island-context.png')
    for im in bpy.data.images:
        if im.source=='FILE' and not im.packed_file:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'mist-bubble-island-context.blend'));bpy.ops.render.render(write_still=True)
    require(sha(environment)==before,'Environment source changed')
    write('battle-camera-manifest.json',{'status':'Offline Blender actual geometry; not a Cocos screenshot',
        'cocos_camera':[0,15,18],'cocos_target':[0,.2,0],'blender_camera':[0,-18,15],'blender_target':[0,0,.2],
        'vertical_fov_degrees':42,'aspect':'16:9','mist_scale':.83,'closeup_battle_angle':'matching pitch, orthographic studio framing to inspect face',
        'source_hashes_unchanged':{str(environment):before}})

def render_poses():
    scene,rig,mesh=studio();setup(scene,1600,560,20);aim(scene.camera,(0,-10,4.3),(0,0,.50),6.3)
    mat=bpy.data.materials.new('REVIEW_ONLY_labels');mat.diffuse_color=(.06,.045,.085,1)
    for index,(name,frame) in enumerate([('idle',19),('walk',7),('attack',17),('hit',4),('exit',24)]):
        action(rig,name);scene.frame_set(frame);bpy.context.view_layer.update()
        freeze(mesh,'Real_pose_'+name,((index-2)*1.22,0,0))
        curve=bpy.data.curves.new('Review_label','FONT');curve.body=name.upper()+' / '+str(frame);curve.align_x='CENTER';curve.size=.105
        ob=bpy.data.objects.new('REVIEW_ONLY_'+name,curve);scene.collection.objects.link(ob)
        ob.location=((index-2)*1.22,0,1.22);ob.rotation_euler=scene.camera.rotation_euler;curve.materials.append(mat)
    rig.hide_render=True;mesh.hide_render=True;scene.render.filepath=str(HERE/'render-five-poses.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'mist-bubble-poses.blend'));bpy.ops.render.render(write_still=True)

verify_fbx();verify_source()
if '--no-render' not in sys.argv:render_static();render_context();render_poses()
print('MIST_REVIEW_COMPLETE',flush=True)
