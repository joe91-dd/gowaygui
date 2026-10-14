"""Create an unsigned, resource-only compact variant of a verified Cocos 3.8 APK.

Run zipalign and apksigner afterwards. Code, mesh data, animation data, dimensions,
and alpha channels are retained. Original project/build files are never edited.
The runtime entry manifest plus serialized dependencies determines resource use.
"""
import argparse
import base64
import collections
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import time
import zipfile
from PIL import Image, ImageChops

RESOURCE = 'assets/assets/resources/'


def unpack_message(data):
    """Read only a CCON v2 MessagePack document, including opaque typed extensions."""
    offset = 0
    def take(n):
        nonlocal offset
        b = data[offset:offset+n]
        assert len(b) == n
        offset += n
        return b
    def number(fmt):
        return struct.unpack('>'+fmt, take(struct.calcsize('>'+fmt)))[0]
    def item():
        tag = take(1)[0]
        if tag <= 0x7f: return tag
        if tag >= 0xe0: return tag-256
        if 0xa0 <= tag <= 0xbf: return take(tag & 31).decode('utf8')
        if 0x90 <= tag <= 0x9f: return [item() for _ in range(tag & 15)]
        if 0x80 <= tag <= 0x8f: return {item():item() for _ in range(tag & 15)}
        if tag == 0xc0: return None
        if tag in (0xc2,0xc3): return tag == 0xc3
        formats = {0xca:'f',0xcb:'d',0xcc:'B',0xcd:'H',0xce:'I',0xcf:'Q',0xd0:'b',0xd1:'h',0xd2:'i',0xd3:'q'}
        if tag in formats: return number(formats[tag])
        if tag in (0xd9,0xda,0xdb): return take(number({0xd9:'B',0xda:'H',0xdb:'I'}[tag])).decode('utf8')
        if tag in (0xc4,0xc5,0xc6): return take(number({0xc4:'B',0xc5:'H',0xc6:'I'}[tag]))
        if tag in (0xdc,0xdd): return [item() for _ in range(number('H' if tag == 0xdc else 'I'))]
        if tag in (0xde,0xdf): return {item():item() for _ in range(number('H' if tag == 0xde else 'I'))}
        if tag in (0xd4,0xd5,0xd6,0xd7,0xd8): return take(1+2**(tag-0xd4))
        if tag in (0xc7,0xc8,0xc9): return take(1+number({0xc7:'B',0xc8:'H',0xc9:'I'}[tag]))
        raise ValueError(f'Unsupported MessagePack tag {tag:x}')
    result = item()
    assert offset == len(data), (offset,len(data))
    return result


def ccon_document(data):
    magic,version,total,length = struct.unpack_from('<4sIII',data)
    assert magic == b'CCON' and total == len(data)
    if version == 1: return json.loads(data[16:16+length])
    assert version == 2
    return unpack_message(data[16:16+length])


def strings(obj):
    if isinstance(obj,str): yield obj
    elif isinstance(obj,dict):
        for value in obj.values(): yield from strings(value)
    elif isinstance(obj,list):
        for value in obj: yield from strings(value)


