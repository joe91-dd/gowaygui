"""Append the first successful actual Cocos import evidence without rewriting earlier manifests."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
check=OUT/'cocos-imported-check.json';report=json.loads(check.read_text(encoding='utf-8'))
assert report['cocosImportedStatus']=='actual-imported-triangles-pass'
assert report['correctedFbxSha256']==sha(OUT/'boss-bay.fbx')==sha(ROOT/'game/assets/resources/environment/boss-bay/boss-bay.fbx')
assert report['cocosImportedEvidence']['groupsByImportedUvTile']['25']=={'triangles':4608,'degenerate':128,'storedZPositive':4608,'localZPositive':4480}
target=OUT/'post-import-evidence.json';assert not target.exists(),'Append evidence only once; never overwrite a frozen report'
record={'status':'actual-cocos-imported-triangles-pass-browser-acceptance-owned-by-root',
        'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'buildReportedByRoot':'210046',
        'runtimeFbxSha256':report['correctedFbxSha256'],
        'grassTriangles':{'upwardNondegenerate':4480,'retainedCenterDegenerate':128,'upwardStoredNormals':4608},
        'evidence':{'path':check.relative_to(ROOT).as_posix(),'sha256':sha(check),'bytes':check.stat().st_size},
        'existingSourceProvenanceSha256Unchanged':sha(OUT/'provenance.json'),
        'existingPromotionManifestSha256Unchanged':sha(OUT/'promotion-manifest.json'),
        'earlierManifestStage':'Earlier pending status records source freeze and promotion time; this new document appends the subsequent successful import.',
        'previousManifestsOrOldBuildReportsRewritten':False,
        'remainingAcceptance':'Root actual browser visibility, materials/shadows and idle frame-rate checks'}
target.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=False,indent=2))
