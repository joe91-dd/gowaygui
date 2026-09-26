"""Hash isolated boss candidate after source/FBX checks and real image inspection."""
from pathlib import Path
import hashlib,json,struct,io
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[5]
assert not (HERE/'source-freeze.json').exists(),'Frozen candidate: validate hashes instead of repackaging'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((HERE/name).read_text(encoding='utf-8'))
stats=read('model-stats.json');roundtrip=read('round-trip-check.json')
assert roundtrip['status']==read('source-check.json')['status']=='pass'
assert sha(HERE/'export/giant-claw.fbx')==stats['fbx_sha256']==roundtrip['fbx_sha256']
for name,digest in stats['protected_reference_hashes'].items():assert sha(ROOT/name)==digest,name
review=read('visual-review.json');assert review['status']=='agent viewed all seven rendered keyframes'
for item in review['images']:assert sha(HERE/item['file'])==item['sha256'],item['file']
# Read actual FBX AnimationStack names/times without starting Blender again.
stream=io.BytesIO((HERE/'export/giant-claw.fbx').read_bytes())
assert stream.read(23)==b'Kaydara FBX Binary  \x00\x1a\x00'
assert struct.unpack('<I',stream.read(4))[0]==7400
def prop():
    kind=stream.read(1).decode()
    if kind in 'YCFDIL':
        fmt={'Y':'h','C':'?','F':'f','D':'d','I':'i','L':'q'}[kind]
        return struct.unpack('<'+fmt,stream.read(struct.calcsize(fmt)))[0]
    if kind in 'SR':return stream.read(struct.unpack('<I',stream.read(4))[0])
    if kind in 'fdlibc':
        count,encoding,size=struct.unpack('<III',stream.read(12));stream.seek(size,1);return None
    raise AssertionError('Unknown FBX property '+kind)
def node():
    end,count,propbytes,namesize=struct.unpack('<IIIB',stream.read(13))
    if not end:return None
    name=stream.read(namesize);values=[prop() for _ in range(count)];children=[]
    while stream.tell()<end:
        child=node()
        if child is None:break
        children.append(child)
    assert stream.tell()==end
    return name,values,children
objects=None
while True:
    item=node()
    if item is None:break
    if item[0]==b'Objects':objects=item
assert objects is not None
takes=[]
for name,props,children in objects[2]:
    if name!=b'AnimationStack':continue
    take=props[1].decode().split('\x00')[0]
    properties=next(n for n in children if n[0]==b'Properties70')
    times={n[1][0].decode():n[1][-1] for n in properties[2] if n[0]==b'P'}
    # Blender 4.5 AnimationStack PropertyTemplate defaults LocalStart to zero;
    # its writer omits this property when the actual start equals that default.
    start=times.get('LocalStart',0);stop=times.get('LocalStop',0)
    seconds=(stop-start)/46186158000
    key=take.split('|')[-1];assert take==stats['clips'][key]['name']
    assert abs(seconds-stats['clips'][key]['seconds'])<1e-7
    takes.append({'name':take,'seconds':seconds,'local_start_ticks':start,'local_stop_ticks':stop})
assert len(takes)==5
(HERE/'fbx-takes.json').write_text(json.dumps({'status':'pass','fbx_sha256':stats['fbx_sha256'],'actual_animation_stacks':takes},indent=2)+'\n',encoding='utf-8')
files={p.relative_to(ROOT).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size}
       for p in sorted(HERE.rglob('*')) if p.is_file() and p.name!='asset-manifest.json'}
generator=ROOT/'game/art-source/enemies/build_giant_claw_rigged.py'
files[generator.relative_to(ROOT).as_posix()]={'sha256':sha(generator),'bytes':generator.stat().st_size}
manifest={'asset':'巨钳蟹','kind':'boss','status':'approved rigged runtime candidate; promotion-manifest records subsequent runtime copy',
 'source':'Entirely original project geometry and atlas from approved c01, new original rig/weights/actions. No third-party asset.',
 'approved_prototype_sha256':stats['prototype_sha256'],'protected_original_files':stats['protected_reference_hashes'],
 'runtime_material':stats['material_name'],'fbx_sha256':stats['fbx_sha256'],'clips':stats['clips'],'actual_fbx_takes':takes,
 'meshes':1,'triangles':stats['triangles'],'bones':stats['bone_count'],'materials':1,
 'recommended_scale':1,'runtime_copy_performed':False,'cocos_started':False,
 'verification':{'half_frame_samples':377,'exact_geometry_uv_material_preserved':True,'exact_embedded_and_sidecar_pngs':True,
 'visual_review':'Seven original Blender keyframes opened by authoring agent. Root/game/final art approval pending.',
 'clearance_boundary':'No crossings in six tested claw-face pairs or initially separate middle-leg pairs. Existing neighboring leg-root interpenetrations retained and documented; not globally intersection-free.'},
 'files':files}
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'pass','files':len(files),'fbx':stats['fbx_sha256'],'original_files_unchanged':len(stats['protected_reference_hashes'])}))
