const fs=require('fs');function edit(file,fn){let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const r=(a,b)=>{if(!s.includes(a))throw Error(file+' missing '+a.slice(0,90));s=s.replace(a,b);};fn(r,()=>s,v=>s=v);fs.writeFileSync(file,s);}
edit('game/assets/scripts/view/RewardMenus.ts',(r,g,s)=>s(g().replaceAll('packPool(g.grade)[0].id','packPool(g.grade)[0]').replaceAll('packPool(grade)[0].id','packPool(grade)[0]').replaceAll('packPool(grade).map(x=>x.name)','packPool(grade).map(x=>SKILL_BY_ID[x].name)')));
edit('game/assets/scripts/core/raids.ts',r=>r("{kind:'book',skillId:drawBook(s,r.stars===3?'fine':'ordinary'),amount:1}","s.livingVersion?{kind:'bookPack',grade:r.stars===3?'precious':'common',amount:1}:{kind:'book',skillId:drawBook(s,r.stars===3?'fine':'ordinary'),amount:1}"));
edit('game/assets/scripts/view/LiveRaidScreen.ts',r=>r("if(!this.polling&&r.battle.status==='fighting')","if(r.battle.status==='fighting')"));
edit('game/assets/scripts/view/IslandUI.ts',(r,g,s)=>{
 r('IslandUI.prototype.hover.call(this,n);','let touchStart:{x:number;y:number}|undefined,moved=false;\n      IslandUI.prototype.hover.call(this,n);');
 r("n.on(Node.EventType.TOUCH_START,()=>{if(!this.isInteractive(n))return;tween(n).stop();", "n.on(Node.EventType.TOUCH_START,(e?:EventTouch)=>{touchStart=e?.getLocation?.();moved=false;if(!this.isInteractive(n))return;tween(n).stop();");
 r("n.on(Node.EventType.TOUCH_CANCEL,()=>{if(this.isInteractive(n))n.setScale(1,1,1);});", "n.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{const p=e.getLocation();if(touchStart&&Math.hypot(p.x-touchStart.x,p.y-touchStart.y)>9)moved=true;});\n      n.on(Node.EventType.TOUCH_CANCEL,()=>{touchStart=undefined;moved=true;if(this.isInteractive(n))n.setScale(1,1,1);});");
 r("n.setScale(1,1,1);this.click();try{action();}","n.setScale(1,1,1);touchStart=undefined;if(moved)return;this.click();try{action();}");
 const a=g().indexOf('  fusionCard(t:Turtle,parent:Node):void{'),b=g().indexOf('  battleFigure(',a);
 s(g().slice(0,a)+`  fusionCard(t:Turtle,parent:Node):void{
    const card=this.panel(0,-30,410,264,parent,'#FFF9EC',255,18);card.name='泡泡内完整伙伴卡';
    this.portrait(t.role,-122,-1,176,card,true);this.text(t.name||ROLES[t.role].name,78,103,24,UI_COLORS.ink,card,240,34);
    (['attack','health','defense','growth'] as const).forEach((key,i)=>{const tick=Math.max(0,Math.min(50,t.innate[key]+t.training[key]-(key==='growth'?60:50))),full=Math.floor(tick/10),line=['攻击','生命','防御','成长'][i]+' '+'★'.repeat(full)+'☆'.repeat(5-full);this.text(line,83,65-i*28,18,UI_COLORS.ink,card,226,27);});
    t.skills.forEach((id,i)=>this.bookIcon(id,-5+i%6*35,-59-Math.floor(i/6)*35,31,card));this.text(turtleQuality(t).name,-122,-106,19,turtleQuality(t).color,card,142,30);
  }
`+g().slice(b));
});
edit('game/assets/scripts/view/BubbleReveal.ts',(r,g,s)=>{
 s("import {BubbleShimmer} from './BubbleShimmer';\n"+g());
 r('setContentSize(440,440)','setContentSize(580,580);this.root.setPosition(0,-30,0)');
 r("this.root,390,390)","this.root,500,500)");r('seal.circle(0,0,190)','seal.circle(0,0,246)');r("'fusion-bubble',460,460)","'fusion-bubble',600,600);this.ui.group('泡泡虹彩流动',0,0,this.root,520,520).addComponent(BubbleShimmer)");
 r('for(let x=-190;x<=190;x+=20)for(let y=-190;y<=190;y+=20)if(Math.hypot(x,y)<=192)','for(let x=-246;x<=246;x+=20)for(let y=-246;y<=246;y+=20)if(Math.hypot(x,y)<=246)');
 s(g().replaceAll('0,-231','0,-294').replaceAll('>220','>278').replaceAll('stencil.circle(x,y,36)','stencil.circle(x,y,43)').replaceAll('sample.y-y)<36','sample.y-y)<43'));
 r("'直接揭晓',0,-282,320,70", "'直接揭晓',0,-337,340,42");
});
edit('game/assets/scripts/view/PrototypeMenus.ts',(r,g,s)=>{
 r('i===0?-424:424,0,268,364','i===0?-469:469,0,228,364');
 const a=g().indexOf('  chooseParents(page=0):void{'),b=g().indexOf('  private candidate(',a);
 s(g().slice(0,a)+`  chooseParents(page=0):void{
    const all=this.ordered(),pages=Math.max(1,Math.ceil(all.length/6)),current=Math.max(0,Math.min(page,pages-1));this.parents=this.parents.map(id=>all.some(t=>t.id===id)?id:'');this.ui.clear();const p=this.ui.sceneSheet('合成工坊',this.home,'fusion-background');
    this.ui.panel(-363,-13,399,443,p,'#FFF9EC',247,24);this.ui.panel(230,-13,760,443,p,'#FFF9EC',247,24);
    this.ui.text('两位亲本 · 一次新生',-363,170,27,UI_COLORS.ink,p,367,42);
    [0,1].forEach(i=>{const t=this.service.snapshot.collection[this.parents[i]],n=this.ui.button('',-451+i*176,35,161,199,()=>{this.parentSlot=i;this.chooseParents(current);},{parent:p,selected:this.parentSlot===i});this.ui.text(i?'副龟 · 40%':'主龟 · 60%',0,73,20,UI_COLORS.ink,n,152,32);if(t){this.ui.pet(t,0,5,104,n);this.ui.text(this.petName(t),0,-69,21,UI_COLORS.ink,n,152,34);}else this.ui.text('选择伙伴',0,-6,23,UI_COLORS.sand,n,150,58);});
    this.ui.text('先选择左侧亲本位置，再点右侧伙伴。\n合成后保留主龟、副龟或新伙伴之一。',-363,-134,20,UI_COLORS.sand,p,355,91,true);
    all.slice(current*6,current*6+6).forEach((t,i)=>{const chosen=this.parents.includes(t.id),n=this.ui.button('',-13+i%3*246,91-Math.floor(i/3)*189,224,174,()=>new PetDetails(this.ui,this.service,this.command,this.error).show(t,{confirmText:this.parentSlot===0?'选择为主龟':'选择为副龟',disabled:t.locked,confirm:()=>{const slot=this.parentSlot,other=slot===0?1:0;if(this.parents[other]===t.id)this.parents[other]=this.parents[slot]??'';this.parents[slot]=t.id;if(!this.parents[other])this.parentSlot=other;this.chooseParents(current);}}),{parent:p,selected:chosen});this.ui.pet(t,0,25,98,n);this.ui.text(this.petName(t),0,-42,23,UI_COLORS.ink,n,204,36);this.ui.text('Lv.'+levelInfo(t).level+' · '+t.skills.length+' 技能'+(t.locked?' · 锁定':''),0,-70,18,UI_COLORS.sand,n,209,29);});
    this.ui.button('‹',-83,-275,99,51,()=>this.chooseParents(current-1),{parent:p,disabled:current===0,size:27});this.ui.text((current+1)+' / '+pages,59,-275,23,UI_COLORS.ink,p,150,35);this.ui.button('›',202,-275,99,51,()=>this.chooseParents(current+1),{parent:p,disabled:current===pages-1,size:27});
    this.ui.button('查看合成方案',-363,-275,398,57,()=>this.action(()=>this.confirmParents()),{parent:p,primary:true,disabled:!this.parents[0]||!this.parents[1],size:26});this.ui.text('新伙伴继承双亲平均经验，属性点可重新分配。',0,-329,19,UI_COLORS.ink,p,1110,34);
  }
`+g().slice(b));
 r("this.ui.text(summary??\x60攻击 ${value('attack')} · 生命 ${value('health')} · 防御 ${value('defense')} · 成长 ${(value('growth')/100).toFixed(2)}\x60,0,178,28,UI_COLORS.sand,p,1080,40);", "if(summary)this.ui.text(summary,0,180,22,UI_COLORS.sand,p,1080,38);else (['attack','health','defense','growth'] as const).forEach((key,i)=>{this.ui.text(['攻击','生命','防御','成长'][i],-480+i*287,207,18,UI_COLORS.ink,p,76,28);talentStars(this.ui,t,key,-373+i*287,207,p,18);});");
});
edit('game/assets/scripts/view/BattleWorld.ts',r=>r('actor.floor=.021','actor.floor=.035'));
edit('game/assets/scripts/view/BattlePaint.ts',(r,g,s)=>{
 r("kind:'plant'|'water'","kind:'plant'|'water'|'crystal'|'stone'");r('private waterMaterials=new Set<Material>();','private waterMaterials=new Map<Material,number>();');
 r("this.quad('soul-ring',f,1.65,true)","this.quad('soul-ring',f,1.18,true)");r('n.setScale(1,.38,1);n.setPosition(0,-.012,0)','n.setScale(1,.30,1);n.setPosition(0,-.003,0)');
 r("[['落地接触',.52,0,.015],['日照投影',.74,.16,.12]]","[['落地接触',.81,0,.010],['日照投影',1.06,.17,.13]]");r('n.setPosition(x,-.016,z);n.setScale(friendly?1:.68,.44,1)','n.setPosition(x,-.002,z);n.setScale(friendly?1:.84,.40,1)');
 r('this.waterMaterials.add(coast)','this.waterMaterials.set(coast,0)');r("this.waterMaterials.add(this.material('themed-sea',ocean,0))","this.waterMaterials.set(this.material('themed-sea',ocean,0),1)");
 r('this.waterMaterials.add(material);',"const rect=plateFrame.rect,texture=plateFrame.texture;material.setProperty('surfaceRect',new Vec4(rect.x/texture.width,rect.y/texture.height,rect.width/texture.width,rect.height/texture.height));this.waterMaterials.set(material,plate===3?3:2);");
 r("this.material('props',f,1)","this.material('prop-'+tile,f,[4,8,9,11].includes(tile)?8:1)");
 r("kind:'plant',x:p.x,z:p.z","kind:[4,8,9,11].includes(tile)?'crystal':[0,1,2,10].includes(tile)?'plant':'stone',x:p.x,z:p.z");
 r("for(const m of this.waterMaterials)if(m.isValid){m.setProperty('keyParams',new Vec4(0,0,this.time,1));", "for(const [m,mode] of this.waterMaterials)if(m.isValid){m.setProperty('keyParams',new Vec4(0,mode,this.time,1));");
 r("}else{a.node.setScale(1+Math.sin(t*1.3)*.032,1+Math.cos(t*1.1)*.018,1);}","}else if(a.kind==='plant'){a.node.setScale(1+Math.sin(t*1.3)*.017,1+Math.cos(t*1.1)*.012,1);}else if(a.kind==='crystal'){const m=a.node.getComponent(MeshRenderer)?.getSharedMaterial(0);m?.setProperty('keyParams',new Vec4(8,0,t,0));}");
});
