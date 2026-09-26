from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'assets/scripts/view/ArtV2Assets.ts';s=p.read_text(encoding='utf8')
s=s.replace("|'home-stone-keyed';", "|'home-stone-keyed'|'home-controls-keyed';").replace("|`modern-${number}`;", "|`modern-${number}`|`control-${number}`;")
s=s.replace("'functional-icons','home-stone-keyed'];", "'functional-icons','home-stone-keyed','home-controls-keyed'];")
s=s.replace("'home-stone-keyed':'home-stone-keyed'}", "'home-stone-keyed':'home-stone-keyed','home-controls-keyed':'home-controls-keyed'}")
s=s.replace("    const skills=[", """    const controls=this.images.get('home-controls-keyed')!;
    for(let i=0;i<8;i++){const w=controls.image.width/4,h=controls.image.height/2;this.frames.set(`control-${i}`,frame(controls.texture!,Math.round(i%4*w+30),Math.round(Math.floor(i/4)*h+30),Math.floor(w-60),Math.floor(h-60)));}
    const skills=[""")
s=s.replace("if(hero)sprite.customMaterial", "if(hero||key.startsWith('control-'))sprite.customMaterial")
p.write_text(s,encoding='utf8')
p=root/'assets/scripts/view/GameEntry.ts';s=p.read_text(encoding='utf8').replace('Mask, Camera, Canvas, Color, Component','Mask, Camera, Canvas, Component').replace('Mask.Type.ELLIPSE','Mask.Type.GRAPHICS_ELLIPSE').replace('this.staminaDialog()','this.energyDialog()')
s=s.replace("this.ui.button('改名',-414,311,58,38,()=>this.communityEntry('rename'),{size:17});", "const rename=this.ui.button('',-444,311,34,34,()=>this.communityEntry('rename'));this.art?.attach(rename,'control-5',24,24);")
s=s.replace("this.ui.button('设置',589,319,56,56,()=>this.go('settings'),{primary:true,size:19});", "const settings=this.ui.button('',589,319,56,56,()=>this.go('settings'),{primary:true});this.art?.attach(settings,'control-4',35,35);")
s=s.replace("this.ui.modernIcon(icon,0,17,70,n,i===0?Color.WHITE:new Color('#184865'));", "const pict=this.ui.group('模式图标',0,17,n,70,70);this.art?.attach(pict,`control-${i}`,70,70);")
s=s.replace("const primary=this.ui.button(pending?", "const primary=this.ui.button(pending?")
s=s.replace("primary.name='主页开始冒险';", "primary.name='主页开始冒险';const arrow=this.ui.group('继续箭头',130,0,primary,37,37);this.art?.attach(arrow,'control-7',37,37);for(const child of primary.children){const label=child.getComponent(Label);if(label){child.setPosition(-16,0);child.getComponent(UITransform)?.setContentSize(258,65);}}")
s=s.replace("this.ui.button('调整',549,-108,112,42,()=>{this.go('levels');this.chooseTeam(level.id);},{size:22});", "const adjust=this.ui.button('调整',549,-108,112,42,()=>{this.go('levels');this.chooseTeam(level.id);},{size:22});const adjustIcon=this.ui.group('调整图标',-34,0,adjust,25,25);this.art?.attach(adjustIcon,'control-6',25,25);for(const c of adjust.children)if(c.getComponent(Label))c.setPosition(12,0);")
p.write_text(s,encoding='utf8')
import json
p=root/'build-config.art-v2.json';config=json.loads(p.read_text(encoding='utf8-sig'));config.update(name='哥喂龟 现代海岛战术版',outputName='modern-tactics');(root/'build-config.modern-tactics.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf8')
