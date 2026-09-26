"""Validate frozen shell-carrier c02 and copy only FBX plus two atlas PNG files."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, shutil
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
DEST = ROOT / 'game/assets/resources/models/enemies/shell-carrier'
EXPECTED = {
    'shell-carrier.fbx': '876bdf8f22583ea8e9f14fff0e07ce906a9cffbbb72ef11b2b01157685983aea',
    'carrier-colour.png': '3323f31e25680d4fab39ba29b758f3d0012f372bf7c4e148747c98132a12067f',
    'carrier-roughness.png': '8355d3e4e53cca0ec1b951ca0c6c98a870d1ceae564ec5684db109d886b99ba1',
}
TAKES = {'idle': (85, 2.8, True), 'walk': (33, 32/30, True),
         'attack': (40, 1.3, False), 'hit': (19, .6, False), 'exit': (34, 1.1, False)}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def rel(path): return path.relative_to(ROOT).as_posix()
def require(value, message):
    if not value: raise RuntimeError(message)

stats = read(HERE/'model-stats.json')
motion = read(HERE/'round-trip-check.json')
sources = read(HERE/'source-check.json')
comparison = read(HERE/'c01-comparison-check.json')
preservation = read(HERE/'reference-preservation.json')
package = read(HERE/'asset-manifest.json')
require(all(r['status'] == 'pass' for r in (motion, sources, comparison, preservation)), 'Prior QA failed')
require(stats['fbx_sha256'] == motion['fbx_sha256'] == EXPECTED['shell-carrier.fbx'], 'FBX evidence mismatch')
require(stats['triangles'] == motion['triangles'] == 15088 and len(motion['bones']) == 17 and len(motion['materials']) == 1, 'Geometry contract changed')
require(comparison['changed_meshes'] == ['Large_carried_fan_shell'] and len(comparison['unchanged_meshes']) == 30, 'Unexpected part change')
for field in ('rig_exactly_unchanged', 'five_actions_exactly_unchanged', 'material_nodes_exactly_unchanged', 'studio_lighting_exactly_unchanged'):
    require(comparison[field], 'c01 preservation failed: ' + field)
require(comparison['maximum_shell_bound_error_m'] == 0, 'Shell size changed')
require(sha(ROOT/package['generator']) == package['generator_sha256'], 'Packaged generator changed')
for name, digest in preservation['files'].items(): require(sha(ROOT/name) == digest, 'Protected c01 changed: ' + name)
for name, entry in sources['files'].items(): require(sha(HERE/name) == entry['sha256'], 'Editable source changed: ' + name)
require(set(stats['clips']) == set(motion['clips']) == set(TAKES), 'Expected five clips')
for name, (last, seconds, loop) in TAKES.items():
    a, b = stats['clips'][name], motion['clips'][name]
    require(a['name'] == 'ShellCarrier_Rig|' + name and a['first'] == b['first'] == 1 and a['last'] == b['last'] == last, 'Take name/range mismatch')
    require(abs(a['seconds'] - seconds) < 1e-6 and abs(b['seconds'] - seconds) < 1e-6 and b['loop'] == loop, 'Take duration mismatch')
    require(b['samples'] == (last-1)*2+1 and b['maximum_vertex_motion_m'] > .001 and b['minimum_z_m'] > -.002, 'Invalid action sample')
    if name != 'exit': require(b['first_last_seam_m'] < .0001, 'Action reset changed')
require(sum(c['samples'] for c in motion['clips'].values()) == 417, 'Missing samples')
for name, digest in EXPECTED.items():
    require(sha(HERE/'export'/name) == digest, 'Frozen export changed: ' + name)
    if (DEST/name).exists(): require(sha(DEST/name) == digest, 'Different runtime payload already exists: ' + name)

fbx = (HERE/'export/shell-carrier.fbx').read_bytes()
embedded = {}
gray = []
for name in ('carrier-colour.png', 'carrier-roughness.png'):
    blob = (HERE/'export'/name).read_bytes()
    offset = fbx.find(blob)
    require(offset >= 0, 'Exact PNG bytes missing from FBX: ' + name)
    require(EXPECTED[name] == comparison['atlas_bytes_unchanged'][name], 'Atlas differs from frozen c01')
    with Image.open(HERE/'export'/name) as im:
        require(im.size == (512, 512), 'Wrong atlas size')
        rgba = im.convert('RGBA').tobytes()
        require(set(rgba[3::4]) == {255}, 'Unexpected alpha')
        if name == 'carrier-roughness.png':
            require(rgba[0::4] == rgba[1::4] == rgba[2::4], 'Roughness not grayscale')
            gray = sorted(set(rgba[1::4]))
    embedded[name] = {'sha256': EXPECTED[name], 'bytes': len(blob), 'exact_png_byte_offset': offset}

lo, hi = stats['bounds_blender_xyz']['min'], stats['bounds_blender_xyz']['max']
bounds = {'min': [lo[0], lo[2], -hi[1]], 'max': [hi[0], hi[2], -lo[1]]}
dimensions = [bounds['max'][i]-bounds['min'][i] for i in range(3)]
peak = max(motion['clips'][n]['maximum_z_m'] for n in ('idle', 'walk', 'attack', 'hit'))
manifest_path = HERE/'promotion-manifest.json'
if manifest_path.exists():
    require(read(manifest_path)['runtime_sha256'] == EXPECTED['shell-carrier.fbx'], 'Different promotion already recorded')
    require(all((DEST/name).is_file() for name in EXPECTED), 'Promotion incomplete')
else:
    directory_created = not DEST.exists()
    DEST.mkdir(parents=True, exist_ok=True)
    files = []
    for name in ('carrier-colour.png', 'carrier-roughness.png', 'shell-carrier.fbx'):
        target = DEST/name
        created = not target.exists()
        if created: shutil.copyfile(HERE/'export'/name, target)
        require(sha(target) == EXPECTED[name], 'Destination hash mismatch')
        files.append({'path': rel(target), 'source_path': rel(HERE/'export'/name), 'sha256': EXPECTED[name],
                      'bytes': target.stat().st_size, 'created_by_this_run': created})
    manifest = {
        'version': 'shell-carrier-candidate-02', 'promoted_at_utc': datetime.now(timezone.utc).isoformat(),
        'status': 'approved frozen runtime candidate; actual Cocos import/render/performance acceptance pending',
        'authorization': 'Parent actually viewed c02 three-quarter render, accepted rounded edge/shallow pleats and explicitly authorized runtime promotion after bounded-source QA.',
        'enemy_kind': 'elite', 'display_name': '搬壳大蟹', 'runtime_directory': rel(DEST),
        'runtime_directory_created_by_this_run': directory_created, 'runtime_sha256': EXPECTED['shell-carrier.fbx'],
        'runtime_files': files, 'copied_frozen_bytes': True, 'meta_authored': False,
        'fbx_subasset_uuids_authored': False, 'cocos_started': False, 'blender_started_for_promotion': False,
        'provenance_final_check': {'half_frame_samples': 417, 'source_and_fbx_hashes_match': True,
            'five_clip_names_ranges_durations_match': True, 'only_shell_mesh_changed_from_c01': True,
            'other_30_parts_rig_actions_material_lighting_unchanged': True,
            'atlas_bytes_embedded_and_match_c01': True, 'c01_all_recorded_bytes_preserved': True,
            'generator_hash_matches_package': True},
        'source_hashes': {rel(HERE/name): sha(HERE/name) for name in ('shell-carrier.blend', 'shell-carrier-review-scene.blend',
            'shell-carrier.glb', 'model-stats.json', 'round-trip-check.json', 'source-check.json',
            'c01-comparison-check.json', 'reference-preservation.json', 'asset-manifest.json')},
        'embedded_pngs': embedded, 'geometry': {'triangles': 15088, 'vertices': 7606, 'meshes': 1, 'materials': 1, 'bones': 17},
        'clips': {name: {'expected_cocos_take': 'ShellCarrier_Rig|'+name, 'first': 1, 'last': last,
            'seconds': seconds, 'loop': loop, 'observed_blender_roundtrip_name': motion['clips'][name]['imported_action_name']}
            for name, (last, seconds, loop) in TAKES.items()},
        'coordinate_handoff': {'source': 'Blender Z up / -Y forward', 'fbx_export': 'axis_forward=-Z / axis_up=Y',
            'expected_cocos_forward': '+Z; confirm first actual import', 'recommended_model_uniform_scale': 1.0,
            'expected_cocos_bounds_at_scale_xyz': bounds, 'expected_cocos_dimensions_width_height_depth': dimensions,
            'foot_origin_y': 0, 'road_actor_y': .064, 'root_motion': False, 'standing_action_peak_y_at_scale': peak,
            'health_bar_local_on_unscaled_actor': {'position': [0, 1.36, 0], 'suggested_width': .80},
            'control_icon_local_on_unscaled_actor': [0, 1.26, 0],
            'bounds_status': 'Calculated from validated source and established axis contract; actual importer bounds not yet measured'},
        'expected_import': {'prefab_resource_path': 'models/enemies/shell-carrier/shell-carrier/shell-carrier',
            'path_status': 'Established FBX filename/sub-prefab convention; confirm first generated Cocos metadata',
            'material_name_prefix': 'ShellCarrier_Toy_Atlas', 'colour_image_prefix': 'ShellCarrier_Colour_',
            'roughness_image_prefix': 'ShellCarrier_Roughness_', 'colour': 'sRGB mainTexture',
            'roughness': 'linear grayscale; imported shininessExponentMap -> native Standard pbrMap G',
            'roughness_gray_u8': gray, 'roughness_alpha_u8': 255,
            'native_standard_starting_values': {'roughness': 1, 'metallic': 0, 'occlusion': 0,
                'specularIntensity': .5, 'mainColor': [255, 255, 255, 255], 'albedoScale': [1, 1, 1]}},
        'control_notes': ['Scale only the model child at 1.0; do not apply the old placeholder elite 1.3 factor.',
            'Keep unscaled actor coordinates for the suggested health bar and control icon; validate screen overlap in actual combat.',
            'Walk is in-place; movement speed .6 and collision/path positions remain core-driven.',
            'Trigger the 1.3 second attack from existing battle events; preserve interval 1.5, melee range .9 and current damage rules.',
            'The carried shell is appearance only; no new throw, block or counter mechanic.',
            'Keep actor until authored 1.1 second exit finishes; avoid extra placeholder shrink over the skinned exit.',
            'Five clip suffixes are exact; importer may normalize the take prefix.'],
        'rollback': 'Verify the three recorded runtime SHA values before removing only these promoted payloads; c01/c02 sources remain intact. Inspect later importer metadata before altering it.'}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
for name, digest in EXPECTED.items(): require(sha(DEST/name) == digest, 'Final destination mismatch')
for name, digest in preservation['files'].items(): require(sha(ROOT/name) == digest, 'c01 changed during promotion')
print(json.dumps({'status': 'shell-carrier-c02-promoted-frozen',
    'prefab': 'models/enemies/shell-carrier/shell-carrier/shell-carrier', 'files': EXPECTED,
    'scale': 1.0, 'dimensions_width_height_depth': dimensions, 'bar_local': [0, 1.36, 0],
    'control_local': [0, 1.26, 0], 'standing_action_peak_y': peak, 'c01_preserved': True}, indent=2))
