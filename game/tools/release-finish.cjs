const fs=require('fs'),base='game/assets/scripts/';
function edit(p,fn){p=base+p;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
edit('view/ArtV2Assets.ts',s=>s.replace("export type ArtV2Image=","export type ArtV2Image='skill-books-release'|").replace("export type ArtV2Slice=","export type ArtV2Slice=`book-${string}`|").replace("const IMAGES:ArtV2Image[]=[","const IMAGES:ArtV2Image[]=['skill-books-release',").replace("const modern:Partial<Record<ArtV2Image,string>>={","const modern:Partial<Record<ArtV2Image,string>>={'skill-books-release':'skill-books-release',").replace("    const controls=this.images",`    const books=this.images.get('skill-books-release')!;
    ['scatter','daze','arcane','holyLight','spirit','counterStorm','bubbleRing','crystalCannon','piercingShot','hold','greatHeal','combo','rebirth','sleep','extraTarget','taunt'].forEach((id,i)=>this.frames.set(\`book-\${id}\`,frame(books.texture!,bound[i%4]+8,bound[Math.floor(i/4)]+8,bound[i%4+1]-bound[i%4]-16,bound[Math.floor(i/4)+1]-bound[Math.floor(i/4)]-16)));
    const controls=this.images`));
edit('view/IslandUI.ts',s=>s.replace("import type {Role}","import type {Role,SkillId}").replace('  /** Six large cards',`  bookIcon(id:SkillId,x:number,y:number,side:number,parent=this.root):Node{
    const n=this.group('技能书图标:'+id,x,y,parent,side,side);
    if(!this.art?.attach(n,\`book-\${id}\`,side,side))this.icon('book',0,0,side,n);return n;
  }
  /** Six large cards`));
edit('view/PrototypeMenus.ts',s=>s.replace("this.ui.text(pool==='turtle'?'普通招募", "this.ui.text(pool==='turtle'?'普通招募") // replace two existing information rows with illustrated panel
 .replace(/    this\.ui\.text\(pool==='turtle'\?'普通招募[^\n]+\n    this\.ui\.text\(`再招募[^\n]+/,
 `    const showcase=this.ui.panel(-324,-46,438,270,p);
    if(pool==='turtle'){this.ui.portrait('bubble',0,5,238,showcase,true);this.ui.text('新的海岛伙伴',0,-106,24,UI_COLORS.ink,showcase,390,36);}
    else{this.ui.bookIcon('spirit',0,8,200,showcase);this.ui.bookIcon('scatter',-130,-40,100,showcase);this.ui.bookIcon('arcane',130,-40,100,showcase);}
    this.ui.text(pool==='turtle'?'海岛伙伴招募':'海洋秘典',228,40,38,UI_COLORS.ink,p,584,54);
    this.ui.text(pool==='turtle'?'1～4技能伙伴 · 十次至少一只4技能以上':'通用被动与职业主动 · 点击规则查看概率',228,-24,25,UI_COLORS.sand,p,584,70,true);
    this.ui.text(\`再招募 \${100-count%100} 次必得\${pool==='turtle'?'6技能伙伴':'职业主动'}\`,228,-91,26,UI_COLORS.gold,p,584,44);
    this.ui.panel(228,-143,520,10,p,'#C8DDDA');this.ui.panel(-32+260*(count%100)/100,-143,Math.max(6,520*(count%100)/100),10,p,UI_COLORS.green);`)
 .replace("this.ui.text(SKILL_BY_ID[d.skillId!].name,0,40,34", "this.ui.bookIcon(d.skillId!,-110,0,116,n);this.ui.text(SKILL_BY_ID[d.skillId!].name,64,34,28").replace("this.ui.text(tag,0,-40,28","this.ui.text(tag,64,-32,25")
 .replace("this.ui.text(SKILL_BY_ID[id].description,0,0,34,UI_COLORS.cream,p,1080,160,true);", "this.ui.bookIcon(id,-360,0,270,p);this.ui.text(SKILL_BY_ID[id].description,174,0,30,UI_COLORS.cream,p,680,230,true);")
 .replace("this.ui.text(`${skill.name} ×${s.skillBooks![skill.id]}`,0,22,28,UI_COLORS.cream,n,340,40);this.ui.text(owned?'已经拥有':!compatible?'主动技能与造型不符':skill.description,0,-24,23,UI_COLORS.sand,n,336,42,true);", "this.ui.bookIcon(skill.id,-130,0,82,n);this.ui.text(`${skill.name} ×${s.skillBooks![skill.id]}`,45,22,25,UI_COLORS.cream,n,244,38);this.ui.text(owned?'已经拥有':!compatible?'主动与造型不符':skill.precious?'珍贵 · 通用被动':skill.active?'职业主动':'通用被动',45,-24,22,UI_COLORS.sand,n,244,36);")
 .replace("this.paintTurtle(e.candidate,p);}","this.ui.portrait(e.candidate.role,0,0,310,p,true);}")
 .replace('坚守1、大治疗1.5、泡泡圈1.5、穿甲弹0.3、水晶炮0.3','坚守1、大治疗1.5、潮灵召唤1.5、穿甲弹0.3、海霜风暴0.3'));
edit('view/BattleScreen.ts',s=>s.replace("this.ui.text(skill.name,0,19,30,UI_COLORS.cream,n,w-16,40);","this.ui.bookIcon(id,-w/2+31,0,52,n);this.ui.text(skill.name,27,16,23,UI_COLORS.cream,n,w-64,36);").replace("this.ui.text(skill.active?'主动技能':'被动技能',0,-20,28,UI_COLORS.sand,n,w-16,36);","this.ui.text(skill.active?'主动':skill.precious?'珍贵被动':'被动',27,-20,19,UI_COLORS.sand,n,w-64,30);")
 .replace("this.ui.text(skill.description,0,12,32,UI_COLORS.cream,p,1040,300,true);","this.ui.bookIcon(id,-380,12,250,p);this.ui.text(skill.description,154,12,30,UI_COLORS.cream,p,730,280,true);")
 .replace("if(!canCommandBattle(b,{type:'cast',unitId,skillId})){", "if(!canCommandBattle(b,{type:'cast',unitId,skillId,...(skillId==='bubbleRing'?{point:{x:u.x,z:u.z}}:{})})){")
 .replace("    overlay.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);",`    overlay.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
    if(mode==='area')overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{
      if(e.target!==overlay)return;const screen=e.getLocation(),ray=this.camera.screenPointToRay(screen.x,screen.y);if(Math.abs(ray.d.y)<.001)return;
      const t=(.15-ray.o.y)/ray.d.y,point={x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};
      if(commandBattle(b,{type:'cast',unitId,skillId,point}))this.render();else this.ui.toast('请点射程内的合法区域');
    });`)
 .replace("'选择高亮范围中心'","'点击射程内区域'")
 );
edit('view/ActiveSkillControls.ts',s=>s.replace("if(!canCommandBattle(b,{type:'cast',unitId,skillId})){", "if(!canCommandBattle(b,{type:'cast',unitId,skillId,...(skillId==='bubbleRing'?{point:{x:u.x,z:u.z}}:{})})){")
 .replace("      for(const target of legalSkillTargets",`      if(mode==='area')overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{
        if(e.target!==overlay||!this.available())return;const screen=e.getLocation(),ray=this.camera.screenPointToRay(screen.x,screen.y);if(Math.abs(ray.d.y)<.001)return;
        const t=(.15-ray.o.y)/ray.d.y,point={x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};
        if(this.context(state=>commandBattle(state,{type:'cast',unitId,skillId,point})))done();else this.ui.toast('请点射程内的合法区域');
      });
      for(const target of legalSkillTargets`));
edit('core/save.ts',s=>{const a=s.indexOf('  if(s.avatar)'),b=s.indexOf('\n',a),line=s.slice(a,b);s=s.slice(0,a)+s.slice(b);return s.replace('function validateSaveState(s:GameSave,allowLegacyLayoutSlots:boolean):void{','function validateSaveState(s:GameSave,allowLegacyLayoutSlots:boolean):void{\n'+line);});
edit('core/battle.ts',s=>s.replace("const before=target.controlCount;controlEnemy(state,target,.5,source.id,'arcane');\n      const root=target.statuses.find(x=>x.kind==='root');if(root&&target.controlCount>before)setStatus(state,target,'stun',1,Math.max(.05,(root.untilTick-state.tick)*.05),source.id);","controlEnemy(state,target,.5,source.id,'arcane','stun');")
 .replace("seconds: number, sourceId: string, skillId: SkillId): void {", "seconds: number, sourceId: string, skillId: SkillId,kind:'root'|'stun'='root'): void {")
 .replace("setStatus(state, target, 'root', 1, seconds * scale, sourceId);", "setStatus(state, target, kind, 1, seconds * scale, sourceId);")
 .replace("for(let i=0;i<strikes;i++)for(const e of state.enemies.filter(e=>e.alive&&distance(e,target)<=1.8))", "const victims=state.duelUnits?state.duelUnits.filter(u=>state.duelTeamA!.includes(u.id)!==state.duelTeamA!.includes(target.id)).map(u=>turtleEnemy(u)):state.enemies;\n    for(let i=0;i<strikes;i++)for(const e of victims.filter(e=>e.alive&&distance(e,target)<=1.8))")
 .replace("damageEnemy(state,target,e,amount,false,'secondary','counterStorm')", "damageEnemy(state,target,e,amount,false,'reflect','counterStorm')")
 );
console.log('Presentation and core fixes applied');
