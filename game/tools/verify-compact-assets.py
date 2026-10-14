"""Validate all retained ImageAssets and emit inputs for the actual Cocos routing test."""
import argparse
import io
import json
from pathlib import Path
import zipfile
from PIL import Image

p=argparse.ArgumentParser()
p.add_argument('apk',type=Path)
p.add_argument('--output',type=Path,required=True)
args=p.parse_args()
prefix='assets/assets/resources/'
with zipfile.ZipFile(args.apk) as z:
    names=set(z.namelist())
    config=json.loads(z.read(prefix+'cc.config.json'))
    manifest=json.loads((args.output/'runtime-resources.json').read_text('utf8'))
    paths={v[0] for v in config['paths'].values()}
    assert set(manifest['entries']) <= paths
    assert all(f'art-modern/map-coast-stage-{n}' in paths for n in range(1,51))
    assert all(f'art-modern/map-mode-scene-{n}' in paths for n in range(50,57))
    assert not any(p.startswith(('models-modern/','models-sculpted/','models-approved/references/')) for p in paths)
    uuids=set(config['uuids'])
    for us in config['packs'].values(): assert set(us)<=uuids
    for us in config['extensionMap'].values(): assert set(us)<=uuids
    assert set(config['paths']) <= uuids
    images=[]
    for uuid,entry in config['paths'].items():
        if entry[1]!='cc.ImageAsset':continue
        imported=prefix+'import/'+uuid[:2]+'/'+uuid+'.json'
        data=json.loads(z.read(imported))
        assert data[3]==['cc.ImageAsset']
        fmt=data[5][0]
        ext=['.png','.jpg','.jpeg','.bmp','.webp','.pvr','.pkm','.astc'][int(fmt['fmt'])]
        native=prefix+'native/'+uuid[:2]+'/'+uuid+ext
        assert native in names,entry[0]
        with Image.open(io.BytesIO(z.read(native))) as im:
            im.load();w,h=im.size
            assert w>0 and h>0
        images.append(dict(uuid=uuid,path=entry[0],serialized=fmt,extension=ext,nativeExists=True,width=w,height=h))
    (args.output/'retained-config.json').write_text(json.dumps(config),encoding='utf8')
    (args.output/'image-routing.json').write_text(json.dumps(images),encoding='utf8')
    print(f'PASS: 57 maps, runtime paths, pruned legacy families and {len(images)} complete decodable images.')
