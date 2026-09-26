"""Read-only FBX/Cocos imported geometry audit. Runs with ordinary Python, not Blender.

Uses the already installed Blender FBX binary reader without its bpy package init;
no image, FBX, import metadata, production data or library output is changed.
"""
from pathlib import Path
import importlib, types, sys, json, math, hashlib, struct
from collections import Counter

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
ADDON=ROOT/'tmp/tools/blender-4.5.13-windows-x64/4.5/scripts/addons_core/io_scene_fbx'
package=types.ModuleType('read_only_fbx');package.__path__=[str(ADDON)]
sys.modules['read_only_fbx']=package
threading=importlib.import_module('read_only_fbx.fbx_utils_threading')
threading._MULTITHREADING_ENABLED=False
reader=importlib.import_module('read_only_fbx.parse_fbx')

def child(node,name):return next((x for x in node.elems if x.id==name),None)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def chunks(a,n):return [tuple(a[i:i+n]) for i in range(0,len(a),n)]
def vector_cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def unit(v):
    length=math.sqrt(sum(x*x for x in v))
    return tuple(x/length for x in v) if length>1e-14 else (0,0,0)
def winding(vertices,polygon):
    # Accumulate actual fan triangle signed area; degenerate center-ring quads are tracked.
    cross=[0,0,0]
    for j in range(1,len(polygon)-1):
        c=vector_cross(sub(vertices[polygon[j]],vertices[polygon[0]]),sub(vertices[polygon[j+1]],vertices[polygon[0]]))
        cross=[a+b for a,b in zip(cross,c)]
    return unit(cross)

