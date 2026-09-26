"""Verify c12 packed source + round-trip six FBX clips, then render key poses.

Run Blender -b -t 2 --python-exit-code 1 --python THIS_FILE [-- --no-render].
Writes only this candidate directory. Does not promote or change the model.
"""
import bpy
import bmesh
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
manifest = json.loads((HERE / 'candidate-manifest.json').read_text(encoding='utf-8'))
def verify_protected():
    for path, digest in manifest['protected_inputs'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, ('protected input changed', path)
verify_protected()
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'stone-turtle.blend'))
rig = next(ob for ob in bpy.context.scene.objects if ob.type == 'ARMATURE')
parts = [ob for ob in bpy.context.scene.objects if ob.type == 'MESH' and 'bone' in ob]
head = bpy.data.objects['Head_sculpt']
bm = bmesh.new(); bm.from_mesh(head.data)
assert all(edge.is_manifold for edge in bm.edges), 'Head must be a single closed manifold'
bm.free()
images = [image for image in bpy.data.images if image.name.startswith('StoneTurtle_')]
assert len(images) == 2 and all(image.packed_file for image in images), 'Editable source must pack both original textures'
for filename in ['stone-colour.png', 'stone-roughness.png']:
    assert (HERE / 'export' / filename).read_bytes() == (HERE.parent / 'candidate-11/export' / filename).read_bytes()
assert all(abs(sum(group.weight for group in vertex.groups) - 1) < .0001 for ob in parts for vertex in ob.data.vertices)
assert len(rig.data.bones) == 10
front_polygons = set()
for polygon in head.data.polygons:
    center = sum((head.data.vertices[i].co for i in polygon.vertices), Vector()) / len(polygon.vertices)
    if center.y < -1.20 and center.z > .40 and polygon.normal.y < -.15: front_polygons.add(polygon.index)

def action_named(name): return next(action for action in bpy.data.actions if action.name.split('|')[-1] == name)
def select_action(name, frame=1):
    for track in rig.animation_data.nla_tracks: track.mute = True
    action = action_named(name); rig.animation_data.action = action
    if len(action.slots): rig.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame)); bpy.context.view_layer.update()

def bvh(objects, front=False):
    graph = bpy.context.evaluated_depsgraph_get(); vertices, polygons = [], []
    for ob in objects:
        evaluated = ob.evaluated_get(graph); mesh = evaluated.to_mesh(); offset = len(vertices)
        vertices.extend(evaluated.matrix_world @ v.co for v in mesh.vertices)
        for polygon in mesh.polygons:
            if front and polygon.index not in front_polygons: continue
            polygons.append(tuple(offset + index for index in polygon.vertices))
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0)

shell = [ob for ob in parts if ob['bone'] == 'shell']
legs = [ob for ob in parts if ob['bone'].startswith('front_')]
clearance = {'method': 'BVH candidates every half-frame; face polygons rest y<-1.20,z>.40,normal.y<-.15. Back-head/neck embedding excluded; key-pose visual review remains necessary.', 'clips': {}}
for name, last in [('attack', 27), ('hit', 18)]:
    rows = []
    for half in range(2, last * 2 + 1):
        select_action(name, half / 2); face = bvh([head], True)
        rows.append({'frame': half / 2, 'shell': len(face.overlap(bvh(shell))), 'front_legs': len(face.overlap(bvh(legs)))})
    clearance['clips'][name] = {'samples': rows, 'max_shell': max(row['shell'] for row in rows), 'max_front_legs': max(row['front_legs'] for row in rows)}
(HERE / 'animation-clearance.json').write_text(json.dumps(clearance, indent=2), encoding='utf-8')

