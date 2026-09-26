"""Verify editable source, parameter atlas and six exported clips; render views.
Blender -b -t 2 --python-exit-code 1 --python THIS_FILE [-- --quick|--no-render].
Quick mode renders only front/three-quarter, without claiming technical checks.
"""
import ast, bpy, bmesh, hashlib, json, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=json.loads((HERE/'candidate-manifest.json').read_text(encoding='utf-8'))
def protected():
    for path,digest in manifest['protected_inputs'].items():assert sha(ROOT/path)==digest,('protected input changed',path)
protected()
def select_action(name,frame=1):
    action=next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)
    for track in rig.animation_data.nla_tracks:track.mute=True
    rig.animation_data.action=action
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()

quick='--quick' in sys.argv
if not quick:
    bpy.ops.wm.open_mainfile(filepath=str(HERE/'spike-turtle.blend'))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'bone' in o]
    head=bpy.data.objects['Head_sculpt'];bm=bmesh.new();bm.from_mesh(head.data)
    assert all(edge.is_manifold for edge in bm.edges),'Head not closed manifold';bm.free()
    images=[i for i in bpy.data.images if i.name.startswith('SpikeTurtle_')]
    assert len(images)==2 and all(i.packed_file for i in images),'Two packed source textures required'
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for o in parts for v in o.data.vertices),'Weights not normalized'
    # Execute only this local builder's literal parameters and pure atlas function.
    # No builder scene setup is executed, and no rendered PNG is an input.
    source=ROOT/'game/art-source/build_spike_turtle_candidate01.py'
    parsed=ast.parse(source.read_text(encoding='utf-8'))
    selected=[node for node in parsed.body if (isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('PALETTE','ATLAS_PARAMETERS') for t in node.targets)) or (isinstance(node,ast.FunctionDef) and node.name=='build_atlas')]
    assert len(selected)==3
    namespace={'bpy':bpy,'np':np,'Path':Path}
    exec(compile(ast.Module(body=selected,type_ignores=[]),str(source),'exec'),namespace)
    namespace['build_atlas'](HERE/'verification/atlas-rebuild')
    for name in ['spike-colour.png','spike-roughness.png']:
        assert (HERE/'verification/atlas-rebuild'/name).read_bytes()==(HERE/'export'/name).read_bytes(),('Atlas rebuild mismatch',name)

    # Forward facial geometry only: natural neck/back-head embedding excluded.
    front_polygons=set()
    for p in head.data.polygons:
        center=sum((head.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
        if center.y<-1.20 and center.z>.40 and p.normal.y<-.15:front_polygons.add(p.index)
    def bvh(objects,front=False):
        graph=bpy.context.evaluated_depsgraph_get();vertices=[];polygons=[]
        for ob in objects:
            evaluated=ob.evaluated_get(graph);mesh=evaluated.to_mesh();offset=len(vertices)
            vertices.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
            for polygon in mesh.polygons:
                if front and polygon.index not in front_polygons:continue
                polygons.append(tuple(offset+i for i in polygon.vertices))
            evaluated.to_mesh_clear()
        return BVHTree.FromPolygons(vertices,polygons,all_triangles=False,epsilon=0)
    shell=[o for o in parts if o['bone']=='shell'];legs=[o for o in parts if o['bone'].startswith('front_')]
    clearance={'method':'Every half-frame; forward head polygons rest y<-1.20,z>.40,normal.y<-.15. Intentional neck embedding excluded. Not proof at arbitrary continuous times.','clips':{}}
    for name,last in [('attack',27),('skill',42),('hit',18)]:
        rows=[]
        for half in range(2,last*2+1):
            select_action(name,half/2);face=bvh([head],True)
            rows.append({'frame':half/2,'shell':len(face.overlap(bvh(shell))),'front_legs':len(face.overlap(bvh(legs)))})
        clearance['clips'][name]={'max_shell':max(r['shell'] for r in rows),'max_front_legs':max(r['front_legs'] for r in rows),'samples':rows}
    write(HERE/'animation-clearance.json',clearance)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbx=HERE/'export/spike-turtle.fbx';bpy.ops.import_scene.fbx(filepath=str(fbx))
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
    mesh=meshes[0];expected={'idle':72,'attack':27,'skill':42,'hit':18,'rest':72,'fusion':60}
    assert set(a.name.split('|')[-1] for a in bpy.data.actions)==set(expected)
    assert len(rig.data.bones)==10 and len(mesh.data.materials)==len(mesh.data.uv_layers)==1
    assert rig.data.bones['head'].head_local.y<rig.data.bones['body'].head_local.y
    assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in mesh.data.vertices)
    def vertices():
        evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
        points=[evaluated.matrix_world@v.co for v in data.vertices];evaluated.to_mesh_clear();return points
    report={'fbx_sha256':sha(fbx),'triangles':sum(len(p.vertices)-2 for p in mesh.data.polygons),
        'weighted_vertices':len(mesh.data.vertices),'bones':10,'materials':1,'uv_layers':1,
        'packed_source_textures':2,'head_closed_manifold':True,'atlas_rebuild_byte_identical':True,'clips':{}}
    assert report['triangles']<=30000
    for name,last in expected.items():
        action=next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)
        assert list(action.frame_range)==[1,last]
        select_action(name,1);start=vertices();select_action(name,last);end=vertices()
        seam=max((a-b).length for a,b in zip(start,end));motion=0;ground=999
        for half in range(2,last*2+1):
            select_action(name,half/2);points=vertices()
            motion=max(motion,max((a-b).length for a,b in zip(start,points)));ground=min(ground,min(p.z for p in points))
        assert seam<.0001 and motion>.0001,(name,'seam or no motion',seam,motion)
        report['clips'][name]={'first':1,'last':last,'seconds':(last-1)/30,'max_vertex_motion_m':motion,'loop_seam_m':seam,'minimum_z_m':ground}
    write(HERE/'round-trip-check.json',report)
    assert min(v['minimum_z_m'] for v in report['clips'].values())>-.003,'Foot penetration requires correction'
    assert all(v['max_shell']==v['max_front_legs']==0 for v in clearance['clips'].values()),'Facial intersection requires correction'

