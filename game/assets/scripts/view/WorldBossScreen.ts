import {runtimeQuery} from '../platform/runtimeQuery';
import {BattleFeedback} from './BattleFeedback';
import {expeditionSlots} from '../core/expeditionRules';
import {Camera,Node,Label,Vec3,EventTouch,screen,isValid} from 'cc';
import {IslandUI,UI_COLORS} from './IslandUI';
import {GameService} from '../core/game';
import {RoomClient} from './RoomClient';
import {BattleWorld} from './BattleWorld';
import {IslandAudio} from './IslandAudio';
import {ActiveSkillControls} from './ActiveSkillControls';
import {PetDetails} from './PetDetails';
import {petRange} from '../core/development';
import {BATTLE_MAPS} from '../core/data';
import {exchangePlacementIssue,placementIssue} from '../core/placement';
import {getBattleEvents} from '../core/battle';
import {WORLD_BOSSES,WORLD_BOSS_MAP,WORLD_DAMAGE_TIERS,createWorldBossFight,stepWorldBoss,worldBossDay,worldBossAction} from '../core/worldBoss';
import type {WorldBossFight,WorldBossView} from '../core/worldBoss';
import type {Point} from '../core/types';

/** Server controls the 90-second clock and score; prediction never submits damage. */
export class WorldBossScreen {
 private approvedFeedback?:BattleFeedback;
 private moving=false;private moveCancel?:Node;private operations:Promise<void>=Promise.resolve();private pauseHeartbeat=0;private acceptedTime=0;
 private resultSound=false;private fightStarted=false;private fight:WorldBossFight;private preview=true;private destroyed=false;private hidden=false;private pending=false;private polling=false;private pollClock=0;private lastEvent=0;private acceptedTick=-1;private targeting=false;private epoch=0;private selected='';private speed:1|2=1;private hits:Node[]=[];private overlay?:()=>void;private skills?:ActiveSkillControls;private clock?:Label;private score?:Label;private connectivity?:Label;
 constructor(private service:GameService,private client:RoomClient,private ui:IslandUI,private world:BattleWorld,private camera:Camera,private audio:IslandAudio,private command:(kind:string)=>string,private home:()=>void,private error:(e:unknown)=>void,private localReview=false){
  if(localReview){const now=Date.now(),day=worldBossDay(now);client.world={day:day.key,bossIndex:Math.max(0,Math.min(3,Number(runtimeQuery().get('boss')??day.bossIndex)||0)),closes:day.closes,next:day.next,serverTime:now,canStart:true,attempts:0,best:0,claimed:[],ranking:[],participants:0};}
  const v=client.world;if(!v)throw Error('请先连接世界首领');
  if(v.fight?.phase==='combat'){this.fight=JSON.parse(JSON.stringify(v.fight));this.preview=false;this.acceptedTick=v.fight.battle.tick;}
  else this.fight=createWorldBossFight('preview',v.day,v.bossIndex,client.worldSelection.map(id=>service.snapshot.collection[id]),v.serverTime);
  world.setLevel(WORLD_BOSS_MAP);this.render();
 }
 get diagnosticContext(){return {levelId:WORLD_BOSS_MAP,wave:1};}
 checkpoint():void{}
 hide():void{this.cancelOperation();this.hidden=true;}
 show():void{this.hidden=false;if(!this.preview)void this.sync();}
 destroy():void{this.cancelOperation();this.destroyed=true;this.hits.forEach(n=>{if(isValid(n,true)){n.removeFromParent();n.destroy();}});this.hits=[];this.world.destroy();}
 private receive(v:WorldBossView):void{if(this.destroyed||!v.fight||v.fight.id!==this.fight.id)return;const f=v.fight;if(v.serverTime<this.acceptedTime||f.battle.tick<this.acceptedTick)return;this.acceptedTime=v.serverTime;const changed=f.phase!==this.fight.phase;this.acceptedTick=f.battle.tick;this.fight=JSON.parse(JSON.stringify(f));if(changed||f.phase==='result'&&this.skills){this.render();}}
 private async sync(){if(this.localReview||this.polling||this.destroyed||this.preview)return;this.polling=true;try{const v=await this.client.worldState();if(this.destroyed)return;this.receive(v);if(this.connectivity?.isValid)this.connectivity.string='';}catch{if(this.connectivity?.isValid)this.connectivity.string='正在重连 · 成绩由服务器保存';}finally{this.polling=false;}}
 private send(action:string,body:Record<string,unknown>={}):Promise<void>{
  this.operations=this.operations.then(async()=>{try{if(this.localReview){worldBossAction(this.fight,action,body as Parameters<typeof worldBossAction>[2]);return;}this.receive(await this.client.worldAction(action,body));}catch(e){if(!this.destroyed)this.ui.toast(e instanceof Error?e.message:'操作未成功，请重试');}});return this.operations;
 }
 private operation(kind:'target'|'move',value:boolean):void{
  const before=this.targeting||this.moving;if(kind==='target')this.targeting=value;else this.moving=value;
  const active=this.targeting||this.moving;this.world.setPaused(active);if(active!==before&&!this.preview&&this.fight.phase==='combat')void this.send(active?'operationPause':'operationResume');
  if(!this.moving){this.moveCancel?.destroy();this.moveCancel=undefined;}else if(!this.moveCancel){this.moveCancel=this.ui.button('取消换位',-470,-263,180,46,()=>{this.selected='';this.world.showRange(null);this.operation('move',false);},{size:22});}
 }
 private cancelOperation():void{this.skills?.dispose();this.operation('target',false);this.operation('move',false);this.selected='';this.world.showRange(null);}

