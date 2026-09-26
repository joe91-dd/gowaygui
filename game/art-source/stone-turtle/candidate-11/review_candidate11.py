"""Read-only v10 control renders and candidate-11 geometry/FBX/animation checks.
All outputs stay beside this script. Run Blender -b -t 2 --python FILE.
"""
import bpy
import json
import math
import hashlib
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE=Path(__file__).resolve().parent
CANON=HERE.parent
ROOT=HERE.parents[3]
VIEWS=[('front',(0,-6,2.2),(0,-.12,.88)),('three-quarter',(3.6,-5.4,3.0),(0,-.12,.91)),('battle',(3.8,-5.2,5.3),(0,-.1,.88))]
protected=[CANON/'stone-turtle.blend',CANON/'stone-turtle-review-scene.blend',ROOT/'game/art-source/build_stone_turtle.py',ROOT/'game/assets/resources/models/stone-turtle/stone-turtle.fbx']
before={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}

def bounds(objects):
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    mn=[min(p[a] for p in points) for a in range(3)];mx=[max(p[a] for p in points) for a in range(3)]
    return {'min':mn,'max':mx,'dimensions':[mx[a]-mn[a] for a in range(3)]}

def measure(path):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'bone' in o]
    head=bounds([o for o in parts if o.name=='Head_sculpt'])
    shell=bounds([o for o in parts if o.name.startswith('Fitted_stone_')])
    hem=bounds([o for o in parts if o['bone']=='shell']);whole=bounds(parts)
    return {'head':head,'main_shell':shell,'shell_with_hem':hem,'whole':whole,
        'head_to_main_shell':head['dimensions'][0]/shell['dimensions'][0],
        'head_to_shell_with_hem':head['dimensions'][0]/hem['dimensions'][0],
        'head_to_whole':head['dimensions'][0]/whole['dimensions'][0],
        'head_width_to_height':head['dimensions'][0]/head['dimensions'][2]}

metrics={'v10':measure(CANON/'stone-turtle.blend'),'candidate11':measure(HERE/'stone-turtle.blend')}
(HERE/'measured-comparison.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')

# Explicitly match the candidate's actual lighting, floor, camera and colour management.
bpy.ops.wm.open_mainfile(filepath=str(HERE/'stone-turtle-review-scene.blend'))
scene=bpy.context.scene
preset={'lights':[{'name':o.name,'type':o.data.type,'location':list(o.location),'rotation':list(o.rotation_euler),'energy':o.data.energy,'color':list(o.data.color),'shape':o.data.shape,'size':o.data.size} for o in scene.objects if o.type=='LIGHT'],
    'world_color':list(scene.world.node_tree.nodes['Background'].inputs[0].default_value),
    'world_strength':scene.world.node_tree.nodes['Background'].inputs[1].default_value,
    'view_transform':scene.view_settings.view_transform,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma,
    'ortho_scale':scene.camera.data.ortho_scale,'resolution':[1000,850],'samples':32,'threads':2,
    'adaptive_threshold':.035,'denoise':True,'floor_color':[.72,.68,.57,1],'floor_roughness':.6,'views':VIEWS}
(HERE/'matched-lighting.json').write_text(json.dumps(preset,indent=2),encoding='utf-8')

def apply_preset():
    scene=bpy.context.scene
    for o in list(scene.objects):
        if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
    for item in preset['lights']:
        light=bpy.data.lights.new(item['name'],item['type']);light.energy=item['energy'];light.color=item['color'];light.shape=item['shape'];light.size=item['size']
        ob=bpy.data.objects.new(item['name'],light);scene.collection.objects.link(ob);ob.location=item['location'];ob.rotation_euler=item['rotation']
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=preset['world_color'];scene.world.node_tree.nodes['Background'].inputs[1].default_value=preset['world_strength']
    for key in ['view_transform','look','exposure','gamma']:setattr(scene.view_settings,key,preset[key])
    floor=scene.objects.get('Studio_floor')
    if floor:
        mat=floor.data.materials[0];shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=preset['floor_color'];shader.inputs['Roughness'].default_value=preset['floor_roughness']
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.035
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=preset['ortho_scale']
    return scene

