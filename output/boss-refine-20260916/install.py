from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,shutil,hashlib,sys,math
R=Path(__file__).resolve().parent;ROOT=R.parents[1];P=json.loads((R/'plan.json').read_text('utf8'))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
def atlas(records,name,cell,cols,review=False):
 rows=math.ceil(len(records)/cols);im=Image.new('RGBA',(cols*cell,rows*(cell+(30 if review else 0))),('#EAF1E9' if review else (0,0,0,0)))
 d=ImageDraw.Draw(im)
 for i,r in enumerate(records):
  p=R/'production'/r['key']/'portrait.png'
  if not p.exists():continue
  figure=Image.open(p).convert('RGBA');alpha=figure.getchannel('A');box=alpha.getbbox()
  if box:
   figure=figure.crop(box);figure.thumbnail((int(cell*.91),int(cell*.90)),Image.Resampling.LANCZOS)
   x=i%cols*cell+(cell-figure.width)//2;y=i//cols*(cell+(30 if review else 0))+(cell-figure.height)//2
   im.alpha_composite(figure,(x,y))
  if review:d.text((i%cols*cell+8,i//cols*(cell+30)+cell),r['key']+' '+r.get('displayName',r['name']),font=font,fill='#234956')
 dest=R/(name+('.review.png' if review else '.png'));im.save(dest);return dest
for group,name,cell,cols in [(P['bosses'],'boss-finished-roster',256,8),(P['world'],'world-finished-roster',384,5)]:
 atlas(group,name,cell,cols,True)
if '--review' in sys.argv:sys.exit(0)
records=[*P['bosses'],*P['world']];metrics=[]
for r in records:
 src=R/'production'/r['key'];manifest=json.loads((src/'manifest.json').read_text('utf8'))
 assert manifest.get('artVersion')==3 and manifest.get('runtimeOptimized'),r['key']
 assert manifest['drawMaterials']<=2,(r['key'],manifest['drawMaterials'])
 assert all(c in manifest['clips'] for c in ['idle','walk','attack','skill','exit']),r['key']
 for name in [r['key']+'.fbx',r['key']+'.glb',r['key']+'_albedo.png',r['key']+'_normal.png',r['key']+'_surface.png','portrait.png']:
  assert (src/name).stat().st_size>100,name
 target=ROOT/'game/assets/resources/models-fauna'/r['key'];target.mkdir(parents=True,exist_ok=True)
 for f in [src/(r['key']+'.fbx'),src/(r['key']+'_albedo.png'),src/(r['key']+'_normal.png'),src/(r['key']+'_surface.png')]:
  to=target/f.name
  if to.exists():
   old=R/'before-assets'/r['key']/f.name;old.parent.mkdir(parents=True,exist_ok=True)
   if not old.exists():shutil.copy2(to,old)
  shutil.copy2(f,to)
 (target/'license-and-source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8');metrics.append(manifest)
for group,name,cell,cols in [(P['bosses'],'boss-finished-roster',256,8),(P['world'],'world-finished-roster',384,5)]:
 src=atlas(group,name,cell,cols);target=ROOT/'game/assets/resources/art-modern'/src.name
 if target.exists():
  old=R/'before-assets'/src.name
  if not old.exists():shutil.copy2(target,old)
 shutil.copy2(src,target)
(R/'installed.json').write_text(json.dumps({'count':len(metrics),'normal':59,'bosses':48,'world':5,'maxMaterials':max(m['drawMaterials'] for m in metrics),'triangles':{'min':min(m['triangles'] for m in metrics),'max':max(m['triangles'] for m in metrics)},'assets':metrics},ensure_ascii=False,indent=2))
print('INSTALLED',len(metrics),'rigged meshes and matching portraits')
