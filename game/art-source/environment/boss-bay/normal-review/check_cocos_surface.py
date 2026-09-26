"""Read actual post-import Cocos data; fail while old inverted triangles remain.

Ordinary Python. Never launches Cocos or edits assets/library/old reports.
Each successful invocation writes a new timestamped report beside this script.
"""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,importlib.util
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4];CANDIDATE=OUT.parent/'candidate-02'
spec=importlib.util.spec_from_file_location('surface_reader',OUT/'inspect_surface_normals.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
sha=audit.sha
runtime=ROOT/'game/assets/resources/environment/boss-bay/boss-bay.fbx'
expected=json.loads((CANDIDATE/'correction-report.json').read_text(encoding='utf-8'))['fbxSha256']
assert sha(runtime)==sha(CANDIDATE/'boss-bay.fbx')==expected,'Expected c02 has not been promoted to runtime'
imported=audit.inspect_cocos();g=imported['groupsByImportedUvTile'][25]
assert g['triangles']==4608 and g['localZPositive']==4480 and g['degenerate']==128 and g['localZNegative']==0,g
assert g['storedZPositive']==4608 and g['storedZNegative']==0,g
q=imported['groundNodeRotation'];positive_z_to_world_y=2*(q['y']*q['z']-q['x']*q['w'])
assert positive_z_to_world_y>.9999 and min(imported['groundNodeScale'][k] for k in ['x','y','z'])>0
stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
report={'status':'pass-actual-cocos-imported-upward-surface','recordedAtUtc':stamp,
        'runtimeFbxSha256':expected,'localPositiveZToWorldY':positive_z_to_world_y,
        'nondegenerateGreenTrianglesFacingWorldUp':4480,'preservedCenterDegenerateTriangles':128,
        'evidence':imported,'scope':'Actual imported mesh bytes; does not assert browser visual/performance acceptance'}
target=OUT/('cocos-c02-imported-'+stamp+'.json');assert not target.exists()
target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':report['status'],'report':target.relative_to(ROOT).as_posix(),'runtimeFbxSha256':expected,'trianglesFacingWorldUp':4480,'retainedDegenerates':128},ensure_ascii=False))
