"""Read-only c01/c02 scope comparison; writes only candidate-02/scope-check.json.
Run after build completes: Blender -b -t 2 --python-exit-code 1 --python THIS_FILE.
This is not full animation reimport QA and never touches runtime resources.
"""
import ast,bpy,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def mesh_snapshot():
    result={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or 'bone' not in ob or ob.name.startswith('Layered_leaf_') or ob.name=='Leaf_shell_core':continue
        result[ob.name]={'bone':ob['bone'],
            'vertices':[[float(c) for c in v.co] for v in ob.data.vertices],
            'polygons':[list(p.vertices) for p in ob.data.polygons],
            'uv':[[float(c) for c in d.uv] for d in ob.data.uv_layers.active.data],
            'weights':[[[g.group,g.weight] for g in v.groups] for v in ob.data.vertices]}
    return result
sources=[(ROOT/'game/art-source'/name).read_text(encoding='utf-8') for name in ['build_leaf_turtle_candidate01.py','build_leaf_turtle_candidate02.py']]
def freeze_ast(text):
    nodes=ast.parse(text).body
    targets=[n for n in nodes if (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CLIPS' for t in n.targets)) or (isinstance(n,ast.FunctionDef) and n.name=='setpose')]
    return [ast.dump(n,include_attributes=False) for n in targets]
assert freeze_ast(sources[0])==freeze_ast(sources[1]),'c01 action source changed'
def fragment(text,start,end):return text[text.index(start):text.index(end,text.index(start))]
assert fragment(sources[0],'# A4 warm female character','# A4 layered leaf carapace')==fragment(sources[1],'# A4 warm female character','# A4 layered leaf carapace'),'Face construction changed'
assert fragment(sources[0],"scene.render.engine='CYCLES'","if '--no-render' not in sys.argv:")==fragment(sources[1],"scene.render.engine='CYCLES'","if '--no-render' not in sys.argv:"),'Review lighting/camera changed'
def palette(text):
    node=next(n for n in ast.parse(text).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PALETTE' for t in n.targets))
    return ast.literal_eval(node.value)
assert palette(sources[0])[4:]==palette(sources[1])[4:],'Non-leaf pigments changed'
bpy.ops.wm.open_mainfile(filepath=str(HERE.parent/'candidate-01/leaf-turtle.blend'))
before=mesh_snapshot()
bpy.ops.wm.open_mainfile(filepath=str(HERE/'leaf-turtle.blend'))
after=mesh_snapshot();assert before==after,'c01 non-leaf mesh, UV or weights changed'
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
assert len(rig.data.bones)==10 and set(a.name for a in bpy.data.actions)=={'idle','attack','skill','hit','rest','fusion'}
images=[i for i in bpy.data.images if i.name.startswith('LeafTurtle_')]
assert len(images)==2 and all(i.packed_file for i in images),'Source does not contain exactly two packed leaf atlases'
for ob in bpy.context.scene.objects:
    if ob.type=='MESH' and 'bone' in ob:
        assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in ob.data.vertices),ob.name
manifest=json.loads((HERE/'candidate-manifest.json').read_text(encoding='utf-8'))
for path,digest in manifest['protected_inputs'].items():assert sha(ROOT/path)==digest,('protected file changed',path)
report={'scope_check_passed':True,'non_leaf_mesh_uv_weights_identical_count':len(before),
    'four_white_blossom_mesh_parts_identical':all(name in before for name in ['Small_shell_blossom_L_petals','Small_shell_blossom_L_pollen','Small_shell_blossom_R_petals','Small_shell_blossom_R_pollen']),
    'face_construction_unchanged':True,'body_and_eye_geometry_unchanged':True,'six_action_source_unchanged':True,
    'lighting_and_three_cameras_unchanged':True,'non_leaf_palette_tiles_unchanged':True,'source_normalized_weights':True,
    'source_bones':10,'source_clips':6,'source_packed_textures':2,'protected_c01_and_frozen_runtime_payloads_unchanged':True,
    'full_fbx_reimport_or_half_frame_qa_performed':False,'runtime_written':False,'cocos_started':False,
    'review_image_sha256':{p.name:sha(p) for p in HERE.glob('render-*.png')}}
(HERE/'scope-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('LEAF_C02_SCOPE_CHECK '+json.dumps(report))

