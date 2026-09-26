"""Read-only geometry/UV/occlusion inspection for the ink blob candidate."""
import bpy
import bmesh
import json
from pathlib import Path
from mathutils import Vector

source = Path(__file__).resolve().parent / 'ink-blob' / 'candidate-01' / 'ink-blob.blend'
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
scene = bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()


def xyz(v):
    return [round(float(n), 9) for n in v]


def info(ob):
    evaluated = ob.evaluated_get(dg)
    world = [evaluated.matrix_world @ v.co for v in evaluated.data.vertices]
    center = sum(world, Vector()) / len(world)
    uv = ob.data.uv_layers.active.data
    tiles = sorted({int(entry.uv.x * 4) + int(entry.uv.y * 4) * 4 for entry in uv})
    return {
        'center': xyz(center),
        'minimum': [min(v[a] for v in world) for a in range(3)],
        'maximum': [max(v[a] for v in world) for a in range(3)],
        'uv_min': [min(entry.uv[a] for entry in uv) for a in range(2)],
        'uv_max': [max(entry.uv[a] for entry in uv) for a in range(2)],
        'uv_tiles': tiles,
        'authored_tile': ob.get('atlas_tile'),
        'bone_weights': {group.name: sorted({round(assignment.weight, 8)
                                             for v in ob.data.vertices for assignment in v.groups
                                             if assignment.group == group.index})
                         for group in ob.vertex_groups},
        'hidden_render': ob.hide_render,
    }


parts = ['Warm_eye_L', 'Amber_iris_L', 'Pupil_L', 'Catchlight_L', 'Small_catchlight_L']
report = {'objects': {name: info(bpy.data.objects[name]) for name in parts}, 'rays': {}}
meshes = [ob for ob in scene.objects if ob.type == 'MESH']
for name in parts:
    center = Vector(report['objects'][name]['center'])
    origin = Vector((center.x, -3, center.z))
    direction = Vector((0, 1, 0))
    hits = []
    for ob in meshes:
        evaluated = ob.evaluated_get(dg)
        inverse = evaluated.matrix_world.inverted()
        local_origin = inverse @ origin
        local_direction = inverse.to_3x3() @ direction
        hit, position, normal, polygon = evaluated.ray_cast(local_origin, local_direction)
        if hit:
            position = evaluated.matrix_world @ position
            hits.append({'object': ob.name, 'hit': xyz(position),
                         'normal': xyz(evaluated.matrix_world.to_3x3() @ normal),
                         'distance': (position - origin).length,
                         'polygon': polygon})
    report['rays'][name + '_center_from_negative_Y'] = sorted(hits, key=lambda hit: hit['distance'])
body = bpy.data.objects['Continuous_ink_body']
hit, point, normal, _ = body.ray_cast(Vector((-.205, -3, .585)), Vector((0, 1, 0)))
report['original_surface_probe'] = {'hit': hit, 'point': xyz(point), 'normal': xyz(normal),
                                    'flattened_eye_normal': xyz(Vector((normal.x * .3, normal.y, normal.z * .25)).normalized())}
bm = bmesh.new()
bm.from_mesh(body.data)
report['body_topology'] = {'signed_volume': bm.calc_volume(signed=True),
                           'boundary_edges': sum(edge.is_boundary for edge in bm.edges),
                           'non_manifold_edges': sum(not edge.is_manifold for edge in bm.edges)}
bm.free()
report['body_surface_probes'] = []
for origin, direction in [((0, -3, .4), (0, 1, 0)), ((0, -3, .7), (0, 1, 0)),
                          ((.205, -3, .585), (0, 1, 0)), ((0, 3, .4), (0, -1, 0)),
                          ((-3, 0, .4), (1, 0, 0)), ((3, 0, .4), (-1, 0, 0))]:
    hit, point, normal, _ = body.ray_cast(Vector(origin), Vector(direction))
    report['body_surface_probes'].append({'origin': origin, 'hit': hit,
                                           'point': xyz(point), 'normal': xyz(normal),
                                           'normal_dot_ray': normal.dot(Vector(direction))})
rig = bpy.data.objects['InkBlob_Rig']
face = rig.pose.bones['face']
report['face_bone'] = {'location': xyz(face.location), 'rotation': xyz(face.rotation_euler),
                       'scale': xyz(face.scale), 'matrix_basis': [xyz(row) for row in face.matrix_basis],
                       'matrix': [xyz(row) for row in face.matrix], 'action': rig.animation_data.action.name}
atlas = bpy.data.images['InkBlob_Colour_512']
pixels = list(atlas.pixels)
report['atlas_tile_center_rgba'] = {str(tile): pixels[(((tile // 4) * 128 + 64) * 512 + (tile % 4) * 128 + 64) * 4:
                                                     (((tile // 4) * 128 + 64) * 512 + (tile % 4) * 128 + 64) * 4 + 4]
                                    for tile in [4, 5, 6, 7]}
print('INK_EYE_INSPECTION ' + json.dumps(report, ensure_ascii=False, indent=2), flush=True)
