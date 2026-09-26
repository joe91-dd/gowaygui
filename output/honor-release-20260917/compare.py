from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
p=Path('output/honor-release-20260917')
r=Path('C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14')
items=[('loading','exec-098170b6-b4e2-4ab5-a8c7-a4c06ed89ec1.png','loading.png'),('pet','exec-e2966095-f9dd-4fc9-ad3e-13e673a374bb.png','pet-final.png'),('arena','exec-c8cb7013-7c12-49ff-bbca-955ab5467fbd.png','arena.png')]
for name,ref,actual in items:
 canvas=Image.new('RGB',(1920,564),'#193c50');d=ImageDraw.Draw(canvas);d.text((20,6),'APPROVED DESIGN',fill='white');d.text((980,6),'GAME IMPLEMENTATION',fill='white')
 for i,img in enumerate([r/ref,p/actual]):canvas.paste(ImageOps.fit(Image.open(img).convert('RGB'),(960,540)),(i*960,24))
 canvas.save(p/f'compare-{name}.jpg',quality=90)
