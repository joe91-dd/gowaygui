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
    chosen=next((a for a in candidates if any('InkSnail' in s.identifier for s in a.slots)),candidates[0])
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
    path=HERE/'export/ink-snail.fbx';require(sha(path)==STATS['fbx_sha256'],'FBX differs from recorded build')
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=True)
    rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    require(len(rigs)==len(meshes)==1,'Expected one rig and one mesh');rig,mesh=rigs[0],meshes[0]
    require(set(b.name for b in rig.data.bones)==set(STATS['bones']),'Bone contract changed')
    require(len(mesh.data.materials)==1 and len(mesh.data.uv_layers)==1,'Expected one material/UV')
    triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
    require(triangles==STATS['triangles'] and triangles<=14000,'Triangle budget/count mismatch')
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
    write('round-trip-check.json',report);print('INK_SNAIL_FBX_VERIFICATION_PASS '+json.dumps(report['clips']),flush=True)

def verify_source():
    report={'status':'pass','files':{}}
    for name in ('ink-snail.blend','ink-snail-review-scene.blend'):
        path=HERE/name;before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['InkSnail_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('InkSnail_Colour_','InkSnail_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Missing packed atlas')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        mat=bpy.data.materials['InkSnail_Toy_Atlas'];p=mat.node_tree.nodes.get('Principled BSDF')
        require(p.inputs['Alpha'].default_value==1 and p.inputs['Transmission Weight'].default_value==0,'Expected opaque non-transmitting surface')
        if name=='ink-snail.blend':
            entry['editable_parts']=len(meshes)
            for ob in meshes:
                bm=bmesh.new();bm.from_mesh(ob.data)
                try:
                    require(all(e.is_manifold for e in bm.edges),'Non-manifold '+ob.name)
                    require(bm.calc_volume(signed=True)>0,'Inward/zero-volume '+ob.name)
                finally:bm.free()
            shell=bpy.data.objects['Thick_ochre_shell']
            thickness=max(v.co.x for v in shell.data.vertices)-min(v.co.x for v in shell.data.vertices)
            require(thickness>.48,'Shell is an unexpectedly thin disc')
            spirals=[o for o in meshes if o.name.startswith('Raised_spiral_')]
            require(len(spirals)==2 and all(len(o.data.vertices)>800 for o in spirals),'Missing real two-sided spirals')
            spout=bpy.data.objects['Short_recessed_ink_spout']
            require(max(v.co.y for v in spout.data.vertices)-min(v.co.y for v in spout.data.vertices)>.10,'Spout has no depth')
            entry['shell_thickness_x']=thickness;entry['geometric_spirals']=2;entry['recessed_spout']=True
            eyes=[o for o in meshes if o.name.startswith('Spherical_painted_eye_')]
            require(len(eyes)==2 and all(len(o.data.vertices)>400 for o in eyes),'Missing curved closed eyes')
            entry['eye_vertices']={o.name:len(o.data.vertices) for o in eyes}
        require(sha(path)==before,'Source changed during validation');report['files'][name]=entry
    write('source-check.json',report);print('INK_SNAIL_SOURCE_VERIFICATION_PASS',flush=True)


def payload_digest(data):
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode('utf-8')).hexdigest()

def source_snapshot(path):
    before=sha(path);bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    meshes={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        me=ob.data
        groups={g.index:g.name for g in ob.vertex_groups}
        payload={
            'vertices':[list(v.co) for v in me.vertices],
            'faces':[list(p.vertices) for p in me.polygons],
            'uv':[[list(d.uv) for d in layer.data] for layer in me.uv_layers],
            'weights':[[[groups[g.group],g.weight] for g in v.groups] for v in me.vertices],
            'bone':ob.get('bone'),'material_names':[m.name for m in me.materials]}
        meshes[ob.name]=payload_digest(payload)
    rig=bpy.data.objects['InkSnail_Rig']
    bones={b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None} for b in rig.data.bones}
    actions={}
    for act in bpy.data.actions:
        curves=[]
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        curves.append((fc.data_path,fc.array_index,[(list(k.co),k.interpolation) for k in fc.keyframe_points]))
        actions[act.name]=payload_digest(sorted(curves,key=lambda c:(c[0],c[1])))
    require(sha(path)==before,'Snapshot changed source')
    return {'meshes':meshes,'bones':payload_digest(bones),'actions':actions}

def compare_c01():
    base=HERE.parent/'candidate-01'
    preservation=json.loads((HERE/'c01-preservation.json').read_text(encoding='utf-8'))
    for name,digest in preservation['files'].items():require(sha(ROOT/name)==digest,'Protected c01 file changed: '+name)
    old=source_snapshot(base/'ink-snail.blend');new=source_snapshot(HERE/'ink-snail.blend')
    require(set(old['meshes'])==set(new['meshes']),'Unexpected new/removed part')
    changed=sorted(name for name in old['meshes'] if old['meshes'][name]!=new['meshes'][name])
    expected=['Raised_spiral_L','Raised_spiral_R','Thick_rolled_shell_lip_L','Thick_rolled_shell_lip_R']
    require(changed==expected,'Out-of-scope geometry/UV/weight/material change: '+str(changed))
    require(old['bones']==new['bones'] and old['actions']==new['actions'],'Skeleton or authored animation changed')
    texture_hashes={}
    for name in ('snail-colour.png','snail-roughness.png'):
        require(sha(base/'export'/name)==sha(HERE/'export'/name),'Palette/roughness changed')
        texture_hashes[name]=sha(HERE/'export'/name)
    topology={}
    for name in expected:
        ob=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(ob.data)
        try:
            require(all(e.is_manifold for e in bm.edges),'Open/nonmanifold shell curve '+name)
            euler=len(bm.verts)-len(bm.edges)+len(bm.faces)
            require(euler==(0 if 'shell_lip' in name else 2),'Closed seam/cap topology mismatch '+name)
            topology[name]={'vertices':len(bm.verts),'faces':len(bm.faces),'euler':euler,'manifold':True}
        finally:bm.free()
    for name,digest in preservation['files'].items():require(sha(ROOT/name)==digest,'c01 changed during QA')
    report={'status':'pass','changed_meshes_only':changed,
        'unchanged_meshes':[name for name in sorted(old['meshes']) if name not in changed],
        'mesh_comparison_fields':['vertex coordinates','face indices','UVs','weights','bone binding','material names'],
        'bones_identical':True,'authored_actions_identical':True,'texture_sha256_identical':texture_hashes,
        'c01_all_recorded_bytes_unchanged':True,'curve_topology':topology,
        'evidence_boundary':'Same source geometry and curves verified; actual Cocos import/render/performance not run.'}
    write('c01-comparison-check.json',report)
    print('INK_SNAIL_C02_COMPARISON_PASS '+json.dumps(changed),flush=True)

verify_fbx();verify_source();compare_c01()
print('INK_SNAIL_C02_QA_COMPLETE',flush=True)
