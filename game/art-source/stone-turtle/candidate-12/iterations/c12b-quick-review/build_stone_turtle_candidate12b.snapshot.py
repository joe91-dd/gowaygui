"""Second isolated facial-volume study (c12b) derived from the frozen editable c11 source.

Blender 4.5: -b -t 2 --python-exit-code 1 --python THIS_FILE
Only candidate-12 is written. Original non-eye atlas regions, non-head geometry, skeleton
and all six action curves are preserved; this is not a runtime promotion.
"""
import bpy
import bmesh
import hashlib
import json
import math
import shutil
import sys
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'game/art-source/stone-turtle/candidate-11'
SOURCE = BASE.parent / 'candidate-12/c12b'
OUT = SOURCE / 'export'
SOURCE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
protected = [BASE / 'stone-turtle.blend', BASE / 'stone-turtle-review-scene.blend', BASE / 'export/stone-turtle.fbx',
             ROOT / 'game/art-source/build_stone_turtle_candidate11.py', ROOT / 'game/art-source/build_stone_turtle.py',
             ROOT / 'game/art-source/stone-turtle/stone-turtle.blend', ROOT / 'game/art-source/stone-turtle/stone-turtle-review-scene.blend']
protected += list((ROOT / 'game/assets/resources/models/stone-turtle').glob('*'))
protected = [p for p in protected if p.is_file()]
def hashes(paths):
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
before = hashes(protected)
bpy.ops.wm.open_mainfile(filepath=str(BASE / 'stone-turtle.blend'))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
CHAR = bpy.data.collections['STONE_TURTLE_EDITABLE_PARTS']
parts = [o for o in CHAR.objects if o.type == 'MESH' and 'bone' in o]
materials = [bpy.data.materials.get('StoneAtlas_%02d' % i) for i in range(16)]
old_head = bpy.data.objects['Head_sculpt']
old_min = [min(v.co[a] for v in old_head.data.vertices) for a in range(3)]
old_max = [max(v.co[a] for v in old_head.data.vertices) for a in range(3)]

def mesh_digest(ob):
    value = {'vertices': [list(v.co) for v in ob.data.vertices],
             'faces': [list(p.vertices) for p in ob.data.polygons],
             'uv': [[list(uv.uv) for uv in layer.data] for layer in ob.data.uv_layers],
             'groups': [[(g.group, g.weight) for g in v.groups] for v in ob.data.vertices]}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def action_digest(action):
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    curves.append((curve.data_path, curve.array_index,
                                   [(list(k.co), list(k.handle_left), list(k.handle_right), k.interpolation) for k in curve.keyframe_points]))
    return hashlib.sha256(json.dumps(curves, sort_keys=True).encode()).hexdigest()

unchanged_meshes = {o.name: mesh_digest(o) for o in parts if o['bone'] != 'head'}
unchanged_actions = {a.name: action_digest(a) for a in bpy.data.actions}
unchanged_bones = {b.name: [list(row) for row in b.matrix_local] for b in rig.data.bones}
for ob in list(parts):
    if ob['bone'] == 'head':
        parts.remove(ob)
        bpy.data.objects.remove(ob, do_unlink=True)

# Preserve c11 maps; only the procedural iris tile is warmed in this candidate.
# All body/shell tiles and the complete roughness PNG remain unchanged.
for filename in ['stone-colour.png', 'stone-roughness.png']:
    shutil.copy2(BASE / 'export' / filename, OUT / filename)
for image in bpy.data.images:
    if image.name.startswith('StoneTurtle_Colour'):
        image.filepath = str(OUT / 'stone-colour.png'); image.pack()
    elif image.name.startswith('StoneTurtle_Roughness'):
        image.filepath = str(OUT / 'stone-roughness.png'); image.pack()

