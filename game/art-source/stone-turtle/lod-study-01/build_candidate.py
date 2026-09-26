"""One isolated LOD study from the approved c12b 28,572-triangle mesh.

No authored shape/atlas is regenerated.  The complete head is preserved.
Run with Blender 4.5.13 --background --threads 4 --python-exit-code 1.
"""
import bpy, hashlib, json, math, shutil
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'candidate-12/c12b'
EXPORT=HERE/'export';EXPORT.mkdir(exist_ok=True)

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,data): (HERE/name).write_text(json.dumps(data,indent=2),encoding='utf-8')
def tris(ob):return sum(len(p.vertices)-2 for p in ob.data.polygons)
def bounds(ob):return [[min(v.co[a] for v in ob.data.vertices) for a in range(3)],[max(v.co[a] for v in ob.data.vertices) for a in range(3)]]
def select(objects,active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=active or objects[0]
def head_signature(ob):
    # Polygon corners retain coordinates, original UVs, and stored split normals.
    mesh=ob.data;uv=mesh.uv_layers.active.data;normals=mesh.corner_normals
    head=ob.vertex_groups.get('head');rows=[]
    for p in mesh.polygons:
        if not all(any(g.group==head.index and g.weight>.999 for g in mesh.vertices[i].groups) for i in p.vertices):continue
        rows.append(sorted([tuple(round(float(q),6) for q in (*mesh.vertices[mesh.loops[i].vertex_index].co,*uv[i].uv,*normals[i].vector)) for i in p.loop_indices]))
    geometry=[sorted([c[:3] for c in r]) for r in rows]
    uv=[sorted([c[:5] for c in r]) for r in rows]
    return {'polygon_count':len(rows),'triangles':sum(len(r)-2 for r in rows),'sha256':hashlib.sha256(json.dumps(sorted(rows),sort_keys=True).encode()).hexdigest(),
      'geometry_sha256':hashlib.sha256(json.dumps(sorted(geometry)).encode()).hexdigest(),'geometry_uv_sha256':hashlib.sha256(json.dumps(sorted(uv)).encode()).hexdigest()}
def head_normals(ob):
    mesh=ob.data;head=ob.vertex_groups['head'];uv=mesh.uv_layers.active.data;result={}
    for p in mesh.polygons:
        if not all(any(g.group==head.index and g.weight>.999 for g in mesh.vertices[i].groups) for i in p.vertices):continue
        face=tuple(sorted(tuple(mesh.vertices[i].co) for i in p.vertices))
        for i in p.loop_indices:
            key=(face,tuple(mesh.vertices[mesh.loops[i].vertex_index].co),tuple(uv[i].uv))
            result[key]=(i,tuple(mesh.corner_normals[i].vector))
    return result
def actions_record():
    rows=[]
    for action in sorted(bpy.data.actions,key=lambda a:a.name):
        curves=[]
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for c in bag.fcurves:
                        curves.append({'path':c.data_path,'index':c.array_index,'extrapolation':c.extrapolation,'keys':[[*k.co,*k.handle_left,*k.handle_right,k.interpolation,k.handle_left_type,k.handle_right_type] for k in c.keyframe_points]})
        rows.append({'name':action.name,'range':list(action.frame_range),'curves':curves})
    return rows
def rig_record(rig):return [{'name':b.name,'parent':b.parent.name if b.parent else None,'matrix':[list(row) for row in b.matrix_local],'head':list(b.head_local),'tail':list(b.tail_local)} for b in rig.data.bones]
def set_action(rig,name,frame=1):
    for track in rig.animation_data.nla_tracks:track.mute=True
    action=bpy.data.actions[name];rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
def evaluate_bounds(ob):
    e=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    coords=[ob.matrix_world@v.co for v in m.vertices]
    result=[[min(v[a] for v in coords) for a in range(3)],[max(v[a] for v in coords) for a in range(3)]]
    e.to_mesh_clear();return result

bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'stone-turtle-review-scene.blend'))
scene=bpy.context.scene;scene.render.threads_mode='FIXED';scene.render.threads=4
scene.cycles.samples=32
original=bpy.data.objects['StoneTurtle_SkinnedMesh'];rig=bpy.data.objects['StoneTurtle_Rig']
set_action(rig,'idle')
original_head=head_signature(original);original_bounds=bounds(original)
original_head_normals=head_normals(original)
action_before=actions_record();rig_before=rig_record(rig)
original_copy=original.copy();original_copy.data=original.data.copy();scene.collection.objects.link(original_copy)
original_copy.name='Approved_c12b_28572_reference';original_copy.hide_render=True;original_copy.hide_set(True)
source_parts=json.loads((HERE/'source-inspection.json').read_text())[0]['meshes']
components=json.loads((HERE/'runtime-components.json').read_text())
assert len(source_parts)==len(components)==131
select([original]);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
parts=list(bpy.context.selected_objects);assert len(parts)==131
unmatched=set(range(len(components)));report=[]

