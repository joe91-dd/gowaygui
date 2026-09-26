"""Promote the reviewed c11 bytes, verify them, or restore the archived v10 bytes.

No Blender/Cocos invocation. Run from any working directory. The default is
read-only verification; mutations require an explicit promote/rollback command.
"""
import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE.parent
RUNTIME = ROOT / 'game/assets/resources/models/stone-turtle'
ARCHIVE = SOURCE / 'versions/v10'
MANIFEST = SOURCE / 'promotion-manifest.json'
RECEIPT = HERE / 'promotion-manifest.json'
UUID = '5d7d68a1-9672-41e8-a0ad-05d7a87185f7'
PAYLOADS = ('stone-colour.png', 'stone-roughness.png', 'stone-turtle.fbx')
RUNTIME_NAMES = tuple(name + suffix for name in PAYLOADS for suffix in ('', '.meta'))
EXPECTED_OLD = {
    'stone-turtle.fbx': '8b8f0c56b2be36e8fa1fb082a253cc34271cf53d6983001f78f61ce4eb38260d',
    'stone-colour.png': '68e22dd052641ee72a2775d4041ec0683d2437db116364fc8e05aeb54f904746',
    'stone-roughness.png': '8fb7f0157aebcd620a6f6535ef04d7307412aea09c553b64e1957335b8b52434',
}
EXPECTED_NEW = {
    'stone-turtle.fbx': '9bc1cc37580ad3cb1c9fb57e2f54bf574fc7bac129befb1f7b08f60027d836a7',
    'stone-colour.png': '331db30651c09e8930435b91bf78b7e714b13d6852e488c82a67233bad66ea57',
    'stone-roughness.png': '8fb7f0157aebcd620a6f6535ef04d7307412aea09c553b64e1957335b8b52434',
}
CANONICAL = (
    ROOT / 'game/art-source/build_stone_turtle.py',
    SOURCE / 'stone-turtle.blend',
    SOURCE / 'stone-turtle-review-scene.blend',
    SOURCE / 'stone-turtle.glb',
)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path):
    return path.relative_to(ROOT).as_posix()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def ensure(condition, message):
    if not condition:
        raise RuntimeError(message)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def source_unchanged(hashes):
    for name, digest in hashes.items():
        ensure(sha(ROOT / name) == digest, f'Canonical source changed: {name}')


def check_uuid():
    ensure(read_json(RUNTIME / 'stone-turtle.fbx.meta')['uuid'] == UUID,
           'Existing FBX UUID does not match the reviewed asset.')


def replace_bytes(source, target, staging):
    # Stage outside assets, then replace the named file on the same volume.
    # Never stage a partial FBX/PNG inside Cocos assets. FBX is promoted last.
    staged = staging / target.name
    shutil.copyfile(source, staged)
    os.replace(staged, target)


def verify():
    receipt = read_json(RECEIPT)
    check_uuid()
    source_unchanged(receipt['canonical_source_hashes'])
    for item in receipt['before_runtime']:
        ensure(sha(ROOT / item['archive_path']) == item['sha256'],
               f'Archive hash mismatch: {item["archive_path"]}')
    ensure(sha(ARCHIVE / 'promotion-manifest.json') == receipt['previous_manifest_sha256'],
           'Archived v10 promotion manifest changed.')
    for item in receipt['promoted_runtime']:
        ensure(sha(ROOT / item['target_path']) == item['sha256'],
               f'Runtime hash mismatch: {item["target_path"]}')
        ensure(sha(ROOT / item['candidate_path']) == item['sha256'],
               f'Frozen candidate changed: {item["candidate_path"]}')
    ensure(read_json(MANIFEST)['version'] == 'stone-sample-11',
           'Current promotion manifest no longer identifies c11.')
    return {
        'status': 'verified-runtime-candidate-11-not-final-art',
        'runtime_uuid': UUID,
        'runtime_hashes': {name: sha(RUNTIME / name) for name in RUNTIME_NAMES},
        'v10_archive_verified': True,
        'canonical_v10_sources_unchanged': True,
        'meta_byte_changes_since_promotion': [
            item['name'] for item in receipt['before_runtime']
            if item['name'].endswith('.meta') and sha(RUNTIME / item['name']) != item['sha256']
        ],
    }


