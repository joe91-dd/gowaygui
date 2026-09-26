"""Root-authorized single-FBX promotion. Atlases already match; no metadata is authored."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,shutil
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
path=OUT/'promotion-manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'))
for item in manifest['files']:
    source=ROOT/item['source'];assert sha(source)==item['sha256'] and source.stat().st_size==item['bytes']
    if source.suffix.lower()!='.fbx':assert sha(ROOT/item['destination'])==item['sha256'],'Existing atlas unexpectedly differs'
fbx=next(item for item in manifest['files'] if item['source'].endswith('.fbx'))
source=ROOT/fbx['source'];destination=ROOT/fbx['destination'];meta=destination.with_name(destination.name+'.meta')
old_hash=sha(destination);assert old_hash in ['011b94a72decfa697f8b6df16a0970e8ebd8df802240ee59b6e8248f53394397',fbx['sha256']]
meta_before=sha(meta) if meta.exists() else None
if old_hash!=fbx['sha256']:shutil.copyfile(source,destination)
assert sha(destination)==fbx['sha256'];assert (sha(meta) if meta.exists() else None)==meta_before
manifest.update(status='runtime-c02-fbx-promoted-pending-cocos-reimport-and-acceptance',promotedAtUtc=datetime.now(timezone.utc).isoformat(),
                authorization='Root actually reviewed c02 overview, approved corrected FBX promotion and explicitly authorized copying only FBX; unchanged atlases remain in the manifest.',
                runtimeFilesCopiedByThisSubtask=True,copiedFiles=[fbx['destination']],atlasesRewritten=False,
                previousRuntimeFbxSha256=old_hash,existingMetaSha256Unchanged=meta_before,sourceProvenanceCreatedBeforePromotion=True)
path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':manifest['status'],'fbx':fbx,'metaUnchanged':True,'atlasesRewritten':False},ensure_ascii=False,indent=2))
