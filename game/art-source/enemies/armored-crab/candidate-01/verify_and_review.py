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
    path=HERE/'export/armored-crab.fbx'
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
    require(triangles==STATS['triangles'] and triangles<=14000,'Triangle count mismatch/budget overflow')
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
    print('ARMORED_FBX_VERIFICATION_PASS '+json.dumps({name:value['maximum_vertex_motion_m'] for name,value in report['clips'].items()}),flush=True)


def verify_source():
    report={'status':'pass','files':{}}
    for filename in ('armored-crab.blend','armored-crab-review-scene.blend'):
        path=HERE/filename;before=sha(path)
        bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['ArmoredCrab_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('ArmoredCrab_Colour_','ArmoredCrab_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Expected two packed atlas images')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==rig for mod in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        if filename=='armored-crab.blend':
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
    write('source-check.json',report);print('ARMORED_SOURCE_VERIFICATION_PASS',flush=True)



def aim(camera,location,target,scale=None):
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    if scale is not None:camera.data.type='ORTHO';camera.data.ortho_scale=scale

def setup(scene,x=920,y=820,samples=24):
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=samples
    scene.render.resolution_x=x;scene.render.resolution_y=y;scene.render.resolution_percentage=100

def studio():
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'armored-crab-review-scene.blend'),load_ui=False,use_scripts=False)
    return bpy.context.scene,bpy.data.objects['ArmoredCrab_Rig'],bpy.data.objects['ArmoredCrab_SkinnedMesh']

def render_static():
    scene,rig,mesh=studio();setup(scene)
    action(rig,'idle');scene.frame_set(1)
    for name,location,target,scale in [
        ('front',(0,-5,1.3),(0,-.04,.33),1.71),
        ('three-quarter',(2.5,-4.8,2.35),(0,-.01,.34),1.84),
        ('side',(5,-.10,1.18),(0,-.01,.34),1.63)]:
        aim(scene.camera,location,target,scale)
        scene.render.filepath=str(HERE/('render-'+name+'.png'));bpy.ops.render.render(write_still=True)

def freeze(mesh,name,position,scale=1,heading=0):
    deps=bpy.context.evaluated_depsgraph_get()
    data=bpy.data.meshes.new_from_object(mesh.evaluated_get(deps))
    ob=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(ob)
    ob.location=position;ob.scale=(scale,)*3;ob.rotation_euler.z=heading
    return ob

def append_actor(path,prefix):
    with bpy.data.libraries.load(str(path),link=False) as (src,dst):
        dst.objects=[name for name in src.objects if name in (prefix+'_Rig',prefix+'_SkinnedMesh')]
    for ob in dst.objects:bpy.context.scene.collection.objects.link(ob)
    return next(ob for ob in dst.objects if ob.type=='ARMATURE'),next(ob for ob in dst.objects if ob.type=='MESH')

def label(text,position,size=.12):
    scene=bpy.context.scene;curve=bpy.data.curves.new('Review_label','FONT');curve.body=text;curve.align_x='CENTER';curve.size=size
    ob=bpy.data.objects.new('REVIEW_ONLY_'+text,curve);scene.collection.objects.link(ob)
    ob.location=position;ob.rotation_euler=scene.camera.rotation_euler
    mat=bpy.data.materials.get('REVIEW_ONLY_label')
    if not mat:mat=bpy.data.materials.new('REVIEW_ONLY_label');mat.diffuse_color=(.075,.065,.05,1)
    ob.data.materials.append(mat)

