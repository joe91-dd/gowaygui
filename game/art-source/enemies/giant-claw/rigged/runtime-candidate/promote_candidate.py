"""One-time root-authorized promotion of three validated boss candidate bytes."""
from pathlib import Path
import json,hashlib,datetime
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[5]
TARGET=ROOT/'game/assets/resources/models/enemies/giant-claw'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8'))
def write(name,value):(HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert not (HERE/'promotion-manifest.json').exists(),'Already promoted: do not mutate frozen source'
assert not TARGET.exists(),'Target already exists; investigate instead of overwriting'
assert TARGET.resolve().is_relative_to((ROOT/'game/assets/resources/models/enemies').resolve())
manifest=read('asset-manifest.json');stats=read('model-stats.json');check=read('round-trip-check.json')
assert check['status']=='pass'
for path,info in manifest['files'].items():assert sha(ROOT/path)==info['sha256'],path
for path,digest in stats['protected_reference_hashes'].items():assert sha(ROOT/path)==digest,path
names=('giant-claw.fbx','giant-colour.png','giant-roughness.png')
for name in names:assert (HERE/'export'/name).is_file()
assert sha(HERE/'export/giant-claw.fbx')==manifest['fbx_sha256']==check['fbx_sha256']
TARGET.mkdir(parents=False)
copied=[]
for name in names:
    source=HERE/'export'/name;destination=TARGET/name
    with destination.open('xb') as out:out.write(source.read_bytes())
    assert sha(destination)==sha(source)
    copied.append({'path':destination.relative_to(ROOT).as_posix(),'source_path':source.relative_to(ROOT).as_posix(),
                   'sha256':sha(source),'bytes':source.stat().st_size,'created_by_this_run':True})
assert sorted(p.name for p in TARGET.iterdir())==sorted(names)
frozen={p.relative_to(ROOT).as_posix():sha(p) for p in sorted(HERE.rglob('*')) if p.is_file()}
generator=ROOT/'game/art-source/enemies/build_giant_claw_rigged.py';frozen[generator.relative_to(ROOT).as_posix()]=sha(generator)
write('source-freeze.json',{'status':'frozen after parent visual approval and exact three-file promotion',
 'sha256_by_path':frozen,'protected_original_files':stats['protected_reference_hashes'],
 'boundary':'This record intentionally excludes itself and promotion-manifest.json to avoid circular hashes. Do not regenerate frozen source in place.'})
write('promotion-manifest.json',{'version':'giant-claw-rigged-runtime-candidate-01','enemy_kind':'boss','display_name':'巨钳蟹',
 'promoted_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'authorization':'Root actually viewed walk and attack-front keyframes and explicitly authorized exactly FBX/colour/roughness promotion.',
 'status':'frozen approved runtime candidate; actual Cocos import/motion/lighting/performance acceptance pending',
 'runtime_directory':TARGET.relative_to(ROOT).as_posix(),'runtime_files':copied,
 'expected_prefab_path':'models/enemies/giant-claw/giant-claw/giant-claw','actual_cocos_import_verified':False,
 'source_freeze_sha256':sha(HERE/'source-freeze.json'),'fbx_sha256':manifest['fbx_sha256'],
 'material':'GiantClaw_Toy_Atlas','atlas_prefixes':['GiantClaw_Colour_','GiantClaw_Roughness_'],
 'actual_fbx_takes':manifest['actual_fbx_takes'],'scale':1,
 'bounds_scale_1_width_height_depth':[2.443696975708008,1.2760032415390015,1.357442319393158],
 'maximum_animated_height':max(c['maximum_z_m'] for c in check['clips'].values()),
 'suggested_bar_height':1.52,'suggested_control_height':1.43,'suggested_bar_width':1.05,
 'half_frame_samples':377,'original_prototype_preserved':True,'meta_authored':False,'fbx_subasset_uuids_authored':False,
 'cocos_started':False,'blender_started_for_promotion':False,
 'rollback':'Only three new files were added in this previously absent enemy folder. Preserve source and use this file list if root authorizes removal/replacement; no existing asset was overwritten.'})
for path,digest in frozen.items():assert sha(ROOT/path)==digest,path
for item in copied:assert sha(ROOT/item['path'])==item['sha256']
print(json.dumps({'status':'promoted and frozen','runtime_files':copied,'prefab':'models/enemies/giant-claw/giant-claw/giant-claw'},ensure_ascii=False))
