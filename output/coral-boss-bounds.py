import json
from PIL import Image
from pathlib import Path
root=Path('game/assets/resources/art-modern')
rows={'green':[0,418,822,1254],'blue':[0,440,838,1254],'purple':[0,445,833,1254],'yellow':[0,442,856,1254],'red':[0,500,933,1254],'gold':[0,476,920,1254]}
counts=[9,9,7,7,5,5];result={}
for (tier,ys),count in zip(rows.items(),counts):
 im=Image.open(root/f'boss-{tier}-roster.png').convert('RGB');w,h=im.size
 print(tier,im.size)
 # Read source pixels only. SpriteFrame crops and chroma removal happen in-engine.
 crops=[]
 for i in range(count):
  l=int((i%3)*w/3);r=int((i%3+1)*w/3);t=int(ys[i//3]/1254*h);b=int(ys[i//3+1]/1254*h)
  points=[]
  for y in range(t,b):
   for x in range(l,r):
    red,g,blue=im.getpixel((x,y))
    if not(red>g+65 and blue>g+65 and red>140 and blue>140):points.append((x,y))
  x0=max(l,min(x for x,y in points)-3);x1=min(r,max(x for x,y in points)+4)
  y0=max(t,min(y for x,y in points)-3);y1=min(b,max(y for x,y in points)+2)
  crops.append([x0,y0,x1-x0,y1-y0])
 result[tier]=crops
Path('output/coral-expansion-20260914/boss-bounds.json').write_text(json.dumps(result))
