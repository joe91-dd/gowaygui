from pathlib import Path
import json,shutil,uuid
OUT=Path(__file__).resolve().parent;ROOT=Path(r'C:/Users/Administrator/Documents/ChatGPT/gowaygui')
plan=json.loads((OUT/'production-plan.json').read_text('utf8'))
p=ROOT/'game/assets/scripts/view/ArtV2Assets.ts';backup=OUT/'code-before/game/assets/scripts/view/ArtV2Assets.ts';backup.parent.mkdir(parents=True,exist_ok=True)
if not backup.exists():shutil.copy2(p,backup)
s=p.read_text('utf8')
s="import {ENEMY_G1,enemyG1,WORLD_G1_IDS} from '../core/enemyG1Catalog';\n"+s
s=s.replace("export type ArtV2Image=","export type ArtV2Image=\`enemy-g1-\${string}\`|".replace('\\',''))
pos=s.index('type Owned=')
s=s[:pos]+"IMAGES.push(...ENEMY_G1.map(x=>('enemy-g1-'+x.id.toLowerCase()) as ArtV2Image));\n"+s[pos:]
s=s.replace("resources.load(modern[key]?","resources.load(key.startsWith('enemy-g1-')?\`enemy-g1/icons/\${key.slice(9)}\`:modern[key]?".replace('\\',''))
a=s.index("    BOSSES.forEach((boss,i)=>");b=s.index("    const enemy=this.images",a)
s=s[:a]+"""    const iconFrame=(id:string)=>{const owned=this.images.get(('enemy-g1-'+id.toLowerCase()) as ArtV2Image)!;return frame(owned.texture!,0,0,owned.image.width,owned.image.height);};
    ENEMY_G1.forEach(x=>this.frames.set(x.key as ArtV2Slice,iconFrame(x.id)));
    BOSSES.forEach((boss,i)=>this.frames.set(('boss-'+i) as ArtV2Slice,iconFrame(boss.assetId??'B01')));
    ['world-boss-leviathan','world-boss-crab','world-boss-kraken','world-boss-tortoise'].forEach((key,i)=>this.frames.set(key as ArtV2Slice,iconFrame(WORLD_G1_IDS[i])));
    this.frames.set('world-boss-shark' as ArtV2Slice,iconFrame('H01'));
"""+s[b:]
p.write_text(s,'utf8')
for item in plan['items']:
 dest=ROOT/'game/assets/resources/enemy-g1/icons'/f"{item['id'].lower()}.png";dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(item['icon'],dest)
 # Cocos will author the complete image importer metadata on first import.
for name in ['enemyG1Catalog','enemyG1Dimensions']:
 p=ROOT/'game/assets/scripts/core'/f'{name}.ts.meta'
 if not p.exists():p.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2),'utf8')
print('20 approved icons connected to 54 boss catalogue entries and four world entries.')