bpy.ops.wm.open_mainfile(filepath=str(HERE/'spike-turtle-review-scene.blend'))
scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE')
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=32
scene.render.resolution_x=800;scene.render.resolution_y=680;scene.render.resolution_percentage=100
views={'front':((0,-6,2.2),(0,-.12,.92),3.8),'three-quarter':((3.6,-5.4,3),(0,-.12,.95),3.8),
    'side':((6,-.6,2.5),(0,0,.95),3.8),'battle':((4.8,-7.4,8.8),(0,-.05,.75),4.8)}
jobs=[('idle',1,'front','render-front'),('idle',1,'three-quarter','render-three-quarter')]
if not quick:
    jobs += [('idle',1,'side','render-side'),('idle',1,'battle','render-battle'),
        ('attack',7,'side','animation-attack-07-side'),('attack',11,'three-quarter','animation-attack-11-three-quarter'),
        ('skill',18,'three-quarter','animation-skill-18-three-quarter'),('skill',23,'side','animation-skill-23-side'),
        ('hit',4,'three-quarter','animation-hit-04-three-quarter'),('fusion',23,'three-quarter','animation-fusion-23-three-quarter')]
if '--no-render' not in sys.argv:
    for action,frame,view,name in jobs:
        select_action(action,frame);location,target,scale=views[view]
        scene.camera.location=location;scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.camera.data.ortho_scale=scale;scene.render.filepath=str(HERE/(name+'.png'));bpy.ops.render.render(write_still=True)
    if not quick:bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'spike-turtle-keypose-review.blend'))
protected()
write(HERE/('quick-render-complete.json' if quick else 'review-complete.json'),{'status':'Candidate only; actual image review and Cocos review remain required',
    'quick_only':quick,'six_fbx_clips_checked':not quick,'atlas_rebuild_checked':not quick,'protected_inputs_unchanged':True,
    'rendered_files':[name+'.png' for _,_,_,name in jobs] if '--no-render' not in sys.argv else [],'threads':2,'samples':32})
print('SPIKE_REVIEW_COMPLETE '+json.dumps({'quick':quick,'rendered':len(jobs) if '--no-render' not in sys.argv else 0}))