def inspect_fbx(path):
    root,version=reader.parse(str(path))
    objects=child(root,b'Objects');result={'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'fbxVersion':version,'geometry':[],'models':[]}
    settings=child(child(root,b'GlobalSettings'),b'Properties70')
    result['axes']={p.props[0].decode():list(p.props[4:]) for p in settings.elems if p.props[0] in [b'UpAxis',b'UpAxisSign',b'FrontAxis',b'FrontAxisSign',b'CoordAxis',b'CoordAxisSign',b'UnitScaleFactor']}
    for ob in objects.elems:
        if ob.id==b'Model' and ob.props[2]==b'Mesh':
            p=child(ob,b'Properties70')
            result['models'].append({'name':ob.props[1].decode().split('\x00')[0],'transform':{q.props[0].decode():list(q.props[4:]) for q in p.elems if q.props[0] in [b'Lcl Translation',b'Lcl Rotation',b'Lcl Scaling']}})
        if ob.id!=b'Geometry':continue
        vertices=chunks(child(ob,b'Vertices').props[0],3)
        indices=child(ob,b'PolygonVertexIndex').props[0]
        polygons=[];face=[]
        for index in indices:
            face.append(index if index>=0 else -index-1)
            if index<0:polygons.append(face);face=[]
        uv_layer=child(ob,b'LayerElementUV');normal_layer=child(ob,b'LayerElementNormal')
        uv=chunks(child(uv_layer,b'UV').props[0],2);uv_indices=child(uv_layer,b'UVIndex').props[0]
        normals=chunks(child(normal_layer,b'Normals').props[0],3)
        normal_index_node=child(normal_layer,b'NormalsIndex')
        normal_indices=normal_index_node.props[0] if normal_index_node else None
        normal_mapping=child(normal_layer,b'MappingInformationType').props[0]
        groups={};start=0
        for polygon in polygons:
            tex=[uv[uv_indices[i]] for i in range(start,start+len(polygon))]
            tile=int(sum(p[0] for p in tex)/len(tex)*8)+8*int(sum(p[1] for p in tex)/len(tex)*4)
            n=winding(vertices,polygon)
            group=groups.setdefault(tile,{'polygons':0,'nondegenerate':0,'up':0,'down':0,'side':0,'degenerate':0,'geometricZMin':1,'geometricZMax':-1,'storedNormalZMin':1,'storedNormalZMax':-1})
            group['polygons']+=1
            if n==(0,0,0):group['degenerate']+=1
            else:
                group['nondegenerate']+=1;group['up' if n[2]>.1 else 'down' if n[2]<-.1 else 'side']+=1
                group['geometricZMin']=min(group['geometricZMin'],n[2]);group['geometricZMax']=max(group['geometricZMax'],n[2])
            raw_normal_indices=polygon if normal_mapping==b'ByVertice' else range(start,start+len(polygon))
            face_normals=[normals[normal_indices[i] if normal_indices is not None else i] for i in raw_normal_indices]
            for raw in face_normals:
                group['storedNormalZMin']=min(group['storedNormalZMin'],raw[2]);group['storedNormalZMax']=max(group['storedNormalZMax'],raw[2])
            start+=len(polygon)
        result['geometry'].append({'name':ob.props[1].decode().split('\x00')[0],'vertices':len(vertices),'polygons':len(polygons),'atlasTileGroups':groups})
    return result

def inspect_cocos():
    folder=ROOT/'game/library/5b';prefix='5b5b1616-e6b8-4b3c-86ea-c733fe071d18'
    path=folder/(prefix+'@ae720.json');model=json.loads(path.read_text(encoding='utf-8'));raw=(folder/(prefix+'@ae720.bin')).read_bytes()
    bundle=model['_struct']['vertexBundles'][0];view=bundle['view']
    vertices=[struct.unpack_from('<3f',raw,view['offset']+i*view['stride']) for i in range(view['count'])]
    normals=[struct.unpack_from('<3f',raw,view['offset']+i*view['stride']+12) for i in range(view['count'])]
    uv=[struct.unpack_from('<2f',raw,view['offset']+i*view['stride']+24) for i in range(view['count'])]
    iv=model['_struct']['primitives'][0]['indexView'];assert iv['stride']==2
    indices=struct.unpack_from('<'+'H'*iv['count'],raw,iv['offset']);groups={}
    for face in chunks(indices,3):
        tex=[uv[i] for i in face];tile=int(sum(p[0] for p in tex)/3*8)+8*int(sum(p[1] for p in tex)/3*4)
        n=winding(vertices,face);g=groups.setdefault(tile,Counter());g['triangles']+=1
        g['degenerate' if n==(0,0,0) else 'localZPositive' if n[2]>.1 else 'localZNegative' if n[2]<-.1 else 'side']+=1
        g['storedZPositive' if sum(normals[i][2] for i in face)>0 else 'storedZNegative']+=1
    prefab=json.loads((folder/(prefix+'@5d37f.json')).read_text(encoding='utf-8'))
    ground=next(p for p in prefab if p.get('__type__')=='cc.Node' and p.get('_name')=='Ground')
    return {'path':path.relative_to(ROOT).as_posix(),'jsonSha256':sha(path),'binSha256':hashlib.sha256(raw).hexdigest(),'groupsByImportedUvTile':groups,
            'groundNodeRotation':ground['_lrot'],'groundNodeScale':ground['_lscale'],
            'material':json.loads((folder/(prefix+'@0ba3a.json')).read_text(encoding='utf-8'))}

paths={
 'boss':ROOT/'game/art-source/environment/boss-bay/candidate-01/boss-bay.fbx',
 'dusk':ROOT/'game/art-source/environment/dusk-bay/candidate-01/dusk-bay.fbx',
 'coral':ROOT/'game/art-source/environment/coral-bend/candidate-01/coral-bend.fbx',
 'home':ROOT/'game/art-source/environment/home-island/candidate-01/home-island.fbx',
}
if __name__=='__main__':
    report={'method':'Ordinary Python; installed binary FBX reader, no Blender process. Geometry cross products plus actual exported loop normals grouped by atlas UV tile. Cocos imported binary read separately. All source assets are read-only.','fbx':{k:inspect_fbx(p) for k,p in paths.items()},'cocosBossGround':inspect_cocos()}
    (OUT/'surface-normal-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:next(g for g in v['geometry'] if 'grass' in g['name'].lower()) for k,v in report['fbx'].items()},ensure_ascii=False,indent=2))
    print(json.dumps(report['cocosBossGround']['groupsByImportedUvTile'],indent=2))
