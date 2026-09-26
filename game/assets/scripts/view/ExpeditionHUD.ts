import {Camera,EventTouch,Graphics,Label,Node,Vec3,screen,isValid} from 'cc';
import {BattleState,BattleUnit,commandBattle,skillTargetMode,legalSkillTargets} from '../core/battle';
import {BUFFS,BuffId,expeditionSlots,isCoastTrial,trialHint} from '../core/expeditionRules';
import {ROLE_IDS,SKILLS,SKILL_BY_ID} from '../core/data';
import type {Role,SkillId,Point} from '../core/types';
import {IslandUI,color,UI_COLORS} from './IslandUI';
import {BattleWorld} from './BattleWorld';
export type ExpeditionCommand='recruit'|'merge'|'move'|'buff';
function station(ui:IslandUI,x:number,y:number,i:number,mine=true):void{
 const n=ui.group('圆形站位底座:'+i,x,y,ui.root,58,36),g=n.addComponent(Graphics);
 g.fillColor=color('#182F38',75);g.ellipse(1,-5,28,14);g.fill();g.fillColor=color(mine?'#648878':'#637D9C');g.ellipse(0,-2,25,13);g.fill();
 g.fillColor=color(mine?'#DBE8C5':'#C8DEEF',240);g.ellipse(0,2,25,13);g.fill();g.strokeColor=color(mine?'#FCFFE6':'#E9F9FF');g.lineWidth=2;g.ellipse(0,2,24,12);g.stroke();
 g.strokeColor=color(mine?'#76AF86':'#739BC4');g.lineWidth=1.5;g.ellipse(0,2,19,9);g.stroke();ui.text(String(i+1),0,2,12,mine?'#365B48':'#345774',n,34,19).isBold=true;
}
export class ExpeditionHUD {
 private hits:{node:Node;id:string}[]=[];private key='';private labels:{gold:Label;wave:Label};private holds:ReturnType<typeof setTimeout>[]=[];
 private skillItems:{role:Role;label:Label;mask:Graphics}[]=[];private chosen:Partial<Record<Role,string>>={};private aim?:{unit:string;skill:SkillId};private aimNodes:Node[]=[];
 constructor(private ui:IslandUI,private camera:Camera,private world:BattleWorld,private read:()=>BattleState,private owner:string,private commit:(action:ExpeditionCommand,args:{a?:string;b?:string;slot?:number;buff?:BuffId})=>void,private refresh:()=>void,private busy:(moving:boolean)=>void,private prep=false,private start?:()=>void,private cast?:(unit:string,skill:string,targetId?:string,point?:Point)=>void,private auto?:(enabled:boolean)=>void,private readAuto?:()=>boolean){
  const b=read(),e=b.expedition!,p=e.players.find(p=>p.id===owner)!,root=ui.root;this.key=this.signature();
  const top=root.children.length;ui.panel(310,326,495,42,root,'#F5FCFC',245,9);ui.panel(0,280,820,32,root,'#F5FCFC',232,8);this.labels={gold:ui.text('',314,326,20,UI_COLORS.ink,root,480,34),wave:ui.text('',0,280,18,UI_COLORS.ink,root,800,30)};ui.pinBattleFrom(top,1,0,0,'top');
  const slots=expeditionSlots(b.levelId);slots.forEach((point,i)=>{const at=this.project(point.x,0,point.z);station(ui,at.x,at.y,i,p.slots.includes(i));});
  for(const unit of b.units.filter(u=>u.ownerId===owner)){
   const pos=this.project(unit.x,.6,unit.z),hit=ui.group('拖动合成伙伴:'+unit.id,pos.x,pos.y,root,62,72);let dragging=false,origin:{x:number;y:number}|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   const reset=()=>{if(timer)clearTimeout(timer);origin=undefined;dragging=false;busy(false);world.showRange(null);};
   hit.on(Node.EventType.TOUCH_START,(ev:EventTouch)=>{if(this.aim)return;origin=ev.getLocation();timer=setTimeout(()=>{if(origin){dragging=true;busy(true);world.showRange(null,unit.range,unit.role==='leaf',unit.placement??unit);}},280);this.holds.push(timer);});
   const nearest=(ev:EventTouch)=>{const at=ev.getLocation(),candidates=p.slots.map(slot=>{const q=slots[slot],occupant=read().units.find(u=>u.slot===slot),foot=camera.worldToScreen(new Vec3(q.x,0,q.z)),head=camera.worldToScreen(new Vec3(q.x,occupant?.6:0,q.z));return {slot,d:Math.min(Math.hypot(at.x-foot.x,at.y-foot.y),Math.hypot(at.x-head.x,at.y-head.y))};}).sort((a,b)=>a.d-b.d);return candidates[0]?.d<48*this.scale()?candidates[0].slot:undefined;};
   hit.on(Node.EventType.TOUCH_MOVE,(ev:EventTouch)=>{if(!dragging)return;const slot=nearest(ev);world.showRange(null,unit.range,unit.role==='leaf',slot===undefined?unit:slots[slot]);world.tintRange(slot!==undefined);});
   const finish=(ev:EventTouch)=>{if(dragging){const slot=nearest(ev);reset();if(slot!==undefined)this.commit('move',{a:unit.id,slot});else ui.toast('请拖到圆形底座或另一只龟龟身上');}else{reset();ui.toast('长按拖动：同级合成，不同级或满级互换');}};
   hit.on(Node.EventType.TOUCH_END,finish);hit.on(Node.EventType.TOUCH_CANCEL,(ev:EventTouch)=>{if(ev.getEventCode()===Node.EventType.TOUCH_END)finish(ev);else reset();});this.hits.push({node:hit,id:unit.id});ui.text((unit.fusionRank??1)+'阶',0,-32,13,unit.fusionRank===3?'#FFE28C':'#FFFFFF',hit,48,20);
  }
  const bottom=root.children.length;ui.panel(0,-294,1168,112,root,'#F5FCFC',248,16);
  ui.button('征召\n'+e.cost+' 干粮',-477,-294,184,80,()=>commit('recruit',{}),{primary:true,size:23,disabled:p.coins<e.cost||!!e.cap&&p.recruited>=e.cap||p.slots.every(slot=>b.units.some(u=>u.slot===slot))});
  ROLE_IDS.forEach((role,i)=>{const x=-295+i*143,base=SKILLS.find(s=>s.role===role&&s.active&&!s.specialization)!.id,n=ui.button('',x,-292,104,100,()=>this.cycle(role),{surface:'bare'});n.name='征召战斗技能:'+role;ui.battleSkillIcon(base,0,8,70,n);const label=ui.text('未上场',0,-35,15,UI_COLORS.ink,n,110,25),mask=ui.group('技能状态',0,8,n,76,76).addComponent(Graphics);this.skillItems.push({role,label,mask});});
  ui.line(410,-333,410,-252,root,'#A8CCD2');ui.text(isCoastTrial(b)?'自动/点技保留':'自动施法',494,-266,17,UI_COLORS.ink,root,130,30);
  ui.button(this.automatic()?'开':'关',494,-307,108,44,()=>{this.clearAim();const enabled=!this.automatic();if(this.auto)this.auto(enabled);read().autoSkills=enabled;read().manualSkillTurtles=[];if(isCoastTrial(read()))read().expedition!.heldRoles=[];this.refresh();},{primary:this.automatic(),size:24});ui.pinBattleFrom(bottom,1,0,0,'bottom');
  if(prep)ui.button('开始战斗',0,-212,230,47,()=>{if(!read().units.some(u=>u.ownerId===owner&&u.alive)){ui.toast('先消耗干粮征召伙伴再开战');return;}start?.();},{primary:true,size:23});
  if(p.choices.length){const panel=ui.dialog('首领祝福 · 三选一','仅在本场战斗有效，已获得的祝福可叠加',undefined,1090,430);p.choices.forEach((id,i)=>{const buff=BUFFS[id],n=ui.button('',-350+i*350,-15,328,240,()=>commit('buff',{buff:id}),{parent:panel});ui.text(buff.name,0,64,28,buff.rare?'#A36C12':UI_COLORS.ink,n,300,42);ui.text(buff.rare?'稀有祝福':'普通祝福',0,24,18,buff.rare?'#C68A22':'#1F997C',n,280,28);ui.text(buff.description,0,-48,20,UI_COLORS.ink,n,289,110,true);});}else if(e.players.some(v=>v.choices.length))ui.text('等待队友选择祝福',0,0,26,UI_COLORS.ink,root,600,52);
  this.update();
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
  const badge=this.project(u.x,1.8,u.z),mark=this.ui.text('▼ 已选 '+(actors.indexOf(u)+1)+'/'+actors.length,badge.x,badge.y,20,'#FFFFFF',this.ui.root,190,32);this.aimNodes.push(mark.node);this.aimNodes.push(this.ui.panel(0,239,860,30,this.ui.root,'#F5FCFC',235,8));const hint=this.ui.text('再点同一法术切换龟龟 · 点击目标或按释放',0,239,19,UI_COLORS.ink,this.ui.root,900,30);this.aimNodes.push(hint.node);
  this.aimNodes.push(this.ui.button('释放',-90,-212,166,44,()=>this.release(),{primary:true,size:22}),this.ui.button('取消',90,-212,166,44,()=>this.clearAim(),{size:22}));this.update();
 }
 private release(point?:Point):void{
  if(!this.aim)return;const b=this.read(),a=this.aim,u=b.units.find(u=>u.id===a.unit);if(!u){this.clearAim();return;}const mode=skillTargetMode(a.skill);let targetId:string|undefined;
  if(point&&(mode==='enemy'||mode==='team')){targetId=legalSkillTargets(b,u,a.skill).filter(t=>Math.hypot(t.x-point.x,t.z-point.z)<1.2).sort((a,c)=>Math.hypot(a.x-point!.x,a.z-point!.z)-Math.hypot(c.x-point!.x,c.z-point!.z))[0]?.id;if(!targetId){this.ui.toast('请选择技能范围内的目标');return;}}
  if(this.cast){this.cast(u.id,a.skill,targetId,mode==='area'?point:undefined);this.clearAim();}else if(commandBattle(b,{type:'cast',unitId:u.id,skillId:a.skill,...(targetId?{targetId}:{}),...(mode==='area'&&point?{point}:{})})){this.clearAim();}else this.ui.toast('技能尚在冷却或没有有效目标');
 }
 private clearAim():void{for(const n of this.aimNodes)if(isValid(n))n.destroy();this.aimNodes=[];if(this.aim){this.aim=undefined;this.busy(false);this.world.showRange(null);}}
 private signature():string{const b=this.read(),p=b.expedition!.players.find(p=>p.id===this.owner)!;return JSON.stringify([b.wave,b.units.map(u=>[u.id,u.slot,u.alive,u.fusionRank]),b.expedition!.players.map(p=>p.choices),p.coins>=b.expedition!.cost,p.recruited,this.automatic()]);}
 update():void{
  const b=this.read();for(const hit of this.hits){const u=b.units.find(u=>u.id===hit.id);if(u&&isValid(hit.node))hit.node.setPosition(this.project(u.x,.6,u.z));}const e=b.expedition!,p=e.players.find(p=>p.id===this.owner)!;if(!isValid(this.labels.gold.node))return;
  this.labels.gold.string='干粮 '+p.coins+' · 已征召 '+p.recruited+(e.cap?'/'+e.cap:' / 不限');this.labels.wave.string='第 '+b.wave+(e.limit?'/'+e.limit:'')+' 波 · '+(isCoastTrial(b)?trialHint(b):(e.players.length>1?'每人12座 · ':'')+'长按拖动：同级合成，不同级/满级互换');
  for(const item of this.skillItems){const actors=this.actors(item.role),u=actors.find(u=>u.id===this.chosen[item.role])??actors[0],g=item.mask;g.clear();const skill=u?.skills.find(id=>SKILL_BY_ID[id].active&&!SKILL_BY_ID[id].specialization),left=u&&skill?Math.max(0,((u.cooldowns[skill]??0)-b.tick)*.05):0;item.label.string=!u?'未上场':left>0?left.toFixed(1)+'秒':actors.length>1?'可选 '+actors.length+'只':'就绪';if(u&&e.heldRoles?.includes(item.role))item.label.string='手动 '+item.label.string;if(!u||left>0){g.fillColor=color('#0A3551',155);g.circle(0,0,34);g.fill();}if(u?.id===this.aim?.unit){g.lineWidth=3;g.strokeColor=color('#FFE39B');g.circle(0,0,37);g.stroke();}}
  const key=this.signature();if(key!==this.key&&!this.aim){this.key=key;this.refresh();}
 }
 dispose():void{this.holds.forEach(clearTimeout);this.holds=[];this.clearAim();}
}
export function drawFixedStations(ui:IslandUI,camera:Camera,id:number):void{for(const [i,p]of expeditionSlots(id).entries()){const v=camera.worldToScreen(new Vec3(p.x,0,p.z)),size=screen.windowSize,s=Math.min(size.width/1280,size.height/720);station(ui,(v.x-size.width/2)/s,(v.y-size.height/2)/s,i);}}

