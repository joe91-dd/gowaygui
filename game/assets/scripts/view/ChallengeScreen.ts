import {ExpeditionHUD,drawFixedStations} from './ExpeditionHUD';
import {petRange} from '../core/development';
import {PACK_NAMES} from '../core/rewardPacks';
import {exchangePlacementIssue,placementIssue,normalizedPoint} from '../core/placement';
import type {Point} from '../core/types';
import {raidMapId} from '../core/raids';
import {Camera,Color,EventTouch,Graphics,Label,LabelOutline,Node,Vec3,screen as displayScreen,tween,isValid} from 'cc';
import {GameService,displayName} from '../core/game';
import type {RaidSession,ArenaSession} from '../core/communityTypes';
import {RAIDS,raidBattle,stepRaid,swapRaidPet,moveRaidStation} from '../core/raids';
import {frontNotice} from '../core/multiFront';
import {stepArena,withArenaPlayer} from '../core/arena';
import {commandBattle,getBattleEvents} from '../core/battle';
import {MATERIAL_NAMES,SKILL_BY_ID,BATTLE_MAPS,battleMap,ROLES} from '../core/data';
import {IslandUI,UI_COLORS,color} from './IslandUI';
import {BattleWorld} from './BattleWorld';
import {IslandAudio} from './IslandAudio';
import type {BattleState} from '../core/battle';
import {ActiveSkillControls} from './ActiveSkillControls';

