import {PearlBattleArt,PearlAsset} from './PearlBattleArt';
import {BattleHudMotion} from './BattleHudMotion';
import {expeditionRecruitCost} from '../core/expeditionEconomy';
import {Camera,EventTouch,Graphics,Label,Node,Vec3,screen,isValid,Sprite,LabelOutline} from 'cc';
import {BattleState,BattleUnit,commandBattle,canCommandBattle,skillTargetMode,legalSkillTargets} from '../core/battle';
import {BUFFS,BuffId,expeditionSlots,isCoastTrial,trialHint,expeditionBuffDescription} from '../core/expeditionRules';
import {ROLE_IDS,SKILLS,SKILL_BY_ID} from '../core/data';
import type {Role,SkillId,Point} from '../core/types';
import {IslandUI,color,UI_COLORS} from './IslandUI';
import {BattleWorld} from './BattleWorld';
export type ExpeditionCommand='recruit'|'merge'|'move'|'buff';
export class ExpeditionHUD {
 private hits:{node:Node;id:string}[]=[];private key='';private labels:{gold:Label;wave:Label;life:Label;time:Label};private holds:ReturnType<typeof setTimeout>[]=[];
 private recruitMotion?:BattleHudMotion;private allMotion?:BattleHudMotion;private skillItems:{role:Role;label:Label;mask:Graphics;motion:BattleHudMotion}[]=[];private chosen:Partial<Record<Role,string>>={};private aim?:{unit:string;skill:SkillId};private aimNodes:Node[]=[];
 constructor(private ui:IslandUI,private camera:Camera,private world:BattleWorld,private read:()=>BattleState,private owner:string,private commit:(action:ExpeditionCommand,args:{a?:string;b?:string;slot?:number;buff?:BuffId})=>void,private refresh:()=>void,private busy:(moving:boolean)=>void,private prep=false,private start?:()=>void,private cast?:(unit:string,skill:string,targetId?:string,point?:Point)=>void,private auto?:(enabled:boolean)=>void,private readAuto?:()=>boolean){
  const b=read(),e=b.expedition!,p=e.players.find(p=>p.id===owner)!,root=ui.root;this.key=this.signature();
  const top=root.children.length;
  for(const [x,w] of [[-207,148],[-37,158],[151,164]])this.artPanel('secondary',x,320,w,52,root);
  ui.hudSymbol(1,-253,320,30);ui.hudSymbol(2,-87,320,30);ui.hudSymbol(3,98,320,28);
  this.labels={gold:undefined as unknown as Label,life:ui.text('',-194,320,24,'#563719',root,102,38),wave:ui.text('',-21,320,24,'#563719',root,108,38),time:ui.text('',167,320,24,'#563719',root,114,38)};
  ui.pinBattleFrom(top,1,0,0,'top');
  const slots=expeditionSlots(b.levelId);world.setStationOwnership(p.slots);
  for(const unit of b.units.filter(u=>u.ownerId===owner)){
   const pos=this.project(unit.x,.6,unit.z),hit=ui.group('拖动合成伙伴:'+unit.id,pos.x,pos.y,root,62,72);let dragging=false,origin:{x:number;y:number}|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   const reset=()=>{if(timer)clearTimeout(timer);origin=undefined;dragging=false;busy(false);world.showRange(null);};
   hit.on(Node.EventType.TOUCH_START,(ev:EventTouch)=>{if(this.aim)return;origin=ev.getLocation();timer=setTimeout(()=>{if(origin){dragging=true;busy(true);world.showRange(null,unit.range,unit.role==='leaf',unit.placement??unit);}},280);this.holds.push(timer);});
   const nearest=(ev:EventTouch)=>{const at=ev.getLocation(),candidates=p.slots.map(slot=>{const q=slots[slot],occupant=read().units.find(u=>u.slot===slot),foot=camera.worldToScreen(new Vec3(q.x,0,q.z)),head=camera.worldToScreen(new Vec3(q.x,occupant?.6:0,q.z));return {slot,d:Math.min(Math.hypot(at.x-foot.x,at.y-foot.y),Math.hypot(at.x-head.x,at.y-head.y))};}).sort((a,b)=>a.d-b.d);return candidates[0]?.d<48*this.scale()?candidates[0].slot:undefined;};
   hit.on(Node.EventType.TOUCH_MOVE,(ev:EventTouch)=>{if(!dragging)return;const slot=nearest(ev);world.showRange(null,unit.range,unit.role==='leaf',slot===undefined?unit:slots[slot]);world.tintRange(slot!==undefined);});
   const finish=(ev:EventTouch)=>{if(dragging){const slot=nearest(ev);reset();if(slot!==undefined)this.commit('move',{a:unit.id,slot});else ui.toast('请拖到圆形底座或另一只龟龟身上');}else{reset();ui.toast('长按拖动：同级合成，不同级或满级互换');}};
   hit.on(Node.EventType.TOUCH_END,finish);hit.on(Node.EventType.TOUCH_CANCEL,(ev:EventTouch)=>{if(ev.getEventCode()===Node.EventType.TOUCH_END)finish(ev);else reset();});this.hits.push({node:hit,id:unit.id});
  }
  const bottom=root.children.length;this.artPanel('dock',0,-292,1236,134,root);
  this.artPanel('rations',-553,-283,72,83,root);this.labels.gold=ui.text(String(p.coins),-553,-297,27,'#FFF8DF',root,85,35);const balanceOutline=this.labels.gold.node.addComponent(LabelOutline);balanceOutline.color=color('#704519');balanceOutline.width=2;
  const cost=expeditionRecruitCost(e,p),full=p.slots.every(slot=>b.units.some(u=>u.slot===slot)),capped=!!e.cap&&p.recruited>=e.cap,disabled=p.coins<cost||full||capped;
  const recruit=this.artButton('recruit','',-431,-296,164,78,()=>commit('recruit',{}),disabled);
  ui.text(capped?'已征满':full?'站位已满':'征召',0,12,29,ui.soloStyle?'#FFFFFF':'#5B3109',recruit,145,38);ui.text(cost+' 干粮',0,-19,20,ui.soloStyle?'#FFFFFF':'#684014',recruit,145,28);
  this.recruitMotion=this.motion(recruit,158,70);this.recruitMotion.ready=!disabled;
  ROLE_IDS.forEach((role,i)=>{const x=-275+i*110,base=SKILLS.find(s=>s.role===role&&s.active&&!s.specialization)!.id,n=ui.button('',x,-293,94,110,()=>this.cycle(role),{surface:'bare'});n.name='征召战斗技能:'+role;ui.battleSkillIcon(base,0,4,90,n);const mask=ui.group('技能状态',0,4,n,94,94).addComponent(Graphics),label=ui.text('未上场',0,4,18,'#FFFBE6',n,86,28);const outline=label.node.addComponent(LabelOutline);outline.width=1.5;outline.color=color('#173A49');const motion=BattleHudMotion.on(ui.group('技能就绪光',0,4,n),ui.reducedMotion);motion.radius=46;this.skillItems.push({role,label,mask,motion});});
  const changeAuto=(enabled:boolean)=>{this.clearAim();if(this.auto)this.auto(enabled);read().autoSkills=enabled;read().manualSkillTurtles=[];if(isCoastTrial(read()))read().expedition!.heldRoles=[];this.refresh();};
  this.artButton(this.automatic()?'secondary':'recruit','手动',258,-271,76,39,()=>changeAuto(false),false,18);
  this.artButton(this.automatic()?'recruit':'secondary','自动',333,-271,76,39,()=>changeAuto(true),false,18);
  const all=this.artButton('secondary','一键释放',295,-315,153,40,()=>this.releaseAll(),prep,21);this.allMotion=this.motion(all,147,34);
  if(prep){const startButton=this.artButton('start','开始战斗',493,-295,207,80,()=>{if(!read().units.some(u=>u.ownerId===owner&&u.alive)){ui.toast('先征召伙伴再开战');return;}start?.();},false,29);const m=this.motion(startButton,196,70);m.ready=true;}
  else {this.artPanel('secondary',493,-295,199,78,root);ui.text(e.players.length>1?(p.slots[0]===0?'上侧布阵':'下侧布阵'):'守住珍珠',493,-282,26,'#634221',root,174,34);ui.text(e.cap?'征召 '+p.recruited+'/'+e.cap:'第 '+b.wave+' 波',493,-313,18,'#806745',root,174,26);}
  this.buffStrip();
  ui.pinBattleFrom(bottom,1,0,0,'bottom');
  if(p.choices.length)this.blessings(p.choices);else if(e.players.some(v=>v.choices.length))ui.text('等待队友选择祝福',0,0,26,UI_COLORS.ink,root,600,52);
  this.update();
 }
 private artPanel(key:PearlAsset,x:number,y:number,w:number,h:number,parent=this.ui.root):Node{if(this.ui.soloStyle&&key!=='rations'){const n=this.ui.panel(x,y,w,h,parent,'#FFF9EC',248,18);return n;}const n=this.ui.group('珍珠HUD:'+key,x,y,parent,w,h);PearlBattleArt.attach(n,key,w,h);return n;}
 private artButton(key:PearlAsset,text:string,x:number,y:number,w:number,h:number,action:()=>void,disabled=false,size=23,parent=this.ui.root):Node{
  if(this.ui.soloStyle){return this.ui.button(text,x,y,w,h,action,{disabled,parent,primary:key==='start'||key==='recruit',size});}
  const n=this.ui.button('',x,y,w,h,action,{surface:'bare',disabled,parent});n.name='珍珠按钮:'+text;const art=PearlBattleArt.attach(n,key,w,h);if(disabled){const sprite=art?.getComponent(Sprite);if(sprite)sprite.color=color('#A7A8A0');}
  if(text){const l=this.ui.text(text,0,0,size,key==='start'?'#FFF8E3':'#54391E',n,w-12,h-5);if(key==='start'){const outline=l.node.addComponent(LabelOutline);outline.color=color('#AD3D1C');outline.width=2;}}return n;
 }
 private buffStrip():void{
  const p=this.read().expedition!.players.find(p=>p.id===this.owner)!,entries=Object.entries(p.buffs).filter(([,n])=>n!>0) as [BuffId,number][];
  const ui=this.ui,shown=entries.slice(0,8),width=shown.length?shown.length*52+59:141;
  const bar=ui.button('',-608+width/2,-204,width,39,()=>this.buffDetails(),{surface:'bare'});bar.name='本局祝福栏';ui.panel(0,0,width,39,bar,'#FFF9EC',232,13);
  if(!entries.length){ui.text('祝福 0',0,0,17,UI_COLORS.sand,bar,width-12,25);return;}
  shown.forEach(([id,count],i)=>{const x=-width/2+24+i*52;PearlBattleArt.attach(ui.group('祝福图标:'+id,x,0,bar),`buff-${id}`,30,29);ui.text('×'+count,x+18,-9,13,UI_COLORS.ink,bar,30,20);});
  ui.text(entries.length>8?'+'+(entries.length-8):'›',width/2-21,0,19,UI_COLORS.ink,bar,36,29);
 }
 private buffDetails(page=0):void{
  const ui=this.ui,entries=Object.entries(this.read().expedition!.players.find(p=>p.id===this.owner)!.buffs).filter(([,n])=>n!>0) as [BuffId,number][],pages=Math.max(1,Math.ceil(entries.length/6));
  const p=ui.dialog('本局祝福','仅在本场战斗生效 · 相同祝福叠加',()=>{p.parent?.destroy();this.busy(false);},1020,602);this.busy(true);
  if(!entries.length)ui.text('击败首领，选择你的第一份祝福',0,15,27,UI_COLORS.sand,p,890,80);
  entries.slice(page*6,page*6+6).forEach(([id,n],i)=>{const card=ui.panel(i%2?240:-240,113-Math.floor(i/2)*128,461,114,p,'#FFF9EC',255,15);PearlBattleArt.attach(ui.group('祝福详情图标',-173,3,card),`buff-${id}`,70,67);ui.text(BUFFS[id].name+' ×'+n,44,28,23,UI_COLORS.ink,card,336,34);ui.text(expeditionBuffDescription(this.read(),id),44,-22,17,UI_COLORS.sand,card,336,63,true);});
  ui.button('上一页',-250,-241,172,45,()=>{p.parent?.destroy();this.buffDetails(page-1);},{parent:p,disabled:page===0,size:21});ui.text((page+1)+' / '+pages,0,-241,22,UI_COLORS.ink,p,155,34);ui.button('下一页',250,-241,172,45,()=>{p.parent?.destroy();this.buffDetails(page+1);},{parent:p,disabled:page+1===pages,size:21});
 }
 private motion(parent:Node,width:number,height:number):BattleHudMotion{const m=BattleHudMotion.on(this.ui.group('按钮状态光',0,0,parent),this.ui.reducedMotion);m.width=width;m.height=height;return m;}
 private releaseAll():void{
  if(this.prep)return;this.clearAim();const b=this.read();let count=0;
  for(const u of b.units.filter(u=>u.ownerId===this.owner&&u.alive))for(const skill of u.skills.filter(id=>SKILL_BY_ID[id].active&&!SKILL_BY_ID[id].specialization)){
   const cmd={type:'cast' as const,unitId:u.id,skillId:skill};if(!canCommandBattle(b,cmd))continue;
   if(this.cast)this.cast(u.id,skill);else commandBattle(b,cmd);count++;break;
  }
  if(!count)this.ui.toast('技能冷却中或暂无有效目标');
 }
 private blessings(choices:BuffId[]):void{
  const ui=this.ui,veil=ui.screenVeil('首领祝福遮罩','#102B38',193);
  this.artPanel('secondary',0,247,570,68,veil);ui.text('首领祝福 · 选一项',0,247,34,'#54391E',veil,520,50);ui.text('本场生效 · 可叠加'+(this.read().expedition!.players.find(p=>p.id===this.owner)!.pending>1?' · 还有 '+this.read().expedition!.players.find(p=>p.id===this.owner)!.pending+' 次选择':''),0,197,19,'#FFF0D5',veil,400,32);
  const lines:Record<BuffId,string>={attack:'攻击 +8%',defense:'双防 +10%',health:'生命 +10%',range:'射程 +1格',haste:'冷却恢复 +10%',drain:'吸血 +2%',speed:'攻速 +6%',regen:'每秒回复 0.4%',crit:'暴击 +4%',guard:'伤害减免 +4%',desperate:'低血量 · 强化8秒',phoenix:'免死一次 · 无敌3秒',waveGrowth:'每波成长 +2%',killAttack:'击杀 · 攻击成长',killDefense:'击杀 · 双防成长',killHealth:'击杀 · 生命成长',treasury:'干粮越多 · 属性越高',tauntGuard:'嘲讽击杀 · 获得护盾',cleanseSurge:'净化 · 额外回血',tidePierce:'箭矢额外贯穿2只',crystalBurst:'溅射增伤 · 多打1只',healingTide:'溢出治疗 · 转为护盾'};
  choices.forEach((id,i)=>{const buff=BUFFS[id],card=ui.button('',(i-1)*332,-19,306,368,()=>this.commit('buff',{buff:id}),{parent:veil,surface:'bare'});card.name='祝福卡:'+id;if(ui.soloStyle)ui.panel(0,0,306,368,card,'#FFF9EC',255,21);else PearlBattleArt.attach(card,'card',306,368);
   const picture=ui.group('祝福插画:'+id,0,44,card,243,230);PearlBattleArt.attach(picture,`buff-${id}`,243,230);
   ui.text(buff.name,0,-96,28,'#573814',card,276,41);ui.text(lines[id],0,-131,20,'#684626',card,280,32);
   if(ui.soloStyle)ui.panel(-94,140,77,29,card,'#FFF9EC',245,10);ui.text(buff.rare?'稀有':'祝福',-94,140,17,ui.soloStyle?'#008F96':'#FFF3BA',card,75,25);
   const info=()=>{const p=ui.dialog(buff.name,'仅本场生效 · 当前 '+(this.read().expedition!.players.find(p=>p.id===this.owner)!.buffs[id]??0)+' 层',()=>p.parent?.destroy(),720,358);ui.text(expeditionBuffDescription(this.read(),id),0,-3,25,UI_COLORS.ink,p,640,155,true);ui.button('返回选择',0,-121,200,46,()=>p.parent?.destroy(),{parent:p});};
   this.artButton('secondary','详情',92,139,78,35,info,false,17,card);

  });
 }
 private scale():number{const s=screen.windowSize;return Math.min(s.width/1280,s.height/720);}
 private project(x:number,y:number,z:number):Vec3{const v=this.camera.worldToScreen(new Vec3(x,y,z)),s=screen.windowSize,k=this.scale();return new Vec3((v.x-s.width/2)/k,(v.y-s.height/2)/k,0);}
 private automatic():boolean{return this.readAuto?this.readAuto():!!this.read().autoSkills;}
 private actors(role:Role):BattleUnit[]{return this.read().units.filter(u=>u.ownerId===this.owner&&u.role===role&&u.alive&&u.skills.some(id=>SKILL_BY_ID[id].active));}
 private cycle(role:Role):void{
  if(this.prep){this.ui.toast('开战后可以释放技能');return;}if(this.automatic()){if(isCoastTrial(this.read())){const e=this.read().expedition!;e.heldRoles??=[];if(!e.heldRoles.includes(role))e.heldRoles.push(role);}else{this.ui.toast('关闭自动施法后，点击法术选择场上龟龟');return;}}const actors=this.actors(role);if(!actors.length){this.ui.toast('场上还没有拥有此法术的龟龟');return;}
  const index=actors.findIndex(u=>u.id===this.chosen[role]),u=actors[(index+1)%actors.length],skill=u.skills.find(id=>SKILL_BY_ID[id].active&&!SKILL_BY_ID[id].specialization)!;
  this.clearAim();this.chosen[role]=u.id;this.aim={unit:u.id,skill};this.busy(true);this.world.showRange(null,u.range,u.role==='leaf',u.placement??u);
  const field=this.ui.group('手动法术目标',0,30,this.ui.root,1280,465);this.aimNodes.push(field);field.on(Node.EventType.TOUCH_END,(ev:EventTouch)=>{const loc=ev.getLocation(),ray=this.camera.screenPointToRay(loc.x,loc.y);if(Math.abs(ray.d.y)<.001)return;const t=(.15-ray.o.y)/ray.d.y;this.release({x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t});});
  const badge=this.project(u.x,1.8,u.z),mark=this.ui.text('▼ 已选 '+(actors.indexOf(u)+1)+'/'+actors.length,badge.x,badge.y,20,'#FFFFFF',this.ui.root,190,32);this.aimNodes.push(mark.node);this.aimNodes.push(this.ui.panel(0,239,860,30,this.ui.root,'#F5FCFC',235,8));const hint=this.ui.text('再点同一法术切换龟龟 · 点击目标释放',0,239,19,UI_COLORS.ink,this.ui.root,900,30);this.aimNodes.push(hint.node);
  if(!this.ui.soloStyle)this.aimNodes.push(this.ui.button('释放',-90,-212,166,44,()=>this.release(),{primary:true,size:22}));this.aimNodes.push(this.ui.button('取消',this.ui.soloStyle?0:90,-212,166,44,()=>this.clearAim(),{size:22}));this.update();
 }
 private release(point?:Point):void{
  if(!this.aim)return;const b=this.read(),a=this.aim,u=b.units.find(u=>u.id===a.unit);if(!u){this.clearAim();return;}const mode=skillTargetMode(a.skill);let targetId:string|undefined;
  if(point&&(mode==='enemy'||mode==='team')){targetId=legalSkillTargets(b,u,a.skill).filter(t=>Math.hypot(t.x-point.x,t.z-point.z)<1.2).sort((a,c)=>Math.hypot(a.x-point!.x,a.z-point!.z)-Math.hypot(c.x-point!.x,c.z-point!.z))[0]?.id;if(!targetId){this.ui.toast('请选择技能范围内的目标');return;}}
  if(this.cast){this.cast(u.id,a.skill,targetId,mode==='area'?point:undefined);this.clearAim();}else if(commandBattle(b,{type:'cast',unitId:u.id,skillId:a.skill,...(targetId?{targetId}:{}),...(mode==='area'&&point?{point}:{})})){this.clearAim();}else this.ui.toast('技能尚在冷却或没有有效目标');
 }
 private clearAim():void{for(const n of this.aimNodes)if(isValid(n))n.destroy();this.aimNodes=[];if(this.aim){this.aim=undefined;this.busy(false);this.world.showRange(null);}}
 private signature():string{const b=this.read(),p=b.expedition!.players.find(p=>p.id===this.owner)!;return JSON.stringify([b.wave,b.units.map(u=>[u.id,u.slot,u.alive,u.fusionRank]),b.expedition!.players.map(p=>p.choices),p.coins>=expeditionRecruitCost(b.expedition!,p),p.recruited,p.buffs,this.automatic()]);}
 update():void{
  const b=this.read();for(const hit of this.hits){const u=b.units.find(u=>u.id===hit.id);if(u&&isValid(hit.node))hit.node.setPosition(this.project(u.x,.6,u.z));}const e=b.expedition!,p=e.players.find(p=>p.id===this.owner)!;if(!isValid(this.labels.gold.node))return;
  this.labels.gold.string=String(p.coins);this.labels.wave.string=e.kind==='endless'?'第 '+b.wave+' 波':b.wave+'/'+e.limit;this.labels.life.string=b.coreHealth+'/20';this.labels.time.string=Math.floor(b.elapsed/60)+':'+String(Math.floor(b.elapsed)%60).padStart(2,'0');
  let anyReady=false;
  for(const item of this.skillItems){const actors=this.actors(item.role),u=actors.find(u=>u.id===this.chosen[item.role])??actors.find(u=>{const s=u.skills.find(id=>SKILL_BY_ID[id].active&&!SKILL_BY_ID[id].specialization);return s&&canCommandBattle(b,{type:'cast',unitId:u.id,skillId:s});})??actors[0],g=item.mask;g.clear();const skill=u?.skills.find(id=>SKILL_BY_ID[id].active&&!SKILL_BY_ID[id].specialization),left=u&&skill?Math.max(0,((u.cooldowns[skill]??0)-b.tick)*.05):0,ready=!!u&&!!skill&&!this.prep&&canCommandBattle(b,{type:'cast',unitId:u.id,skillId:skill});anyReady||=ready;
   item.label.string=!u?'未上场':this.prep?'':left>0?left.toFixed(1):'';if(u&&e.heldRoles?.includes(item.role))item.label.string='保留';
   if(!u||left>0){const fraction=!u?1:Math.min(1,left/(SKILL_BY_ID[skill!].cooldown??20));g.fillColor=color('#153949',155);g.moveTo(0,0);g.lineTo(0,45);for(let j=0;j<=48;j++){const a=Math.PI/2+fraction*Math.PI*2*j/48;g.lineTo(Math.cos(a)*45,Math.sin(a)*45);}g.close();g.fill();}
   item.motion.ready=ready;item.motion.selected=u?.id===this.aim?.unit;
  }
  if(this.allMotion)this.allMotion.ready=anyReady;
  const key=this.signature();if(key!==this.key&&!this.aim){this.key=key;this.refresh();}
 }
 dispose():void{this.holds.forEach(clearTimeout);this.holds=[];this.clearAim();}
}