def promote():
    if RECEIPT.exists():
        return verify()
    ensure(not ARCHIVE.exists(), 'v10 archive already exists; inspect before retrying.')
    check_uuid()
    ensure(read_json(MANIFEST)['version'] == 'stone-sample-10', 'Current version is not v10.')
    for name in PAYLOADS:
        ensure(sha(RUNTIME / name) == EXPECTED_OLD[name], f'Unexpected v10 bytes: {name}')
        ensure(sha(HERE / 'export' / name) == EXPECTED_NEW[name], f'Candidate bytes changed: {name}')
    # Canonical files intentionally remain v10; c11 is editable in its own folder.
    canonical = {relative(path): sha(path) for path in CANONICAL}
    complete = read_json(HERE / 'review-complete.json')
    for name, digest in complete['sha256'].items():
        ensure(sha(ROOT / name) == digest, f'Pre-promotion protected file changed: {name}')
    original_manifest_sha = sha(MANIFEST)
    before = [{'name': name, 'target_path': relative(RUNTIME / name),
               'archive_path': relative(ARCHIVE / 'runtime' / name),
               'bytes': (RUNTIME / name).stat().st_size, 'sha256': sha(RUNTIME / name)}
              for name in RUNTIME_NAMES]
    (ARCHIVE / 'runtime').mkdir(parents=True)
    for item in before:
        shutil.copy2(ROOT / item['target_path'], ROOT / item['archive_path'])
        ensure(sha(ROOT / item['archive_path']) == item['sha256'], 'Backup verification failed.')
    shutil.copy2(MANIFEST, ARCHIVE / 'promotion-manifest.json')
    ensure(sha(ARCHIVE / 'promotion-manifest.json') == original_manifest_sha, 'Manifest backup failed.')
    write_json(ARCHIVE / 'archive-manifest.json', {
        'version': 'stone-sample-10', 'archived_at_utc': stamp(), 'asset_uuid': UUID,
        'runtime_files': before, 'previous_manifest_sha256': original_manifest_sha,
        'canonical_source_hashes': canonical,
        'note': 'All six live v10 FBX/PNG/meta files preserved byte-for-byte before c11 promotion. Canonical v10 sources remain in their original locations.',
    })
    staging = HERE / 'promotion-staging'
    staging.mkdir(exist_ok=True)
    # Copies preserve candidate bytes, but use a new mtime so the existing editor
    # can notice the resource change on its next import without being launched.
    for name in PAYLOADS:
        replace_bytes(HERE / 'export' / name, RUNTIME / name, staging)
    check_uuid()
    source_unchanged(canonical)
    stats = read_json(HERE / 'model-stats.json')
    receipt = {
        'version': 'stone-sample-11', 'promotion_status': 'runtime-review-not-final-art',
        'promoted_at_utc': stamp(), 'frozen_candidate': 'candidate-11',
        'previous_version_archive': 'versions/v10',
        'runtime_asset_uuid': UUID,
        'runtime_prefab_path': 'models/stone-turtle/stone-turtle/stone-turtle',
        'previous_fbx_sha256': EXPECTED_OLD['stone-turtle.fbx'],
        'runtime_fbx_sha256': EXPECTED_NEW['stone-turtle.fbx'],
        'previous_manifest_sha256': original_manifest_sha,
        'geometry_changed_during_promotion': False, 'live_meta_files_replaced': False,
        'before_runtime': before,
        'promoted_runtime': [{'target_path': relative(RUNTIME / name),
                              'candidate_path': relative(HERE / 'export' / name),
                              'bytes': (RUNTIME / name).stat().st_size,
                              'sha256': sha(RUNTIME / name)} for name in PAYLOADS],
        'meta_hashes_immediately_after_promotion': {
            name: sha(RUNTIME / name) for name in RUNTIME_NAMES if name.endswith('.meta')},
        'canonical_source_version': 'stone-sample-10-preserved',
        'canonical_source_hashes': canonical,
        'current_editable_source': relative(HERE / 'stone-turtle.blend'),
        'current_generation_script': 'game/art-source/build_stone_turtle_candidate11.py',
        'candidate_source_hashes': {
            relative(path): sha(path) for path in (
                HERE / 'stone-turtle.blend', HERE / 'stone-turtle-review-scene.blend',
                HERE / 'stone-turtle.glb', ROOT / 'game/art-source/build_stone_turtle_candidate11.py')},
        'runtime_triangles_expected': stats['triangles'],
        'runtime_vertices_expected': stats['vertices'],
        'runtime_materials_expected': stats['runtime_materials'],
        'runtime_bones_expected': stats['bones'], 'clips': stats['clips'],
        'forward_axis_cocos': '+Z', 'foot_origin_y': 0.0,
        'review_basis': 'Parent visually reviewed three-quarter, battle, side attack and hit renders; approved c11 as a runtime candidate, not final art.',
        'remaining_review': 'Cocos reimport, actual browser rendering/material/animation and eventual user aesthetic acceptance remain pending.',
        'tools_started': {'blender': False, 'cocos': False},
        'rollback_command': 'python game/art-source/stone-turtle/candidate-11/runtime_promotion.py rollback',
        'note': 'Do not run the canonical v10 builder to rebuild c11. Use the independent candidate-11 source/script. Cocos may regenerate imported metadata after this operation; this tool never rewrites live meta during promotion.',
    }
    for name in PAYLOADS:
        ensure(sha(RUNTIME / name) == EXPECTED_NEW[name], f'Promoted hash mismatch: {name}')
    write_json(RECEIPT, receipt)
    write_json(MANIFEST, receipt)
    result = verify()
    write_json(HERE / 'promotion-verification.json', result)
    return result