# The iris is part of the eyeball UV surface, never a separate raised lens.
# Warm only its annulus, retaining the original cream sclera, black pupil/glints.
colour_image = next(image for image in bpy.data.images if image.name.startswith('StoneTurtle_Colour'))
size = int(colour_image.size[0]); pixels = np.empty(size * size * 4, dtype=np.float32)
colour_image.pixels.foreach_get(pixels); pixels = pixels.reshape((size, size, 4))
original_pixels = pixels.copy(); tile_size = size // 4
zz, xx = np.mgrid[0:tile_size, 0:tile_size].astype(np.float32)
u = (xx + .5) / tile_size; v = (zz + .5) / tile_size
iris_d = np.sqrt(((u - .5) / .415) ** 2 + ((v - .49) / .411) ** 2)
pupil_d = np.sqrt(((u - .5) / .302) ** 2 + ((v - .49) / .314) ** 2)
region = pixels[2*tile_size:3*tile_size, tile_size:2*tile_size, :3]
mask = (iris_d < .97) & (pupil_d > 1.025) & (region.max(axis=2) < .5)
region[mask] += np.array((.100, -.028, -.045), dtype=np.float32)
region[:] = np.clip(region, 0, 1)
assert np.array_equal(pixels[:2*tile_size], original_pixels[:2*tile_size])
colour_image.pixels.foreach_set(pixels.ravel())
colour_image.filepath_raw = str(OUT / 'stone-colour.png'); colour_image.file_format = 'PNG'; colour_image.save(); colour_image.pack()

