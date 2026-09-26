import {ExpeditionHUD} from './ExpeditionHUD';
import {petRange} from '../core/development';
import {visualName} from './VisualIdentity';
import {Camera,Node,Label,Graphics,Vec3,EventTouch,screen} from 'cc';
import {IslandUI,UI_COLORS,color} from './IslandUI';
import {GameService} from '../core/game';
import {RoomClient} from './RoomClient';
import {BattleWorld} from './BattleWorld';
import {IslandAudio} from './IslandAudio';
import {ActiveSkillControls} from './ActiveSkillControls';
import {PetDetails} from './PetDetails';
import {RewardMenus} from './RewardMenus';
import {RAIDS,raidMapId,raidBattle,stepRaid} from '../core/raids';
import {BATTLE_MAPS,ROLES} from '../core/data';
import {getBattleEvents} from '../core/battle';
import {exchangePlacementIssue,placementIssue} from '../core/placement';
import type {RaidSession} from '../core/communityTypes';
import type {Point} from '../core/types';

/** Server owns combat and rewards; local prediction is disposable presentation only. */
export class LiveRaidScreen {
 private expeditionHUD?:ExpeditionHUD;
 private moving=false;private moveCancel?:Node;private operations:Promise<void>=Promise.resolve();private pauseHeartbeat=0;private acceptedRevision=0;
 private resultSound=false;private musicWave=-1;private raid:RaidSession;private destroyed=false;private hidden=false;private paused=false;private polling=false;private pollClock=0;private lastEvent=0;private lastWave=-1;private notice?:Label;private skills?:ActiveSkillControls;private epoch=0;private rosterOpen=true;private targeting=false;private overlay?:()=>void;
 constructor(private service:GameService,private client:RoomClient,private ui:IslandUI,private world:BattleWorld,private camera:Camera,private audio:IslandAudio,private command:(kind:string)=>string,private onHome:()=>void,private onError:(e:unknown)=>void){
  if(!client.room?.raid)throw Error('副本尚未开始');this.raid=JSON.parse(JSON.stringify(client.room.raid));world.setLevel(raidMapId(this.raid.tier));this.render();void this.settings();
 }
 get diagnosticContext(){return {levelId:raidMapId(this.raid.tier),wave:this.raid.wave+1};}
 private get mine(){return this.raid.members.find(m=>m.ownerId===this.client.id)!;}
 private get host(){return this.client.room?.host===this.client.id;}
 checkpoint():void{} // Every accepted action has already been committed by the room service.
 hide():void{this.cancelOperation();this.hidden=true;}
 show():void{this.hidden=false;void this.sync();}
 destroy():void{this.cancelOperation();this.destroyed=true;this.world.destroy();}
 private async settings(){const s=this.service.snapshot.settings;await this.send('settings',{auto:!!s.autoSkills,held:s.manualSkillTurtles??[]},false);}
 private send(action:string,body:Record<string,unknown>={},render=true):Promise<void>{this.operations=this.operations.then(async()=>{try{const room=await this.client.action(action,body);if(this.destroyed)return;if(room?.raid&&room.revision>=this.acceptedRevision){this.acceptedRevision=room.revision;this.raid=JSON.parse(JSON.stringify(room.raid));}if(render)this.render();}catch(e){if(!this.destroyed)this.ui.toast(e instanceof Error?e.message:'操作未成功，请重试');}});return this.operations;}
 private operation(kind:'target'|'move',value:boolean):void{
  const before=this.targeting||this.moving;if(kind==='target')this.targeting=value;else this.moving=value;const active=this.targeting||this.moving;
  this.world.setPaused(active||!!this.raid.operationOwners?.length);if(active!==before&&this.raid.phase==='combat')void this.send(active?'operationPause':'operationResume',{},false);
  if(!this.moving){this.moveCancel?.destroy();this.moveCancel=undefined;}else if(!this.moveCancel&&!this.raid.expeditionVersion)this.moveCancel=this.ui.button('取消换位',-470,-263,180,46,()=>{this.operation('move',false);this.world.showRange(null);},{size:22});
 }
 private cancelOperation():void{this.skills?.dispose();this.operation('target',false);this.operation('move',false);}