 private async start(){if(this.localReview){this.preview=false;this.fight.battle.autoSkills=true;this.render();return;}if(this.pending)return;this.pending=true;const placements=this.fight.battle.units.map(u=>({...u.placement??{x:u.x,z:u.z}}));try{const v=await this.client.worldStart(this.client.worldSelection,placements);if(this.destroyed)return;if(!v.fight)throw Error('挑战未能开始');this.fight=JSON.parse(JSON.stringify(v.fight));this.preview=false;this.acceptedTick=this.fight.battle.tick;this.lastEvent=0;this.render();void this.settings();}catch(e){if(!this.destroyed){this.ui.toast(e instanceof Error?e.message:'挑战未能开始');void this.client.worldState();}}finally{this.pending=false;}}
 private settings(){const s=this.service.settingsSnapshot;return this.send('settings',{auto:!!s.autoSkills,held:s.manualSkillTurtles??[]});}
 update(dt:number):void{
  if(this.destroyed||this.hidden)return;
  if((this.targeting||this.moving)&&!this.preview){this.pauseHeartbeat+=dt;if(this.pauseHeartbeat>=10){this.pauseHeartbeat=0;void this.send('operationPause');}}else this.pauseHeartbeat=0;
  const playbackDt=Math.max(0,dt)*this.speed;
  if(this.localReview&&!this.preview&&!this.targeting&&!this.moving&&this.fight.phase==='combat'){stepWorldBoss(this.fight,Math.min(.10,playbackDt));if((this.fight as WorldBossFight).phase==='result'){this.client.world!.fight=this.fight;this.client.world!.best=this.fight.damage;this.render();}}
  if(!this.localReview&&!this.preview){this.pollClock+=dt;if(this.pollClock>=.3){this.pollClock=0;void this.sync();}}
  if(!this.localReview&&!this.preview&&!this.targeting&&!this.moving&&this.fight.phase==='combat'&&this.fight.battle.tick<=this.acceptedTick+12){stepWorldBoss(this.fight,Math.min(.05,playbackDt));this.fight.phase='combat';}
  const b=this.fight.battle,events=getBattleEvents(b).filter(e=>e.id>this.lastEvent);if(events.length)this.lastEvent=Math.max(...events.map(e=>e.id));this.world.setPlaybackSpeed(this.speed);this.world.update(b,events,this.targeting||this.moving?0:playbackDt);if(!this.preview)this.audio.battleEvents(b,events);for(const event of events)(this.approvedFeedback??=new BattleFeedback(this.ui,this.camera)).show(b,event);this.skills?.update();this.overlay?.();
  if(this.clock?.isValid){const remaining=Math.max(0,90-Math.floor(b.elapsed));this.clock.string=this.preview?'布阵中 · 90 秒挑战':`剩余 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;}
  if(this.score?.isValid){const damage=Math.floor(this.fight.damage);this.score.string='伤害 '+(damage>=10000?(damage/10000).toFixed(1)+'万':String(damage));}
 }
 render():void{
  if(this.destroyed)return;this.cancelOperation();this.ui.clear();this.epoch++;this.hits=[];this.skills=undefined;this.overlay=undefined;this.world.showRange(null);this.world.update(this.fight.battle,[],0);
  const root=this.ui.root,def=WORLD_BOSSES[this.fight.bossIndex];
  const settled=!this.preview&&this.client.world?.fight?.id===this.fight.id&&this.client.world.fight.phase==='result';
  void this.audio.playMusic(this.preview||settled?'bgm_home':'bgm_boss');
  if(!this.preview&&!settled&&!this.fightStarted){this.fightStarted=true;this.audio.effect('sfx_boss_arrive');}
  if(settled&&!this.resultSound){this.resultSound=true;this.audio.effect('sfx_collect');}
  if(!this.preview&&this.client.world?.fight?.id===this.fight.id&&this.client.world.fight.phase==='result'){
   const v=this.client.world,damage=Math.floor(v.fight!.damage),tiers=WORLD_DAMAGE_TIERS.filter(n=>v.best>=n).length,p=this.ui.dialog('世界首领 · 挑战完成',def.name+(this.localReview?' · 本地验收，不提交排名':' · 最高成绩已保存'),undefined,910,570);
   this.ui.art?.attach(this.ui.group(def.name,-254,1,p,268,268),def.art,268,268);this.ui.text('本次伤害',134,123,24,UI_COLORS.sand,p,475,41);this.ui.text(damage.toLocaleString(),134,62,47,'#007D92',p,471,63);this.ui.text(`今日最高 ${v.best.toLocaleString()}\n当前第 ${v.rank??'—'} 名 · 达标 ${tiers} / 10 档`,134,-22,25,UI_COLORS.ink,p,476,99,true);this.ui.text(`剩余 ${Math.max(0,3-v.attempts)} 次 · 排名奖励 22:00 发往系统邮箱`,0,-153,22,UI_COLORS.sand,p,823,50);this.ui.button('查看宝箱与伤害榜',0,-222,610,56,()=>this.home(),{parent:p,primary:true,size:26});if(!this.localReview)void this.client.sync().catch(()=>{});return;
  }
  this.drag();const top=root.children.length;this.ui.panel(-126,326,964,46);this.ui.text(def.name,-442,326,24,UI_COLORS.ink,root,295,37);this.clock=this.ui.text('',-146,326,24,UI_COLORS.ink,root,258,37);this.score=this.ui.text('',178,326,21,'#007D92',root,192,37);this.ui.button(`${this.speed}X`,387,326,104,46,()=>{this.speed=this.speed===1?2:1;this.world.setPlaybackSpeed(this.speed);this.render();},{size:23});this.ui.button('返回',507,326,207,46,()=>this.leave(),{size:24});this.ui.pinBattleFrom(top,1,0,0,'top');
  this.connectivity=this.ui.text('',0,280,20,'#C56743',root,750,30);
  if(this.preview){const from=root.children.length;this.ui.panel(-229,-316,754,57);this.ui.text('拖动伙伴自由布阵 · 拖到队友位置可交换',-229,-316,22,UI_COLORS.ink,root,729,42);this.ui.button(this.localReview?'开始战斗':'开始挑战 · 使用1次',389,-316,442,57,()=>void this.start(),{primary:true,size:26});this.ui.pinBattleFrom(from,1,0,0,'bottom');}
  else {this.skills=new ActiveSkillControls(this.ui,this.camera,this.service,this.command,fn=>fn(this.fight.battle),v=>{if(v){this.operation('move',false);this.selected='';}this.operation('target',v);},()=>this.render(),()=>!this.destroyed&&!this.hidden,{focus:targetId=>{void this.send('focus',{targetId});return true;},key:u=>u.turtleId,changed:()=>void this.settings(),cast:cmd=>{void this.send('cast',{command:cmd});return true;}});this.ui.panel(0,-280,1120,122,root,'#F5FCFC',246,17);this.fight.roster.forEach((t,i)=>{const n=this.ui.group('世界挑战伙伴头像',-455+i*94,-280,root,84,100);this.ui.pet(t,0,13,65,n);this.ui.text(['岩盾','叶灵','珊歌','阳光','潮行'][['stone','spike','crystal','leaf','bubble'].indexOf(t.role)],0,-28,17,UI_COLORS.ink,n,82,26,true);});this.ui.line(4,-323,4,-236,root,'#BDDADF');this.skills.render(this.fight.battle.units,'battleDock');const from=root.children.length;this.ui.button('调位',-535,-280,44,82,()=>this.ui.toast('长按伙伴并拖到合法陆地，可与队友交换位置'),{size:21});this.ui.pinBattleFrom(from,1,0,0,'bottom',-1);}
 }
 private drag():void{
  const epoch=this.epoch,b=this.fight.battle,map={...BATTLE_MAPS[WORLD_BOSS_MAP],slots:b.formationVersion===2?expeditionSlots(WORLD_BOSS_MAP):BATTLE_MAPS[WORLD_BOSS_MAP].slots};
  const ground=(e:EventTouch):Point=>{const p=e.getLocation(),ray=this.camera.screenPointToRay(p.x,p.y),t=(.045-ray.o.y)/ray.d.y;const point={x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};if(b.formationVersion===2){const nearest=map.slots.map(p=>({p,d:Math.hypot(p.x-point.x,p.z-point.z)})).sort((a,b)=>a.d-b.d)[0];if(nearest.d<1)return {...nearest.p};}return point;};
  const project=(p:Point,height:number)=>{const v=this.camera.worldToScreen(new Vec3(p.x,height,p.z)),size=screen.windowSize,s=Math.min(size.width/1280,size.height/720);return {x:(v.x-size.width/2)/s,y:(v.y-size.height/2)/s};};
  const issue=(id:string,p:Point)=>{if(b.formationVersion===2&&!map.slots.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<.01))return '请拖到12个固定站位点之一';const hud=this.ui.battleLandingIssue(project(p,0),project(p,1.55));if(hud)return hud;const units=this.fight.battle.units,source=units.find(u=>u.id===id);return exchangePlacementIssue(map,p,source?.placement??source,units.filter(u=>u.id!==id).map(u=>u.placement??u));};
  const place=(id:string,p:Point)=>{const reason=issue(id,p);if(reason){this.ui.toast(reason);return;}const units=this.fight.battle.units,u=units.find(u=>u.id===id)!,other=units.find(v=>v!==u&&Math.hypot((v.placement??v).x-p.x,(v.placement??v).z-p.z)<.78);if(this.preview){const old={x:u.x,z:u.z},oldSlot=u.slot;Object.assign(u,other?.placement??p);u.placement={x:u.x,z:u.z};if(b.formationVersion===2)u.slot=map.slots.findIndex(q=>Math.hypot(q.x-u.x,q.z-u.z)<.01);if(other){Object.assign(other,old);other.placement=old;other.slot=oldSlot;}this.world.update(this.fight.battle,[],0);}else void this.send('move',{unitId:id,point:p});this.selected='';this.world.showRange(null);this.operation('move',false);};
  const entries=b.units.map(u=>{const hit=this.ui.group('世界挑战伙伴:'+u.id,0,0,this.ui.root,76,89);this.hits.push(hit);let origin:{x:number;y:number}|undefined,ghost:Node|undefined,pressTimer:ReturnType<typeof setTimeout>|undefined,longPress=false;
   const clearPress=()=>{if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}};
   hit.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.targeting)return;origin=e.getLocation();longPress=false;pressTimer=setTimeout(()=>{pressTimer=undefined;if(!origin)return;longPress=true;if(!this.preview)this.operation('move',true);const current=this.fight.battle.units.find(v=>v.id===u.id);if(current)this.world.showRange(null,current.range,u.role==='leaf',current);},280);});
   hit.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!origin||this.targeting)return;const at=e.getLocation();if(Math.hypot(at.x-origin.x,at.y-origin.y)>7&&!longPress){clearPress();longPress=true;if(!this.preview)this.operation('move',true);}if(!longPress)return;const p=ground(e);if(!ghost){ghost=this.ui.group('世界挑战拖动预览',0,0,this.ui.root,100,100);this.ui.battleFigure(u.role,0,0,94,ghost);}const pos=project(p,.65);ghost.setPosition(pos.x,pos.y,0);this.world.showRange(null,petRange(this.fight.roster.find(t=>t.id===u.turtleId)!),u.role==='leaf',p);this.world.tintRange(!issue(u.id,p));});
   const finish=(e:EventTouch)=>{if(!origin)return;clearPress();origin=undefined;if(ghost){place(u.id,ground(e));this.operation('move',false);ghost.removeFromParent();ghost.destroy();ghost=undefined;}else {this.selected='';this.operation('move',false);this.world.showRange(null);this.ui.toast('长按伙伴并拖到合法陆地，不支持点击落点');}};hit.on(Node.EventType.TOUCH_END,finish);
   hit.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.getEventCode()===Node.EventType.TOUCH_END){finish(e);return;}clearPress();origin=undefined;ghost?.removeFromParent();ghost?.destroy();ghost=undefined;this.selected='';this.operation('move',false);this.world.showRange(null);});return {id:u.id,hit};});
  this.overlay=()=>{if(epoch!==this.epoch)return;for(const {id,hit} of entries){if(!isValid(hit,true))continue;const u=this.fight.battle.units.find(v=>v.id===id)!;const p=project(u,.65);hit.setPosition(p.x,p.y,0);hit.active=u.alive;}};this.overlay();
 }
 private leave():void{this.cancelOperation();if(this.localReview||this.preview){this.home();return;}const p=this.ui.dialog('返回世界挑战','离开页面后，90 秒挑战仍继续计时，成绩会自动保存。',()=>p.parent?.destroy(),785,354);this.ui.text('再次进入可继续操作本次挑战，不会重复扣次数。',0,-6,24,UI_COLORS.ink,p,703,82,true);this.ui.button('返回伤害榜',0,-112,435,52,()=>this.home(),{parent:p,primary:true,size:25});}
}
