"""Read-only c02 FBX/source validation and bounded geometry comparison.

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
    path=HERE/'export/shell-carrier.fbx'
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
    require(triangles==STATS['triangles'] and triangles<=16000,'Triangle count mismatch/budget overflow')
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
    print('SHELL_CARRIER_FBX_VERIFICATION_PASS '+json.dumps({name:value['maximum_vertex_motion_m'] for name,value in report['clips'].items()}),flush=True)


def verify_source():
    report={'status':'pass','files':{}}
    for filename in ('shell-carrier.blend','shell-carrier-review-scene.blend'):
        path=HERE/filename;before=sha(path)
        bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
        rig=bpy.data.objects['ShellCarrier_Rig']
        images=[im for im in bpy.data.images if im.name.startswith(('ShellCarrier_Colour_','ShellCarrier_Roughness_'))]
        require(len(images)==2 and all(im.packed_file for im in images),'Expected two packed atlas images')
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==rig for mod in o.modifiers)]
        entry={'sha256':before,'packed_images':[im.name for im in images],'skinned_meshes':len(meshes)}
        if filename=='shell-carrier.blend':
            feet=[o for o in meshes if o.name.endswith('_curved_leg')]
            require(len(feet)==8,'Expected eight distinct editable walking legs')
            entry['walking_legs']=len(feet);entry['editable_parts']=len(meshes)
            fan=bpy.data.objects['Large_carried_fan_shell']
            require(fan.get('bone')=='carried_shell','Shell load lost its independent bone')
            entry['carried_fan_dimensions']=[max(v.co[i] for v in fan.data.vertices)-min(v.co[i] for v in fan.data.vertices) for i in range(3)]
            require(entry['carried_fan_dimensions'][0]>.9 and entry['carried_fan_dimensions'][2]>.6,'Large carried shell silhouette missing')
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
    write('source-check.json',report);print('SHELL_CARRIER_SOURCE_VERIFICATION_PASS',flush=True)





def snapshot_source(path):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    rig=bpy.data.objects['ShellCarrier_Rig']
    meshes={}
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH':continue
        meshes[ob.name]={
            'vertices':[list(v.co) for v in ob.data.vertices],
            'faces':[list(p.vertices) for p in ob.data.polygons],
            'uvs':[[list(loop.uv) for loop in uv.data] for uv in ob.data.uv_layers],
            'weights':[[[ob.vertex_groups[g.group].name,g.weight] for g in v.groups] for v in ob.data.vertices],
            'binding':ob.get('bone'),'matrix':[list(row) for row in ob.matrix_world],
            'materials':[m.name for m in ob.data.materials],
            'modifiers':[(m.type,m.object.name if m.type=='ARMATURE' and m.object else None) for m in ob.modifiers]}
    bones={b.name:{'parent':b.parent.name if b.parent else None,'matrix':[list(row) for row in b.matrix_local],
                   'head':list(b.head_local),'tail':list(b.tail_local),'deform':b.use_deform} for b in rig.data.bones}
    actions={}
    for act in bpy.data.actions:
        curves=[]
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        curves.append([fc.data_path,fc.array_index,[
                            [list(kp.co),list(kp.handle_left),list(kp.handle_right),kp.interpolation,
                             kp.handle_left_type,kp.handle_right_type] for kp in fc.keyframe_points]])
        actions[act.name]={'range':list(act.frame_range),'curves':curves}
    mat=bpy.data.materials['ShellCarrier_Toy_Atlas']
    material={'nodes':[],'links':[]}
    for n in mat.node_tree.nodes:
        inputs=[]
        for i in n.inputs:
            if not hasattr(i,'default_value'):continue
            value=i.default_value
            if not isinstance(value,(float,int,bool,str)):value=list(value) if hasattr(value,'__iter__') else str(value)
            inputs.append([i.name,value])
        material['nodes'].append({'name':n.name,'type':n.bl_idname,'inputs':inputs,
                                 'image':n.image.name if n.type=='TEX_IMAGE' and n.image else None,
                                 'colorspace':n.image.colorspace_settings.name if n.type=='TEX_IMAGE' and n.image else None})
    material['links']=[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in mat.node_tree.links]
    return {'meshes':meshes,'bones':bones,'actions':actions,'material':material}

def studio_snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    scene=bpy.context.scene
    lights={ob.name:{'matrix':[list(row) for row in ob.matrix_world],'type':ob.data.type,
                      'energy':ob.data.energy,'color':list(ob.data.color),'size':ob.data.size} for ob in scene.objects if ob.type=='LIGHT'}
    bg=scene.world.node_tree.nodes['Background']
    return {'lights':lights,'world_color':list(bg.inputs[0].default_value),'world_strength':bg.inputs[1].default_value,
            'view_transform':scene.view_settings.view_transform,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure,
            'gamma':scene.view_settings.gamma,'samples':scene.cycles.samples,'threads':scene.render.threads}

def compare_c01():
    prior=HERE.parent/'candidate-01'
    before=snapshot_source(prior/'shell-carrier.blend');after=snapshot_source(HERE/'shell-carrier.blend')
    require(before['meshes'].keys()==after['meshes'].keys(),'Editable part set changed')
    changed=[name for name in before['meshes'] if before['meshes'][name]!=after['meshes'][name]]
    require(changed==['Large_carried_fan_shell'],'Unexpected changed part: '+str(changed))
    for key in ('bones','actions','material'):require(before[key]==after[key],'Changed '+key)
    old=before['meshes'][changed[0]];new=after['meshes'][changed[0]]
    old_bounds=[[min(v[i] for v in old['vertices']),max(v[i] for v in old['vertices'])] for i in range(3)]
    new_bounds=[[min(v[i] for v in new['vertices']),max(v[i] for v in new['vertices'])] for i in range(3)]
    max_error=max(abs(a-b) for aa,bb in zip(old_bounds,new_bounds) for a,b in zip(aa,bb))
    require(max_error<.000001,'Shell dimensions changed')
    old_studio=studio_snapshot(prior/'shell-carrier-review-scene.blend')
    new_studio=studio_snapshot(HERE/'shell-carrier-review-scene.blend')
    require(old_studio==new_studio,'Studio lighting/color management changed')
    atlas={}
    for name in ('carrier-colour.png','carrier-roughness.png'):
        a=sha(prior/'export'/name);b=sha(HERE/'export'/name);require(a==b,'Atlas pixels/bytes changed')
        atlas[name]=a
    report={'status':'pass','changed_meshes':changed,'unchanged_meshes':[n for n in before['meshes'] if n not in changed],
            'comparison':'Exact vertex/index/UV/weight/binding/transform/material-slot data for all unchanged parts; exact bone and F-curve keyframe/handle data; exact material nodes; studio lighting/exposure unchanged.',
            'rig_exactly_unchanged':True,'five_actions_exactly_unchanged':True,
            'material_nodes_exactly_unchanged':True,'studio_lighting_exactly_unchanged':True,
            'old_shell_bounds':old_bounds,'new_shell_bounds':new_bounds,'maximum_shell_bound_error_m':max_error,
            'atlas_bytes_unchanged':atlas}
    write('c01-comparison-check.json',report)
    print('SHELL_CARRIER_C01_COMPARE_PASS',flush=True)

verify_fbx();verify_source();compare_c01()
for name,digest in STATS['protected_reference_hashes'].items():require(sha(ROOT/name)==digest,'Protected frozen source changed: '+name)
write('reference-preservation.json',{'status':'pass','files':STATS['protected_reference_hashes'],'writes_to_other_assets':False})
print('SHELL_CARRIER_QA_COMPLETE',flush=True)

