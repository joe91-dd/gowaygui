"""Read-only FBX/source validation, then isolated real-mesh review renders.

Blender --background --factory-startup -t 2 --python-exit-code 1 --python PATH
Append -- --no-render to run checks alone. No runtime resources are modified.
"""
from pathlib import Path
import bpy,bmesh,math,json,hashlib,sys
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
STATS=json.loads((HERE/'model-stats.json').read_text(encoding='utf-8'))


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,data):
    (HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def require(condition,message):
    if not condition:raise RuntimeError(message)
def action(rig,name):
    chosen=next(a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]==name)
    data=rig.animation_data_create();data.use_nla=False;data.action=None
    for pb in rig.pose.bones:pb.matrix_basis.identity()
    data.action=chosen
    if len(chosen.slots):data.action_slot=chosen.slots[0]
    return chosen
def sample(mesh,frame):
    bpy.context.scene.frame_set(math.floor(frame),subframe=frame-math.floor(frame))
    bpy.context.view_layer.update()
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
    try:vertices=[evaluated.matrix_world@v.co for v in data.vertices]
    finally:evaluated.to_mesh_clear()
    require(all(math.isfinite(x) for v in vertices for x in v),'Non-finite animated vertex')
    return vertices
def distance(a,b):return max((x-y).length for x,y in zip(a,b))


def verify_fbx():
    path=HERE/'export/runner-crab.fbx'
    require(sha(path)==STATS['fbx_sha256'],'FBX changed after build')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(rigs)==len(meshes)==1,'Expected one rig and one runtime mesh')
    rig,mesh=rigs[0],meshes[0]
    require(set(b.name for b in rig.data.bones)==set(STATS['bones']),'Bone contract changed')
    require(len(mesh.data.materials)==1 and len(mesh.data.uv_layers)==1,'Expected one UV and material')
    triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    require(triangles==STATS['triangles'] and triangles<=12000,'Triangle count mismatch/budget overflow')
    groups={group.index:group.name for group in mesh.vertex_groups}
    for vertex in mesh.data.vertices:
        weights=[g.weight for g in vertex.groups if groups[g.group] in STATS['bones']]
        require(weights and abs(sum(weights)-1)<.0001,'Unweighted/non-normalized vertex')
    report={'status':'pass','fbx_sha256':sha(path),'triangles':triangles,
            'vertices':len(mesh.data.vertices),'materials':[m.name for m in mesh.data.materials],
            'bones':[b.name for b in rig.data.bones],'clips':{},'warnings':[],
            'method':'Imported FBX, explicitly selected Blender 4.5 action slots, evaluated every half frame. Technical evidence does not imply art acceptance.'}
    for name,expected in STATS['clips'].items():
        clip=action(rig,name);first,last=map(float,clip.frame_range)
        require(abs(first-expected['first'])<.001 and abs(last-expected['last'])<.001,'Clip range mismatch')
        start=sample(mesh,first);motion=0;lowest=10;highest=-10
        for index in range(int((last-first)*2)+1):
            vertices=sample(mesh,first+index*.5)
            motion=max(motion,distance(start,vertices));lowest=min(lowest,min(v.z for v in vertices));highest=max(highest,max(v.z for v in vertices))
        finish=sample(mesh,last);seam=distance(start,finish)
        require(motion>.001,f'Static clip: {name}')
        require(lowest>-.002,f'Ground penetration > 2 mm: {name} / {lowest}')
        if name in ('idle','walk','attack','hit'):require(seam<.0001,f'Pose reset mismatch: {name}')
        if name=='exit':require(max(v.z for v in finish)<.08,'Exit does not shrink out')
        report['clips'][name]={'imported_action_name':clip.name,'first':first,'last':last,'seconds':(last-first)/30,
            'samples':int((last-first)*2)+1,'maximum_vertex_motion_m':motion,'minimum_z_m':lowest,
            'maximum_z_m':highest,'first_last_seam_m':seam,'loop':name in STATS['loops']}
    action(rig,'idle');vertices=sample(mesh,1)
    report['bounds_world_xyz']={'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
    for i in range(3):
        require(abs(report['bounds_world_xyz']['min'][i]-STATS['bounds_blender_xyz']['min'][i])<.0001,'FBX min bound changed')
        require(abs(report['bounds_world_xyz']['max'][i]-STATS['bounds_blender_xyz']['max'][i])<.0001,'FBX max bound changed')
    require(abs(report['bounds_world_xyz']['min'][2])<.0001,'Rest foot origin not zero')
    write('round-trip-check.json',report)
    print('RUNNER_FBX_VERIFICATION_PASS '+json.dumps({name:value['maximum_vertex_motion_m'] for name,value in report['clips'].items()}),flush=True)


def verify_source():
    report={'status':'pass','files':{}}
    for filename in ('runner-crab.blend','runner-crab-review-scene.blend'):
        path=HERE/filename;before=sha(path)
        bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['RunnerCrab_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('RunnerCrab_Colour_','RunnerCrab_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Expected two packed atlas images')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==rig for mod in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        if filename=='runner-crab.blend':
            feet=[o for o in meshes if o.name.endswith('_curved_leg')]
            require(len(feet)==8,'Expected eight distinct editable walking legs')
            entry['walking_legs']=len(feet);entry['editable_parts']=len(meshes)
            for ob in meshes:
                bm=bmesh.new();bm.from_mesh(ob.data)
                try:
                    require(all(e.is_manifold for e in bm.edges),f'Nonmanifold part: {ob.name}')
                    require(bm.calc_volume(signed=True)>0,f'Inward/zero volume part: {ob.name}')
                finally:bm.free()
            # Eyes contain true closed topology; dark areas are UV paint.
            eyes=[o for o in meshes if o.name.startswith('Spherical_painted_eye_')]
            require(len(eyes)==2 and all(len(o.data.vertices)>450 for o in eyes),'Missing smooth eye topology')
            entry['eye_vertices']={o.name:len(o.data.vertices) for o in eyes}
        require(sha(path)==before,'Source was unexpectedly modified')
        report['files'][filename]=entry
    write('source-check.json',report);print('RUNNER_SOURCE_VERIFICATION_PASS',flush=True)


def aim(camera,location,target,scale):
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=scale


def render_poses():
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'runner-crab-review-scene.blend'),load_ui=False,use_scripts=False)
    scene=bpy.context.scene;rig=bpy.data.objects['RunnerCrab_Rig'];mesh=bpy.data.objects['RunnerCrab_SkinnedMesh']
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=20
    scene.render.resolution_x=1800;scene.render.resolution_y=580
    aim(scene.camera,(0,-10,4.8),(0,0,.46),6.4)
    labelmat=bpy.data.materials.new('REVIEW_ONLY_labels');labelmat.diffuse_color=(.065,.042,.022,1)
    for index,(name,frame) in enumerate([('idle',16),('walk',4),('attack',9),('hit',4),('exit',18)]):
        action(rig,name);scene.frame_set(frame);bpy.context.view_layer.update()
        frozen=bpy.data.meshes.new_from_object(mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        ob=bpy.data.objects.new('REVIEW_ONLY_real_pose_'+name,frozen);scene.collection.objects.link(ob)
        ob.location.x=(index-2)*1.22
        curve=bpy.data.curves.new('label_'+name,'FONT');curve.body=f'{name.upper()} / {frame}';curve.align_x='CENTER';curve.size=.105
        label=bpy.data.objects.new('label_'+name,curve);scene.collection.objects.link(label);label.data.materials.append(labelmat)
        label.location=((index-2)*1.22,0,1.12);label.rotation_euler=scene.camera.rotation_euler
    rig.hide_render=True;mesh.hide_render=True
    scene.render.filepath=str(HERE/'render-five-poses.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'runner-crab-poses.blend'))
    bpy.ops.render.render(write_still=True)
    # A side view of the actual attack tests claw/front-body separation visually.
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'runner-crab-review-scene.blend'),load_ui=False,use_scripts=False)
    scene=bpy.context.scene;rig=bpy.data.objects['RunnerCrab_Rig'];action(rig,'attack');scene.frame_set(9)
    scene.cycles.samples=20;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=800;scene.render.resolution_y=760
    aim(scene.camera,(4,-.65,1.25),(0,-.02,.46),1.43)
    scene.render.filepath=str(HERE/'render-attack-side.png');bpy.ops.render.render(write_still=True)