def objmesh(name, vertices, faces, tile, subdiv=0):
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    ob = bpy.data.objects.new(name, mesh); CHAR.objects.link(ob)
    ob['bone'] = 'head'; ob['atlas_tile'] = tile
    mesh.materials.append(materials[tile])
    for polygon in mesh.polygons: polygon.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    if subdiv:
        modifier = ob.modifiers.new('Continuous_facial_surface', 'SUBSURF'); modifier.levels = subdiv
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.1519, island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    for uv in ob.data.uv_layers.active.data:
        uv.uv = ((tile % 4 + .04 + uv.uv.x * .92) / 4, (tile // 4 + .04 + uv.uv.y * .92) / 4)
    group = ob.vertex_groups.new(name='head'); group.add(list(range(len(ob.data.vertices))), 1, 'REPLACE')
    modifier = ob.modifiers.new('Armature_deformation', 'ARMATURE'); modifier.object = rig
    ob.parent = rig; ob.select_set(False); parts.append(ob)
    return ob

def loft(name, rings, segments=40):
    vertices = []
    for y, rx, rz, cz in rings:
        for j in range(segments):
            angle = 2 * math.pi * j / segments
            ca, sa = math.cos(angle), math.sin(angle)
            vertices.append((rx * math.copysign(abs(ca) ** .91, ca), y,
                             cz + rz * math.copysign(abs(sa) ** .91, sa)))
    faces = []
    for ring in range(len(rings) - 1):
        for j in range(segments):
            faces.append((ring * segments + j, ring * segments + (j + 1) % segments,
                          (ring + 1) * segments + (j + 1) % segments, (ring + 1) * segments + j))
    faces.extend([tuple(range(segments - 1, -1, -1)),
                  tuple((len(rings) - 1) * segments + j for j in range(segments))])
    return objmesh(name, vertices, faces, 12, 2)

# A single closed mesh carries rounded occiput, cheek mass and short blunt muzzle.
# No planar front clamp and no disconnected nose block. Y is forward-negative.
head = loft('Head_sculpt', [(-.900, .052, .061, .820), (-.985, .290, .272, .836),
    (-1.100, .490, .330, .840), (-1.240, .624, .341, .830),
    (-1.365, .605, .313, .806), (-1.460, .533, .267, .790),
    (-1.525, .454, .205, .765), (-1.570, .373, .142, .755),
    (-1.593, .215, .091, .750), (-1.605, .034, .036, .750)])
for vertex in head.data.vertices:
    x, y, z = vertex.co
    front = max(0, min(1, (-y - 1.20) / .19))
    socket = math.exp(-((abs(x) - .325) / .141) ** 2 - ((z - .941) / .142) ** 2)
    cheek = math.exp(-((abs(x) - .422) / .163) ** 2 - ((z - .773) / .150) ** 2)
    muzzle = math.exp(-(x / .428) ** 6 - ((z - .760) / .094) ** 4)
    upper_lip_transition = math.exp(-(x / .415) ** 6 - ((z - .881) / .041) ** 2)
    brow = math.exp(-((abs(x) - .325) / .170) ** 2 - ((z - 1.080) / .079) ** 2)
    vertex.co.y += front * (.047 * socket - .053 * cheek - .112 * muzzle + .013 * upper_lip_transition - .038 * brow)
    vertex.co.z = .75 + (z - .75) * 1.15 - .20
# Exact c11 frontal width and vertical extent; only depth distribution is new.
new_min = [min(v.co[a] for v in head.data.vertices) for a in range(3)]
new_max = [max(v.co[a] for v in head.data.vertices) for a in range(3)]
for vertex in head.data.vertices:
    for axis in [0, 2]:
        vertex.co[axis] = old_min[axis] + (vertex.co[axis] - new_min[axis]) / (new_max[axis] - new_min[axis]) * (old_max[axis] - old_min[axis])
head.data.update()
def face_z(z): return .75 + (z - .75) * 1.15 - .20
def surface(x, z, lift=0):
    hit, point, normal, _ = head.ray_cast(Vector((x, -3, z)), Vector((0, 1, 0)))
    assert hit, ('facial feature outside closed head', x, z)
    return point + Vector((0, -lift, 0)), normal

def ellipsoid(name, center, radii, tile, normal=Vector((0, -1, 0)), segments=48, rings=20):
    rotate = Vector((0, -1, 0)).rotation_difference(normal)
    vertices, faces = [], []
    # Two actual poles, no duplicated zero-area pole rings.
    vertices.append(tuple(center + rotate @ Vector((0, 0, radii[2]))))
    for i in range(1, rings):
        a = math.pi * i / rings
        for j in range(segments):
            b = 2 * math.pi * j / segments
            vertices.append(tuple(center + rotate @ Vector((radii[0] * math.sin(a) * math.cos(b), radii[1] * math.sin(a) * math.sin(b), radii[2] * math.cos(a)))))
    bottom = len(vertices); vertices.append(tuple(center + rotate @ Vector((0, 0, -radii[2]))))
    for j in range(segments): faces.append((0, 1 + j, 1 + (j + 1) % segments))
    for ring in range(rings - 2):
        for j in range(segments):
            a = 1 + ring * segments + j; b = 1 + ring * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    start = 1 + (rings - 2) * segments
    for j in range(segments): faces.append((start + j, bottom, start + (j + 1) % segments))
    return objmesh(name, vertices, faces, tile), rotate

def tube(name, points, radius, tile, sides=12):
    points = [Vector(p) for p in points]; vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        normal = tangent.cross(Vector((0, 1, 0))).normalized(); other = tangent.cross(normal).normalized()
        r = radius * (.22 + .78 * math.sin(math.pi * i / (len(points) - 1)) ** .45)
        for j in range(sides):
            a = 2 * math.pi * j / sides; vertices.append(tuple(point + r * (normal * math.cos(a) + other * math.sin(a))))
    for i in range(len(points) - 1):
        for j in range(sides): faces.append((i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j))
    faces.extend([tuple(range(sides - 1, -1, -1)), tuple((len(points) - 1) * sides + j for j in range(sides))])
    return objmesh(name, vertices, faces, tile)

for sign, label in [(-1, 'L'), (1, 'R')]:
    point, normal = surface(sign * .320, face_z(.945))
    normal = Vector((normal.x * .72, normal.y, normal.z * .62)).normalized()
    radii = (.166, .103, .179); center = point - normal * .024
    eye, rotate = ellipsoid('Eye_white_' + label, center, radii, 9, normal)
    inverse = rotate.inverted()
    for loop in eye.data.loops:
        local = inverse @ (eye.data.vertices[loop.vertex_index].co - center)
        eye.data.uv_layers.active.data[loop.index].uv = ((1 + .5 + .46 * local.x / radii[0] + sign * .025) / 4, (2 + .5 + .46 * local.z / radii[2]) / 4)
    # Rounded eyelid rolls from the true cheek surface into the embedded eyeball.
    # Match outer normals to the head so the skin ring cannot read as a flat disk.
    vertices, faces, normals = [], [], []; segments = 56; rings = 6
    for ring in range(rings):
        t = ring / (rings - 1); ease = t * t * (3 - 2 * t)
        rx = .187 * (1 - t) + .138 * t; rz = .200 * (1 - t) + .154 * t
        for j in range(segments):
            angle = 2 * math.pi * j / segments
            local = Vector((rx * math.cos(angle), 0, rz * math.sin(angle) * (.94 if math.sin(angle) > 0 else 1)))
            p = point + rotate @ local
            skin, skin_normal = surface(p.x, p.z, .0003)
            ball_y = -radii[1] * math.sqrt(max(.008, 1 - (local.x / radii[0]) ** 2 - (local.z / radii[2]) ** 2)) - .002
            bridge = center + rotate @ Vector((local.x, ball_y, local.z))
            bridge.x = p.x; bridge.z = p.z
            # Flesh thickness is concentrated near the inner rim, never a broad washer.
            p = skin.lerp(bridge, ease) + normal * (.003 * math.sin(math.pi * t))
            eye_normal = (rotate @ Vector((local.x / radii[0] ** 2, ball_y / radii[1] ** 2, local.z / radii[2] ** 2))).normalized()
            vertices.append(tuple(p)); normals.append(tuple(skin_normal.lerp(eye_normal, ease).normalized()))
    for ring in range(rings - 1):
        for j in range(segments): faces.append((ring * segments + j, ring * segments + (j + 1) % segments, (ring + 1) * segments + (j + 1) % segments, (ring + 1) * segments + j))
    lid = objmesh('Continuous_eyelid_' + label, vertices, faces, 12)
    lid.data.normals_split_custom_set_from_vertices(normals)
    brow = []
    for j in range(17):
        t = j / 16
        # A reliable curved short brow: low inner end, broad arch, tapered outer tip.
        brow.append(tuple(surface(sign * (.175 + .245 * t), face_z(1.023 + .025 * t + .071 * math.sin(math.pi * t)), .012)[0]))
    tube('Steady_brow_' + label, brow, .058, 12, 16)
    point, normal = surface(sign * .125, face_z(.788), .002)
    ellipsoid('Nostril_' + label, point, (.019, .0045, .012), 8, normal, 20, 12)
mouth = [surface(t * .349, face_z(.657 + .042 * t * t), .002)[0] for t in [-1 + 2 * j / 32 for j in range(33)]]
tube('Friendly_closed_mouth', mouth, .0065, 8, 10)
for sign in [-1, 1]:
    points = [surface(sign * x, face_z(z), .0012)[0] for x, z in [(.346, .699), (.361, .710), (.366, .723)]]
    tube('Cheek_crease_' + str(sign), points, .004, 5, 8)

assert {o.name: mesh_digest(o) for o in parts if o['bone'] != 'head'} == unchanged_meshes
assert {a.name: action_digest(a) for a in bpy.data.actions} == unchanged_actions
assert {b.name: [list(row) for row in b.matrix_local] for b in rig.data.bones} == unchanged_bones

def select_action(name, frame=1):
    action = bpy.data.actions[name]
    for track in rig.animation_data.nla_tracks: track.mute = True
    rig.animation_data.action = action
    if len(action.slots): rig.animation_data.action_slot = action.slots[0]
    scene.frame_set(frame); bpy.context.view_layer.update()

def bounds(objects):
    points = [ob.matrix_world @ v.co for ob in objects for v in ob.data.vertices]
    low = [min(p[a] for p in points) for a in range(3)]; high = [max(p[a] for p in points) for a in range(3)]
    return {'min': low, 'max': high, 'dimensions': [high[a] - low[a] for a in range(3)]}

select_action('idle')
head_bounds = bounds([head]); shell_bounds = bounds([ob for ob in parts if ob.name.startswith('Fitted_stone_')])
assert abs(head_bounds['dimensions'][0] / shell_bounds['dimensions'][0] - .5994055854) < .00001
evidence = {'status': 'Isolated candidate; no runtime or canonical promotion.', 'base': str(BASE.relative_to(ROOT)),
    'head': head_bounds, 'main_shell': shell_bounds, 'head_to_main_shell': head_bounds['dimensions'][0] / shell_bounds['dimensions'][0],
    'non_head_meshes_unchanged': unchanged_meshes, 'six_actions_unchanged': unchanged_actions,
    'skeleton_unchanged': True, 'iris_colour_adjustment': 'Only tile9 iris annulus warmed; original c11 PNG remains in c12a archive and c11 source.',
    'eye_opening_target_fraction': .22, 'eye_inner_lid_diameter_m': .276,
    'muzzle_target_width_m': .856, 'muzzle_target_height_m': .188,
    'candidate_atlas_bytes': hashes([OUT / 'stone-colour.png', OUT / 'stone-roughness.png']),
    'render_threads': 2, 'resolution': [800, 680], 'samples': 16, 'iteration': 'c12b'}
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'stone-turtle.blend'))

