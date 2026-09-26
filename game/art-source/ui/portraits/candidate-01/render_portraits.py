"""Five genuine runtime-model portraits. Run only after root grants Blender slot.
blender --background --factory-startup -t 2 --python-exit-code 1 --python THIS -- --slot-authorized
"""
from pathlib import Path
import sys,json,hashlib,math
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
assert '--slot-authorized' in sys.argv,'Do not start rendering without root scheduling the single Blender slot'
plan=json.loads((HERE/'portrait-plan.json').read_text(encoding='utf-8'))
assert len(plan['sources'])==5,'Wait for the frozen bubble runtime source; no four-icon partial release'
assert not (HERE/'source-freeze.json').exists(),'Portrait candidate frozen; create another candidate for changes'
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,obj):(HERE/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def verify_protected():
    for path,digest in plan['protected_sha256'].items():assert sha(ROOT/path)==digest,('Frozen character bytes changed',path)
verify_protected();settings=plan['render_settings'];C=settings['camera'];TARGET=Vector(C['target'])
az,el=map(math.radians,(C['azimuth_degrees'],C['elevation_degrees']))
CAMERA=TARGET+Vector((math.sin(az)*math.cos(el),-math.cos(az)*math.cos(el),math.sin(el)))*C['distance']
ROTATION=(TARGET-CAMERA).to_track_quat('-Z','Y');RIGHT=ROTATION@Vector((1,0,0));UP=ROTATION@Vector((0,1,0))
common_scale=C['minimum_scale'];prepared=[]
for spec in plan['sources']:
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    # Load copies of object datablocks, keeping source bytes and source studio intact.
    with bpy.data.libraries.load(str(ROOT/spec['source_blend']),link=False) as (src,dst):dst.objects=list(src.objects)
    loaded=[o for o in dst.objects if o is not None]
    rigs=[o for o in loaded if o.type=='ARMATURE'];assert len(rigs)==1
    rig=rigs[0];assert rig.name==spec['rig'],(rig.name,spec['rig'])
    meshes=[o for o in loaded if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
    assert len(meshes)==1,'Expected final one-mesh runtime LOD, not editable high model'
    mesh=meshes[0];assert sum(len(p.vertices)-2 for p in mesh.data.polygons)==spec['triangles']
    for ob in (rig,mesh):scene.collection.objects.link(ob);ob.hide_render=False;ob.hide_viewport=False
    assert len(mesh.data.materials)==1 and len(rig.data.bones)==10
    actions=[]
    if rig.animation_data:
        if rig.animation_data.action:actions.append(rig.animation_data.action)
        for track in rig.animation_data.nla_tracks:
            track.mute=True
            actions.extend(strip.action for strip in track.strips if strip.action)
    candidates=list({a.name:a for a in actions if a.name.split('|')[-1].split('.')[0]=='idle'}.values())
    assert len(candidates)==1,'Find idle belonging to this actual rig'
    action=candidates[0];rig.animation_data.use_nla=False;rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis.identity()
    rig.animation_data.action=action
    if action.slots:rig.animation_data.action_slot=action.slots[0]
    scene.frame_set(settings['frame']);bpy.context.view_layer.update()
    # Match packed source atlas bytes to the very PNGs used by the runtime FBX.
    material=mesh.data.materials[0]
    packed={hashlib.sha256(node.image.packed_file.data).hexdigest():node.image.name
            for node in material.node_tree.nodes if node.type=='TEX_IMAGE' and node.image and node.image.packed_file}
    for item in spec['images']:assert item['sha256'] in packed,'Missing exact packed runtime atlas'
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
    try:points=[evaluated.matrix_world@v.co for v in data.vertices]
    finally:evaluated.to_mesh_clear()
    assert len(points)==len(mesh.data.vertices)
    groups={g.index:g.name for g in mesh.vertex_groups}
    head=[points[v.index] for v in mesh.data.vertices if any(groups[g.group]=='head' and g.weight>.5 for g in v.groups)]
    feature=[points[v.index] for v in mesh.data.vertices if any(groups[g.group] in ('head','shell','neck') and g.weight>.5 for g in v.groups)]
    assert head and feature
    extent=max(max(abs((p-TARGET).dot(RIGHT)),abs((p-TARGET).dot(UP))) for p in feature)
    common_scale=max(common_scale,extent*2/.88)
    camera_data=bpy.data.cameras.new('Portrait_shared_camera');camera=bpy.data.objects.new(camera_data.name,camera_data)
    scene.collection.objects.link(camera);scene.camera=camera;camera.location=CAMERA;camera.rotation_euler=ROTATION.to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=common_scale;camera_data.lens=50
    scene.render.engine='CYCLES';scene.cycles.samples=settings['samples'];scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=settings['threads'];scene.render.film_transparent=True
    scene.render.resolution_x=scene.render.resolution_y=settings['size'];scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=15
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0;scene.view_settings.gamma=1
    scene.world=bpy.data.worlds.new('Portrait_neutral_world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=settings['world']['colour']
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=settings['world']['strength']
    for light in settings['lights']:
        light_data=bpy.data.lights.new('Portrait_'+light['name'],'AREA');light_data.energy=light['energy'];light_data.shape='DISK';light_data.size=light['size'];light_data.color=light['colour']
        node=bpy.data.objects.new(light_data.name,light_data);scene.collection.objects.link(node);node.location=light['location'];node.rotation_euler=(TARGET-node.location).to_track_quat('-Z','Y').to_euler()
    path=HERE/(spec['role']+'-portrait-scene.blend');bpy.ops.wm.save_as_mainfile(filepath=str(path))
    prepared.append({'role':spec['role'],'title':spec['title'],'scene':path.name,'triangles':spec['triangles'],
        'head_world_points':[list(p) for p in head],'feature_world_points':[list(p) for p in feature]})
assert common_scale<=C['maximum_scale_without_review'],'Shared crop unexpectedly wide: review source/feature bounds first'
output=[]
for item in prepared:
    path=HERE/item['scene'];bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    scene=bpy.context.scene;scene.camera.data.ortho_scale=common_scale
    head=[world_to_camera_view(scene,scene.camera,Vector(p)) for p in item['head_world_points']]
    feature=[world_to_camera_view(scene,scene.camera,Vector(p)) for p in item['feature_world_points']]
    assert all(.04<=p.x<=.96 and .04<=p.y<=.96 for p in feature),'Head or upper shell clipped'
    head_width=max(p.x for p in head)-min(p.x for p in head)
    assert head_width>=.35,'Head too small for useful 64px preview'
    scene.render.resolution_x=scene.render.resolution_y=settings['size'];bpy.ops.wm.save_as_mainfile(filepath=str(path))
    files=[]
    for size in (settings['size'],settings['small_preview_size']):
        scene.render.resolution_x=scene.render.resolution_y=size
        name=f"portrait-{item['role']}.png" if size==settings['size'] else f"preview-{item['role']}-{size}.png"
        scene.render.filepath=str(HERE/name);bpy.ops.render.render(write_still=True)
        files.append({'file':name,'size':size,'sha256':sha(HERE/name)})
    output.append({'role':item['role'],'title':item['title'],'scene':item['scene'],'scene_sha256':sha(path),'files':files,
        'triangles':item['triangles'],'head_width_ratio':head_width,'head_width_at_64_px':head_width*64})
verify_protected()
write('render-report.json',{'status':'rendered, actual image review pending','common_camera':{**C,'orthographic_scale':common_scale},
 'settings':settings,'roles':output,'protected_sha256':plan['protected_sha256'],'character_sources_unchanged':True,'runtime_assets_written':False})
print('FIVE_PORTRAITS_RENDERED '+json.dumps({'roles':len(output),'images':10,'shared_ortho_scale':common_scale,'threads':2,'samples':24}),flush=True)
