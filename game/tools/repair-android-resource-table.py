"""Repackage existing APK payloads with Android's required resource-table storage.

This does not alter resources, game code or native binaries. Sign after zipalign.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import zipfile

p=argparse.ArgumentParser()
p.add_argument('source',type=Path)
p.add_argument('--output',type=Path,required=True)
args=p.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
destination=args.output/'gowaygui-compact-unsigned.apk'
assert destination.resolve()!=args.source.resolve()
expected={}
with zipfile.ZipFile(args.source) as source:
    before=source.getinfo('resources.arsc').compress_type
    with zipfile.ZipFile(destination,'w',allowZip64=False) as target:
        for entry in source.infolist():
            name=entry.filename
            if name.startswith('META-INF/') and (name.upper().endswith(('.SF','.RSA','.DSA','.EC')) or name=='META-INF/MANIFEST.MF'):
                continue
            data=source.read(entry)
            expected[name]=hashlib.sha256(data).hexdigest()
            info=copy.copy(entry)
            info.extra=b''  # zipalign regenerates padding before the new signature.
            if name=='resources.arsc':info.compress_type=zipfile.ZIP_STORED
            target.writestr(info,data,compresslevel=6)
            if len(expected)%400==0:print('Repacked',len(expected),'entries',flush=True)
with zipfile.ZipFile(destination) as check:
    assert check.getinfo('resources.arsc').compress_type==zipfile.ZIP_STORED
    assert set(check.namelist())==set(expected)
    for name,digest in expected.items():
        assert hashlib.sha256(check.read(name)).hexdigest()==digest,name
report=dict(source=str(args.source.resolve()),unsignedApk=str(destination.resolve()),beforeResourceTableMethod=before,afterResourceTableMethod=0,payloadsByteVerified=len(expected),gameContentChanged=False,unsignedBytes=destination.stat().st_size)
(args.output/'resource-table-repair.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=False),flush=True)
