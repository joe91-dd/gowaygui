from pathlib import Path
from shutil import copyfile
root=Path(__file__).resolve().parents[2]
copyfile(root/'output/pearl-ui-20260917/pearl-skins.png',root/'game/assets/resources/art-modern/pearl-skins.png')
p=root/'game/assets/scripts/view/ArtV2Assets.ts'
s=p.read_text(encoding='utf-8')
s=s.replace('export type ArtV2Image=',"export type ArtV2Image='pearl-skins'|",1)
s=s.replace('export type ArtV2Slice=',"export type ArtV2Slice='pearl-panel'|'pearl-primary'|'pearl-selected'|'pearl-secondary'|'pearl-disabled'|'pearl-navy'|",1)
s=s.replace('const IMAGES:ArtV2Image[]=[',"const IMAGES:ArtV2Image[]=['pearl-skins',",1)
s=s.replace('const modern:Partial<Record<ArtV2Image,string>>={',"const modern:Partial<Record<ArtV2Image,string>>={'pearl-skins':'pearl-skins',",1)
needle='    for(const [role,x,y,w,h] of crops){'
insert="""    const pearl=this.images.get('pearl-skins')!.texture!;
    const pearlRects:[ArtV2Slice,number,number,number,number][]=[['pearl-panel',46,174,450,236],['pearl-primary',545,176,449,234],['pearl-selected',1043,174,454,237],['pearl-secondary',46,615,450,226],['pearl-disabled',545,615,450,226],['pearl-navy',1039,622,462,215]];
    pearlRects.forEach(([key,x,y,w,h])=>{const f=frame(pearl,x,y,w,h);f.insetLeft=60;f.insetRight=60;f.insetTop=60;f.insetBottom=60;this.frames.set(key,f);this.sliced.add(key);});
"""
s=s.replace(needle,insert+needle,1)
p.write_text(s,encoding='utf-8')