/** Local party and arena battles keep their own checkpoint, sharing the finished turtle assets and combat world. */
export class ChallengeScreen {
  private expeditionHUD?:ExpeditionHUD;
  private raid?:RaidSession;private arena?:ArenaSession;private destroyed=false;private hidden=false;private paused=false;private epoch=0;private lastCheckpoint=0;private speed:1|2=1;private heading?:Label;private clock?:Label;private rosterView='';
  private skills?:ActiveSkillControls;private choosingTarget=false;private moving=false;private moveCancel?:Node;private rosterOpen=false;private feedbackNodes:Node[]=[];private feedbackTimes=new Map<string,number>();
  private stationLabels:{slot:number;label:Label}[]=[];
  private stationOverlay?:()=>void;
  get diagnosticContext(){return {levelId:this.raid?raidMapId(this.raid.tier):54,wave:this.raid?this.raid.wave+1:1};}
  constructor(private mode:'raid'|'arena',private service:GameService,private ui:IslandUI,private world:BattleWorld,private camera:Camera,private audio:IslandAudio,private command:(kind:string)=>string,private onHome:()=>void,private onError:(e:unknown)=>void){
    const c=service.snapshot.community;if(!c)throw new Error('没有挑战资料');this.raid=mode==='raid'?c.raid:undefined;this.arena=mode==='arena'?c.arena:undefined;
    if(!this.raid&&!this.arena)throw new Error('没有待继续的挑战');this.world.setLevel(this.battle?.levelId??(this.raid?raidMapId(this.raid.tier):54));this.lastCheckpoint=this.battle?.tick??0;this.paused=false;void this.audio.playMusic('bgm_battle');this.render();
  }
  private rosterState():string{
    if(this.raid){const mine=this.raid.members[0],owned=new Set(mine.roster.map(p=>p.id));return JSON.stringify([mine.activeId,this.raid.battle?.units.concat(this.raid.battle.benchUnits??[]).filter(u=>owned.has(u.id)).map(u=>[u.id,u.alive,u.sleepUntilWave])]);}
    return JSON.stringify([this.arena?.attackers.map(u=>u.alive),this.arena?.movers.map(m=>[m.escaped,(this.arena?.battle.tick??0)>=m.enterTick])]);
  }
  private get battle():BattleState|undefined{return this.raid?.battle??this.arena?.battle;}
  private get finished():boolean{return this.raid?.settled??this.arena?.settled??false;}
  private button(text:string,x:number,y:number,w:number,h:number,action:()=>void,parent=this.ui.root,disabled=false,primary=false):Node{
    let n:Node;const epoch=this.epoch;n=this.ui.button(text,x,y,w,h,()=>{if(this.destroyed||this.hidden||epoch!==this.epoch||!this.ui.isInteractive(n))return;try{action();}catch(e){this.paused=true;this.onError(e);}},{parent,disabled,primary,size:28});return n;
  }
  checkpoint():void{
    if(this.destroyed||this.finished)return;
    if(this.raid?.phase==='combat')this.service.checkpointRaid(this.command('raidCheckpoint'),this.raid);
    if(this.arena?.phase==='combat')this.service.checkpointArena(this.command('arenaCheckpoint'),this.arena);
    this.lastCheckpoint=this.battle?.tick??0;
  }
  hide():void{if(this.destroyed)return;this.hidden=true;this.world.setPaused(true);try{this.checkpoint();}catch(e){this.onError(e);}}
  show():void{if(this.destroyed)return;this.hidden=false;this.render();}
  destroy():void{if(this.destroyed)return;this.destroyed=true;this.world.destroy();}
  update(dt:number):void{
    if(this.destroyed||this.hidden||this.paused||this.choosingTarget||this.moving||this.finished)return;
    this.stationOverlay?.();
    try{
      const delta=Math.min(Math.max(dt,0),.5)*this.speed;
      if(this.battle)this.battle.autoSkills=this.service.snapshot.settings.autoSkills??false;
      if(this.raid?.phase==='combat')stepRaid(this.raid,delta);
      else if(this.arena?.phase==='combat')stepArena(this.arena,delta);else{this.world.updatePresentation(delta);return;}
      const b=this.battle!;const events=getBattleEvents(b);this.world.setPlaybackSpeed(this.speed);this.world.update(b,events,delta);for(const event of events)this.buildFeedback(b,event);
      this.skills?.update();this.expeditionHUD?.update();
      if(this.raid)for(const marker of this.stationLabels)marker.label.color=color(this.raid.members.some((m,i)=>(m.station??i)===marker.slot)?UI_COLORS.gold:UI_COLORS.cream);
      this.audio.battleEvents(b,events);
      if(this.clock)this.clock.string=`${Math.floor((this.raid?.seconds??0)+b.elapsed)} 秒`;
      if(this.heading)this.heading.string=this.raid?.tier===3?`双环潮狱 · 剩余 ${Math.max(0,180-Math.floor(b.elapsed))}秒 · 敌人 ${b.enemies.filter(e=>e.alive).length}/15`:this.raid?`守护 ${b.coreHealth}/20 · 第${this.raid.wave+1}波`:this.arena!.defending?`对手突破 ${this.arena!.passed}/5 · 守住三只`:`已突破 ${this.arena!.passed}/5 · 三只获胜`;
      if(this.raid&&b.status!=='fighting'){
        this.raid=this.service.finishRaid(`raidFinish:${this.raid.id}:${this.raid.wave+1}`,this.raid);this.lastCheckpoint=0;this.render();if(this.raid.settled)this.audio.effect(this.raid.victory?'sfx_victory':'sfx_defeat');return;
      }
      if(this.arena?.phase==='result'){
        this.arena=this.service.finishArena(`arenaFinish:${this.arena.id}`,this.arena);this.render();this.audio.effect(this.arena.victory?'sfx_victory':'sfx_defeat');return;
      }
      if(b.tick-this.lastCheckpoint>=40)this.checkpoint();if(this.rosterState()!==this.rosterView)this.render();
    }catch(e){this.paused=true;this.world.setPaused(true);this.onError(e);}
  }
  private buildFeedback(battle:BattleState,event:import('../core/battle').BattleEvent):void{
    if(this.paused||this.hidden)return;const amount=Math.round(event.amount??0);
    const numeric=amount>0&&['damage','heal','shield'].includes(event.type)?(event.type==='damage'?`-${amount.toLocaleString()}`:`+${amount.toLocaleString()}`):undefined;
    const skill=event.skillId?SKILL_BY_ID[event.skillId]:undefined;const word=event.critical?'暴击':event.type==='control'?`控制 · ${skill?.name??'眩晕'}`:event.type==='skill'&&skill?`${skill.active?'技能':'被动'} · ${skill.name}`:undefined;
    const label=numeric?(word?`${word} ${numeric}`:numeric):word;if(!label)return;
    const key=`${event.sourceId}:${event.skillId??event.effect??event.type}`;if(!numeric&&battle.tick-(this.feedbackTimes.get(key)??-100)<20)return;
    this.feedbackNodes=this.feedbackNodes.filter(n=>isValid(n,true));if(this.feedbackNodes.length>=14)return;
    const casterText=!numeric,actorId=casterText?event.sourceId:(event.targetId??event.sourceId);
    const actor=battle.units.find(u=>u.id===actorId)??battle.enemies.find(e=>e.id===actorId);if(!actor&&(casterText||event.x===undefined))return;
    const size=displayScreen.windowSize,scale=Math.min(size.width/1280,size.height/720),screen=this.camera.worldToScreen(new Vec3(actor?.x??event.x??0,2.15,actor?.z??event.z??0)),p=new Vec3((screen.x-size.width/2)/scale,(screen.y-size.height/2)/scale,0);if(!numeric)this.feedbackTimes.set(key,battle.tick);
    if(casterText)p.y+=12;
    const drift=casterText?(p.x>0?-1:1)*(56+(event.id%3)*10):0;
    const critical=event.critical===true,positive=event.type==='heal'||event.type==='shield',text=this.ui.text(label,p.x,p.y,critical?23:numeric?20:18,critical?'#FF7777':positive?'#9AFFC9':numeric?'#FFFFFF':'#FFF2A8',this.ui.root,260,32,true);const outline=text.node.addComponent(LabelOutline);outline.width=1.5;outline.color=new Color('#263449');this.feedbackNodes.push(text.node);tween(text.node).to(casterText?.86:.72,{position:new Vec3(p.x+drift,p.y+(casterText?48:34),0),scale:new Vec3(1.06,1.06,1)}).call(()=>{if(isValid(text.node,true))text.node.destroy();}).start();
  }
  render():void{
    if(this.destroyed)return;this.expeditionHUD?.dispose();this.expeditionHUD=undefined;this.skills?.dispose();this.setMoving(false);this.epoch++;this.stationOverlay=undefined;this.rosterView=this.rosterState();this.skills=undefined;this.stationLabels=[];this.choosingTarget=false;this.ui.clear();this.heading=undefined;this.clock=undefined;this.world.showRange(null);this.world.setPaused(this.paused||this.finished);
    void this.audio.playMusic(this.finished||this.raid?.phase!=='combat'&&!this.arena?'bgm_home':this.raid&&this.raid.wave+1===RAIDS[this.raid.tier].waves?'bgm_boss':'bgm_battle');
    if(this.finished){this.result();return;}
    if(this.paused){this.pausePage();return;}
    if(this.raid)this.renderRaid();else this.renderArena();
  }
  private hud(title:string):void{
    const start=this.ui.root.children.length;
    this.ui.panel(-185,318,870,60);this.ui.text(title,-455,318,26,UI_COLORS.ink,this.ui.root,302,40);
    this.heading=this.ui.text('',-81,318,24,UI_COLORS.ink,this.ui.root,410,40);this.clock=this.ui.text('',181,318,23,UI_COLORS.sand,this.ui.root,112,38);
    this.ui.pinBattleFrom?.(start,1,0,0,'top',-1);const controls=this.ui.root.children.length;
    this.button(`${this.speed}X`,335,318,136,60,()=>{this.speed=this.speed===1?2:1;this.render();});this.button('菜单',526,318,176,60,()=>{this.paused=true;this.checkpoint();this.render();});
    this.ui.pinBattleFrom?.(controls,1,0,0,'top',1);
  }
  private renderExpeditionRaid():void{
    const r=this.raid!,b=r.battle!;this.world.update(b,[],0);const top=this.ui.root.children.length;this.ui.panel(-328,326,610,42);this.ui.text(RAIDS[r.tier].name+' · 双人协防',-440,326,20,UI_COLORS.ink,this.ui.root,340,32);this.ui.button(`${this.speed}X`,-170,326,76,42,()=>{this.speed=this.speed===1?2:1;this.render();},{size:22});this.ui.button('菜单',-76,326,104,42,()=>{this.paused=true;this.checkpoint();this.render();},{size:20});this.ui.pinBattleFrom(top,1,0,0,'top');
    this.expeditionHUD=new ExpeditionHUD(this.ui,this.camera,this.world,()=>this.raid!.battle!,r.members[0].ownerId,(action,args)=>{try{this.service.raidExpeditionCommand(this.command(action),action,args,r.phase==='combat'?this.raid:undefined);this.raid=this.service.snapshot.community!.raid;this.render();}catch(e){this.onError(e);}},()=>this.render(),v=>this.setMoving(v),r.phase==='prep',()=>{this.service.beginRaidWave(this.command('raidBegin'));this.raid=this.service.snapshot.community!.raid;this.render();},undefined,enabled=>this.service.updateSettings(this.command('auto'),{autoSkills:enabled,manualSkillTurtles:[]}));
  }
  private renderRaid():void{
    if(this.raid?.expeditionVersion){this.renderExpeditionRaid();return;}

    const r=this.raid!,config=RAIDS[r.tier],combat=r.phase==='combat';this.stationMarkers();this.hud(config.name);this.heading!.string=`守护 ${r.battle?.coreHealth??r.coreHealth}/20 · 第${r.wave+1}/${config.waves}波`;this.clock!.string=`${Math.floor(r.seconds+(r.battle?.elapsed??0))} 秒`;
    const preview=combat?r.battle!:raidBattle(r);this.world.update(preview,[],0);
    if(combat){this.ui.panel(0,-280,1120,122,this.ui.root,'#F5FCFC',246,17);this.renderDeployDock();this.renderSkills();return;}
    const actions=this.ui.root.children.length;
    this.button('调整站位',-507,-316,224,54,()=>this.stationPage());this.ui.pinBattleFrom?.(actions,1,0,0,'bottom',-1);
    const rosterStart=this.ui.root.children.length;
    const mine=r.members[0];if(!combat||this.rosterOpen){this.ui.panel(0,-236,1232,102);
    mine.roster.forEach((p,i)=>{
      const actor=r.battle?.units.concat(r.battle.benchUnits??[]).find(u=>u.id===p.id),sleep=actor?.sleepUntilWave??r.sleep[p.id],active=p.id===mine.activeId;
      const fallen=actor?!actor.alive:!!r.fallen?.includes(p.id)&&sleep===undefined;
      const status=sleep&&sleep>r.wave+1?`第${sleep}波苏醒`:fallen?'本局已倒下':active?'正在上场':'点击轮换';
      const n=this.button('',-472+i*236,-236,224,92,()=>{
        if(this.raid!.phase==='combat'){swapRaidPet(this.raid!,0,p.id);this.checkpoint();}else{this.service.selectRaidPet(this.command('raidSwap'),p.id);this.raid=this.service.snapshot.community!.raid;}
        this.render();
      },this.ui.root,!!(sleep&&sleep>r.wave+1)||fallen,active);
      this.ui.pet(p.turtle,-70,0,68,n);this.ui.text(`${p.turtle.skills.length}技能`,35,18,21,active?UI_COLORS.ink:UI_COLORS.cream,n,96,34);this.ui.text(status,35,-20,20,active?UI_COLORS.ink:UI_COLORS.sand,n,128,32);
    });const hint=this.ui.panel(0,-170,800,36,this.ui.root,'#FFF9EC',235,12);this.ui.text(frontNotice(raidMapId(r.tier),r.wave+1)+' · 每人一只',0,0,20,UI_COLORS.ink,hint,780,32);this.ui.pinBattleFrom?.(rosterStart,.84,0,-31,'bottom');}
    if(!combat){const readyStart=this.ui.root.children.length;this.button(r.wave===0?'全队准备，出发':'开始下一波',384,-316,420,54,()=>{this.service.beginRaidWave(`raidWave:${r.id}:${r.wave+1}`);this.raid=this.service.snapshot.community!.raid;this.lastCheckpoint=0;this.rosterOpen=false;this.render();},this.ui.root,false,true);this.ui.pinBattleFrom?.(readyStart,1,0,0,'bottom',1);}
    else{
      this.button(this.rosterOpen?'收起备战':'出战 / 轮换',-242,-316,268,54,()=>{this.rosterOpen=!this.rosterOpen;this.render();});
      this.renderDeployDock();
      this.renderSkills();
    }
  }
  private setMoving(value:boolean):void{
    this.moving=value&&this.raid?.phase==='combat';
    if(!this.moving){this.moveCancel?.destroy();this.moveCancel=undefined;}else if(!this.moveCancel&&!this.raid?.expeditionVersion){this.moveCancel=this.ui.button('取消换位',-470,-258,180,46,()=>{this.setMoving(false);this.world.showRange(null);},{size:22});}
    this.world.setPaused?.(this.paused||this.choosingTarget||this.moving);
  }
  private stationMarkers():void{
    const r=this.raid!,map=r.battle?battleMap(r.battle):BATTLE_MAPS[raidMapId(r.tier)],mine=r.members[0],epoch=this.epoch,pet=mine.roster.find(p=>p.id===mine.activeId);if(!pet)return;
    const size=displayScreen.windowSize,scale=Math.min(size.width/1280,size.height/720),local=(p:{x:number;y:number})=>new Vec3((p.x-size.width/2)/scale,(p.y-size.height/2)/scale,0);
    const ground=(p:{x:number;y:number}):Point|undefined=>{const ray=this.camera.screenPointToRay(p.x,p.y);if(Math.abs(ray.d.y)<.001)return;const t=(.045-ray.o.y)/ray.d.y;return normalizedPoint({x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t});};
    const issue=(p:Point)=>this.ui.battleLandingIssue?.(local(this.camera.worldToScreen(new Vec3(p.x,0,p.z))),local(this.camera.worldToScreen(new Vec3(p.x,1.65,p.z))))??exchangePlacementIssue(map,p,mine.placement??map.slots[mine.station??0],r.members.filter((_,i)=>i>0).map(m=>m.placement??map.slots[m.station??r.members.indexOf(m)]));
    const commit=(p:Point)=>{if(this.epoch!==epoch)return;try{const reason=issue(p);if(reason){this.ui.toast(reason);return;}if(r.phase==='combat'){moveRaidStation(r,0,mine.station??0,p);this.checkpoint();}else{this.service.selectRaidStation(this.command('raidPlace'),mine.station??0,p);this.raid=this.service.snapshot.community!.raid;}this.render();}catch(e){this.world.showRange(null);this.onError(e);}};
    const surface=this.ui.group('副本自由布阵地图',0,0,this.ui.root,1280,720),g=surface.addComponent(Graphics);g.fillColor=color('#FFFFFF',1);g.rect(-640,-360,1280,720);g.fill();
    const hit=this.ui.group('拖动我的副本伙伴',0,0,this.ui.root,84,106);let start:Vec3|undefined,ghost:Node|undefined,pressTimer:ReturnType<typeof setTimeout>|undefined,longPress=false;
    this.stationOverlay=()=>{if(this.epoch!==epoch)return;const actor=r.battle?.units.find(u=>u.id===mine.activeId),at=actor??mine.placement??map.slots[mine.station??0],p=local(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));hit.setPosition(p);};this.stationOverlay();
    const reset=()=>{if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}if(start||ghost)this.setMoving(false);start=undefined;ghost?.destroy();ghost=undefined;longPress=false;this.world.showRange(null);};
    hit.on(Node.EventType.TOUCH_START,(e:EventTouch)=>{if(this.paused||this.choosingTarget)return;start=local(e.getLocation());longPress=false;pressTimer=setTimeout(()=>{pressTimer=undefined;if(!start)return;longPress=true;this.setMoving(true);this.world.showRange(mine.station??0,petRange(pet.turtle),pet.turtle.role==='leaf',mine.placement);},280);});
    hit.on(Node.EventType.TOUCH_MOVE,(e:EventTouch)=>{if(!start||this.epoch!==epoch)return;const p=local(e.getLocation());if(Math.hypot(p.x-start.x,p.y-start.y)>8&&!longPress){if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}longPress=true;this.setMoving(true);}if(!longPress)return;if(!ghost){ghost=this.ui.group('副本拖动伙伴',p.x,p.y,this.ui.root,108,108);this.ui.battleFigure(pet.turtle.role,0,0,130,ghost);}ghost.setPosition(p);const at=ground(e.getLocation());this.world.showRange(null,petRange(pet.turtle),pet.turtle.role==='leaf',at);this.world.tintRange(!!at&&!issue(at));});
    const finish=(e:EventTouch)=>{const moved=!!ghost,at=ground(e.getLocation());reset();if(moved&&at)commit(at);else {this.setMoving(false);this.ui.toast('长按伙伴并拖到合法陆地，不支持点击落点');}};
    hit.on(Node.EventType.TOUCH_END,finish);hit.on(Node.EventType.TOUCH_CANCEL,(e:EventTouch)=>{if(e.getEventCode()===Node.EventType.TOUCH_END&&ghost)finish(e);else reset();});hit.once(Node.EventType.NODE_DESTROYED,reset);
  }
  private stationPage():void{this.render();this.ui.toast('长按自己的伙伴，拖到空地换位，拖到队友落点互换');}
  private renderArena():void{
    const a=this.arena!;if(a.battle.formationVersion===2)drawFixedStations(this.ui,this.camera,54);this.hud(a.defending?'竞技场·防守演练':'竞技场·进攻');this.heading!.string=a.defending?`对手突破 ${a.passed}/5 · 守住三只`:`已突破 ${a.passed}/5 · 三只获胜`;this.clock!.string=`${Math.floor(a.seconds)} 秒`;this.world.update(a.battle,[],0);
    this.ui.panel(0,-280,1120,122,this.ui.root,'#F5FCFC',246,17);this.renderDeployDock();this.renderSkills();
  }
  private deployRoster():{id:string;turtle:import('../core/types').Turtle;active:boolean;alive:boolean}[]{
    if(this.raid){const mine=this.raid.members[0];return mine.roster.map(p=>{const actor=this.battle?.units.concat(this.battle.benchUnits??[]).find(u=>u.id===p.id);return {id:p.id,turtle:p.turtle,active:p.id===mine.activeId,alive:actor?.alive??!this.raid!.fallen?.includes(p.id)};});}
    const a=this.arena!,team=a.defending?a.defenders:a.attackers;return team.map(u=>{const turtle=this.service.snapshot.collection[u.turtleId];return turtle?{id:u.turtleId,turtle,active:!a.defending&&!!a.movers.find(m=>m.id===u.id&&m.enterTick<=a.battle.tick&&!m.escaped),alive:u.alive}:undefined;}).filter((v):v is {id:string;turtle:import('../core/types').Turtle;active:boolean;alive:boolean}=>!!v);
  }
  private deployPet(id:string):void{
    if(this.raid){swapRaidPet(this.raid,0,id);this.checkpoint();this.render();return;}
    const a=this.arena!,u=a.attackers.find(v=>v.turtleId===id),m=u&&a.movers.find(v=>v.id===u.id);if(!u||!m){this.ui.toast('该伙伴当前不可出场');return;}
    if(a.defending){this.ui.toast('防守方按顺序自动出场');return;}
    if(!u.alive||m.escaped){this.ui.toast('该伙伴已倒下或已完成路线');return;}
    m.enterTick=Math.max(1,a.battle.tick+1);m.waiting=false;this.checkpoint();this.render();
  }
  private toggleArenaDeploy():void{
    const a=this.arena;if(!a||a.defending)return;
    const enabled=!(a.autoDeploy??true);a.autoDeploy=enabled;
    if(!enabled){for(const m of a.movers)if(!m.escaped&&m.enterTick>a.battle.tick)m.enterTick=Number.MAX_SAFE_INTEGER;}
    else {let next=a.battle.tick+1;for(const m of a.movers){if(m.escaped||m.enterTick!==Number.MAX_SAFE_INTEGER)continue;m.enterTick=next;next+=50;}}
    this.checkpoint();this.render();
  }
  private renderDeployDock():void{
    const roster=this.deployRoster();if(!roster.length)return;

    roster.slice(0,5).forEach((entry,i)=>{
      const x=-500+i*72,n=this.button('',x,-278,66,86,()=>this.deployPet(entry.id),this.ui.root,!entry.alive,entry.active);
      n.name='手动出场头像:'+entry.id;this.ui.pet(entry.turtle,0,8,54,n);this.ui.text(entry.active?'上场':entry.alive?'点击上阵':'倒下',0,-31,14,entry.active?UI_COLORS.gold:UI_COLORS.cream,n,62,22,true);
    });
    if(this.arena&&!this.arena.defending){const auto=this.arena.autoDeploy??true;this.button(auto?'自动\n出场':'手动\n出场',-72,-278,84,86,()=>this.toggleArenaDeploy(),this.ui.root,false,auto);}
  }
  private renderSkills():void{
    const b=this.battle!;
    if(this.raid)b.controlledUnitIds=this.raid.members[0].roster.map(p=>p.id);
    this.skills=new ActiveSkillControls(this.ui,this.camera,this.service,this.command,
      action=>this.arena?withArenaPlayer(this.arena,action):action(this.battle!),
      value=>{if(value)this.setMoving(false);this.choosingTarget=value;this.world.setPaused(this.paused||this.choosingTarget||this.moving);},()=>this.render(),()=>!this.destroyed&&!this.hidden&&!this.paused);
    const roster=this.arena?(this.arena.defending?this.arena.defenders:this.arena.attackers):b.units.filter(u=>b.controlledUnitIds!.includes(u.id));
    this.skills.render(roster,'battleDock');
  }
  private pausePage():void{
    const p=this.ui.dialog('战斗菜单','关闭菜单后自动回到战斗。',()=>{this.paused=false;this.render();},700,360);

    this.button('保存并返回海岛',0,-36,430,54,()=>this.onHome(),p);
    this.button(this.raid?'退出副本 · 不领奖':'结束本次挑战',0,-114,430,54,()=>{
      if(this.raid){this.raid=this.service.finishRaid(this.command('raidAbandon'),this.raid,true);this.service.updateSettings(this.command('raidExitAuto'),{autoSkills:true,manualSkillTurtles:[]});this.paused=false;this.onHome();return;}
      if(this.arena)this.arena=this.service.finishArena(this.command('arenaAbandon'),this.arena,true);this.paused=false;this.render();
    },p);
  }
  private result():void{
    if(this.ui.art?.ready){
      const r=this.raid,a=this.arena,victory=r?.victory??a?.victory;
      const p=this.ui.dialog(a?.draw?'本场平局':victory?'挑战成功':'本次挑战结束',r?`${RAIDS[r.tier].name} · ${r.wave} 波 · ${r.seconds.toFixed(0)} 秒`:`竞技场 · 突破 ${a!.passed} 只`,undefined,840,460);
      this.ui.icon('gold',-263,5,84,p);
      const rewards=r?(r.rewards??[]).map(g=>g.kind==='gold'?`${g.amount.toLocaleString()} 金币`:g.kind==='material'?`${MATERIAL_NAMES[g.material]} ×${g.amount}`:`${(g.kind==='bookPack'?PACK_NAMES[g.grade]:SKILL_BY_ID[g.skillId].name)} ×${g.amount}`).join(' · '):a?.draw?'双方坚持到时限，本场排名不变。':a?.practice?'防守演练结束，可以调整伙伴再试。':`原排名 ${a!.rankBefore} → 当前 ${a!.rankAfter??a!.rankBefore}`;
      this.ui.text(rewards||'本次未通关，调整技能与阵容后再来。',73,3,26,UI_COLORS.ink,p,540,136,true);
      if(r?.chestId){const id=r.chestId,c=this.service.snapshot.progression?.chests.find(c=>c.id===id);this.button(c?.claimed?'宝箱已领取':`领取 ${r.stars} 星宝箱`,0,-88,340,48,()=>{this.service.claimChest(this.command('raidChest'),id);this.result();},p,!!c?.claimed,true);}
      this.ui.text('基础奖励已保存；宝箱可在副本奖励页补领。',0,-112,21,UI_COLORS.sand,p,760,36);
      this.button('返回海岛',0,-175,430,54,()=>this.onHome(),p,false,true);return;
    }
    const r=this.raid,a=this.arena,victory=r?.victory??a?.victory,p=this.ui.sheet(a?.draw?'本场平局':victory?'挑战成功！':'本次挑战结束',r?`${RAIDS[r.tier].name} · 完成${r.wave}波 · ${r.seconds.toFixed(1)}秒`:`竞技场 · 突破${a!.passed}只 · ${a!.seconds.toFixed(1)}秒`);
    if(r){const names=(r.rewards??[]).map(g=>g.kind==='gold'?`${g.amount}金币`:g.kind==='material'?`${MATERIAL_NAMES[g.material]}×${g.amount}`:`${(g.kind==='bookPack'?PACK_NAMES[g.grade]:SKILL_BY_ID[g.skillId].name)}书×${g.amount}`);this.ui.text(names.length?names.join(' · '):'本次未通关，调整技能和阵容后再来。',0,12,34,UI_COLORS.gold,p,1080,228,true);}
    else if(a!.draw)this.ui.text('双方仍有可战斗的伙伴，达到时限，本场平局。\n排名不变，可调整输出与续航搭配后再挑战。',0,20,36,UI_COLORS.gold,p,1080,220,true);
    else if(a!.practice)this.ui.text(victory?'防守演练成功，所有进攻伙伴已完成本场战斗。':'防线被突破，调整防守站位和伙伴后再试。',0,20,36,UI_COLORS.gold,p,1080,220,true);
    else this.ui.text(`原排名 ${a!.rankBefore}\n当前排名 ${a!.rankAfter??a!.rankBefore}\n${victory?'已获得对应排名':'至少三只突破才能晋级'}`,0,28,36,UI_COLORS.gold,p,1080,230,true);
    this.ui.text('本次副本或竞技场仅使用自有龟；伙伴仍保留在收藏。',0,-174,28,UI_COLORS.sand,p,1100,58);
    this.button('返回海岛',0,-276,560,88,()=>this.onHome(),p,false,true);
  }
}