def ratio(name,bone):
    if bone=='head':return 1.0,'Complete approved face/eyes/brows/mouth; zero simplification'
    if name=='Carapace_shadow_between_stones':return .15,'Mostly covered shell underlay; retain continuous backing'
    if name.startswith('Fitted_stone_'):return .40,'Reduce dense flat/bevel rings; retain every individual stone'
    if name.startswith('Overlapping_rim_'):return .50,'Retain all 18 overlapping stone hem pieces'
    if name.endswith('_sculpt'):return .32,'Round limb shaft/palm; preserve authored silhouette using curvature collapse'
    if '_toe_' in name:return .25,'Small rounded toes; preserve all 12 separate toes'
    if '_flush_scale_' in name:return .40,'Small flush patches; preserve all 32 patches'
    if name in ('Torso','Warm_plastron'):return .30,'Largely occluded body and underside'
    return .40,'Neck/tail small low silhouette impact surfaces'

for ob in parts:
    bb=bounds(ob)
    def error(i):return max(abs(bb[a][b]-components[i]['bounds'][a][b]) for a in range(2) for b in range(3))
    idx=min(unmatched,key=error);assert error(idx)<1e-5,(ob.name,error(idx))
    unmatched.remove(idx);source=source_parts[idx];name=source['name'];bone=source['bone']
    ob.name='LOD_'+name;ob['source_part']=name;ob['bone']=bone
    before=tris(ob);factor,reason=ratio(name,bone)
    if factor<1:
        select([ob]);modifier=ob.modifiers.new('Selective_component_collapse','DECIMATE');modifier.decimate_type='COLLAPSE';modifier.ratio=factor
        # Evaluate reduction in rest coordinates, ahead of the existing armature.
        bpy.ops.object.modifier_move_up(modifier=modifier.name)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    report.append({'part':name,'bone':bone,'triangles_before':before,'triangles_after':tris(ob),'ratio':factor,'reason':reason,'bounds_before':bb,'bounds_after':bounds(ob)})

assert not unmatched
for texture in ['stone-colour.png','stone-roughness.png']:shutil.copy2(SOURCE/'export'/texture,EXPORT/texture)
for im in bpy.data.images:
    if im.source=='FILE' and Path(im.filepath).name in ('stone-colour.png','stone-roughness.png'):
        im.filepath=str(EXPORT/Path(im.filepath).name);im.pack()
for ob in parts:
    if ob['bone']!='head':continue
    normals=[tuple(n.vector) for n in ob.data.corner_normals]
    for key,(index,value) in head_normals(ob).items():normals[index]=original_head_normals[key][1]
    ob.data.normals_split_custom_set(normals)