def render_comparison():
    scene,rig,mesh=studio();setup(scene,1400,760,20);action(rig,'idle');scene.frame_set(1);bpy.context.view_layer.update()
    freeze(mesh,'Armored_comparison',(-.87,0,0),.90)
    rig.hide_render=True;mesh.hide_render=True
    runner_path=ROOT/'game/art-source/enemies/runner-crab/candidate-01/runner-crab-review-scene.blend'
    before=sha(runner_path)
    rr,rm=append_actor(runner_path,'RunnerCrab')
    rr.animation_data.use_nla=False
    candidate=next(a for a in bpy.data.actions if a.name.split('|')[-1].split('.')[0]=='idle' and any('RunnerCrab' in s.identifier for s in a.slots))
    rr.animation_data.action=candidate;rr.animation_data.action_slot=candidate.slots[0]
    scene.frame_set(1);bpy.context.view_layer.update()
    freeze(rm,'Runner_comparison',(.88,0,0),.83)
    rr.hide_render=True;rm.hide_render=True
    aim(scene.camera,(1.7,-7,2.8),(0,0,.35),3.75)
    label('ARMORED x0.90',(-.87,0,1.0))
    label('RUNNER x0.83',(.88,0,1.08))
    scene.render.filepath=str(HERE/'render-runner-scale-comparison.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'armored-runner-comparison.blend'))
    bpy.ops.render.render(write_still=True)
    require(sha(runner_path)==before,'Comparison modified runner source')
    write('comparison-manifest.json',{'status':'Offline Blender comparison, equal ground and light; not Cocos',
        'runner_source':str(runner_path),'runner_source_sha256':before,'runner_unchanged':True,
        'armored_scale':.90,'runner_scale':.83,
        'armored_runtime_dimensions':STATS['dimensions_at_recommended_scale'],
        'runner_runtime_dimensions':[.8864400649070739,.675024664402008,.7753315716981888]})

def render_battle():
    environment=ROOT/'game/art-source/environment/tidal-island-review-scene.blend'
    before=sha(environment)
    bpy.ops.wm.open_mainfile(filepath=str(environment),load_ui=False,use_scripts=False)
    scene=bpy.context.scene;setup(scene,1280,720,20)
    ar,am=append_actor(HERE/'armored-crab-review-scene.blend','ArmoredCrab')
    ar.animation_data.use_nla=False;scene.frame_set(1);bpy.context.view_layer.update()
    freeze(am,'Armored_battle_context',(-4.8,0,.064),.90,math.pi/2)
    ar.hide_render=True;am.hide_render=True
    runner=ROOT/'game/art-source/enemies/runner-crab/candidate-01/runner-crab-review-scene.blend'
    runner_before=sha(runner)
    rr,rm=append_actor(runner,'RunnerCrab');rr.animation_data.use_nla=False;scene.frame_set(1);bpy.context.view_layer.update()
    freeze(rm,'Runner_battle_context',(-3.2,.533333,.064),.83,math.pi/2+math.atan2(2,3))
    rr.hide_render=True;rm.hide_render=True
    # Directly map GameEntry's (0,15,18)->(0,.2,0) Cocos camera into Blender.
    # Preserve the actual 42-degree vertical perspective and 16:9 aspect.
    camera=scene.camera;camera.data.type='PERSP';camera.data.sensor_fit='VERTICAL'
    camera.data.sensor_height=24;camera.data.lens=12/math.tan(math.radians(42)/2)
    aim(camera,(0,-18,15),(0,0,.2))
    scene.render.filepath=str(HERE/'render-battle-angle.png')
    for im in bpy.data.images:
        if im.source=='FILE' and not im.packed_file:im.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'armored-battle-context.blend'))
    bpy.ops.render.render(write_still=True)
    require(sha(environment)==before and sha(runner)==runner_before,'Reference source changed')
    write('battle-camera-manifest.json',{'status':'Offline Blender rendering at current game camera direction/FOV; not Cocos screenshot',
        'source_code':'game/assets/scripts/view/GameEntry.ts:191 / resizeViewport',
        'cocos_camera':[0,15,18],'cocos_target':[0,.2,0],'blender_camera':[0,-18,15],'blender_target':[0,0,.2],
        'vertical_fov_degrees':42,'aspect':'16:9','armored_scale':.90,'runner_scale':.83,
        'source_hashes_unchanged':{str(environment):before,str(runner):runner_before}})

def render_poses():
    scene,rig,mesh=studio();setup(scene,1600,520,20)
    aim(scene.camera,(0,-10,4.5),(0,0,.30),7.5)
    for index,(name,frame) in enumerate([('idle',19),('walk',7),('attack',16),('hit',4),('exit',22)]):
        action(rig,name);scene.frame_set(frame);bpy.context.view_layer.update()
        freeze(mesh,'Real_pose_'+name,((index-2)*1.45,0,0))
        label(name.upper()+' / '+str(frame),((index-2)*1.45,0,.99),.115)
    rig.hide_render=True;mesh.hide_render=True
    scene.render.filepath=str(HERE/'render-five-poses.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'armored-crab-poses.blend'))
    bpy.ops.render.render(write_still=True)

verify_fbx();verify_source()
if '--no-render' not in sys.argv:
    render_static();render_comparison();render_battle();render_poses()
print('ARMORED_REVIEW_COMPLETE',flush=True)

