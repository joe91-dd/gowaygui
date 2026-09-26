from pathlib import Path
from PIL import Image
import json,hashlib
root=Path(__file__).resolve().parent;src=root/'cc0-effects';out=root.parent.parent/'game/assets/resources/models-g1/fx';out.mkdir(parents=True,exist_ok=True)
sets=[list((src/'water/03').glob('*.png')),list((src/'earth/2').glob('*.png')),list((src/'nature').glob('1-*.png')),list((src/'arcane/05').glob('*.png'))]
atlas=Image.new('RGBA',(2048,1024));report=[]
for row,files in enumerate(sets):
 files=sorted(files);images=[Image.open(f).convert('RGBA') for f in files];w=max(im.width for im in images);h=max(im.height for im in images);scale=min(236/w,236/h)
 for col,im in enumerate(images):
  im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);atlas.alpha_composite(im,(col*256+(256-im.width)//2,row*256+(256-im.height)//2))
 report.append({'row':row,'frames':len(files),'files':[str(p.relative_to(src)) for p in files]})
atlas.save(out/'cethiel-spells.png');atlas.save(src/'runtime-atlas.png')
license={'author':'Cethiel','license':'CC0 1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/','verified':'2026-09-16','sources':['https://opengameart.org/content/water-magic-effect','https://opengameart.org/content/earth-impact-magic-effect','https://opengameart.org/content/nature-magic-effect','https://opengameart.org/content/arcane-magic-effect'],'changes':'Frame padding and atlas packing; runtime colour grading, interpolation, ground alignment and pooled playback. Original ZIP files retained.','sequences':report,'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.zip') if p.stat().st_size>1000}}
(src/'LICENSE-and-sources.json').write_text(json.dumps(license,ensure_ascii=False,indent=2),encoding='utf8');(out/'cethiel-license.json').write_text(json.dumps(license,ensure_ascii=False,indent=2),encoding='utf8');print(report)
