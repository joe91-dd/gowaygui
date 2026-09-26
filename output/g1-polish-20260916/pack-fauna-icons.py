from PIL import Image
from pathlib import Path
import json
root=Path(__file__).resolve().parent
dest=root.parents[1]/'game/assets/resources/art-modern/fauna-roster.png'
atlas=Image.new('RGBA',(2048,2048))
for i,f in enumerate(json.loads((root/'fauna-inputs.json').read_text('utf8'))):
 image=Image.open(root/'production'/f['key']/'preview.png').convert('RGBA')
 image=image.resize((256,256),Image.Resampling.LANCZOS)
 atlas.alpha_composite(image,((i%8)*256,(i//8)*256))
atlas.save(dest);atlas.save(root/'fauna-roster.png')
print('FAUNA_ICONS',dest)
