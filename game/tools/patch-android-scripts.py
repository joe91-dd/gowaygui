"""Update an existing compact native APK's script bundle only; align/sign afterward.

Keep the already verified WebP resources, native libraries and Android metadata.
All other unsigned entry payloads are compared byte-for-byte after repackaging.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import zipfile

p=argparse.ArgumentParser()
p.add_argument('source',type=Path)
p.add_argument('--build',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
args=p.parse_args()
script=args.build/'assets/main/index.js'
build_report=json.loads((args.build/'script-build-manifest.json').read_text('utf8'))
script_bytes=script.read_bytes()
assert hashlib.sha256(script_bytes).hexdigest()==build_report['bundleSha256'], 'Build manifest mismatch'
assert b'CAMERA_ORDER' in script_bytes and b'FIXED_HEIGHT' in script_bytes
args.output.mkdir(parents=True,exist_ok=True)
destination=args.output/'gowaygui-compact-unsigned.apk'
assert destination.resolve()!=args.source.resolve()
replacement='assets/assets/main/index.js'
expected={}
changed=[]
with zipfile.ZipFile(args.source) as source:
    source.getinfo(replacement)
    with zipfile.ZipFile(destination,'w',allowZip64=False) as target:
        for entry in source.infolist():
            name=entry.filename
            if name.startswith('META-INF/') and (name.upper().endswith(('.SF','.RSA','.DSA','.EC')) or name=='META-INF/MANIFEST.MF'):
                continue
            original=source.read(entry)
            data=script_bytes if name==replacement else original
            if data!=original:changed.append(name)
            expected[name]=hashlib.sha256(data).hexdigest()
            info=copy.copy(entry)
            info.extra=b''
            if name=='resources.arsc':info.compress_type=zipfile.ZIP_STORED
            target.writestr(info,data,compresslevel=6)
            if len(expected)%400==0:print('Repacked',len(expected),'entries',flush=True)
assert changed==[replacement],changed
with zipfile.ZipFile(destination) as check:
    assert check.getinfo('resources.arsc').compress_type==zipfile.ZIP_STORED
    assert set(check.namelist())==set(expected)
    for name,digest in expected.items():
        assert hashlib.sha256(check.read(name)).hexdigest()==digest,name
report=dict(source=str(args.source.resolve()),unsignedApk=str(destination.resolve()),
            changedEntries=changed,unchangedPayloads=len(expected)-len(changed),
            payloadsByteVerified=len(expected),scriptSha256=build_report['bundleSha256'],
            resourceTableUncompressed=True,physicalDeviceTested=False)
(args.output/'script-patch-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
(args.output/'script-build-manifest.json').write_text(json.dumps(build_report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False),flush=True)