select(parts)
# Preserve an editable attributed-parts archive without rewriting the high source.
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'stone-turtle-lod-parts.blend'))
bpy.ops.object.join();candidate=bpy.context.object;candidate.name='StoneTurtle_LOD_SkinnedMesh'
candidate.data.name='StoneTurtle_LOD_Selective_15k'
material=candidate.data.materials[0]
candidate.data.materials.clear();candidate.data.materials.append(material)
for p in candidate.data.polygons:p.material_index=0
current=head_normals(candidate);assert set(current)==set(original_head_normals)
restored=[tuple(n.vector) for n in candidate.data.corner_normals]
for key,(index,normal) in current.items():restored[index]=original_head_normals[key][1]
candidate.data.normals_split_custom_set(restored)
normal_delta=max((Vector(n)-Vector(original_head_normals[key][1])).length for key,(i,n) in head_normals(candidate).items())
after_head=head_signature(candidate)
write('head-preservation-check.json',{'before':original_head,'after':after_head,'restored_split_normal_max_vector_delta':normal_delta})
assert after_head['geometry_uv_sha256']==original_head['geometry_uv_sha256'],'Head geometry/UV changed'
assert normal_delta<.0002,('Head normal restore delta',normal_delta)
assert actions_record()==action_before,'Animation curve source changed'
assert rig_record(rig)==rig_before,'Bone source changed'
weights=[sum(g.weight for g in v.groups) for v in candidate.data.vertices]
assert max(abs(w-1) for w in weights)<1e-6
assert len(candidate.data.uv_layers)==1 and all(math.isfinite(x) for uv in candidate.data.uv_layers.active.data for x in uv.uv)
source_count=tris(original_copy);count=tris(candidate)
assert 14000<=count<=17000,count
action_qa=[]
for name in ['idle','attack','skill','hit','rest','fusion']:
    action=bpy.data.actions[name];start,end=action.frame_range;rows=[]
    for step in range(round((end-start)*2)+1):
        frame=start+step*.5;set_action(rig,name,frame)
        rows.append({'frame':frame,'candidate_bounds':evaluate_bounds(candidate),'original_bounds':evaluate_bounds(original_copy)})
    action_qa.append({'name':name,'frame_range':[start,end],'duration':(end-start)/scene.render.fps,'samples':len(rows),'min_z':min(r['candidate_bounds'][0][2] for r in rows),'max_z':max(r['candidate_bounds'][1][2] for r in rows),'rows':rows})
set_action(rig,'idle')
stats={'source':str(SOURCE/'stone-turtle-review-scene.blend'),'source_sha256':sha(SOURCE/'stone-turtle-review-scene.blend'),
 'vertices_before':len(original_copy.data.vertices),'vertices_after':len(candidate.data.vertices),'triangles_before':source_count,'triangles_after':count,
 'triangle_reduction_percent':100*(1-count/source_count),'material_count':len(candidate.data.materials),'material_name':material.name,
 'head_original_signature':original_head,'head_candidate_signature':after_head,'head_geometry_uv_unchanged':True,'head_restored_normal_max_delta':normal_delta,'head_unchanged':True,'bounds_before':original_bounds,'bounds_after':bounds(candidate),
 'uv_layers':[l.name for l in candidate.data.uv_layers],'weights_min':min(weights),'weights_max':max(weights),'max_influences':max(len(v.groups) for v in candidate.data.vertices),
 'bones':rig_before,'actions_exact_unchanged':True,'actions_source_digest':hashlib.sha256(json.dumps(action_before,sort_keys=True).encode()).hexdigest(),
 'packed_images':[{'name':im.name,'bytes':im.packed_file.size} for im in bpy.data.images if im.source=='FILE' and im.packed_file],
 'parts':sorted(report,key=lambda r:r['part'])}
write('candidate-stats.json',stats);write('animation-half-frame-qa.json',action_qa)
print('LOD_STATS',json.dumps({k:stats[k] for k in ['vertices_before','vertices_after','triangles_before','triangles_after','triangle_reduction_percent','head_unchanged']}),flush=True)
# Save only candidate+rig as canonical study source; reference studio remains review-only.
original_copy.hide_set(False);bpy.data.objects.remove(original_copy,do_unlink=True)
studio=[o for o in list(scene.objects) if o not in (candidate,rig)]
for ob in studio:bpy.data.objects.remove(ob,do_unlink=True)
select([candidate,rig],rig)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'stone-turtle-lod.blend'))
bpy.ops.export_scene.fbx(filepath=str(EXPORT/'stone-turtle-lod.fbx'),use_selection=True,object_types={'MESH','ARMATURE'},add_leaf_bones=False,
 axis_forward='-Z',axis_up='Y',apply_unit_scale=True,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,
 bake_anim_force_startend_keying=True,bake_anim_simplify_factor=0,path_mode='COPY',embed_textures=True)
write('export-files.json',[{'file':str(p.relative_to(HERE)),'sha256':sha(p),'bytes':p.stat().st_size} for p in EXPORT.iterdir() if p.is_file()])
print('LOD_BUILD_FINISHED',count,flush=True)
