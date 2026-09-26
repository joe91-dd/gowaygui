"""c04 preservation check only. No animation export, render or runtime writes."""
import ast,bpy,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OLD=HERE.parent/'candidate-03'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path));out={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or 'bone' not in ob or ob.name=='Leaf_shell_core' or ob.name.startswith('Layered_leaf_'):continue
        out[ob.name]={'bone':ob['bone'],'v':[list(v.co) for v in ob.data.vertices],
            'f':[list(p.vertices) for p in ob.data.polygons],'uv':[list(d.uv) for d in ob.data.uv_layers.active.data],
            'w':[[[g.group,g.weight] for g in v.groups] for v in ob.data.vertices]}
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    bones={b.name:{'parent':b.parent.name if b.parent else None,'matrix':[list(row) for row in b.matrix_local]} for b in rig.data.bones}
    actions={a.name:list(a.frame_range) for a in bpy.data.actions}
    return out,bones,actions
def shape_ast(path):
    nodes=ast.parse(path.read_text(encoding='utf-8')).body
    selected=[node for node in nodes if (isinstance(node,ast.FunctionDef) and node.name=='leaf') or (isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ['ACROSS','BELOW','STEPS'] for t in node.targets))]
    return [ast.dump(node,include_attributes=False) for node in selected]
assert shape_ast(ROOT/'game/art-source/build_leaf_turtle_candidate03.py')==shape_ast(ROOT/'game/art-source/build_leaf_turtle_candidate04.py'),'c03 leaf shape definition changed'
before=snapshot(OLD/'leaf-turtle.blend');after=snapshot(HERE/'leaf-turtle.blend')
assert before==after,'Non-leaf geometry/UV/weights, bone layout or clip inventory changed'
images=[i for i in bpy.data.images if i.name.startswith('LeafTurtle_')]
assert len(images)==2 and all(i.packed_file for i in images)
def studio(path):
    bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene
    cam=scene.camera
    lights={o.name:{'matrix':[list(r) for r in o.matrix_world],'energy':o.data.energy,'colour':list(o.data.color),'size':o.data.size,'shape':o.data.shape} for o in scene.objects if o.type=='LIGHT'}
    return {'camera_matrix':[list(r) for r in cam.matrix_world],'ortho_scale':cam.data.ortho_scale,
        'lights':lights,'view_transform':scene.view_settings.view_transform,
        'world_colour':list(scene.world.node_tree.nodes['Background'].inputs[0].default_value),
        'world_strength':scene.world.node_tree.nodes['Background'].inputs[1].default_value}
# Compare the exact authored three-quarter camera without saving the old source.
bpy.ops.wm.open_mainfile(filepath=str(OLD/'leaf-turtle-review-scene.blend'))
from mathutils import Vector
scene=bpy.context.scene;scene.camera.location=(3.6,-5.4,3)
scene.camera.rotation_euler=(Vector((0,-.12,.95))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=3.8;bpy.context.view_layer.update()
def current_studio():
    scene=bpy.context.scene;cam=scene.camera
    return {'camera_matrix':[list(r) for r in cam.matrix_world],'ortho_scale':cam.data.ortho_scale,
        'lights':{o.name:{'matrix':[list(r) for r in o.matrix_world],'energy':o.data.energy,'colour':list(o.data.color),'size':o.data.size,'shape':o.data.shape} for o in scene.objects if o.type=='LIGHT'},
        'view_transform':scene.view_settings.view_transform,'world_colour':list(scene.world.node_tree.nodes['Background'].inputs[0].default_value),
        'world_strength':scene.world.node_tree.nodes['Background'].inputs[1].default_value}
old_studio=current_studio();new_studio=studio(HERE/'leaf-turtle-review-scene.blend')
assert old_studio==new_studio,'Full preview lighting/camera changed'
for p in (HERE/'textures').glob('*.png'):assert p.read_bytes()==(OLD/'textures'/p.name).read_bytes()
manifest=json.loads((HERE/'candidate-manifest.json').read_text(encoding='utf-8'))
for path,digest in manifest['protected_inputs'].items():assert sha(ROOT/path)==digest,('Protected c01/c02/runtime file changed',path)
report={'passed':True,'c03_leaf_outline_cross_section_and_midrib_definition_unchanged':True,'non_leaf_meshes_exactly_preserved':len(before[0]),'bone_layout_exactly_preserved':True,
    'source_clip_inventory_and_ranges_preserved':True,'source_actions':before[2],
    'full_preview_lights_camera_world_identical':True,'both_packed_atlases_retained':True,
    'external_atlas_png_bytes_identical':True,'c01_c02_c03_and_frozen_runtime_bytes_preserved':True,
    'six_animation_reexport_performed':False,'full_half_frame_or_runtime_qa_performed':False,
    'runtime_written':False,'cocos_started':False}
(HERE/'scope-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('LEAF_C04_SCOPE_CHECK '+json.dumps(report))



