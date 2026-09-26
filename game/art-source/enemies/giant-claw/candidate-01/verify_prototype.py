"""Read-only source inspection for a static shape prototype, no FBX or animation."""
from pathlib import Path
import bpy, bmesh, json, hashlib, math

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
stats=json.loads((HERE/'model-stats.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def require(value,message):
    if not value:raise RuntimeError(message)
report={'status':'pass','stage':'static shape prototype only','files':{}}
def geometry_snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    root=bpy.data.objects['GiantClaw_Prototype']
    meshes={o.name:{'vertices':[list(v.co) for v in o.data.vertices],
        'faces':[list(p.vertices) for p in o.data.polygons],
        'uvs':[[list(loop.uv) for loop in uv.data] for uv in o.data.uv_layers],
        'joint':o.get('planned_joint'),'matrix':[list(row) for row in o.matrix_world]}
        for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==root}
    images={im.name:hashlib.sha256(im.packed_file.data).hexdigest() for im in bpy.data.images if im.name.startswith('GiantClaw_') and im.packed_file}
    return {'meshes':meshes,'images':images}
for filename in ('giant-claw-prototype.blend','giant-claw-review-scene.blend'):
    path=HERE/filename;before=sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    root=bpy.data.objects['GiantClaw_Prototype']
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==root]
    require(not any(o.type=='ARMATURE' for o in bpy.context.scene.objects),'Unexpected rig in shape-only stage')
    require(len(bpy.data.actions)==0,'Unexpected actions in shape-only stage')
    require(len(meshes)==stats['editable_mesh_count'],'Missing editable part')
    require(sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)==stats['triangles'],'Mesh triangle count differs')
    require(len([o for o in meshes if o.name.endswith('_weight_bearing_leg')])==8,'Missing walking legs')
    materials=set()
    for ob in meshes:
        require(len(ob.data.uv_layers)==len(ob.data.materials)==1,'Expected single UV/material on '+ob.name)
        materials.add(ob.data.materials[0].name)
        require(all(math.isfinite(c) for v in ob.data.vertices for c in v.co),'Nonfinite position')
        require(all(math.isfinite(c) and 0<=c<=1 for l in ob.data.uv_layers[0].data for c in l.uv),'Bad atlas UV')
        bm=bmesh.new();bm.from_mesh(ob.data)
        try:
            require(all(e.is_manifold for e in bm.edges),'Nonclosed part '+ob.name)
            require(bm.calc_volume(signed=True)>0,'Nonpositive volume '+ob.name)
        finally:bm.free()
    require(materials=={'GiantClaw_Toy_Atlas'},'Extra model material')
    bounds={'min':[min(v.co[i] for o in meshes for v in o.data.vertices) for i in range(3)],
            'max':[max(v.co[i] for o in meshes for v in o.data.vertices) for i in range(3)]}
    require(bounds==stats['bounds_blender_xyz'],'Source bounds changed')
    require(abs(bounds['min'][2])<1e-6,'Foot origin not zero')
    images={}
    for name,image_name in [('giant-colour.png','GiantClaw_Colour_512'),('giant-roughness.png','GiantClaw_Roughness_512')]:
        image=bpy.data.images[image_name]
        require(image.packed_file and tuple(image.size)==(512,512),'Packed atlas missing')
        require(hashlib.sha256(image.packed_file.data).hexdigest()==sha(HERE/'textures'/name),'Packed PNG differs from source')
        if 'roughness' in name:require(image.colorspace_settings.name=='Non-Color','Roughness colorspace wrong')
        images[name]={'sha256':sha(HERE/'textures'/name),'packed_exactly':True}
    require(sha(path)==before,'Opening source changed file')
    report['files'][filename]={'sha256':before,'editable_meshes':len(meshes),'materials':list(materials),'bounds':bounds,'packed_images':images}
for name,digest in stats['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Frozen reference changed '+name)
require(not list(HERE.rglob('*.fbx')) and not list(HERE.rglob('*.glb')),'Unexpected runtime interchange export')
report['protected_reference_hashes']=stats['protected_reference_hashes']
report['rig_and_actions_deferred']=True
report['no_fbx_or_glb_export']=True
initial=HERE/'iterations/before-finger-rounding/giant-claw-prototype.blend'
if initial.exists():
    before=geometry_snapshot(initial);after=geometry_snapshot(HERE/'giant-claw-prototype.blend')
    require(before['meshes'].keys()==after['meshes'].keys(),'Prototype parts changed')
    changed=sorted(name for name in before['meshes'] if before['meshes'][name]!=after['meshes'][name])
    require(changed==['Dominant_fixed_round_finger','Dominant_moving_round_finger'],'Unexpected geometry change: '+str(changed))
    require(before['images']==after['images'],'Palette changed during finger refinement')
    report['initial_preview_comparison']={'changed_meshes':changed,'other_34_parts_exactly_unchanged':True,
        'packed_atlas_bytes_exactly_unchanged':True,'initial_source_sha256':sha(initial),
        'comparison':'Exact vertex/face/UV/planned-joint/transform data; original shape preview archived before two-finger smoothing and front-camera adjustment.'}
report['method']='Opened actual saved blend files without resaving; checked editable parts, closed positive-volume topology, UV, finite geometry, bounds and packed PNG exact bytes. No animation or runtime validation claimed.'
(HERE/'source-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('GIANT_CLAW_PROTOTYPE_QA_PASS '+json.dumps({'triangles':stats['triangles'],'parts':stats['editable_mesh_count'],'rigs':0,'actions':0,'protected_sources_unchanged':True}),flush=True)
