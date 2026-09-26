from pathlib import Path
from PIL import Image,ImageStat
import json,struct
R=Path(__file__).resolve().parent;plan=json.loads((R/'plan.json').read_text('utf8'));result=[]
for r in [*plan['fauna'],*plan['bosses'],*plan['world']]:
 key=r['key'];folder=R/'production'/key;m=json.loads((folder/'manifest.json').read_text('utf8'))
 assert m['artVersion']==4 and m['runtimeOptimized'] and m['tangentsExported'],key
 assert m['drawMaterials']<=2 and m['triangles']<48000,key
 b=(folder/(key+'.glb')).read_bytes();assert b[:4]==b'glTF';g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
 body=next(x for x in g['materials'] if x['name'].startswith('CC0_CoastalAtlas'));assert 'normalTexture' in body and 'metallicRoughnessTexture' in body['pbrMetallicRoughness'],key
 for mesh in g['meshes']:
  for p in mesh['primitives']:
   assert all(a in p['attributes'] for a in ['POSITION','NORMAL','TANGENT','TEXCOORD_0','JOINTS_0','WEIGHTS_0']),key
 names=[a['name'] for a in g['animations']];assert all(a in names for a in ['idle','walk','attack','skill','exit']),key
 normal=Image.open(folder/(key+'_normal.png')).convert('RGB');surface=Image.open(folder/(key+'_surface.png')).convert('RGB');assert normal.size==surface.size
 assert normal.getextrema()[2][1]>=200,key
 if not key.startswith('fauna-'):assert ImageStat.Stat(normal).stddev[0]>1,key
 assert ImageStat.Stat(surface).stddev[1]>1,key
 result.append({'key':key,'triangles':m['triangles'],'masterTriangles':m['masterTriangles'],'materials':m['drawMaterials'],'textureResolution':normal.size,'animations':len(names)})
(R/'asset-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');print('VALIDATED',len(result),'rigged PBR assets')
