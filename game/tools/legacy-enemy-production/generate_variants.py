"""Bake continuous five-grade material atlases from the approved G1 surface colors."""
from pathlib import Path
import json,colorsys,struct,numpy as np
from PIL import Image
R=Path(__file__).resolve().parent;W=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui')
GRADES=['blue','purple','orange','red','gold']
COLORS=['4DACEB','AC77DD','E79A48','DE6456','EAC254']
HUES={'B01':(0,.12),'B02':(.36,.23),'B03':(.50,.19),'B04':(.30,.22),'B05':(.74,.22),'B07':(.42,.23),'B08':(.50,.18),'B09':(.55,.22),'B10':(.055,.11),'E01':(.55,.20)}
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def face_protection(ID,size=1024):
 data=(R/'production'/ID/(ID.lower()+'.glb')).read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);binary=data[28+length:]
 def accessor(index):
  a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']];dtype=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);n={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
  return np.ndarray((a['count'],n),dtype=dtype,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',n*dtype.itemsize),dtype.itemsize))
 mask=np.zeros((size,size),np.float32)
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   p=accessor(primitive['attributes']['POSITION']);uv=accessor(primitive['attributes']['TEXCOORD_0'])*(size-1);faces=accessor(primitive['indices']).reshape(-1,3)
   x,z,front=p.T;W=max(abs(x).max(),.01);D=max(abs(front).max(),.01)
   weight=(1-smooth(W*.23,W*.46,abs(x)))*smooth(D*.10,D*.37,front)*smooth(.32,.65,z)*(1-smooth(1.55,1.86,z))
   for indices in faces:
    w=weight[indices]
    if w.max()<.01:continue
    tri=uv[indices];low=np.floor(tri.min(0)).astype(int).clip(0,size-1);high=np.ceil(tri.max(0)).astype(int).clip(0,size-1)
    xx,yy=np.meshgrid(np.arange(low[0],high[0]+1)+.5,np.arange(low[1],high[1]+1)+.5)
    a,b,c=tri;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-9:continue
    u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;v=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;t=1-u-v
    values=np.where((u>=0)&(v>=0)&(t>=0),u*w[0]+v*w[1]+t*w[2],0)
    region=mask[low[1]:high[1]+1,low[0]:high[0]+1];np.maximum(region,values,out=region)
 return mask
def build(ID):
 key=ID.lower();source=R/'production'/ID/f'{key}_texture_0.png'
 image=Image.open(source).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
 rgb=np.asarray(image,dtype=np.float32)/255;hsv=np.asarray(image.convert('HSV'),dtype=np.float32)/255
 h,s,v=hsv.transpose(2,0,1)
 if ID=='B06':mask=smooth(.12,.28,v)
 else:
  center,width=HUES[ID];distance=np.minimum(abs(h-center),1-abs(h-center))
  mask=np.clip((width-distance)/.065,0,1)*np.clip((s-.13)/.17,0,1)*np.clip((v-.12)/.2,0,1)
 if ID in ['B06','B07','B08','E01']:
  stone=(1-smooth(.36,.56,s))*(1-smooth(.70,.84,v))*smooth(.16,.32,v)
  mask=np.maximum(mask,stone)
 cream=smooth(.64,.83,v)*(1-smooth(.25,.42,s))*((h>.055)&(h<.20))
 mask*=1-cream;mask*=1-face_protection(ID)
 folder=W/'game/assets/resources/enemy-g1/variants'/key;folder.mkdir(parents=True,exist_ok=True)
 for grade,hexcolor in zip(GRADES,COLORS):
  hue,saturation,_=colorsys.rgb_to_hsv(*[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)])
  values=np.stack([np.full_like(v,hue),np.clip(s*.65+saturation*.35,.25,.82),v],axis=-1)
  colored=np.asarray(Image.fromarray(np.uint8(values*255),'HSV').convert('RGB'),dtype=np.float32)/255
  result=np.clip(rgb*(1-mask[:,:,None])+colored*mask[:,:,None],0,1)
  Image.fromarray(np.uint8(result*255)).save(folder/(grade+'.png'),optimize=True)
 return {'id':ID,'size':1024,'grades':GRADES,'source':str(source),'changedPixelFraction':float((mask>.1).mean())}
if __name__=='__main__':
 report=[build(ID) for ID in [*HUES,'B06']]
 (R/'mutation-atlases.json').write_text(json.dumps(report,indent=2),'utf8');print('Five-grade surface atlases:',len(report))