def action_named(name):
    return next(a for a in bpy.data.actions if a.name.split('|')[-1]==name)

def select_action(name,frame=1):
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for track in rig.animation_data.nla_tracks:track.mute=True
    action=action_named(name);rig.animation_data.action=action
    # Blender 4.5 imported slots have action-specific identifiers; assignment
    # alone can silently leave action_slot=None and produce false static tests.
    if len(action.slots):rig.animation_data.action_slot=action.slots[0]
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
    return rig

def render(path,loc,target):
    scene=bpy.context.scene;scene.camera.location=loc;scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

if '--skip-control' not in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(CANON/'stone-turtle-review-scene.blend'))
    apply_preset();select_action('idle')
    for name,loc,target in VIEWS:render(HERE/('v10-control-'+name+'.png'),loc,target)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'v10-matched-review-scene.blend'))

# Check the forward-facing head surface, not intentional neck/torso embedding.
bpy.ops.wm.open_mainfile(filepath=str(HERE/'stone-turtle.blend'))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'bone' in o]
head=next(o for o in parts if o.name=='Head_sculpt')
front_polygons=set()
for p in head.data.polygons:
    center=sum((head.data.vertices[i].co for i in p.vertices),Vector())/len(p.vertices)
    if center.y<-1.20 and center.z>.40 and p.normal.y<-.15:front_polygons.add(p.index)
shell_parts=[o for o in parts if o['bone']=='shell']
leg_parts=[o for o in parts if o['bone'].startswith('front_')]

def evaluated_bvh(objects,only_front=False):
    dg=bpy.context.evaluated_depsgraph_get();vertices=[];polys=[]
    for ob in objects:
        evaluated=ob.evaluated_get(dg);mesh=evaluated.to_mesh();offset=len(vertices)
        vertices.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
        for p in mesh.polygons:
            if only_front and p.index not in front_polygons:continue
            polys.append(tuple(offset+i for i in p.vertices))
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(vertices,polys,all_triangles=False,epsilon=0)

collision={'method':'BVH triangle-overlap candidates at every half frame. Restricts head to rest-face polygons y<-1.20,z>.40,normal.y<-.15; intentional neck/back-head embedding is excluded. Supplemented by actual key-pose renders; not a continuous-time physics proof.',
    'front_head_polygons':len(front_polygons),'clips':{}}
for name,last in [('attack',27),('hit',18)]:
    samples=[];first_pose=None;pose_change=0
    for half in range(2,2*last+1):
        frame=half/2;rig=select_action(name,frame)
        pose=[value for row in rig.pose.bones['head'].matrix for value in row]
        if first_pose is None:first_pose=pose
        pose_change=max(pose_change,max(abs(a-b) for a,b in zip(first_pose,pose)))
        face=evaluated_bvh([head],True)
        shell_count=len(face.overlap(evaluated_bvh(shell_parts)))
        leg_count=len(face.overlap(evaluated_bvh(leg_parts)))
        samples.append({'frame':frame,'shell_overlap_candidates':shell_count,'front_leg_overlap_candidates':leg_count})
    assert pose_change>.0001,(name,'source action did not move')
    collision['clips'][name]={'samples':samples,'maximum_head_transform_change':pose_change,'maximum_shell_candidates':max(v['shell_overlap_candidates'] for v in samples),'maximum_leg_candidates':max(v['front_leg_overlap_candidates'] for v in samples)}
(HERE/'animation-clearance.json').write_text(json.dumps(collision,indent=2),encoding='utf-8')

