"""Create a phone-only texture tier; source artwork and UV/atlas layouts stay intact.

Only complete normalized-UV model textures and whole codex portraits are resized.
All UI atlases, battle paintings, frame metadata, meshes and gameplay data are kept.
"""
import argparse, copy, hashlib, io, json, zipfile, threading, re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('apk',type=Path)
p.add_argument('--routing',type=Path,required=True)
p.add_argument('--native-source',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--build',type=Path)
args=p.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
cache=args.output/'phone-texture-cache';cache.mkdir(exist_ok=True)
rows=json.loads(args.routing.read_text('utf8'));jobs=[];cache_locks={}
with zipfile.ZipFile(args.apk) as z:
    names=set(z.namelist())
    for row in rows:
        resource=row['path']
        cap=512 if resource.startswith('enemy-g1/icons/') else 1024 if resource.startswith(('models-g1/','models-enemy-g1/','models/','models-cc0/','environment/','models-fauna/')) else None
        if cap is None or max(row['width'],row['height'])<=cap:continue
        uuid=row['uuid'];entry=f'assets/assets/resources/native/{uuid[:2]}/{uuid}{row["extension"]}'
        assert entry in names,entry
        source=args.native_source/uuid[:2]/(uuid+'.png')
        assert source.is_file(),f'Keep original PNG for single-generation encoding: {source}'
        target=(max(1,round(row['width']*cap/max(row['width'],row['height']))),max(1,round(row['height']*cap/max(row['width'],row['height']))))
        # Match the existing compact package: albedo is high-quality q93;
        # alpha, UI portraits and material data use lossless encoding.
        lossless=resource.startswith('enemy-g1/icons/') or bool(re.search(r'normal|rough|metal|surface|occlusion|mask|height|gloss|keyed|guardian-pearl',resource,re.I))
        jobs.append(dict(resource=resource,entry=entry,source=source,target=target,original=(row['width'],row['height']),extension=row['extension'],lossless=lossless))
    def encode(job):
        raw=job['source'].read_bytes();key=hashlib.sha256(raw).hexdigest()+f'-{job["target"][0]}x{job["target"][1]}'+('' if job['lossless'] else '-q93')+job['extension']
        destination=cache/key
        with Image.open(io.BytesIO(raw)) as original:
            assert original.size==job['original']
            scaled=original.convert('RGBA').resize(job['target'],Image.Resampling.LANCZOS)
            with cache_locks.setdefault(key,threading.Lock()):
                valid=False
                if destination.exists():
                    try:
                        with Image.open(destination) as actual:
                            decoded=actual.convert('RGBA')
                            valid=actual.size==scaled.size and decoded.getchannel('A').tobytes()==scaled.getchannel('A').tobytes() and (not job['lossless'] or decoded.tobytes()==scaled.tobytes())
                    except (OSError,ValueError):pass
                if not valid:
                    if job['extension']=='.webp':scaled.save(destination,'WEBP',lossless=job['lossless'],quality=93,method=4,exact=True,alpha_quality=100)
                    else:scaled.save(destination,'PNG',optimize=True)
                with Image.open(destination) as actual:
                    assert actual.size==scaled.size
                    decoded=actual.convert('RGBA')
                    assert decoded.getchannel('A').tobytes()==scaled.getchannel('A').tobytes(),'Texture alpha changed'
                    if job['lossless']:assert decoded.tobytes()==scaled.tobytes(),'Material-data and portrait pixels must match the resampled RGBA exactly'
        return dict(resource=job['resource'],entry=job['entry'],cache=str(destination.resolve()),before=list(job['original']),after=list(job['target']),bytes=destination.stat().st_size,
                    decodedBefore=job['original'][0]*job['original'][1]*4,decodedAfter=job['target'][0]*job['target'][1]*4,lossless=job['lossless'],alphaVerified=True)
    images=[]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(encode,jobs):
            images.append(result)
            if len(images)%30==0:print(f'Prepared {len(images)}/{len(jobs)} phone textures',flush=True)
    report=dict(sourceApk=str(args.apk.resolve()),resizedImages=len(images),decodedBefore=sum(x['decodedBefore'] for x in images),decodedAfter=sum(x['decodedAfter'] for x in images),
                estimateMeaning='Uncompressed RGBA for affected textures, not measured total RAM or peak memory',sourceArtChanged=False,uiAtlasesChanged=False,mapPaintingsChanged=False,images=images)
    (args.output/'phone-textures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
    if args.build:
        manifest=json.loads((args.build/'script-build-manifest.json').read_text('utf8'));script=(args.build/'assets/main/index.js').read_bytes()
        assert hashlib.sha256(script).hexdigest()==manifest['bundleSha256']
        replacements={x['entry']:Path(x['cache']) for x in images};expected={};changed=[]
        output=args.output/'gowaygui-compact-unsigned.apk'
        with zipfile.ZipFile(output,'w',allowZip64=False) as target:
            for entry in z.infolist():
                name=entry.filename
                if name.startswith('META-INF/') and (name.upper().endswith(('.SF','.RSA','.DSA','.EC')) or name=='META-INF/MANIFEST.MF'):continue
                original=z.read(entry)
                data=script if name=='assets/assets/main/index.js' else replacements[name].read_bytes() if name in replacements else original
                if data!=original:changed.append(name)
                expected[name]=hashlib.sha256(data).hexdigest();info=copy.copy(entry);info.extra=b''
                if name=='resources.arsc':info.compress_type=zipfile.ZIP_STORED
                target.writestr(info,data,compresslevel=6)
        with zipfile.ZipFile(output) as check:
            assert set(check.namelist())==set(expected)
            assert check.getinfo('resources.arsc').compress_type==zipfile.ZIP_STORED
            for name,digest in expected.items():assert hashlib.sha256(check.read(name)).hexdigest()==digest,name
        assert set(changed)==set(replacements)|{'assets/assets/main/index.js'}
        report.update(unsignedApk=str(output.resolve()),changedEntries=changed,unchangedPayloads=len(expected)-len(changed),allPayloadsVerified=True,scriptSha256=manifest['bundleSha256'])
        (args.output/'phone-package-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
        (args.output/'script-build-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ('images','changedEntries')},ensure_ascii=False),flush=True)