def render_context():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'game/art-source/environment/tidal-island-review-scene.blend'),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    with bpy.data.libraries.load(str(HERE/'runner-crab-review-scene.blend'),link=False) as (src,dst):
        dst.objects=[name for name in src.objects if name in ('RunnerCrab_Rig','RunnerCrab_SkinnedMesh')]
    for ob in dst.objects:scene.collection.objects.link(ob)
    rig=next(o for o in dst.objects if o.type=='ARMATURE');mesh=next(o for o in dst.objects if o.type=='MESH')
    action(rig,'walk');scene.frame_set(4);bpy.context.view_layer.update()
    for index,(x,z) in enumerate([(-6.8,0),(-5.55,0),(-4.3,0)]):
        frozen=bpy.data.meshes.new_from_object(mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        ob=bpy.data.objects.new('REVIEW_ONLY_runner_'+str(index),frozen);scene.collection.objects.link(ob)
        ob.location=(x,-z,.064);ob.rotation_euler.z=math.pi/2;ob.scale=(.83,)*3
    rig.hide_render=True;mesh.hide_render=True
    turtle_source=ROOT/'game/art-source/stone-turtle/candidate-11/stone-turtle-review-scene.blend'
    with bpy.data.libraries.load(str(turtle_source),link=False) as (src,dst):
        dst.objects=[name for name in src.objects if name in ('StoneTurtle_Rig','StoneTurtle_SkinnedMesh')]
    for ob in dst.objects:scene.collection.objects.link(ob)
    turtle=next(o for o in dst.objects if o.type=='ARMATURE');turtle.location=(-5,-1,.292);turtle.scale=(.65,)*3;turtle.rotation_euler.z=math.pi
    turtle.animation_data.use_nla=False
    scene.frame_set(1)
    scene.cycles.samples=20;scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1280;scene.render.resolution_y=780
    aim(scene.camera,(4,-14,13),(-4.7,0,.3),10.5)
    scene.render.filepath=str(HERE/'render-island-battle-context.png')
    for im in bpy.data.images:
        if im.source=='FILE' and not im.packed_file:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'runner-crab-island-context.blend'))
    bpy.ops.render.render(write_still=True)
    write('context-manifest.json',{'status':'Offline Blender real-mesh composition, not Cocos gameplay screenshot',
          'runner_scale':.83,'runner_road_y':.064,'stone_scale':.65,'stone_floor_y':.292,
          'references':['tidal island current source','stone candidate-11'],
          'render_threads':2,'samples':20,'written_under':str(HERE)})


if '--render-only' not in sys.argv:
    verify_fbx();verify_source()
if '--no-render' not in sys.argv:
    render_poses();render_context()
print('RUNNER_REVIEW_COMPLETE',flush=True)
