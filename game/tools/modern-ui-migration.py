from pathlib import Path
root=Path(__file__).resolve().parents[1]
effect=Path('C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/editor/assets/effects/for2d/builtin-sprite.effect').read_text(encoding='utf8')
effect=effect.replace('    o *= color;', '''    #if CREAM_KEY
      float creamDistance = length(o.rgb - vec3(0.99, 0.975, 0.918));
      o.a *= smoothstep(0.06, 0.22, creamDistance);
    #else
      float magenta = min(o.r, o.b) - o.g;
      float key = smoothstep(0.28, 0.50, magenta) * smoothstep(0.52, 0.74, min(o.r, o.b));
      o.a *= 1.0 - key;
      float spill = max(0.0, min(o.r, o.b) - o.g - 0.20);
      o.r -= spill * 0.65;
      o.b -= spill * 0.40;
    #endif
    o *= color;''')
(root/'assets/resources/art-modern/chroma-sprite.effect').write_text(effect,encoding='utf8')
p=root/'assets/scripts/view/ArtV2Assets.ts'
s=p.read_text(encoding='utf8').replace('Color,ImageAsset','Color,EffectAsset,Material,ImageAsset')
s=s.replace("|'shop-icons';","|'shop-icons'|'hero-lineup-keyed'|'functional-icons'|'home-stone-keyed';")
s=s.replace("|'shop-5';","|'shop-5'|`modern-${number}`;")
s=s.replace("'skill-icons','shop-icons'];","'skill-icons','shop-icons','hero-lineup-keyed','functional-icons','home-stone-keyed'];")
s=s.replace("  private generation=0;","  private generation=0;\n  private keyMaterial?:Material;\n  private iconMaterial?:Material;")
s=s.replace("    for(const key of IMAGES)","""    resources.load('art-modern/chroma-sprite',EffectAsset,(error,effect)=>{
      if(generation!==this.generation||this.state!=='loading')return;
      if(error||!effect){this.error=error?.message||'角色材质未载入';this.state='failed';return;}
      this.keyMaterial=new Material();this.keyMaterial.initialize({effectAsset:effect,defines:{USE_TEXTURE:true}});
      this.iconMaterial=new Material();this.iconMaterial.initialize({effectAsset:effect,defines:{USE_TEXTURE:true,CREAM_KEY:true}});
      this.finishLoading();
    });
    const modern:Partial<Record<ArtV2Image,string>>={'home-background':'home-environment','login-background':'home-environment','arena-background':'home-environment','fusion-background':'fusion-environment','hero-lineup-keyed':'hero-lineup-keyed','functional-icons':'functional-icons','home-stone-keyed':'home-stone-keyed'};
    for(const key of IMAGES)""")
s=s.replace('resources.load(`art-v2/${key}`','resources.load(modern[key]?`art-modern/${modern[key]}`:`art-v2/${key}`')
s=s.replace("if(this.images.size===IMAGES.length){this.makeSkins();this.state='ready';}","this.finishLoading();")
s=s.replace('  private makeSkins():void{',"  private finishLoading():void{if(this.images.size===IMAGES.length&&this.keyMaterial&&this.state==='loading'){this.makeSkins();this.state='ready';}}\n  private makeSkins():void{")
at=s.index("    const crops:")
end=s.index('\n  attach(',at)
s=s[:at]+'''    const atlas=this.images.get('hero-lineup-keyed')!.texture!;
    const crops:[string,number,number,number,number][]=[['stone',82,319,252,264],['spike',533,226,310,374],['crystal',935,217,305,384],['leaf',1334,228,318,375],['bubble',1740,210,345,394]];
    const frame=(texture:Texture2D,x:number,y:number,w:number,h:number)=>{const f=new SpriteFrame();f.texture=texture;f.packable=false;f.rect=new Rect(x,y,w,h);f.originalSize=new Size(w,h);return f;};
    for(const [role,x,y,w,h] of crops){
      this.frames.set(`hero-${role}` as ArtV2Slice,frame(atlas,x,y,w,h));
      this.frames.set(`portrait-${role}` as ArtV2Slice,frame(atlas,x,y,w,Math.min(w,h)));
    }
    const tank=this.images.get('home-stone-keyed')!;
    this.frames.set('hero-stone' as ArtV2Slice,frame(tank.texture!,0,0,tank.image.width,tank.image.height));
    const icons=this.images.get('functional-icons')!,bound=[0,314,627,941,1254];
    for(let i=0;i<16;i++)this.frames.set(`modern-${i}`,frame(icons.texture!,bound[i%4]+12,bound[Math.floor(i/4)]+12,bound[i%4+1]-bound[i%4]-24,bound[Math.floor(i/4)+1]-bound[Math.floor(i/4)]-24));
    const skills=[['stone',11],['spike',12],['crystal',13],['leaf',14],['bubble',15]] as const;
    for(const [role,index] of skills){this.frames.get(`skill-${role}`)?.destroy();this.frames.set(`skill-${role}`,this.frames.get(`modern-${index}`)!);}
    [0,0,1,12,14,2].forEach((index,i)=>{this.frames.get(`shop-${i}` as ArtV2Slice)?.destroy();this.frames.set(`shop-${i}` as ArtV2Slice,this.frames.get(`modern-${index}`)!);});
  }
''' + s[end:]
s=s.replace('sprite.trim=false;sprite.color=tint;',"""sprite.trim=false;sprite.color=tint;
    const hero=key.startsWith('hero-')||key.startsWith('portrait-');
    if(hero)sprite.customMaterial=this.keyMaterial!;
    else if(key.startsWith('modern-')||key.startsWith('skill-')||key.startsWith('shop-'))sprite.customMaterial=this.iconMaterial!;""")
