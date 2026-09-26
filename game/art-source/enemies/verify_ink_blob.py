"""Verify the ink blob FBX and packed source assets with Blender 4.5.

Run with Blender, for example:
  blender --background --factory-startup --python-exit-code 1 \
    --python game/art-source/enemies/verify_ink_blob.py
An optional -- --candidate-dir PATH selects another candidate directory.
The source .blend files are opened for inspection only and are never saved.
"""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


EXPECTED_BONES = {
    "root", "body", "crown", "face", "foot_LF", "foot_RF",
    "foot_LR", "foot_RR", "tail",
}
EXPECTED_CLIPS = ("idle", "walk", "attack", "hit", "exit")
LOOP_CLIPS = {"idle", "walk"}
MOTION_EPSILON = 0.001
SEAM_EPSILON = 0.0001
SPHERICAL_EYE_VERSION = "ink-blob-sample-02"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_report(path, report):
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def assign_action(rig, action):
    """Assign the imported action and its Blender 4.5 action slot."""
    animation = rig.animation_data_create()
    animation.use_nla = False
    animation.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    animation.action = action
    if len(action.slots):
        object_slots = [slot for slot in action.slots
                        if slot.target_id_type == "OBJECT"]
        matching = [slot for slot in object_slots if rig.name in slot.identifier]
        animation.action_slot = (matching or object_slots or list(action.slots))[0]


def sample_frames(first, last):
    """Use 33 distributed samples plus integer frames for ordinary short clips."""
    frames = {first, last}
    frames.update(first + (last - first) * i / 32 for i in range(33))
    if last - first <= 300:
        frames.update(float(frame) for frame in
                      range(math.ceil(first), math.floor(last) + 1))
    return sorted(frames)