def write_json(path,obj):
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf8')


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--apk',type=Path,required=True)
    p.add_argument('--manifest',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--audit-only',action='store_true')
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    z=zipfile.ZipFile(args.apk);infos={f.filename:f for f in z.infolist()}
    config=json.loads(z.read(RESOURCE+'cc.config.json'))
    assert config['debug'] is True and not config['redirect']
    uuid_set=set(config['uuids']);aliases={u:u for u in uuid_set}
    for u in uuid_set:
        base,sep,suffix=u.partition('@')
        if re.fullmatch(r'[0-9a-f-]{36}',base):
            h=base.replace('-','');compact=h[:2]+base64.b64encode(bytes.fromhex(h[2:])).decode()
            aliases[compact+(sep+suffix if sep else '')]=u
    def refs(obj): return {aliases[s] for s in strings(obj) if s in aliases}
    def compiled_refs(obj):
        if isinstance(obj,list) and len(obj)==11 and isinstance(obj[0],int):
            # Shared UUID tables contain assets belonging to other packed sections.
            deps={aliases.get(obj[1][v] if isinstance(v,int) else v, obj[1][v] if isinstance(v,int) else v) for v in obj[10]}
            return (deps & uuid_set) | refs(obj[5:10])
        return refs(obj)
    assets={};pack_data={};individual={};graph={}
    for pack,uuids in config['packs'].items():
        name=RESOURCE+'import/'+pack[:2]+'/'+pack+'.json'
        data=json.loads(z.read(name));pack_data[pack]=(name,data)
        sections=data['data'] if isinstance(data,dict) else data[5]
        assert len(sections)==len(uuids)
        for u,section in zip(uuids,sections):
            assets[u]=data[:5]+section if isinstance(data,list) else section
            graph[u]=compiled_refs(assets[u])
    for name in infos:
        if not name.startswith(RESOURCE+'import/'): continue
        u=Path(name).stem
        if u in config['packs']: continue
        assert u in uuid_set, name
        raw=z.read(name)
        obj=json.loads(raw) if name.endswith('.json') else ccon_document(raw)
        assets[u]=obj;individual[u]=name;graph[u]=compiled_refs(obj)
    manifest=json.loads(args.manifest.read_text('utf8'))
    requested=set(manifest['entries']);existing={v[0] for v in config['paths'].values()}
    assert requested <= existing, sorted(requested-existing)
    roots={u for u,v in config['paths'].items() if v[0] in requested or any(v[0].startswith(prefix) for prefix in manifest['prefixes'])}
    # Preserve resources also referenced from the scene or any other bundle.
    for name in infos:
        if name.startswith('assets/assets/') and '/import/' in name and not name.startswith(RESOURCE) and name.endswith('.json'):
            roots.update(refs(json.loads(z.read(name))))
    keep=set();pending=list(roots)
    while pending:
        u=pending.pop()
        if u in keep: continue
        assert u in assets, ('Missing serialized asset',u,config['paths'].get(u))
        keep.add(u);pending.extend(graph[u]-keep)
    assert all(graph[u] <= keep for u in keep)
    paths={u:v for u,v in config['paths'].items() if u in keep}
    removed_paths={u:v for u,v in config['paths'].items() if u not in keep}
    def used_name(name):
        if not name.startswith(RESOURCE): return True
        if '/native/' in name or '/import/' in name:
            u=Path(name).stem
            return u in keep or (u in config['packs'] and any(v in keep for v in config['packs'][u]))
        return True
    omitted=[f for f in infos.values() if not used_name(f.filename)]
    by_group=collections.defaultdict(lambda:dict(files=0,bytes=0))
    for f in omitted:
        u=Path(f.filename).stem
        resource=config['paths'].get(u,config['paths'].get(u.split('@')[0],['(packed metadata)']))[0]
        group=by_group[resource.split('/')[0]];group['files']+=1;group['bytes']+=f.compress_size
    report={'sourceApk':str(args.apk.resolve()),'originalBytes':args.apk.stat().st_size,'roots':len(roots),'retainedAssets':len(keep),'omittedAssets':len(uuid_set-keep),'omittedFiles':len(omitted),'omittedPackagedBytes':sum(f.compress_size for f in omitted),'omittedGroups':dict(by_group),'retainedPaths':paths,'omittedPaths':removed_paths,'dependencyClosureVerified':True,'sourceAssetsModified':False,'codeModified':False,'dimensionsModified':False,'physicalDeviceTested':False}
    write_json(args.output/'resource-audit.json',report)
    print(json.dumps({k:report[k] for k in ['roots','retainedAssets','omittedAssets','omittedFiles','omittedPackagedBytes','omittedGroups']},ensure_ascii=False),flush=True)
    if args.audit_only: return
    cache=args.output/'image-cache';cache.mkdir(exist_ok=True)
    jobs={};images={}
    for f in infos.values():
        if not f.filename.startswith(RESOURCE+'native/') or not f.filename.endswith('.png') or not used_name(f.filename): continue
        u=Path(f.filename).stem;resource=config['paths'][u][0]
        assert config['paths'][u][1]=='cc.ImageAsset'
        # Pixel-exact data maps and sensitive UI/chroma-key/FX edges.
        lossless=(not resource.startswith(('models-','models/','environment/','art-modern/map-','art-modern/home-environment','art-modern/patrol-ocean')) or bool(re.search(r'normal|rough|metal|surface|occlusion|mask|height|gloss|keyed|guardian-pearl',resource,re.I)))
        raw=z.read(f);digest=hashlib.sha256(raw).hexdigest();key=digest+('-lossless' if lossless else '-q93')
        images[u]=dict(source=f.filename,resource=resource,key=key,originalBytes=len(raw),lossless=lossless)
        if key not in jobs: jobs[key]=(raw,lossless)
    print(f'Encoding {len(jobs)} unique images ({len(images)} resource images), 2 workers',flush=True)
    def convert(entry):
        key,(raw,lossless)=entry;dst=cache/(key+'.webp');source=Image.open(io.BytesIO(raw)).convert('RGBA')
        if not dst.exists():
            source.save(dst,'WEBP',lossless=lossless,quality=93,method=4,exact=True,alpha_quality=100)
        result=Image.open(dst).convert('RGBA');assert source.size==result.size
        assert ImageChops.difference(source.getchannel('A'),result.getchannel('A')).getbbox() is None, 'Alpha changed'
        if lossless: assert source.tobytes()==result.tobytes(), 'Lossless pixels changed'
        return key,dict(bytes=dst.stat().st_size,width=source.width,height=source.height,alphaVerified=True,lossless=lossless)
    encoded={};started=time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for key,result in pool.map(convert,jobs.items()):
            encoded[key]=result
            if len(encoded)%25==0: print(f'Encoded {len(encoded)}/{len(jobs)} images, {int(time.time()-started)}s',flush=True)
    converted={u for u,img in images.items() if encoded[img['key']]['bytes'] < img['originalBytes']}
    # ImageAsset uses extension index 4 for WebP in the shipped Cocos engine.
    for u in converted:
        data=assets[u];assert data[3]==['cc.ImageAsset'] and data[5][0]['fmt']=='0', (u,data)
        data[5][0]['fmt']='4'
    config['paths']=paths;config['uuids']=[u for u in config['uuids'] if u in keep]
    config['extensionMap']={ext:[u for u in us if u in keep] for ext,us in config['extensionMap'].items()}
    replacements={};packs={}
    for pack,(name,data) in pack_data.items():
        us=config['packs'][pack];selected=[i for i,u in enumerate(us) if u in keep]
        if not selected:continue
        packs[pack]=[us[i] for i in selected]
        if isinstance(data,dict): data['data']=[data['data'][i] for i in selected]
        else: data[5]=[data[5][i] for i in selected]
        replacements[name]=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode()
    config['packs']=packs
    replacements[RESOURCE+'cc.config.json']=json.dumps(config,separators=(',',':'),ensure_ascii=False).encode()
    for u in converted:
        if u in individual:replacements[individual[u]]=json.dumps(assets[u],separators=(',',':')).encode()
    output=args.output/'gowaygui-compact-unsigned.apk'
    changed=set(replacements);removed_signatures=[]
    with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as target:
        for f in z.infolist():
            name=f.filename
            if name.startswith('META-INF/') and (name.upper().endswith(('.SF','.RSA','.DSA','.EC')) or name=='META-INF/MANIFEST.MF'):
                removed_signatures.append(name);continue
            if not used_name(name): continue
            u=Path(name).stem;data=None
            if name.startswith(RESOURCE+'native/') and u in converted and name.endswith('.png'):
                name=name[:-4]+'.webp';data=(cache/(images[u]['key']+'.webp')).read_bytes();changed.add(name)
            elif name in replacements:data=replacements[name]
            else:data=z.read(f)
            info=zipfile.ZipInfo(name,f.date_time);info.external_attr=f.external_attr
            # Android 11+ rejects compressed resource tables for targetSdk >= 30.
            # zipalign only aligns STORED entries; a successful alignment check
            # alone does not detect an accidentally deflated resources.arsc.
            info.compress_type=zipfile.ZIP_STORED if name.endswith(('.arsc','.webp','.png','.ogg','.wav')) else zipfile.ZIP_DEFLATED
            target.writestr(info,data,compresslevel=9)
    with zipfile.ZipFile(output) as check:
        assert check.testzip() is None
        for f in check.infolist():
            if f.filename in changed:continue
            assert hashlib.sha256(check.read(f)).digest()==hashlib.sha256(z.read(f.filename)).digest(),f.filename
        for u in converted:
            assert images[u]['source'][:-4]+'.webp' in check.namelist()
    report.update(unsignedApk=str(output.resolve()),unsignedBytes=output.stat().st_size,convertedImages=len(converted),uniqueEncodedImages=len(encoded),imageSavingsBytes=sum(images[u]['originalBytes']-encoded[images[u]['key']]['bytes'] for u in converted),allUnmodifiedFilesByteVerified=True,alphaVerified=True,images={u:{**im,**encoded[im['key']], 'converted':u in converted} for u,im in images.items()})
    write_json(args.output/'resource-audit.json',report)
    print('Unsigned compact APK bytes:',output.stat().st_size,flush=True)


if __name__=='__main__':main()