s=s.replace('n.getComponent(UITransform)!.setContentSize(w*(sliced?2:1),h*(sliced?2:1));',"""if(hero&&key.startsWith('hero-')){const ratio=frame.rect.width/frame.rect.height;if(w/h>ratio)w=h*ratio;else h=w/ratio;}
    n.getComponent(UITransform)!.setContentSize(w*(sliced?2:1),h*(sliced?2:1));""")
s=s.replace('for(const frame of this.frames.values())frame.destroy();','this.keyMaterial?.destroy();this.iconMaterial?.destroy();this.keyMaterial=undefined;this.iconMaterial=undefined;\n    for(const frame of new Set(this.frames.values()))frame.destroy();')
p.write_text(s,encoding='utf8')

p=root/'assets/scripts/view/IslandUI.ts';s=p.read_text(encoding='utf8')
s=s.replace("cream:'#FFF7E7',sand:'#BDD6DE',gold:'#F6BE43',edge:'#B9AC82',green:'#098BC7',dark:'#123A54',muted:'#849CAA'","cream:'#153B55',sand:'#527889',gold:'#007F97',edge:'#BDDADF',green:'#00AABB',dark:'#FFF9EC',muted:'#76939A'")
start=s.index('    if(this.art?.ready){const quality=');end=s.index('    const g=n.addComponent(Graphics);',start)
s=s[:start]+'''    if(this.art?.ready){
      const neutral=['#47645C','#725132','#395551','#436F79','#123A54','#FFF4DD'].includes(hex);
      if(neutral)hex=UI_COLORS.dark;
      const g=n.addComponent(Graphics),r=Math.min(radius,w/2,h/2);
      g.fillColor=color('#124758',25);g.roundRect(-w/2+1,-h/2-3,w,h,r);g.fill();
      g.fillColor=color(hex,opacity);g.roundRect(-w/2,-h/2,w,h,r);g.fill();
      g.lineWidth=1.5;g.strokeColor=color(hex===UI_COLORS.gold||hex===UI_COLORS.green?'#92F4F2':'#C7DDDC',230);g.roundRect(-w/2,-h/2,w,h,r);g.stroke();
      return n;
    }
    if(this.panels?.supports(radius,w,h)){this.panels.attach(n,w,h,radius,color(hex,opacity));return n;}
''' + s[end:]
s=s.replace("hex=disabled?'#CBDADF':primary||options.surface==='paper'&&!selected?UI_COLORS.ink:UI_COLORS.cream", "hex=disabled?'#E5EDEC':primary||selected?'#FFFFFF':UI_COLORS.ink")
s=s.replace("g.fillColor=color('#152D2F');g.roundRect", "g.fillColor=color('#DCE3DF');g.roundRect")
s=s.replace("  icon(id:IslandIconId", "  modernIcon(index:number,x:number,y:number,size=52,parent=this.root,tint=Color.WHITE):Node{const n=this.group('功能图标:'+index,x,y,parent,size,size);this.art?.attach(n,`modern-${index}`,size,size,tint);return n;}\n  icon(id:IslandIconId")
s=s.replace("active?'#AFE5ED':UI_COLORS.cream", "active?'#007D93':UI_COLORS.cream")
p.write_text(s,encoding='utf8')