def rollback():
    receipt = read_json(RECEIPT)
    check_uuid()
    source_unchanged(receipt['canonical_source_hashes'])
    # Refuse to clobber a later model version. Repeated rollback remains safe.
    for name in PAYLOADS:
        ensure(sha(RUNTIME / name) in (EXPECTED_OLD[name], EXPECTED_NEW[name]),
               f'Runtime has a later/unrecognized version: {name}')
    for item in receipt['before_runtime']:
        ensure(sha(ROOT / item['archive_path']) == item['sha256'], 'Archive hash mismatch.')
    ensure(sha(ARCHIVE / 'promotion-manifest.json') == receipt['previous_manifest_sha256'],
           'Archived manifest hash mismatch.')
    staging = HERE / 'promotion-staging'
    staging.mkdir(exist_ok=True)
    # Original metadata is restored before FBX so a subsequent editor import can
    # regenerate it. Stop any asset-writing build before invoking rollback.
    order = sorted(receipt['before_runtime'], key=lambda item: item['name'] == 'stone-turtle.fbx')
    for item in order:
        replace_bytes(ROOT / item['archive_path'], ROOT / item['target_path'], staging)
    replace_bytes(ARCHIVE / 'promotion-manifest.json', MANIFEST, staging)
    check_uuid()
    for item in receipt['before_runtime']:
        ensure(sha(ROOT / item['target_path']) == item['sha256'], 'Rollback verification failed.')
    result = {'status': 'restored-v10', 'restored_at_utc': stamp(), 'runtime_uuid': UUID,
              'files': {name: sha(RUNTIME / name) for name in RUNTIME_NAMES},
              'canonical_v10_sources_unchanged': True}
    write_json(HERE / 'rollback-receipt.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('verify', 'promote', 'rollback'), default='verify', nargs='?')
    args = parser.parse_args()
    print(json.dumps(globals()[args.command](), ensure_ascii=False, indent=2))