bpy.ops.wm.read_factory_settings(use_empty=True)
fbx = HERE / 'export/stone-turtle.fbx'
bpy.ops.import_scene.fbx(filepath=str(fbx))
rig = next(ob for ob in bpy.context.scene.objects if ob.type == 'ARMATURE')
mesh_ob = next(ob for ob in bpy.context.scene.objects if ob.type == 'MESH')
expected = {'idle': 72, 'attack': 27, 'skill': 42, 'hit': 18, 'rest': 72, 'fusion': 60}
assert set(action.name.split('|')[-1] for action in bpy.data.actions) == set(expected)
assert len(rig.data.bones) == 10
assert len(mesh_ob.data.materials) == len(mesh_ob.data.uv_layers) == 1
assert all(abs(sum(group.weight for group in vertex.groups) - 1) < .0001 for vertex in mesh_ob.data.vertices)
assert rig.data.bones['head'].head_local.y < rig.data.bones['body'].head_local.y
def sample_vertices():
    evaluated = mesh_ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh = evaluated.to_mesh()
    points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]; evaluated.to_mesh_clear(); return points
report = {'fbx_sha256': hashlib.sha256(fbx.read_bytes()).hexdigest(), 'triangles': sum(len(p.vertices) - 2 for p in mesh_ob.data.polygons),
          'weighted_vertices': len(mesh_ob.data.vertices), 'bones': len(rig.data.bones), 'materials': 1, 'uv_layers': 1,
          'source_head_closed_manifold': True, 'source_packed_textures': 2, 'original_png_bytes_preserved': True, 'clips': {}}
for name, last in expected.items():
    action = action_named(name)
    assert list(action.frame_range) == [1, last], (name, list(action.frame_range))
    select_action(name, 1); start = sample_vertices(); select_action(name, last); end = sample_vertices()
    seam = max((a - b).length for a, b in zip(start, end)); motion = 0; ground = 999
    for half in range(2, last * 2 + 1):
        select_action(name, half / 2); points = sample_vertices()
        motion = max(motion, max((a - b).length for a, b in zip(start, points)))
        ground = min(ground, min(point.z for point in points))
    assert seam < .0001 and motion > .0001, (name, 'loop or motion', seam, motion)
    assert ground > -.003, (name, 'ground penetration', ground)
    report['clips'][name] = {'first': 1, 'last': last, 'seconds': (last - 1) / 30, 'max_vertex_motion_m': motion, 'loop_seam_m': seam, 'minimum_z_m': ground}
(HERE / 'round-trip-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')

bpy.ops.wm.open_mainfile(filepath=str(HERE / 'stone-turtle-review-scene.blend'))
scene = bpy.context.scene; rig = next(ob for ob in scene.objects if ob.type == 'ARMATURE')
scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
scene.render.resolution_x = 800; scene.render.resolution_y = 680; scene.render.resolution_percentage = 100
scene.cycles.samples = 32
if '--no-render' not in sys.argv:
    for action, frame, view in [('attack', 7, 'side'), ('attack', 11, 'three-quarter'), ('hit', 4, 'side'), ('hit', 4, 'three-quarter')]:
        select_action(action, frame)
        location, target = ((6, -.6, 2.5), (0, 0, .91)) if view == 'side' else ((3.6, -5.4, 3), (0, -.12, .91))
        scene.camera.location = location
        scene.camera.rotation_euler = (Vector(target) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(HERE / ('animation-%s-%02d-%s.png' % (action, frame, view)))
        bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'stone-turtle-keypose-review.blend'))
verify_protected()
(HERE / 'review-complete.json').write_text(json.dumps({'protected_inputs_unchanged': True, 'threads': 2,
    'round_trip_clips': 6, 'source_clearance_samples': sum(len(value['samples']) for value in clearance['clips'].values()),
    'rendered_poses': '--no-render' not in sys.argv, 'status': 'One candidate only. Manual review required; no runtime promotion.'}, indent=2), encoding='utf-8')
print('CANDIDATE12_REVIEW_COMPLETE ' + json.dumps({'triangles': report['triangles'], 'clips': 6, 'clearance': {k: [v['max_shell'], v['max_front_legs']] for k, v in clearance['clips'].items()}}))