 private async sync():Promise<void>{if(this.polling||this.destroyed)return;this.polling=true;try{await this.client.sync();if(this.destroyed)return;const room=this.client.room,r=room?.raid;if(room&&room.revision<this.acceptedRevision)return;if(room)this.acceptedRevision=room.revision;if(!r){this.onHome();return;}const changed=r.phase!==this.raid.phase||r.wave!==this.raid.wave||r.members.some((m,i)=>m.activeId!==this.raid.members[i]?.activeId);this.raid=JSON.parse(JSON.stringify(r));if(changed){this.rosterOpen=r.phase!=='combat';this.render();}}catch(e){if(this.notice?.isValid)this.notice.string='连接暂时中断 · 正在重连';}finally{this.polling=false;}}
 update(dt:number):void{
  if(this.destroyed||this.hidden)return;if(this.targeting||this.moving){this.pauseHeartbeat+=dt;if(this.pauseHeartbeat>=10){this.pauseHeartbeat=0;void this.send('operationPause',{},false);}}else this.pauseHeartbeat=0;this.pollClock+=dt;if(this.pollClock>=.25){this.pollClock=0;void this.sync();}
  if(this.paused){this.world.updatePresentation(dt);return;}const r=this.raid;
  if(r.phase==='prep'&&r.battle){this.expeditionHUD?.update();this.world.update(r.battle,[],0);}
  if(r.phase==='combat'&&r.battle){
   if(this.lastWave!==r.wave){this.lastWave=r.wave;this.lastEvent=0;}
   // Extrapolate only the last short interval, then reconcile with the next server snapshot.
   const frozen=this.targeting||this.moving||!!r.operationOwners?.length;this.world.setPaused(frozen);if(!frozen&&r.battle.status==='fighting')stepRaid(r,Math.min(.05,dt)*(this.client.room?.speed??1));
   this.expeditionHUD?.update();
   const events=getBattleEvents(r.battle).filter(e=>e.id>this.lastEvent);if(events.length)this.lastEvent=Math.max(...events.map(e=>e.id));this.world.update(r.battle,events,frozen?0:dt);this.audio.battleEvents(r.battle,events);this.skills?.update();
  }else this.world.updatePresentation(dt);this.overlay?.();
  if(this.notice&&(this.targeting||this.moving||r.operationOwners?.length)){this.notice.string=this.targeting||this.moving?'正在选择操作目标':'队友正在选择操作目标';return;}
  if(this.notice)this.notice.string=r.tier===3?`双环潮狱 · ${Math.max(0,180-Math.floor(r.battle?.elapsed??0))} 秒 · 剩余 ${r.battle?.enemies.filter(e=>e.alive).length??0}/15`:`守护 ${r.battle?.coreHealth??r.coreHealth}/20　 第 ${Math.min(r.wave+1,RAIDS[r.tier].waves)}/${RAIDS[r.tier].waves} 波　${Math.floor((r.seconds+(r.battle?.elapsed??0))/60)}:${String(Math.floor(r.seconds+(r.battle?.elapsed??0))%60).padStart(2,'0')}`;
 }
 render():void{
  if(this.destroyed)return;this.expeditionHUD?.dispose();this.expeditionHUD=undefined;this.cancelOperation();this.ui.clear();this.epoch++;this.skills=undefined;this.overlay=undefined;this.world.showRange(null);const r=this.raid,root=this.ui.root;
  void this.audio.playMusic(r.settled||r.phase!=='combat'?'bgm_home':r.wave+1===RAIDS[r.tier].waves?'bgm_boss':'bgm_battle');
  if(r.phase==='combat'&&this.musicWave!==r.wave){this.musicWave=r.wave;this.audio.effect('sfx_wave_start');}
  if(r.settled&&!this.resultSound){this.resultSound=true;this.audio.effect(r.victory?'sfx_victory':'sfx_defeat');}
  if(r.settled){const p=this.ui.dialog(r.victory?'小队凯旋':'本次挑战结束',`${RAIDS[r.tier].name} · 完成 ${r.wave} 波${r.stars?' · '+r.stars+' 星':''}`,undefined,900,500);this.ui.modernIcon(6,0,50,116,p);this.ui.text('基础奖励已发送到系统邮箱。\n星级宝箱可在副本的“我的宝箱”领取，伙伴经验已结算。',0,-66,26,UI_COLORS.ink,p,800,112,true);this.ui.button('返回海岛',0,-181,440,56,()=>{void this.client.action('leave').then(()=>this.onHome()).catch(e=>this.ui.toast(e.message));},{parent:p,primary:true,size:26});return;}
  if(r.expeditionVersion){this.renderExpeditionRaid();return;}
  const preview=r.battle??raidBattle(r);this.world.update(preview,[],0);const h=this.ui.root.children.length;
  this.ui.panel(-107,325,1010,49);this.ui.text(RAIDS[r.tier].name,-446,325,24,UI_COLORS.ink,root,282,37);this.notice=this.ui.text('',9,325,23,UI_COLORS.ink,root,285,37);this.ui.button('退出副本',322,325,178,49,()=>this.exitRaid(),{size:21});this.ui.button('队伍',515,325,188,49,()=>this.pause(),{size:23});this.ui.pinBattleFrom(h,1,0,0,'top');
  this.drag();
  this.ui.panel(0,-280,1120,122,root,'#F5FCFC',246,17);
  this.mine.roster.forEach((p,i)=>{const active=this.mine.activeId===p.id,n=this.ui.button('',-455+i*94,-280,84,100,()=>{const popup=new PetDetails(this.ui,this.service,this.command,this.onError);popup.show(p.turtle,{confirmText:active?'正在出战':'确定出战',disabled:active,confirm:()=>void this.send('swap',{petId:p.originalId})});},{selected:active,surface:'bare'});this.ui.pet(p.turtle,0,14,64,n);this.ui.text(visualName(p.turtle),0,-24,17,UI_COLORS.ink,n,82,24,true);this.ui.text(active?'出战中':'轮换',0,-43,13,active?'#00A9AD':UI_COLORS.sand,n,82,19,true);});
  this.ui.line(4,-323,4,-236,root,'#BDDADF');
  if(r.phase==='combat'&&r.battle){const owned=this.mine.roster.map(p=>p.id);r.battle.controlledUnitIds=owned;this.skills=new ActiveSkillControls(this.ui,this.camera,this.service,this.command,fn=>fn(this.raid.battle!),v=>{if(v)this.operation('move',false);this.operation('target',v);},()=>this.render(),()=>!this.destroyed&&!this.hidden&&!this.paused,{focus:targetId=>{void this.send('focus',{targetId},false);return true;},key:u=>this.mine.roster.find(p=>p.id===u.id)?.originalId??u.turtleId,changed:()=>void this.settings(),cast:cmd=>{void this.send('cast',{skillId:cmd.skillId,targetId:cmd.targetId,point:cmd.point},false);return true;}});this.skills.render(r.battle.units.filter(u=>owned.includes(u.id)),'battleDock');}
  else {const from=root.children.length;this.ui.button(this.host?(r.wave?'开始下一波':'队伍出发'):'等待队长出发',282,-280,460,70,()=>{this.rosterOpen=false;void this.send('next');},{primary:true,disabled:!this.host,size:25});this.ui.pinBattleFrom(from,1,0,0,'bottom',1);}
 }
 private renderExpeditionRaid():void{
  const r=this.raid,b=r.battle!;this.world.update(b,[],0);const top=this.ui.root.children.length;this.ui.panel(-328,326,610,42);this.ui.text(RAIDS[r.tier].name+' · 双人协防',-445,326,20,UI_COLORS.ink,this.ui.root,340,32);this.ui.button(`${this.client.room?.speed??1}X`,-170,326,76,42,()=>{if(this.host)void this.send('speed',{speed:this.client.room?.speed===2?1:2});else this.ui.toast('由队长统一调整战斗倍速');},{size:22});this.ui.button('菜单',-76,326,104,42,()=>this.pause(),{size:20});this.ui.pinBattleFrom(top,1,0,0,'top');
  this.expeditionHUD=new ExpeditionHUD(this.ui,this.camera,this.world,()=>this.raid.battle!,this.client.id,(command,args)=>void this.send('expedition',{command,args}),()=>this.render(),v=>this.operation('move',v),r.phase==='prep',()=>{if(this.host)void this.send('next');else this.ui.toast('等待队长开始战斗');},(unitId,skillId,targetId,point)=>void this.send('cast',{unitId,skillId,targetId,point},false),enabled=>void this.send('settings',{auto:enabled,held:[]},false),()=>!!this.client.room?.members.find(m=>m.clientId===this.client.id)?.auto);
 }
 private drag():void{
  const mine=this.mine,map=BATTLE_MAPS[raidMapId(this.raid.tier)],t=mine.roster.find(p=>p.id===mine.activeId)!,epoch=this.epoch;
  const ground=(e:EventTouch):Point=>{const p=e.getLocation(),ray=this.camera.screenPointToRay(p.x,p.y),t=(.045-ray.o.y)/ray.d.y;return {x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};};
  const transform=(x:number,z:number)=>{const p=this.camera.worldToScreen(new Vec3(x,.65,z)),size=screen.windowSize,s=Math.min(size.width/1280,size.height/720);return new Vec3((p.x-size.width/2)/s,(p.y-size.height/2)/s,0);};
  const issue=(point:Point)=>{const size=screen.windowSize,s=Math.min(size.width/1280,size.height/720),project=(y:number)=>{const v=this.camera.worldToScreen(new Vec3(point.x,y,point.z));return {x:(v.x-size.width/2)/s,y:(v.y-size.height/2)/s};};const hud=this.ui.battleLandingIssue(project(0),project(1.65));if(hud)return hud;const occupied=this.raid.members.filter(m=>m!==this.mine).map(m=>m.placement??map.slots[m.station??this.raid.members.indexOf(m)]);return exchangePlacementIssue(map,point,this.mine.placement??map.slots[this.mine.station??this.raid.members.indexOf(this.mine)],occupied);};
  const hit=this.ui.group('我的联机伙伴落点',0,0,this.ui.root,92,105);let ghost:Node|undefined,origin:{x:number;y:number}|undefined,pressTimer:ReturnType<typeof setTimeout>|undefined,longPress=false;
  this.overlay=()=>{if(epoch!==this.epoch)return;const m=this.mine,at=this.raid.battle?.units.find(u=>u.id===m.activeId)??m.placement??map.slots[m.station??0];hit.setPosition(transform(at.x,at.z));};this.overlay();
  const clearPress=()=>{if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}};
  hit.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.targeting)return;origin=e.getLocation();longPress=false;pressTimer=setTimeout(()=>{pressTimer=undefined;if(!origin)return;longPress=true;if(this.raid.phase==='combat')this.operation('move',true);},280);});
  hit.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!origin)return;const p=e.getLocation(),point=ground(e);if(Math.hypot(p.x-origin.x,p.y-origin.y)>7&&!longPress){clearPress();longPress=true;if(this.raid.phase==='combat')this.operation('move',true);}if(!longPress)return;if(!ghost){ghost=this.ui.group('联机拖动预览',0,0,this.ui.root,110,110);this.ui.battleFigure(t.turtle.role,0,0,110,ghost);}ghost.setPosition(transform(point.x,point.z));this.world.showRange(null,petRange(t.turtle),t.turtle.role==='leaf',point);this.world.tintRange(!issue(point));});
  const finish=(e:EventTouch)=>{if(ghost){const point=ground(e),reason=issue(point);if(reason)this.ui.toast(reason);else void this.send('move',{point},false);ghost.destroy();ghost=undefined;}else if(origin)this.ui.toast('长按伙伴并拖到合法陆地；不支持点击落点');clearPress();origin=undefined;longPress=false;this.operation('move',false);this.world.showRange(null);};hit.on(Node.EventType.TOUCH_END,finish);hit.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.getEventCode()===Node.EventType.TOUCH_END)finish(e);else{clearPress();origin=undefined;longPress=false;ghost?.destroy();ghost=undefined;this.operation('move',false);this.world.showRange(null);}});
 }
 private exitRaid():void{this.cancelOperation();const p=this.ui.dialog('退出副本','中途退出不会获得奖励，并会消耗本次副本机会。退出后下次进入将默认自动战斗。',()=>p.parent?.destroy(),790,350);this.ui.button('继续战斗',-112,-104,250,52,()=>p.parent?.destroy(),{parent:p,size:23});this.ui.button('确认退出',150,-104,250,52,()=>{p.parent?.destroy();void this.abandonRaid();},{parent:p,primary:true,size:23});}
 private async abandonRaid():Promise<void>{try{await this.client.action('abandon');this.service.updateSettings(this.command('raidExitAuto'),{autoSkills:true,manualSkillTurtles:[]});if(!this.destroyed)this.onHome();}catch(e){if(!this.destroyed)this.ui.toast(e instanceof Error?e.message:'退出副本失败，请重试');}}
 private pause():void{this.cancelOperation();
  const p=this.ui.dialog('小队战斗',`房间 ${this.client.room?.code} · 联机战斗由所有队员共享时间`,()=>p.parent?.destroy(),800,430);this.ui.text('返回海岛后，队伍仍会继续战斗。\n再次进入副本可以重返当前房间。',0,12,25,UI_COLORS.ink,p,725,108,true);this.ui.button('返回海岛',0,-75,470,54,()=>this.onHome(),{parent:p,primary:true,size:25});this.ui.button('退出副本',0,-146,470,48,()=>{p.parent?.destroy();this.exitRaid();},{parent:p,size:23});if(this.host)this.ui.button('结束本次副本',0,-214,470,48,()=>{const confirm=this.ui.dialog('结束队伍挑战','所有队友将一起结算已经完成的波次。',()=>confirm.parent?.destroy(),690,290);this.ui.button('确认结束',0,-79,350,50,()=>void this.send('abandon'),{parent:confirm,primary:true,size:24});},{parent:p,size:23});
 }
}
