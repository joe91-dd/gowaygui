from pathlib import Path
p=Path(__file__).resolve().parents[1]/'assets/scripts/view/GameEntry.ts'
s=p.read_text(encoding='utf8').replace('import {_decorator,', 'import {_decorator,Color,Graphics,Mask,')
s=s.replace("  private homeChatOpen=false;", "  private homeChatOpen=false;\n  private homeHeroRole:Role='stone';")
a=s.index('  private home():void{');b=s.index('  private endless():void{',a)
s=s[:a]+'''  private home():void{
    const s=this.service!.snapshot,ongoing=s.run,pending=pendingTakeaways(s).length;
    const roles:Role[]=['stone','spike','crystal','leaf','bubble'];
    const pets=availablePets(s).map(p=>p.turtle),team=roles.map(role=>pets.find(p=>p.role===role));
    const hero=team[roles.indexOf(this.homeHeroRole)]??pets[0],role=hero?.role??this.homeHeroRole;
    const circlePortrait=(r:Role,x:number,y:number,size:number,parent=this.ui.root,selected=false)=>{
      const n=this.ui.group('圆形伙伴:'+r,x,y,parent,size,size),g=n.addComponent(Graphics);
      g.fillColor=Color.WHITE;g.circle(0,0,size/2);g.fill();
      g.strokeColor=new Color(selected?'#FF8755':'#E3EAE6');g.lineWidth=selected?4:2;g.circle(0,0,size/2-2);g.stroke();
      const clip=this.ui.group('头像裁切',0,0,n,size-8,size-8);clip.addComponent(Mask).type=Mask.Type.ELLIPSE;
      this.art?.attach(clip,`portrait-${r}`,size-8,size-8);return n;
    };
    circlePortrait('crystal',-578,312,64);
    this.ui.text(s.community?.name??'小岛主',-497,310,24,UI_COLORS.ink,this.ui.root,124,38);
    this.ui.button('改名',-414,311,58,38,()=>this.communityEntry('rename'),{size:17});
    const coins=this.ui.panel(278,319,178,46,this.ui.root,'#07536C',255,23);this.ui.icon('gold',-66,0,35,coins);
    this.goldLabel=this.ui.text(displayGold(s.gold),15,0,27,'#FFFFFF',coins,135,36);
    const energy=this.ui.panel(460,319,174,46,this.ui.root,'#07536C',255,23);this.ui.icon('stamina',-63,0,33,energy);
    this.staminaLabel=this.ui.text(`${s.stamina}/30`,-1,0,26,'#FFFFFF',energy,94,36);
    this.ui.button('+',61,0,38,38,()=>this.staminaOffer(),{parent:energy,primary:true,size:31});
    this.ui.button('设置',589,319,56,56,()=>this.go('settings'),{primary:true,size:19});
    const left=(text:string,x:number,y:number,size:number,w:number)=>{const l=this.ui.text(text,x,y,size,UI_COLORS.ink,this.ui.root,w,size*1.4);l.horizontalAlign=Label.HorizontalAlign.LEFT;return l;};
    this.ui.panel(-603,242,7,30,this.ui.root,UI_COLORS.green,255,3);left('冒险',-511,242,33,156);
    const modes:[string,number,()=>void][]=[['关卡',7,()=>this.go('levels',Math.floor(s.unlockedLevel/6))],['无尽',8,()=>this.go('endless')],['副本',9,()=>this.communityEntry('raids')],['竞技场',10,()=>this.communityEntry('arena')]];
    modes.forEach(([title,icon,action],i)=>{const n=this.ui.button('',-529+(i%2)*163,160-Math.floor(i/2)*117,158,110,action,{selected:i===0});n.name='冒险模式:'+title;this.ui.modernIcon(icon,0,17,70,n,i===0?Color.WHITE:new Color('#184865'));this.ui.text(title,0,-34,27,i===0?'#FFFFFF':UI_COLORS.ink,n,138,37);});
    const level=LEVELS[ongoing&&ongoing.mode!=='endless'&&ongoing.phase!=='result'?ongoing.levelId:s.unlockedLevel]??LEVELS[0];
    const wave=ongoing?.levelId===level.id&&ongoing.phase!=='result'?ongoing.wave:0;
    this.ui.panel(-603,-45,7,25,this.ui.root,UI_COLORS.green,255,3);left('当前挑战',-491,-44,24,194);
    left(`第${level.id+1}关 · ${level.name}`,-447,-87,30,330);
    this.ui.progress(-502,-126,205,18,wave/level.waves,UI_COLORS.green);left(`进度 ${wave}/${level.waves}波`,-341,-126,20,123);
    const primary=this.ui.button(pending?'整理伙伴':ongoing&&ongoing.phase!=='result'?'继续冒险':'开始冒险',-448,-202,330,84,()=>pending?this.getPrototypeMenus().takeaways():ongoing&&ongoing.phase!=='result'?this.openBattle():this.go('levels',Math.floor(s.unlockedLevel/6)),{primary:true,size:38});primary.name='主页开始冒险';
    const image=this.ui.group('主页主角',105,106,this.ui.root,490,423);this.art?.attach(image,`hero-${role}`,490,423);
    const info=this.ui.panel(382,4,178,122,this.ui.root,'#FFF9EC',234,24);
    this.ui.text(hero?visualName(hero):HERO_LOOK[role].name,-12,31,31,UI_COLORS.ink,info,142,42);
    const quality=hero?turtleQuality(hero):undefined;
    this.ui.text(HERO_LOOK[role].job,-40,-4,20,UI_COLORS.ink,info,75,28);
    const badge=this.ui.panel(44,-4,60,27,info,'#119B68',255,14);this.ui.text(quality?.name??'良好',0,0,18,'#FFFFFF',badge,58,26);
    this.ui.text(`${hero?.skills.length??2}技能`,-29,-36,20,UI_COLORS.ink,info,100,28);
    this.ui.panel(-204,-109,6,21,this.ui.root,UI_COLORS.green,255,3);
    left(`出战小队  ${team.filter(Boolean).length}/5`,-99,-109,23,193);
    this.ui.button('调整',549,-108,112,42,()=>{this.go('levels');this.chooseTeam(level.id);},{size:22});
    roles.forEach((r,i)=>{const n=circlePortrait(r,-130+i*143,-191,112,this.ui.root,r===role);n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();this.homeHeroRole=r;this.render();});if(r===role)this.ui.panel(-130+i*143,-255,91,10,this.ui.root,'#FF8755',255,5);});
    const nav=this.ui.panel(0,-307,1240,78,this.ui.root,'#FFF9EC',247,28);
    const entries:[string,number,()=>void][]=[['龟龟',0,()=>this.go('collection')],['合成',1,()=>this.go('workshop')],['商城',2,()=>this.openShop()],['交易',3,()=>this.communityEntry('trade')],['租赁',4,()=>this.communityEntry('rental')],['好友',5,()=>this.communityEntry('friends')],['排行',6,()=>this.communityEntry('rankings')]];
    entries.forEach(([title,icon,go],i)=>{const x=-526+i*175,n=this.ui.group('主页导航:'+title,x,0,nav,166,78);this.ui.modernIcon(icon,0,13,53,n);this.ui.text(title,0,-25,23,UI_COLORS.ink,n,146,31);n.on(Node.EventType.TOUCH_END,()=>{this.ui.click();go();});if(i<6)this.ui.line(x+87,-25,x+87,23,nav,'#CAD4D0');});
  }
''' +s[b:]
# Use existing stamina dialog: resolve its actual name rather than add another economy action.
s=s.replace('()=>this.staminaOffer()', '()=>this.staminaDialog()')
p.write_text(s,encoding='utf8')
