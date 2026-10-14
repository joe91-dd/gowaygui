"""Inspect the delivered native APK; this is not a substitute for an Android device run."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

p = argparse.ArgumentParser()
p.add_argument('apk', type=Path)
p.add_argument('--report', type=Path, required=True)
args = p.parse_args()
with zipfile.ZipFile(args.apk) as z:
    names = z.namelist()
    assert len(names) == len(set(names)), 'Duplicate APK entries'
    for name in ['AndroidManifest.xml', 'classes.dex', 'assets/main.js',
                 'assets/application.js', 'assets/src/settings.json',
                 'assets/assets/main/index.js', 'assets/assets/resources/cc.config.json',
                 'lib/arm64-v8a/libcocos.so']:
        assert z.getinfo(name).file_size > 0, f'Missing/empty required file: {name}'
    resource_table = z.getinfo('resources.arsc')
    assert resource_table.compress_type == zipfile.ZIP_STORED, 'Android 11+ requires uncompressed resources.arsc'
    with args.apk.open('rb') as apk_file:
        apk_file.seek(resource_table.header_offset)
        local_header = apk_file.read(30)
    assert local_header[:4] == b'PK\x03\x04', 'Invalid resources.arsc local ZIP header'
    assert struct.unpack_from('<H', local_header, 8)[0] == zipfile.ZIP_STORED, 'Compressed resource table in local header'
    filename_bytes, extra_bytes = struct.unpack_from('<HH', local_header, 26)
    resource_table_offset = resource_table.header_offset + 30 + filename_bytes + extra_bytes
    assert resource_table_offset % 4 == 0, 'resources.arsc must be aligned to 4 bytes'
    settings = json.loads(z.read('assets/src/settings.json'))
    assert settings['engine']['platform'] == 'android'
    assert not settings['assets']['remoteBundles'], 'Offline test must bundle resources'
    script = z.read('assets/assets/main/index.js').decode()
    assert '"67125sRs3BFVIjnKUkgSZZh", "GameEntry"' in script
    assert 'android-trial:' in script and 'openNativeTrialMap' in script
    assert 'runtimeQuery' in script and 'EMPTY_QUERY' in script, 'Missing JSB URL compatibility fix'
    scenes = [n for n in names if n.startswith('assets/assets/main/import/') and n.endswith('.json')]
    assert any(b'67125sRs3BFVIjnKUkgSZZh' in z.read(n) for n in scenes), 'Missing GameEntry in scene'
    elf = z.read('lib/arm64-v8a/libcocos.so')
    assert elf[:6] == b'\x7fELF\x02\x01', 'Not ELF64 little-endian'
    assert struct.unpack_from('<H', elf, 18)[0] == 183, 'Not AArch64'
    phoff = struct.unpack_from('<Q', elf, 32)[0]
    phsize, phnum = struct.unpack_from('<HH', elf, 54)
    alignments = [struct.unpack_from('<Q', elf, phoff + i*phsize + 48)[0]
                  for i in range(phnum) if struct.unpack_from('<I', elf, phoff + i*phsize)[0] == 1]
    assert alignments and all(a >= 16384 for a in alignments), 'ELF LOAD segments need 16 KB alignment'
    del elf
    assert z.testzip() is None, 'APK entry CRC check failed'
    report = dict(apk=str(args.apk.resolve()), bytes=args.apk.stat().st_size,
                  sha256=hashlib.file_digest(args.apk.open('rb'), 'sha256').hexdigest(),
                  entries=len(names), gameAssetFiles=sum(n.startswith('assets/') for n in names),
                  engine='Cocos Creator 3.8.8', abi='arm64-v8a', loadSegmentAlignment=alignments,
                  offlineResources=True, sceneGameEntry=True, crcVerified=True,
                  resourceTableUncompressed=True, resourceTableOffset=resource_table_offset,
                  resourceTableAlignment=4,
                  physicalDeviceTested=False)
args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