# Identical c11 export procedure. Editable parts remain in the source .blend.
bpy.ops.object.select_all(action='DESELECT')
for ob in parts: ob.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); merged = bpy.context.object
merged.name = 'StoneTurtle_SkinnedMesh'; merged.data.materials.clear(); merged.data.materials.append(materials[1])
for p in merged.data.polygons: p.material_index = 0
modifier = merged.modifiers.new('Runtime_LOD_preserve_skinning', 'DECIMATE'); modifier.ratio = .60
bpy.ops.object.modifier_move_up(modifier=modifier.name); bpy.ops.object.modifier_apply(modifier=modifier.name)
rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.fbx(filepath=str(OUT / 'stone-turtle.fbx'), use_selection=True,
    object_types={'MESH', 'ARMATURE'}, add_leaf_bones=False, axis_forward='-Z', axis_up='Y',
    apply_unit_scale=True, bake_anim=True, bake_anim_use_all_actions=True, bake_anim_use_nla_strips=False,
    bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0, path_mode='COPY', embed_textures=True)
bpy.ops.export_scene.gltf(filepath=str(SOURCE / 'stone-turtle.glb'), use_selection=True,
    export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_nla_strips=True, export_yup=True)
evidence.update({'triangles': sum(len(p.vertices) - 2 for p in merged.data.polygons), 'vertices': len(merged.data.vertices),
                 'bones': len(rig.data.bones), 'materials': len(merged.data.materials), 'fbx_sha256': hashlib.sha256((OUT / 'stone-turtle.fbx').read_bytes()).hexdigest()})

