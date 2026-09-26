"""Read actual binary FBX take names and embedded PNG payloads without Cocos.
Uses only Python standard library; writes a report in runtime-candidate.
"""
import hashlib,json,struct
from pathlib import Path
HERE=Path(__file__).resolve().parent/'runtime-candidate';OUT=HERE/'export'
raw=(OUT/'bubble-turtle.fbx').read_bytes()
assert raw.startswith(b'Kaydara FBX Binary  \x00\x1a\x00')
version=struct.unpack_from('<I',raw,23)[0];assert version==7400
def parse_property(cursor):
    kind=chr(raw[cursor]);cursor+=1
    formats={'Y':'h','C':'?','I':'i','F':'f','D':'d','L':'q'}
    if kind in formats:
        fmt='<'+formats[kind];return struct.unpack_from(fmt,raw,cursor)[0],cursor+struct.calcsize(fmt)
    if kind in 'SR':
        length=struct.unpack_from('<I',raw,cursor)[0];cursor+=4
        return raw[cursor:cursor+length],cursor+length
    if kind in 'fdlibc':
        _,_,length=struct.unpack_from('<III',raw,cursor);return None,cursor+12+length
    raise AssertionError(('Unknown FBX property',kind,cursor))
def node(cursor):
    end,count,property_length,name_length=struct.unpack_from('<IIIB',raw,cursor)
    if not end:return None,cursor+13
    cursor+=13;name=raw[cursor:cursor+name_length].decode();cursor+=name_length
    property_end=cursor+property_length;properties=[]
    for _ in range(count):value,cursor=parse_property(cursor);properties.append(value)
    assert cursor==property_end
    children=[]
    while cursor<end-13:
        child,cursor=node(cursor)
        if child:children.append(child)
    return {'name':name,'properties':properties,'children':children},end
nodes=[];cursor=27
while True:
    item,cursor=node(cursor)
    if item is None:break
    nodes.append(item)
objects=next(n for n in nodes if n['name']=='Objects')['children']
connections=next(n for n in nodes if n['name']=='Connections')['children']
def text(b):return b.decode('utf-8',errors='replace').split('\x00\x01')[0] if isinstance(b,bytes) else str(b)
def field(ob,name):return next((c['properties'][0] for c in ob['children'] if c['name']==name),None)
stacks=[text(n['properties'][1]) for n in objects if n['name']=='AnimationStack']
assert {n.split('|')[-1] for n in stacks}=={'idle','attack','skill','hit','rest','fusion'}
embedded=[]
for ob in objects:
    if ob['name']!='Video':continue
    content=field(ob,'Content');filename=text(field(ob,'RelativeFilename')).replace('\\','/').split('/')[-1]
    assert isinstance(content,bytes) and content.startswith(b'\x89PNG'),('Missing PNG content',filename)
    assert content==(OUT/filename).read_bytes(),('Embedded texture mismatch',filename)
    embedded.append({'name':filename,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()})
assert {p['name'] for p in embedded}=={'bubble-colour.png','bubble-roughness.png'}
textures={ob['properties'][0]:ob for ob in objects if ob['name']=='Texture'}
channels=[]
for c in connections:
    p=c['properties']
    if len(p)>=4 and p[0]==b'OP' and p[1] in textures:
        channels.append({'fbx_channel':text(p[3]),'texture':text(field(textures[p[1]],'RelativeFilename')).replace('\\','/').split('/')[-1]})
report={'fbx_version':version,'fbx_bytes':len(raw),'fbx_animation_stack_names':stacks,'embedded_pngs':embedded,'texture_connections':channels,
    'runtime_promoted':False,'cocos_validation':False,'note':'AnimationStack names are actual FBX payload names. Blender reimport prepends the armature name again.'}
(HERE/'export-payload-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))