def snapshot(mesh, frame):
    whole_frame = math.floor(frame)
    bpy.context.scene.frame_set(whole_frame, subframe=frame - whole_frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data = evaluated.to_mesh()
    try:
        local = [vertex.co.copy() for vertex in data.vertices]
        world = [evaluated.matrix_world @ vertex for vertex in local]
        require(all(math.isfinite(value) for vertex in world for value in vertex),
                f"Non-finite evaluated vertex at frame {frame}")
        return local, world
    finally:
        evaluated.to_mesh_clear()


def maximum_distance(first, second):
    require(len(first) == len(second), "Animation changed the evaluated vertex count")
    return max(((a - b).length for a, b in zip(first, second)), default=0.0)


def verify_authored_eyeballs(rig):
    """Check the two editable closed eyeballs before export mesh reduction."""
    report = {"status": "fail", "errors": [], "eyes": {}}
    for name in ("Warm_eye_L", "Warm_eye_R"):
        eye = {"status": "fail", "errors": []}
        try:
            mesh = bpy.data.objects.get(name)
            require(mesh is not None and mesh.type == "MESH", f"Missing editable eyeball: {name}")
            eye["vertex_count"] = len(mesh.data.vertices)
            require(eye["vertex_count"] >= 800,
                    f"{name}: expected at least 800 authored eyeball vertices")
            bm = bmesh.new()
            try:
                bm.from_mesh(mesh.data)
                eye["boundary_edge_count"] = sum(edge.is_boundary for edge in bm.edges)
                eye["non_manifold_edge_count"] = sum(not edge.is_manifold for edge in bm.edges)
                eye["signed_volume_m3"] = bm.calc_volume(signed=True) * mesh.matrix_world.determinant()
            finally:
                bm.free()
            require(eye["non_manifold_edge_count"] == 0, f"{name}: eyeball must be a closed manifold")
            require(eye["signed_volume_m3"] > 0, f"{name}: eyeball must have outward winding")
            require(any(modifier.type == "ARMATURE" and modifier.object == rig
                        for modifier in mesh.modifiers), f"{name}: eyeball is not bound to InkBlob_Rig")
            groups = {group.index: group.name for group in mesh.vertex_groups}
            invalid = []
            for vertex in mesh.data.vertices:
                face_weight = sum(assignment.weight for assignment in vertex.groups
                                  if groups.get(assignment.group) == "face")
                other_weight = sum(assignment.weight for assignment in vertex.groups
                                   if groups.get(assignment.group) != "face")
                if (not math.isfinite(face_weight) or not math.isfinite(other_weight)
                        or abs(face_weight - 1.0) > 0.001 or abs(other_weight) > 0.001):
                    invalid.append(vertex.index)
            eye["face_weighted_vertex_count"] = len(mesh.data.vertices) - len(invalid)
            eye["invalid_face_weight_vertex_indices"] = invalid
            require(not invalid, f"{name}: every eyeball vertex must be weighted fully to face")
        except Exception as error:
            eye["errors"].append(f"{type(error).__name__}: {error}")
        if not eye["errors"]:
            eye["status"] = "pass"
        report["eyes"][name] = eye
        report["errors"].extend(eye["errors"])
    if not report["errors"]:
        report["status"] = "pass"
    return report


def verify_surface_orientation(rig, meshes, version=None):
    """Inspect actual evaluated triangles, including the merged FBX/review mesh.

    Atlas tile 0 is exclusively the continuous body. Candidate 01 uses tiles
    5/6 for separate iris/pupil geometry; candidate 02 uses one closed eyeball
    per side with all painted eye features on tile 4 of its shared atlas.
    No generator helper or authored normal is used to establish orientation.
    """
    spherical_eyes = version == SPHERICAL_EYE_VERSION
    report = {"status": "fail", "errors": [], "eye_rays": {},
              "eye_geometry_mode": "single_sphere_atlas" if spherical_eyes else "layered_geometry"}
    try:
        idle = next(action for action in bpy.data.actions
                    if action.name.rsplit("|", 1)[-1] == "idle")
        assign_action(rig, idle)
        first = float(idle.frame_range[0])
        frame = math.floor(first)
        bpy.context.scene.frame_set(frame, subframe=first - frame)
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        vertices = []
        triangles = {tile: [] for tile in ((0, 4) if spherical_eyes else (0, 5, 6))}
        for mesh in meshes:
            evaluated = mesh.evaluated_get(depsgraph)
            data = evaluated.to_mesh()
            try:
                uv = data.uv_layers.active
                require(uv is not None, f"{mesh.name}: missing UV for surface identification")
                offset = len(vertices)
                vertices.extend(evaluated.matrix_world @ vertex.co for vertex in data.vertices)
                data.calc_loop_triangles()
                for triangle in data.loop_triangles:
                    tiles = {math.floor(uv.data[index].uv.x * 4)
                             + 4 * math.floor(uv.data[index].uv.y * 4)
                             for index in triangle.loops}
                    if len(tiles) == 1:
                        tile = next(iter(tiles))
                        if tile in triangles:
                            triangles[tile].append(tuple(offset + index for index in triangle.vertices))
            finally:
                evaluated.to_mesh_clear()
        require(all(triangles.values()),
                "Missing body or eyeball atlas geometry" if spherical_eyes
                else "Missing body, iris, or pupil atlas geometry")
        volume = sum(vertices[a].dot(vertices[b].cross(vertices[c])) / 6.0
                     for a, b, c in triangles[0])
        report["body_identification"] = "Continuous_ink_body: atlas tile 0"
        report["body_triangle_count"] = len(triangles[0])
        report["body_signed_volume_m3"] = volume
        if not volume > 0:
            report["errors"].append(f"Continuous body has inward winding: signed volume {volume}")
        trees = {tile: BVHTree.FromPolygons(vertices, faces, all_triangles=True)
                 for tile, faces in triangles.items()}
        for side, x in (("L", -.205), ("R", .205)):
            if spherical_eyes:
                eye_indices = {index for triangle in triangles[4] for index in triangle
                               if (vertices[index].x < 0) == (side == "L")}
                require(eye_indices, f"Missing {side} eyeball atlas vertices")
                center = sum((vertices[index] for index in eye_indices), Vector()) / len(eye_indices)
                origin = Vector((center.x, -3, center.z))
            else:
                origin = Vector((x, -3, .585))
            direction = Vector((0, 1, 0))
            eye = {"origin": list(origin), "direction": list(direction)}
            if spherical_eyes:
                eye["eyeball_vertex_center"] = list(center)
            ray_targets = (("body", 0), ("eyeball", 4)) if spherical_eyes else (("body", 0), ("iris", 5), ("pupil", 6))
            for label, tile in ray_targets:
                position, normal, _, distance = trees[tile].ray_cast(origin, direction)
                require(position is not None, f"{side} eye ray misses {label}")
                eye[label] = {"position": list(position), "normal": list(normal),
                              "distance_m": distance}
            report["eye_rays"][side] = eye
            if eye["body"]["normal"][1] >= 0:
                report["errors"].append(f"{side} eye body surface normal must face -Y")
            for label in (("eyeball",) if spherical_eyes else ("iris", "pupil")):
                clearance = eye["body"]["distance_m"] - eye[label]["distance_m"]
                eye[label]["clearance_in_front_of_body_m"] = clearance
                if clearance <= SEAM_EPSILON:
                    report["errors"].append(f"{side} {label} is buried in the body "
                                            f"(front clearance {clearance} m)")
    except Exception as error:
        report["errors"].append(f"{type(error).__name__}: {error}")
    if not report["errors"]:
        report["status"] = "pass"
    return report


def verify_clip(rig, mesh, action, fps):
    assign_action(rig, action)
    first, last = map(float, action.frame_range)
    require(last > first, f"{action.name}: empty animation range")
    frames = sample_frames(first, last)
    first_local, first_world = snapshot(mesh, first)
    minimum_z = min(vertex.z for vertex in first_world)
    minimum_frame = first
    local_motion = 0.0
    world_motion = 0.0
    movement_frame = first
    last_world = first_world
    for frame in frames[1:]:
        local, world = snapshot(mesh, frame)
        local_motion = max(local_motion, maximum_distance(first_local, local))
        movement = maximum_distance(first_world, world)
        if movement > world_motion:
            world_motion = movement
            movement_frame = frame
        sample_minimum = min(vertex.z for vertex in world)
        if sample_minimum < minimum_z:
            minimum_z = sample_minimum
            minimum_frame = frame
        last_world = world
    seam = maximum_distance(first_world, last_world)
    clip_name = action.name.rsplit("|", 1)[-1]
    errors = []
    if local_motion <= MOTION_EPSILON:
        errors.append(f"{clip_name}: no meaningful skinned vertex deformation "
                      f"({local_motion:.9f} m)")
    if clip_name in LOOP_CLIPS and seam >= SEAM_EPSILON:
        errors.append(f"{clip_name}: full-mesh loop seam {seam:.9f} m "
                      f"must be below {SEAM_EPSILON} m")
    return {
        "action_name": action.name,
        "status": "fail" if errors else "pass",
        "errors": errors,
        "first": first,
        "last": last,
        "seconds": (last - first) / fps,
        "sample_count": len(frames),
        "sample_frames": frames,
        "max_vertex_motion_m": world_motion,
        "max_local_vertex_deformation_m": local_motion,
        "max_motion_frame": movement_frame,
        "loop_required": clip_name in LOOP_CLIPS,
        "loop_seam_m": seam,
        "sampled_min_z_m": minimum_z,
        "sampled_min_z_frame": minimum_frame,
    }


def verify_fbx(candidate):
    fbx = candidate / "export" / "ink-blob.fbx"
    report = {
        "fbx_round_trip": "fail",
        "fbx_path": str(fbx),
        "blender_version": bpy.app.version_string,
        "motion_epsilon_m": MOTION_EPSILON,
        "loop_seam_epsilon_m": SEAM_EPSILON,
        "clips": {},
        "errors": [],
    }
    try:
        require(fbx.is_file(), f"Missing FBX: {fbx}")
        report["fbx_sha256"] = sha256(fbx)
        stats_path = candidate / "model-stats.json"
        stats = json.loads(stats_path.read_text(encoding="utf-8-sig"))
        report["source_version"] = stats.get("version")
        report["model_stats_sha256"] = sha256(stats_path)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps = 30
        bpy.context.scene.render.fps_base = 1.0
        bpy.ops.import_scene.fbx(filepath=str(fbx), use_anim=True)
        rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        require(len(rigs) == 1, f"Expected one armature, found {len(rigs)}")
        require(len(meshes) == 1, f"Expected one mesh, found {len(meshes)}")
        rig, mesh = rigs[0], meshes[0]
        mesh.data.calc_loop_triangles()
        report.update({
            "rig_name": rig.name,
            "mesh_name": mesh.name,
            "bone_count": len(rig.data.bones),
            "bone_names": sorted(bone.name for bone in rig.data.bones),
            "vertex_count": len(mesh.data.vertices),
            "triangle_count": len(mesh.data.loop_triangles),
            "material_count": len(mesh.data.materials),
            "uv_layers": len(mesh.data.uv_layers),
        })
        require(rig.name == "InkBlob_Rig", f"Unexpected rig name: {rig.name}")
        require(set(report["bone_names"]) == EXPECTED_BONES,
                f"Unexpected bones: {report['bone_names']}")
        require(len(mesh.data.vertices) > 0, "Imported mesh is empty")
        require(len(mesh.data.materials) == 1 and mesh.data.materials[0] is not None,
                "Expected exactly one populated mesh material slot")
        skin_modifiers = [modifier for modifier in mesh.modifiers
                          if modifier.type == "ARMATURE" and modifier.object == rig]
        require(len(skin_modifiers) == 1, "Expected one armature modifier targeting the rig")
        uv = mesh.data.uv_layers.active
        require(uv is not None and len(uv.data) == len(mesh.data.loops),
                "Missing or incomplete active UV layer")
        require(all(math.isfinite(value) for entry in uv.data for value in entry.uv),
                "UV layer contains non-finite coordinates")
        deform_bones = {bone.name for bone in rig.data.bones if bone.use_deform}
        group_names = {group.index: group.name for group in mesh.vertex_groups}
        invalid_weights = []
        weight_sums = []
        for vertex in mesh.data.vertices:
            weights = [assignment.weight for assignment in vertex.groups
                       if group_names.get(assignment.group) in deform_bones]
            total = sum(weights)
            weight_sums.append(total)
            if (not weights or any(not math.isfinite(weight) or weight < 0 for weight in weights)
                    or abs(total - 1.0) > 0.001):
                invalid_weights.append(vertex.index)
        report["weighted_vertex_count"] = len(mesh.data.vertices) - len(invalid_weights)
        report["invalid_weight_vertex_count"] = len(invalid_weights)
        report["invalid_weight_vertex_indices"] = invalid_weights
        report["weight_sum_min"] = min(weight_sums)
        report["weight_sum_max"] = max(weight_sums)
        require(not invalid_weights,
                f"{len(invalid_weights)} vertices lack normalized deform-bone weights")
        actions = {}
        for action in bpy.data.actions:
            name = action.name.rsplit("|", 1)[-1]
            if name in EXPECTED_CLIPS:
                require(name not in actions, f"Duplicate exported clip: {name}")
                actions[name] = action
        report["imported_action_names"] = sorted(action.name for action in bpy.data.actions)
        require(set(actions) == set(EXPECTED_CLIPS),
                f"Expected five clips; found {sorted(actions)}")
        scene = bpy.context.scene
        fps = scene.render.fps / scene.render.fps_base
        report["frames_per_second"] = fps
        orientation = verify_surface_orientation(rig, [mesh], stats.get("version"))
        report["surface_orientation"] = orientation
        report["errors"].extend(orientation["errors"])
        for clip in EXPECTED_CLIPS:
            try:
                result = verify_clip(rig, mesh, actions[clip], fps)
                report["clips"][clip] = result
                report["errors"].extend(result["errors"])
            except Exception as error:
                message = f"{clip}: {type(error).__name__}: {error}"
                report["clips"][clip] = {"status": "fail", "errors": [message]}
                report["errors"].append(message)
    except Exception as error:
        report["errors"].append(f"{type(error).__name__}: {error}")
    if not report["errors"]:
        report["fbx_round_trip"] = "pass"
    write_report(candidate / "round-trip-check.json", report)
    return not report["errors"]


def verify_sources(candidate):
    report = {"source_check": "fail", "files": {}, "errors": []}
    try:
        stats = json.loads((candidate / "model-stats.json").read_text(encoding="utf-8-sig"))
        version = stats.get("version")
        report["source_version"] = version
    except Exception as error:
        report["errors"].append(f"Cannot read source version: {type(error).__name__}: {error}")
        write_report(candidate / "source-check.json", report)
        return False
    for filename in ("ink-blob.blend", "ink-blob-review-scene.blend"):
        path = candidate / filename
        entry = {"path": str(path), "status": "fail", "textures": [], "errors": []}
        before = None
        try:
            require(path.is_file(), f"Missing editable source: {path}")
            before = sha256(path)
            entry["sha256_before"] = before
            bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
            for texture in bpy.data.images:
                if texture.source == "VIEWER" or texture.type in {"RENDER_RESULT", "COMPOSITING"}:
                    continue
                packed = texture.packed_file is not None
                entry["textures"].append({
                    "name": texture.name,
                    "source": texture.source,
                    "filepath": texture.filepath,
                    "packed_file": packed,
                    "size": list(texture.size),
                })
                if not packed:
                    entry["errors"].append(f"Texture is not packed: {texture.name}")
            entry["texture_count"] = len(entry["textures"])
            require(entry["texture_count"] > 0, "Source contains no texture images to verify")
            rig = bpy.data.objects.get("InkBlob_Rig")
            require(rig is not None and rig.type == "ARMATURE", "Source has no InkBlob_Rig")
            meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"
                      and any(modifier.type == "ARMATURE" and modifier.object == rig
                              for modifier in obj.modifiers)]
            require(meshes, "Source contains no skinned model meshes")
            orientation = verify_surface_orientation(rig, meshes, version)
            entry["surface_orientation"] = orientation
            entry["errors"].extend(orientation["errors"])
            if version == SPHERICAL_EYE_VERSION and filename == "ink-blob.blend":
                eyeballs = verify_authored_eyeballs(rig)
                entry["authored_eyeballs"] = eyeballs
                entry["errors"].extend(eyeballs["errors"])
        except Exception as error:
            entry["errors"].append(f"{type(error).__name__}: {error}")
        finally:
            if before is not None:
                after = sha256(path)
                entry["sha256_after"] = after
                entry["source_unchanged"] = before == after
                if before != after:
                    entry["errors"].append("Source .blend file changed during verification")
        if not entry["errors"]:
            entry["status"] = "pass"
        report["files"][filename] = entry
        report["errors"].extend(f"{filename}: {error}" for error in entry["errors"])
    if not report["errors"]:
        report["source_check"] = "pass"
    write_report(candidate / "source-check.json", report)
    return not report["errors"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-dir", type=Path,
                        default=Path(__file__).resolve().parent / "ink-blob" / "candidate-01")
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    candidate = parser.parse_args(arguments).candidate_dir.resolve()
    require(candidate.is_dir(), f"Missing candidate directory: {candidate}")
    fbx_ok = verify_fbx(candidate)
    source_ok = verify_sources(candidate)
    require(fbx_ok and source_ok,
            "Ink blob verification failed; inspect round-trip-check.json and source-check.json")
    print("INK_BLOB_VERIFICATION_PASS", flush=True)


if __name__ == "__main__":
    main()