# FBX re-import checks the artifact that would be promoted, including skin/clip integrity.
bpy.ops.wm.read_factory_settings(use_empty=True)
fbx=HERE/'export/stone-turtle.fbx';bpy.ops.import_scene.fbx(filepath=str(fbx))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh_ob=next(o for o in bpy.context.scene.objects if o.type=='MESH')
assert len(rig.data.bones)==10
assert set(a.name.split('|')[-1] for a in bpy.data.actions)=={'idle','attack','skill','hit','rest','fusion'}
assert all(abs(sum(g.weight for g in v.groups)-1)<.0001 for v in mesh_ob.data.vertices)
assert len(mesh_ob.data.materials)==1 and len(mesh_ob.data.uv_layers)==1

def sample_vertices():
    ob=mesh_ob.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ob.to_mesh()
    points=[ob.matrix_world@v.co for v in mesh.vertices];ob.to_mesh_clear();return points

roundtrip={'fbx_sha256':hashlib.sha256(fbx.read_bytes()).hexdigest(),'bone_count':len(rig.data.bones),'weighted_vertices':len(mesh_ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in mesh_ob.data.polygons),'materials':len(mesh_ob.data.materials),'uv_layers':len(mesh_ob.data.uv_layers),'clips':{},
    'axis_contract':'Unchanged FBX axis_forward=-Z, axis_up=Y; Blender round-trip forward checked via head-bone placement. Actual Cocos +Z contract uses the existing importer and still requires runtime promotion review.'}
assert rig.data.bones['head'].head_local.y<rig.data.bones['body'].head_local.y
for name in ['idle','attack','skill','hit','rest','fusion']:
    action=action_named(name);first,last=map(float,action.frame_range)
    assert (first,last)==(1,{'idle':72,'attack':27,'skill':42,'hit':18,'rest':72,'fusion':60}[name]),(name,'clip range changed',first,last)
    select_action(name,first);start=sample_vertices();select_action(name,last);end=sample_vertices()
    seam=max((a-b).length for a,b in zip(start,end));motion=0;ground=999
    for index in range(int(first*2),int(last*2)+1):
        select_action(name,index/2);points=sample_vertices();ground=min(ground,min(p.z for p in points));motion=max(motion,max((a-b).length for a,b in zip(start,points)))
    assert seam<.0001,(name,'loop mismatch',seam)
    assert ground>-.003,(name,'ground penetration',ground)
    assert motion>.0001,(name,'static clip')
    roundtrip['clips'][name]={'first':first,'last':last,'seconds':(last-first)/30,'max_vertex_motion_m':motion,'loop_seam_m':seam,'sampled_min_z_m':ground}
(HERE/'round-trip-check.json').write_text(json.dumps(roundtrip,indent=2),encoding='utf-8')

# Render the exported LOD geometry's attack and hurt poses, with smaller diagnostic images.
bpy.ops.wm.open_mainfile(filepath=str(HERE/'stone-turtle-review-scene.blend'))
scene=apply_preset();scene.render.resolution_x=600;scene.render.resolution_y=510;scene.cycles.samples=12
for name,frame,view in [('attack',7,'three-quarter'),('attack',11,'three-quarter'),('attack',17,'three-quarter'),('hit',4,'three-quarter'),('hit',10,'three-quarter'),('attack',7,'side'),('hit',4,'side')]:
    select_action(name,frame)
    loc,target=((6,-.6,2.5),(0,0,.91)) if view=='side' else ((3.6,-5.4,3.0),(0,-.12,.91))
    render(HERE/('animation-%s-%02d-%s.png'%(name,frame,view)),loc,target)

after={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
assert before==after,'Protected v10 data changed'
(HERE/'review-complete.json').write_text(json.dumps({'protected_files_unchanged':True,'sha256':after,'render_threads':2,'status':'Technical checks and candidate images generated; manual visual review still required.'},indent=2),encoding='utf-8')
print('CANDIDATE11_REVIEW_COMPLETE')