# Same neutral studio as c11, at the requested lower diagnostic resolution.
scene.render.engine = 'CYCLES'; scene.cycles.samples = 16; scene.cycles.use_denoising = True
scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = .035
scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
scene.render.resolution_x = 800; scene.render.resolution_y = 680; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True; scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.57, .64, .70, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35; scene.view_settings.view_transform = 'AgX'
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001)); floor = bpy.context.object; floor.name = 'Studio_floor'
material = bpy.data.materials.new('Warm_ivory_floor'); material.use_nodes = True
bsdf = material.node_tree.nodes['Principled BSDF']; bsdf.inputs['Base Color'].default_value = (.72, .68, .57, 1); bsdf.inputs['Roughness'].default_value = .6
floor.data.materials.append(material)
for name, location, power, size, colour in [('Key', (-3, -4, 6), 650, 4, (1, .91, .74)), ('Fill', (4, -1, 3), 400, 3, (.78, .90, 1)), ('Rim', (1, 4, 5), 800, 3, (1, .96, .84))]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = size; data.color = colour
    light = bpy.data.objects.new(name, data); scene.collection.objects.link(light); light.location = location
    light.rotation_euler = (Vector((0, 0, .7)) - light.location).to_track_quat('-Z', 'Y').to_euler()
data = bpy.data.cameras.new('ArtReviewCamera'); camera = bpy.data.objects.new('ArtReviewCamera', data)
scene.collection.objects.link(camera); scene.camera = camera; data.type = 'ORTHO'; data.ortho_scale = 3.6
views = [('front', (0, -6, 2.2), (0, -.12, .88)), ('three-quarter', (3.6, -5.4, 3), (0, -.12, .91)), ('side', (6, -.6, 2.5), (0, 0, .91))]
if '--no-render' not in sys.argv:
    for name, location, target in views[:2]:
        camera.location = location; camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(SOURCE / ('render-' + name + '.png')); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'stone-turtle-review-scene.blend'))
after = hashes(protected); assert before == after, 'Protected c11/canonical/runtime files changed'
evidence['protected_inputs'] = after; evidence['protected_files_unchanged'] = True
(SOURCE / 'candidate-manifest.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding='utf-8')
print('CANDIDATE12B_QUICK_VIEWS_COMPLETE ' + json.dumps({k: evidence[k] for k in ['triangles', 'vertices', 'head_to_main_shell', 'fbx_sha256']}))


