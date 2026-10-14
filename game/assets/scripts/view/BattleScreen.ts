import {runtimeQuery} from '../platform/runtimeQuery';
import {BattleFeedback} from './BattleFeedback';
import {pearlBattleHeader} from './BattleHudHeader';
import {ExpeditionHUD} from './ExpeditionHUD';
import {petRange} from '../core/development';
import {PACK_NAMES} from '../core/rewardPacks';
import {exchangePlacementIssue,placementIssue,normalizedPoint} from '../core/placement';
import type {Point} from '../core/types';
import {Camera, Canvas, Color, Component, EventTouch, Graphics, Label, LabelOutline, Node, UITransform, Vec3,view,tween,isValid} from 'cc';
import {GameService, displayName} from '../core/game';
import {BattleEvent, BattleState, commandBattle, commandAllSkills, canCommandBattle, legalSkillTargets, skillTargetMode, createBattle, getBattleEvents, stepBattle} from '../core/battle';
import {combinedCountChance} from '../core/fusion';
import {goldAmount} from '../core/economy';
import {frontNotice} from '../core/multiFront';
import {waveTactic} from '../core/waveTactics';
import {BATTLE_MAPS,battleMap, MATERIAL_NAMES, ROLES, SKILL_BY_ID} from '../core/data';
import type {Material as TrainingMaterial, RewardGrant, RewardNode, RunState, RunTurtle, SkillId, Turtle} from '../core/types';
import {currentUnits,pendingTakeaways,hasPendingReward,rewardPrice,remainingRewardIndices} from '../core/prototype';
import {turtleQuality} from '../core/prototypeConfig';
import {BubbleReveal} from './BubbleReveal';
import {IslandUI, color, UI_COLORS} from './IslandUI';
import {visualName} from './VisualIdentity';
import {IslandAudio} from './IslandAudio';
import {BattleWorld} from './BattleWorld';
import {ActiveSkillControls} from './ActiveSkillControls';

/** Presentation controller: all changes to permanent game state are delegated to GameService. */
export class BattleScreen {
 private approvedFeedback?:BattleFeedback;
  private battle?:BattleState;
  private expeditionHUD?:ExpeditionHUD;
  private worldHits=new Map<string,Node>();
  private paused=false;
  private modal=false;
  private selected='';
  private mergeSelection:string[]=[];
  private lastCheckpointTick=0;
  private lifeLabel?:Label;
  private timeLabel?:Label;
  private pageEpoch=0;
  private recruitPage=0;
  private recruitSelection='';
  private fusionPage=0;
  private teamPage=0;
  private skillLabel?:Label;
  private activeSkill?:{unitId:string;id:import('../core/types').SkillId};
  private destroyed=false;
  private hidden=false;
  private waitingForResult=false;
  private baseSeconds=0;
  private lastSoundEvent=0;
  private feedbackTimes=new Map<string,number>();
  private feedbackNodes:Node[]=[];
  private diagnosticState={levelId:0,wave:0};
  private playbackSpeed=1;
  private lastBenchRefresh='';
  private readonly dropTargets=new Map<number,Node>();
  private readonly benchTargets=new Map<number,Node>();
  private rosterOpen=false;
  private rewardFrame?: (dt:number)=>void;
  private skillButtons:{unitId:string;skill?:SkillId;label:Label;mask:Graphics}[]=[];
  private autoCastLabel?:Label;
  private moving=false;private moveCancel?:Node;
  private sharedSkills?:ActiveSkillControls;
  private hudHealth:{id:string;bar:Graphics;label:Label}[]=[];
  get diagnosticContext():Readonly<{levelId:number;wave:number}>{return this.battle?{levelId:this.battle.levelId,wave:this.battle.wave}:this.diagnosticState;}
  constructor(private readonly owner:Component,private readonly service:GameService,private readonly ui:IslandUI,private readonly world:BattleWorld,private readonly camera:Camera,private readonly audio:IslandAudio,private readonly command:(kind:string)=>string,private readonly onHome:()=>void,private readonly onError:(error:unknown)=>void){
    const r=this.run;this.baseSeconds=r.combatSeconds;this.world.setLevel(r.levelId);this.world.syncRunUnits(this.units);
    if((r.phase==='combat'||r.phase==='reveal'&&r.resumeAfterReveal==='combat')&&r.battle){this.battle=r.battle;if(r.phase==='combat')this.setPauseState(false);this.lastCheckpointTick=this.battle.tick;this.lastSoundEvent=this.battle.nextEventId-1;this.world.update(this.battle,[],0);}
    this.render();if(this.paused)this.showPause();
  }
  private runRevision=-1;
  private cachedRun?:RunState;
  private get run():RunState{
    if(this.runRevision!==this.service.revision){this.cachedRun=this.service.runSnapshot;this.runRevision=this.service.revision;}
    if(!this.cachedRun)throw new Error('没有进行中的冒险');return this.cachedRun;
  }
  private get units():RunTurtle[]{return currentUnits(this.run);}
  /** All buttons belong to this controller, including callbacks held across a page exit. */
  private button(...args:Parameters<IslandUI['button']>):Node{
    const [text,x,y,w,h,action,options]=args;
    let node:Node;
    const epoch=this.pageEpoch,enabled=()=>!this.destroyed&&!this.hidden&&epoch===this.pageEpoch&&!options?.disabled&&this.ui.isInteractive(node);
    const guarded=()=>{if(enabled())action();};
    node=this.ui.button(text,x,y,w,h,guarded,{...options,size:options?.size??30});
    const label=node.getComponentInChildren(Label);
    if(label){label.overflow=Label.Overflow.CLAMP;label.enableWrapText=text.includes('\n');label.lineHeight=Math.ceil((options?.size??30)*1.2);}
    if(!options?.disabled){
      // IslandUI plays confirmation audio before its action. Own this button's
      // end event as well, so even a retained event cannot sound after retirement.
      node.off(Node.EventType.TOUCH_END);
      node.on(Node.EventType.TOUCH_END,()=>{
        if(!enabled())return;
        node.setScale(1,1,1);this.ui.click();guarded();
      });
    }
    return node;
  }
  private clearPage():void{this.expeditionHUD?.dispose();this.expeditionHUD=undefined;this.sharedSkills?.dispose();this.setMoving(false);this.worldHits.clear();this.pageEpoch++;this.rewardFrame=undefined;this.ui.clear();this.skillLabel=undefined;this.activeSkill=undefined;this.skillButtons=[];this.sharedSkills=undefined;}
  private sheet(title:string,subtitle:string,close?:()=>void,closeText='返回'):Node{
    this.setPauseState(this.paused,true);this.clearPage();
    const p=this.ui.sheet(title,subtitle);
    // Keep the close event (including confirmation audio) in this controller.
    if(close)this.button(closeText,504,274,144,88,close,{parent:p});
    return p;
  }
  private shortName(name:string,limit=6):string{const chars=Array.from(name);return chars.length>limit?chars.slice(0,limit-1).join('')+'…':name;}
  private petName(t:Turtle):string{return this.ui.art?.ready?visualName(t):displayName(t);}
  private page(value:number,count:number):number{return Math.max(0,Math.min(Math.max(0,Math.ceil(count/6)-1),value));}
  private card(t:Turtle,middle:string,bottom:string,index:number,parent:Node,action:()=>void,selected=false):Node{
    const n=this.button('',-384+(index%3)*384,104-Math.floor(index/3)*192,360,176,action,{parent,selected});
    n.name='伙伴卡:'+t.id;
    this.ui.pet(t,-114,4,104,n);
    this.ui.text(this.shortName(this.petName(t)),58,48,32,UI_COLORS.cream,n,192,40);
    this.ui.text(middle,58,4,28,UI_COLORS.sand,n,192,36);
    this.ui.text(bottom,58,-48,28,UI_COLORS.sand,n,192,36);return n;
  }
  private skillCard(id:SkillId,x:number,y:number,w:number,parent:Node,back:()=>void,height=98):void{
    const n=this.button('',x,y,w,height,()=>this.skillDetails(id,back),{parent});n.name='技能:'+id;
    this.ui.bookIcon(id,0,10,height===88?56:64,n);this.ui.text(SKILL_BY_ID[id].name,0,height===88?-30:-35,20,UI_COLORS.ink,n,w-12,28);
  }
  private skillDetails(id:SkillId,back:()=>void):void{if(!this.destroyed)this.ui.skillDetail(id);}

  private setPauseState(paused=this.paused,modal=this.modal):void{
    if(this.destroyed)return;
    this.paused=paused;this.modal=modal;this.world.setPaused(paused||modal||this.moving);
  }
  private setMoving(value:boolean):void{
    this.moving=value&&!!this.battle&&this.battle.status==='fighting';
    if(!this.moving){this.moveCancel?.destroy();this.moveCancel=undefined;}else if(!this.moveCancel&&!this.run.expedition){this.moveCancel=this.ui.button('取消换位',-475,-265,180,46,()=>{this.setMoving(false);this.world.showRange(null);},{size:22});}
    this.world.setPaused(this.paused||this.modal||this.moving);
  }
  private act(action:()=>void):void{if(this.destroyed)return;try{action();this.render();}catch(error){this.onError(error);}}
  update(dt:number):void{
    if(this.destroyed||this.hidden)return;
    // Modal/page replacement may retire input nodes before this controller is
    // replaced. Never update an already-destroyed Cocos transform.
    for(const [id,n] of this.worldHits){if(!isValid(n,true)){this.worldHits.delete(id);continue;}const u=this.units.find(u=>u.id===id);if(!u||u.slot===null)continue;const at=this.battle?.units.find(a=>a.id===id)??u.placement??BATTLE_MAPS[this.run.levelId].slots[u.slot];if(!at)continue;const p=this.screenPoint(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));if(p)n.setPosition(p.x,p.y,0);}

    if(this.rewardFrame&&!this.destroyed&&!this.hidden){this.rewardFrame(dt);return;}
    if(this.destroyed||this.paused||this.modal||this.moving)return;
    if(!this.battle){
      this.world.updatePresentation(dt*this.playbackSpeed);
      if(this.waitingForResult&&!this.world.hasPendingExits){this.waitingForResult=false;this.result();}
      return;
    }
    try{
      const simulationDt=this.battle.rulesVersion==='0.6'?Math.min(1,dt)*this.playbackSpeed:Math.min(.15,dt);
      this.battle.autoSkills=this.service.settingsSnapshot.autoSkills??false;this.battle.manualSkillTurtles=[...(this.service.settingsSnapshot.manualSkillTurtles??[])];
      if(this.battle.rulesVersion==='0.6')this.world.setPlaybackSpeed(dt>0?simulationDt/dt:this.playbackSpeed);
      stepBattle(this.battle,simulationDt);const events=getBattleEvents(this.battle);this.world.update(this.battle,events,this.battle.rulesVersion==='0.6'?simulationDt:dt);this.playBattleSounds(this.battle,events);
      if(this.lifeLabel)this.lifeLabel.string=`守护 ${this.battle.coreHealth}/20`;
      if(this.timeLabel)this.timeLabel.string=this.time(this.baseSeconds+this.battle.elapsed);
      this.updateSkillBar();this.expeditionHUD?.update();
      if(this.skillLabel&&this.activeSkill){
        const unit=this.battle.units.find(u=>u.id===this.activeSkill!.unitId),skill=this.activeSkill.id,remaining=Math.max(0,Math.ceil(((unit?.cooldowns[skill]||0)-this.battle.tick)*.05));
        this.skillLabel.string=unit?.alive?`${SKILL_BY_ID[skill].name}\n${remaining?`${remaining}s 后可用`:'点击释放'}`:'正在休整';this.skillLabel.color=color(!unit?.alive?UI_COLORS.muted:UI_COLORS.ink);
      }
      if(this.battle.status!=='fighting'){
        const r=this.run;this.service.completeWave(`finish:${r.id}:${this.battle.wave}`,r.id,this.battle);
        const updated=this.run,ended=updated.phase==='result';this.baseSeconds=updated.combatSeconds;this.battle=undefined;this.selected='';this.rosterOpen=false;this.render();
        if(ended)this.audio.effect(this.service.snapshot.results[r.id].victory?'sfx_victory':'sfx_defeat');
      }else if(this.battle.tick-this.lastCheckpointTick>=40){
        const rescued=this.run.bossRescuedWaves?.length??0;
        this.service.checkpointBattle(this.command('checkpoint'),this.run.id,this.battle);this.lastCheckpointTick=this.battle.tick;
        this.battle=this.run.battle;
        if((this.run.bossRescuedWaves?.length??0)>rescued){this.render();this.ui.toast('击败首领！新伙伴已解救到未锁定备战槽');}
      }
    }catch(error){this.setPauseState(true);this.onError(error);}
  }
  private time(seconds:number):string{return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
  private playBattleSounds(battle:BattleState,events:BattleEvent[]):void{
    const fresh=events.filter(event=>event.id>this.lastSoundEvent&&event.tick>=battle.tick-8);
    for(const event of events)this.lastSoundEvent=Math.max(this.lastSoundEvent,event.id);
    for(const event of fresh)this.buildFeedback(battle,event);
    this.audio.battleEvents(battle,fresh);
  }

  private buildFeedback(battle:BattleState,event:BattleEvent):void{
    if(this.hidden)return;
    (this.approvedFeedback??=new BattleFeedback(this.ui,this.camera)).show(battle,event);
  }
  checkpoint():void{if(!this.destroyed&&this.battle&&this.run.phase==='combat')this.service.checkpointBattle(this.command('checkpoint'),this.run.id,this.battle);}
  hide():void{if(this.destroyed)return;this.hidden=true;this.world.setPaused(true);this.audio.pause();try{this.checkpoint();}catch(error){this.onError(error);}}
  show():void{if(this.destroyed)return;this.hidden=false;this.audio.resume();this.world.setPaused(this.paused||this.modal||this.moving);if(this.run.phase==='reveal')this.render();}
  destroy():void{if(this.destroyed)return;this.destroyed=true;this.worldHits.clear();this.world.destroy();}
  render():void{
    if(this.destroyed)return;this.setPauseState(this.paused,false);this.clearPage();
    const r=this.run,s=this.service.snapshot,level=BATTLE_MAPS[r.levelId],units=this.units,active=r.phase==='combat';
    void this.audio.playMusic(!active?'bgm_home':this.battle?.enemies.some(e=>e.kind==='boss'&&e.alive)||r.wave+1===level.waves?'bgm_boss':'bgm_battle');
    if(this.service.snapshot.livingVersion&&r.mode==='endless'&&r.phase==='between'&&!this.paused&&!r.rewardNodes?.some(hasPendingReward)){this.startWave();return;}
    if(r.expedition&&r.phase!=='result'){this.renderExpedition();return;}
    this.world.showRange(null);this.diagnosticState={levelId:r.levelId,wave:r.wave+(active?1:0)};
    if((active||r.resumeAfterReveal==='combat')&&this.battle)this.world.update(this.battle,[],0);else this.world.syncRunUnits(units);
    if(r.rulesVersion==='0.6'){this.playbackSpeed=r.speed??1;this.world.setPlaybackSpeed(this.playbackSpeed);this.renderPrototype();return;}
    if(r.phase==='result'){
      this.waitingForResult=this.world.hasPendingExits;
      if(this.waitingForResult){
        this.ui.text(s.results[r.id].victory?'海湾守住啦！':'伙伴们辛苦啦，休息一下。',0,-220,32,UI_COLORS.cream,this.ui.root,1000,56);
        this.button('菜单',532,304,144,88,()=>this.showPause());
      }
      else this.result();return;
    }
    this.waitingForResult=false;if(r.phase==='reveal'){this.reveal();return;}
    this.ui.panel(-216,306,800,96);
    this.ui.text(level.name,-430,306,30,UI_COLORS.cream,this.ui.root,320,44);
    this.lifeLabel=this.ui.text(`守护 ${this.battle?.coreHealth??r.coreHealth}/20`,-164,306,30,UI_COLORS.cream,this.ui.root,200,44);
    this.ui.text(`第 ${Math.min(level.waves,r.wave+(active?1:0))}/${level.waves} 波`,62,320,28,UI_COLORS.cream,this.ui.root,216,36);
    this.timeLabel=this.ui.text(this.time(r.combatSeconds+(this.battle?.elapsed||0)),62,280,28,UI_COLORS.cream,this.ui.root,216,36);
    this.button(`队伍·替补${units.filter(u=>u.slot===null).length}`,322,304,216,88,()=>this.team(),{size:28});
    this.button('菜单',532,304,144,88,()=>this.showPause());
    if(active)this.autoSkillToggle(-410,192,388,88);
    this.ui.panel(0,-268,1232,164,this.ui.root,UI_COLORS.dark,245,22);
    if(!units.some(u=>u.id===this.selected))this.selected=units.find(u=>u.slot!==null)?.id??units[0]?.id??'';
    for(let slot=0;slot<5;slot++){
      const u=units.find(u=>u.slot===slot),n=this.button('',-512+slot*180,-268,160,152,()=>{if(u){this.selected=u.id;this.render();}else this.formation();},{selected:u?.id===this.selected,disabled:active&&!u});
      n.name='站位卡:'+slot;
      if(u)this.ui.pet(u.turtle,0,22,96,n);else this.ui.text('空位',0,16,30,UI_COLORS.muted,n,140,44);
      this.ui.text(u?this.shortName(this.petName(u.turtle),5):active?'暂无伙伴':'点击布阵',0,-52,28,UI_COLORS.cream,n,148,36);
      this.ui.text(String(slot+1),-64,50,26,UI_COLORS.sand,n,28,36);
    }
    const selected=units.find(u=>u.id===this.selected);
    if(active){
      const skill=selected?.turtle.skills.find(id=>SKILL_BY_ID[id].active),unit=this.battle?.units.find(u=>u.id===selected?.id);
      const action=this.button('',448,-268,272,152,()=>{
        const b=this.battle,u=b?.units.find(u=>u.id===selected?.id);
        if(skill&&b&&u?.alive&&(u.cooldowns[skill]||0)<=b.tick)this.selectActiveSkill(u.id,skill);
      },{primary:!!skill&&!!unit?.alive,disabled:!skill||!unit?.alive});
      action.name='战斗技能';
      const remaining=skill?Math.max(0,Math.ceil(((unit?.cooldowns[skill]||0)-(this.battle?.tick??0))*.05)):0;
      this.skillLabel=this.ui.text(skill?`${SKILL_BY_ID[skill].name}\n${unit?.alive?(remaining?`${remaining}s 后可用`:'点击释放'):'正在休整'}`:'自动攻击',0,24,30,skill&&unit?.alive?UI_COLORS.ink:UI_COLORS.cream,action,252,80,true);
      if(selected)this.ui.text(`${ROLES[selected.turtle.role].job} · Lv.${selected.level}`,0,-46,28,UI_COLORS.sand,action,252,36);
      if(skill&&selected)this.activeSkill={unitId:selected.id,id:skill};
    }else{
      if(selected){const role=selected.turtle.role;this.world.showRange(selected.slot,petRange(selected.turtle)+(role!=='stone'&&selected.turtle.skills.includes('reach')?.3:0),role==='leaf');}
      this.button(r.wave===0?'守住海岛':'开始下一波',448,-268,272,152,()=>this.startWave(),{primary:true,size:32});
      this.button('布阵',-438,-134,268,88,()=>this.formation());
      this.button(r.recruitAvailable?'招募伙伴':'暂无招募机会',-146,-134,268,88,()=>this.recruit(),{disabled:!r.recruitAvailable||units.length>=10});
      const mergeAllowed=level.mergeWaves.includes(r.wave)&&!r.mergeWavesUsed.includes(r.wave)&&units.length>=2;
      this.button(mergeAllowed?'合成新龟':'暂不可合成',146,-134,268,88,()=>this.fusion(),{disabled:!mergeAllowed});
      this.button('比较收录',438,-134,268,88,()=>{if(selected)this.compare(selected.id);},{disabled:!selected});
      const tip=r.wave===0?'伙伴自动攻击；先守住这一波。':mergeAllowed?'现在可以合成，满意后再收录。':selected?.turtle.role==='leaf'?'绿色范围内的伙伴可接受普通治疗。':'点击布阵调整站位，圈内目标可被普攻。';
      this.ui.panel(0,212,1000,64);this.ui.text(tip,0,212,28,UI_COLORS.cream,this.ui.root,960,44);
    }
  }
  /** An explicit developer preview URL owns isolated in-memory progress. */
  startG1Presentation():void{
    if(typeof location==='undefined'||runtimeQuery().get('showcase')!=='g1'||runtimeQuery().get('inspection')==='prep')return;
    if(!this.destroyed&&this.run.wave===0&&this.run.phase==='prep')this.startWave();
  }
  private renderExpedition():void{
    const r=this.run,b=this.battle??r.battle!;if(r.phase==='combat')this.battle=b;this.playbackSpeed=r.speed??1;this.world.setPlaybackSpeed(this.playbackSpeed);this.world.update(b,[],0);
    this.lifeLabel=undefined;this.timeLabel=undefined;
    pearlBattleHeader(this.ui,BATTLE_MAPS[r.levelId].name+(r.expedition?.solo&&r.mode==='endless'?' · '+['I','II','III'][(r.expedition.difficulty??1)-1]:''),r.speed??1,()=>this.act(()=>this.service.setBattleSpeed(this.command('speed'),r.speed===2?1:2)),()=>this.showPause());
    this.expeditionHUD=new ExpeditionHUD(this.ui,this.camera,this.world,()=>this.battle??this.run.battle!,'local-player',(action,args)=>this.act(()=>{this.service.expeditionCommand(this.command(action),action,args,this.battle);if(this.run.phase==='combat')this.battle=this.run.battle;}),()=>this.render(),v=>this.setMoving(v),r.phase==='prep',()=>this.startWave(),undefined,enabled=>this.service.updateSettings(this.command('auto'),{autoSkills:enabled,manualSkillTurtles:[]}));
  }
  private startWave():void{
    this.act(()=>{
      const r=this.run,next=r.expedition?r.battle!:createBattle(r.levelId,r.wave+1,this.units.filter(u=>u.slot!==null).map(u=>({id:u.id,turtle:u.turtle,level:u.level,slot:u.slot!,placement:u.placement,sleepUntilWave:u.sleepUntilWave,fallen:u.fallen})),{coreHealth:r.coreHealth,waveLimit:r.waveLimit,...(r.rulesVersion==='0.6'?{rulesVersion:'0.6' as const,mode:r.mode}:{})});
      next.autoSkills=(typeof location!=='undefined'&&runtimeQuery().get('showcase')==='g1')||(this.service.settingsSnapshot.autoSkills??false);next.manualSkillTurtles=[...(this.service.settingsSnapshot.manualSkillTurtles??[])];
      this.service.beginWave(`begin:${r.id}:${r.wave+1}`,r.id,next);this.battle=next;this.audio.effect('sfx_wave_start');this.lastCheckpointTick=0;this.lastSoundEvent=0;this.setPauseState(false,false);
    });
  }
  private renderPrototype():void{
    const r=this.run,units=this.units,active=r.phase==='combat',endless=r.mode==='endless';
    this.dropTargets.clear();this.benchTargets.clear();
    if(r.phase==='result'){
      this.waitingForResult=this.world.hasPendingExits;
      if(this.waitingForResult){this.ui.text('伙伴们正在收拾行囊…',0,-220,32,UI_COLORS.cream,this.ui.root,1060,64);this.button('菜单',540,304,144,88,()=>this.showPause());}
      else this.prototypeResult();return;
    }
    this.waitingForResult=false;
    if(r.phase==='reveal'){this.prototypeReveal();return;}
    const reward=r.rewardNodes?.find(hasPendingReward);if(reward){this.resourceChoices(reward);return;}
    this.worldDragTargets();
    const hudStart=this.ui.root.children.length;
    this.ui.panel(-317,326,610,42,this.ui.root,'#F7FCFC',250,9);
    this.ui.hudSymbol(0,-590,326,31);this.ui.hudSymbol(1,-434,326,31);
    this.ui.hudSymbol(2,-266,326,33);this.ui.hudSymbol(3,-109,326,30);
    this.ui.text(endless?'无尽海湾':BATTLE_MAPS[r.levelId].name,-525,326,20,'#07385E',this.ui.root,116,32);
    this.lifeLabel=this.ui.text(`守护 ${this.battle?.coreHealth??r.coreHealth}/20`,-358,326,21,'#07385E',this.ui.root,120,32);
    this.ui.text(`第 ${r.wave+(active?1:0)}${endless?'':`/${r.waveLimit??BATTLE_MAPS[r.levelId].waves}`} 波`,-197,326,21,'#07385E',this.ui.root,112,32);
    this.timeLabel=this.ui.text(this.time(r.combatSeconds+(this.battle?.elapsed??0)),-58,326,21,'#07385E',this.ui.root,65,32);
    for(const node of this.ui.root.children.slice(hudStart)){const label=node.getComponent(Label);if(label)label.isBold=true;}
    this.ui.pinBattleFrom?.(hudStart,1,0,0,'top',-1);
    const controlsStart=this.ui.root.children.length;
    this.button(`${r.speed??1}X`,44,326,70,42,()=>this.act(()=>this.service.setBattleSpeed(this.command('speed'),r.speed===2?1:2)),{size:22,surface:'hud'});
    this.button('暂停',142,326,96,42,()=>this.showPause(),{size:22,surface:'hud'});
    this.ui.pinBattleFrom?.(controlsStart,1,0,0,'top',-1);

    if(!units.some(u=>u.id===this.selected))this.selected=units.find(u=>u.slot!==null)?.id??units[0]?.id??'';
    const selected=units.find(u=>u.id===this.selected);
    if(!active){
      const threat=waveTactic(r.levelId,r.wave+1);
      const lane=BATTLE_MAPS[r.levelId].routes?(r.wave===0?'北岸先至':'两路来袭'):'沿湾来袭';

      if(selected?.slot!==null&&selected)this.world.showRange(selected.slot,petRange(selected.turtle)*(['leaf','stone'].includes(selected.turtle.role)?1:.9)+(selected.turtle.skills.includes('reach')?.3:0),selected.turtle.role==='leaf',selected.placement);
    }
    if(active){this.skillBar();return;}
    const rosterStart=this.ui.root.children.length;
    this.ui.panel(0,-178,1130,86,this.ui.root,'#F5FCFC',246,16);
    for(let slot=0;slot<5;slot++){
      const u=units.filter(u=>u.slot!==null).sort((a,b)=>a.slot!-b.slot!)[slot],n=this.button('',-365+135*slot,-178,124,70,()=>{if(u){this.selected=u.id;this.unitDetails(u.id,()=>this.render());}else if(!active)this.formation();},{surface:'hud',selected:u?.id===this.selected,disabled:!u&&active});
      n.name='出战伙伴:'+slot;if(u)this.dropTargets.set(u.slot!,n);
      if(u){this.ui.pet(u.turtle,-35,0,54,n);this.ui.text(this.shortName(this.petName(u.turtle),3),23,11,17,'#07385E',n,70,24);this.ui.text(String(u.slot!+1),45,29,12,'#6E93A0',n,20,16);}
      else this.ui.text('空位',0,0,18,'#7F9CA1',n,110,30);
      if(u)this.attachBenchDrag(n,u.id);
    }
    this.button(r.wave===0?'守住海岛':'开始下一波',456,-178,240,70,()=>{this.rosterOpen=false;this.startWave()},{primary:true,size:26,surface:'hud',disabled:!units.some(u=>u.slot!==null)});
    if(endless){
      this.ui.text(`本局金币 ${r.goldEarned} · 随机奖励 ${r.rewardNodes?.filter(n=>n.chosen!==undefined).length??0} 份`,-152,36,28,UI_COLORS.gold,this.ui.root,880,44);
    }
    // Keep the pearl bench rail behind the action buttons so the left utility
    // buttons remain fully readable, matching the reference prep layout.
    this.ui.panel(0,-291,1060,88,this.ui.root,'#F5FCFC',246,16);
    if(!endless)this.button('战备/合成',-535,-291,104,72,()=>this.fusion(),{surface:'hud',disabled:units.filter(u=>u.benchSlot!==undefined).length<2,size:18});
    if(!active){const threat=waveTactic(r.levelId,r.wave+1);this.button('当前出战',-535,-178,104,70,()=>{const p=this.ui.sheet('当前出战 · '+threat.name,threat.tip,()=>p.parent?.destroy());this.ui.text('根据敌人的速度和抗性，选择站位与出战伙伴。',0,30,25,UI_COLORS.ink,p,800,90,true);},{surface:'hud',size:19});}
    if(endless&&!units.some(u=>u.benchSlot!==undefined)){if(this.ui.pinBattleFrom)this.ui.pinBattleFrom(rosterStart,1,0,0,'bottom');else this.ui.compactFrom(rosterStart,1,0,0);return;}
    const refreshKey=`${r.id}:${r.wave}`,animate=refreshKey!==this.lastBenchRefresh;this.lastBenchRefresh=refreshKey;
    for(let slot=0;slot<5;slot++){
      const u=units.find(u=>u.benchSlot===slot);if(endless&&!u)continue;const x=-365+150*slot,q=u?turtleQuality(u.turtle):undefined;
      const n=this.button('',x,-291,138,74,()=>{}, {surface:'hud'});n.name='备战槽:'+slot;this.benchTargets.set(slot,n);
      if(!u){this.ui.text(endless?'空槽':'待补充',0,0,17,'#7F9CA1',n,120,30);continue;}
      this.ui.pet(u.turtle,-43,0,52,n);
      this.ui.text(this.shortName(this.runStatus(u)??`${q!.name}·${u.turtle.skills.length}技能`,7),20,12,14,'#07385E',n,72,20);
      this.attachBenchDrag(n,u.id);
      if(!endless)this.button(u.benchLocked?'已锁':'锁定',32,-17,70,28,()=>this.act(()=>this.service.lockBench(this.command('benchLock'),u.id,!u.benchLocked)),{parent:n,surface:'hud',selected:u.benchLocked,size:14});
      if(animate&&!u.benchLocked&&!active)tween(n).to(.06,{angle:5}).to(.08,{angle:-4}).to(.1,{angle:3}).to(.12,{angle:0}).start();
    }
    if(this.ui.pinBattleFrom)this.ui.pinBattleFrom(rosterStart,1,0,0,'bottom');else this.ui.compactFrom(rosterStart,1,0,0);
  }
  private skillBar():void{
    const b=this.battle;if(!b)return;
    if(this.ui.art?.ready){
      const dockStart=this.ui.root.children.length;
      this.ui.panel(3,-280,1075,118,this.ui.root,'#F5FCFC',246,18);this.hudHealth=[];
      const roster=[...b.units].sort((a,b)=>a.slot-b.slot);
      for(let i=0;i<5;i++){
        const u=roster[i],x=-469+i*103;
        const n=this.button('',x,-279,82,94,()=>{if(u){this.selected=u.id;this.render();}},{surface:'bare',disabled:!u});
        n.name='战斗伙伴头像:'+i;
        if(!u){this.ui.text('空位',0,-8,20,UI_COLORS.muted,n,96,30);continue;}
        const owned=this.units.find(v=>v.id===u.id);if(!owned)continue;
        const tint=['#28A750','#20ACF0','#A8782D','#EF6432','#9458DC'][i];
        this.ui.panel(0,0,82,94,n,'#F8FCF7',255,6);
        const border=this.ui.group('伙伴卡边框',0,0,n).addComponent(Graphics);border.strokeColor=color(tint);border.lineWidth=1;border.roundRect(-41,-47,82,94,6);border.stroke();
        this.dropTargets.set(u.slot,n);this.ui.battlePortrait(owned.turtle,n);
        this.ui.text(this.shortName(this.petName(owned.turtle),4),0,-23,13,'#07385E',n,78,20).isBold=true;
        const badge=this.ui.group('职业徽章',-31,39,n,26,26),bg=badge.addComponent(Graphics);bg.fillColor=color(tint);bg.circle(0,0,13);bg.fill();bg.strokeColor=color('#FFFFFF');bg.lineWidth=1;bg.circle(0,0,13);bg.stroke();this.ui.hudSymbol(4+i,0,0,24,badge);
        const bar=this.ui.group('实时生命条',0,-37,n,72,9).addComponent(Graphics);
        const hpText=this.ui.text('',0,-51,11,'#07385E',n,90,16);hpText.isBold=true;this.hudHealth.push({id:u.id,bar,label:hpText});
        this.attachBenchDrag(n,u.id);
      }
      this.ui.line(12,-326,12,-236,this.ui.root,'#82B8C2');
      const epoch=this.pageEpoch;
      this.sharedSkills=new ActiveSkillControls(this.ui,this.camera,this.service,this.command,action=>action(this.battle!),value=>{if(value)this.setMoving(false);this.setPauseState(this.paused,value);},()=>this.render(),()=>!this.destroyed&&!this.hidden&&!this.paused&&this.pageEpoch===epoch);
      this.sharedSkills.render(roster,'battleDock');
      this.ui.pinBattleFrom?.(dockStart,1,0,0,'bottom');this.updateSkillBar();return;
    }
    const skillStart=this.ui.root.children.length;
    this.ui.panel(266,-267,700,166,this.ui.root,UI_COLORS.dark,245,20);
    for(let slot=0;slot<5;slot++){
      const u=[...b.units].sort((a,b)=>a.slot-b.slot)[slot],skill=u?.skills.find(id=>SKILL_BY_ID[id].active),x=10+slot*112;
      const n=this.button('',x,-274,104,108,()=>{if(u&&skill)this.selectActiveSkill(u.id,skill);},{size:24,disabled:!u});
      n.name='主动技能栏:'+slot;
      if(u&&this.ui.art?.ready){const icon=this.ui.group('主动技能图标',0,10,n,76,76);this.ui.art.attach(icon,`skill-${u.role}`,76,76);}else if(u)this.ui.portrait(u.role,-22,18,54,n);
      this.ui.text(String(slot+1),29,32,22,UI_COLORS.sand,n,26,30);
      const mask=this.ui.group('技能冷却遮罩',0,0,n,104,108).addComponent(Graphics);
      const label=this.ui.text(skill?SKILL_BY_ID[skill].name:u?'未学主动':'空位',0,-27,18,UI_COLORS.cream,n,94,26);
      if(u){
        this.skillButtons.push({unitId:u.id,skill,label,mask});
        const held=this.service.settingsSnapshot.manualSkillTurtles?.includes(u.turtleId)??false;
        this.button(held?'手动保留':'跟随自动',x,-205,104,30,()=>{
          const ids=new Set(this.service.settingsSnapshot.manualSkillTurtles??[]);if(ids.has(u.turtleId))ids.delete(u.turtleId);else ids.add(u.turtleId);
          const value=Array.from(ids);this.service.updateSettings(this.command('holdSkill'),{manualSkillTurtles:value});b.manualSkillTurtles=value;this.render();
        },{selected:held,size:16,disabled:!skill});
      }
    }
    this.autoSkillToggle(564,-274,88,108);
    if(this.ui.pinBattleFrom)this.ui.pinBattleFrom(skillStart,.72,188,-103,'bottom',1);else this.ui.compactFrom(skillStart,.72,188,-103);
    this.updateSkillBar();
  }
  private autoSkillToggle(x:number,y:number,w:number,h:number):void{
    const b=this.battle;if(!b)return;const auto=this.service.settingsSnapshot.autoSkills??false;
    const toggle=this.button(`一键释放\n${auto?'已开启':'已关闭'}`,x,y,w,h,()=>{
      const next=!(this.service.settingsSnapshot.autoSkills??false);this.service.updateSettings(this.command('autoSkills'),{autoSkills:next});b.autoSkills=next;
      this.render();
    },{primary:auto,selected:auto,size:w<110?17:20});toggle.name='一键释放开关';
  }
  private updateSkillBar():void{
    for(const item of this.hudHealth){if(!isValid(item.bar,true)||!isValid(item.label,true))continue;const u=this.battle?.units.find(v=>v.id===item.id);if(!u)continue;
      const g=item.bar,p=Math.max(0,Math.min(1,u.hp/u.maxHp));g.clear();g.fillColor=color('#4D7E9A');g.roundRect(-36,-4.5,72,9,3);g.fill();
      if(p>0){g.fillColor=color('#49D874');g.roundRect(-35,-3.5,Math.max(2,70*p),7,2);g.fill();g.fillColor=color('#9DF6A4',160);g.rect(-34,1,Math.max(0,68*p),2);g.fill();}
      item.label.string=`${Math.ceil(Math.max(0,u.hp))}/${Math.ceil(u.maxHp)}`;
    }
    if(this.sharedSkills){this.sharedSkills.update();return;}
    const b=this.battle;if(!b)return;
    for(const item of this.skillButtons){
      const u=b.units.find(x=>x.id===item.unitId),s=item.skill,g=item.mask;g.clear();if(!u||!s)continue;
      const remaining=Math.max(0,((u.cooldowns[s]??0)-b.tick)*.05),ready=canCommandBattle(b,{type:'cast',unitId:u.id,skillId:s});
      item.label.string=!u.alive?'已倒下':remaining>0?`${remaining.toFixed(1)}秒`:SKILL_BY_ID[s].name;
      item.label.color=color(ready?UI_COLORS.gold:UI_COLORS.sand);
      if(remaining>0){g.fillColor=color('#0B1E2B',180);g.rect(-51,54-106*Math.min(1,remaining/SKILL_BY_ID[s].cooldown!),102,106*Math.min(1,remaining/SKILL_BY_ID[s].cooldown!));g.fill();}
      if(ready){g.strokeColor=color('#75DCDD');g.lineWidth=2;g.roundRect(-50,-52,100,104,16);g.stroke();}
    }
  }
  private selectActiveSkill(unitId:string,skillId:SkillId):void{
    const b=this.battle,u=b?.units.find(x=>x.id===unitId);if(!b||!u)return;if(!canCommandBattle(b,{type:'cast',unitId,skillId,...(skillId==='bubbleRing'?{point:{x:u.x,z:u.z}}:{})})){this.ui.toast(!u.alive?'伙伴已倒下':(u.cooldowns[skillId]??0)>b.tick?'技能正在冷却':'当前没有合法目标');return;}
    const mode=skillTargetMode(skillId);
    // Existing self guard and full-team heal have no target step.
    if(mode==='self'||mode==='team'){commandBattle(b,{type:'cast',unitId,skillId});this.updateSkillBar();return;}
    this.setPauseState(false,true);this.world.showRange(u.slot,u.range,false,u);
    const overlay=this.ui.group('技能目标选择',0,0,this.ui.root,1280,720);
    overlay.on(Node.EventType.TOUCH_START,(e:EventTouch)=>e.propagationStopped=true);
    if(mode==='area')overlay.on(Node.EventType.TOUCH_END,(e:EventTouch)=>{
      if(e.target!==overlay)return;const screen=e.getLocation(),ray=this.camera.screenPointToRay(screen.x,screen.y);if(Math.abs(ray.d.y)<.001)return;
      const t=(.15-ray.o.y)/ray.d.y,point={x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t};
      if(commandBattle(b,{type:'cast',unitId,skillId,point}))this.render();else this.ui.toast('请点射程内的合法区域');
    });
    this.ui.panel(0,216,900,64,overlay);
    this.ui.text(`${SKILL_BY_ID[skillId].name} · ${mode==='area'?'点击射程内区域':'选择高亮敌人'} · 战斗暂停`,0,216,27,UI_COLORS.cream,overlay,864,48);
    const drawRing=(x:number,z:number,radius:number,parent:Node)=>{
      const g=this.ui.group('实际技能作用范围',0,0,parent).addComponent(Graphics);g.strokeColor=color('#73F0EB');g.fillColor=color('#53D9D0',36);g.lineWidth=3;
      for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,p=this.screenPoint(this.camera.worldToScreen(new Vec3(x+Math.cos(a)*radius,.2,z+Math.sin(a)*radius)));if(!p)continue;if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.close();g.fill();g.stroke();
    };
    for(const target of legalSkillTargets(b,u,skillId)){
      const p=this.screenPoint(this.camera.worldToScreen(new Vec3(target.x,1,target.z)));if(!p)continue;
      if(mode==='area')drawRing(target.x,target.z,1.5,overlay);
      const n=this.button('选定',p.x,p.y,88,72,()=>{
        const command={type:'cast' as const,unitId,skillId,...(mode==='area'?{point:{x:target.x,z:target.z}}:{targetId:target.id})};
        commandBattle(b,command);this.render();
      },{parent:overlay,selected:true,size:22});n.name='合法技能目标:'+target.id;
    }
    this.button('取消选择',0,-282,272,88,()=>this.render(),{parent:overlay,size:28});
  }
  private prototypeSkillButton(selected:RunTurtle|undefined,x:number,y:number,w:number,h:number):void{
    const skill=selected?.turtle.skills.find(id=>SKILL_BY_ID[id].active),unit=this.battle?.units.find(u=>u.id===selected?.id);
    const action=this.button('',x,y,w,h,()=>{if(skill&&unit&&this.battle)commandBattle(this.battle,{type:'cast',unitId:unit.id,skillId:skill});},{primary:!!skill&&!!unit?.alive,disabled:!skill||!unit?.alive});action.name='战斗技能';
    const remaining=skill?Math.max(0,Math.ceil(((unit?.cooldowns[skill]??0)-(this.battle?.tick??0))*.05)):0;
    this.skillLabel=this.ui.text(skill?`${SKILL_BY_ID[skill].name}\n${unit?.alive?(remaining?`${remaining}s 后可用`:'点击释放'):'正在休整'}`:'自动攻击',0,0,30,skill&&unit?.alive?UI_COLORS.ink:UI_COLORS.cream,action,w-22,h-22,true);
    if(skill&&unit)this.activeSkill={unitId:unit.id,id:skill};
  }
  private screenPoint(point:{x:number;y:number}):Vec3|undefined{
    let canvas:Canvas|null=null;for(let n:Node|null=this.ui.root;n&&!canvas;n=n.parent)canvas=n.getComponent(Canvas);
    const camera=canvas?.cameraComponent,transform=this.ui.root.getComponent(UITransform);if(!camera||!transform)return;
    return transform.convertToNodeSpaceAR(camera.screenToWorld(new Vec3(point.x,point.y,0)));
  }
  private groundPoint(p:{x:number;y:number}):Point|undefined{
    const ray=this.camera.screenPointToRay(p.x,p.y);if(Math.abs(ray.d.y)<.001)return;
    const t=(.045-ray.o.y)/ray.d.y;if(t<0)return;return normalizedPoint({x:ray.o.x+ray.d.x*t,z:ray.o.z+ray.d.z*t});
  }
  private landingIssue(id:string,p:Point):string|undefined{
    const feet=this.screenPoint(this.camera.worldToScreen(new Vec3(p.x,0,p.z))),head=this.screenPoint(this.camera.worldToScreen(new Vec3(p.x,1.65,p.z)));
    const hud=feet&&head?this.ui.battleLandingIssue(feet,head):undefined;if(hud)return hud;
    const m=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId],u=this.units.find(v=>v.id===id);
    const actor=this.battle?.units.find(v=>v.id===id);
    if(actor&&!actor.alive)return '伙伴已倒下，请换上一只可战斗的龟';
    if(actor&&this.battle!.tick<(actor.moveReadyTick??0))return '调位尚在冷却，请稍等';
    if(this.battle?.storms?.some(v=>v.ownerId===id&&v.kind==='rock'&&v.untilTick>this.battle!.tick))return '岩石风暴结束后才能调位';
    const occupied=this.units.find(v=>v.id!==id&&v.slot!==null&&Math.hypot((v.placement??m.slots[v.slot]).x-p.x,(v.placement??m.slots[v.slot]).z-p.z)<.78);if(occupied&&u?.slot!==null){
      const target=this.battle?.units.find(v=>v.id===occupied.id);
      if(target&&!target.alive)return '倒下的伙伴不能互换';
      if(target&&this.battle!.tick<(target.moveReadyTick??0))return '对方调位尚在冷却，请稍等';
      if(this.battle?.storms?.some(v=>v.ownerId===occupied.id&&v.kind==='rock'&&v.untilTick>this.battle!.tick))return '对方岩石风暴结束后才能互换';
    }
    if(!occupied&&u?.slot===null&&this.units.filter(v=>v.slot!==null).length>=5)return '已上阵五只，请拖到要替换的伙伴';
    return exchangePlacementIssue(m,p,u&&u.slot!==null?(u.placement??m.slots[u.slot]):undefined,this.units.filter(v=>v.id!==id&&v.slot!==null).map(v=>v.placement??m.slots[v.slot!]));
  }
  private worldDragTargets():void{
    const map=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId];
    const surface=this.ui.group('自由布阵地图',0,0,this.ui.root,1280,720);
    const ink=surface.addComponent(Graphics);ink.fillColor=color('#FFFFFF',1);ink.rect(-640,-360,1280,720);ink.fill();
    for(const u of this.units.filter(u=>u.slot!==null)){
      const at=this.battle?.units.find(a=>a.id===u.id)??u.placement??map.slots[u.slot!],p=this.screenPoint(this.camera.worldToScreen(new Vec3(at.x,.7,at.z)));if(!p)continue;
      const n=this.ui.group('战场拖动:'+u.id,p.x,p.y,this.ui.root,90,94);this.attachBenchDrag(n,u.id,true);this.worldHits.set(u.id,n);
    }
  }
  private attachBenchDrag(node:Node,id:string,worldTarget=false):void{
    const epoch=this.pageEpoch,current=()=>!this.destroyed&&!this.hidden&&this.pageEpoch===epoch&&this.ui.isInteractive(node);
    let start:{x:number;y:number}|undefined,dragged=false,longPress=false,pressTimer:ReturnType<typeof setTimeout>|undefined,ghost:Node|undefined,dragHint:Label|undefined;
    const local=(event:EventTouch):Vec3|undefined=>this.screenPoint(event.getLocation());
    const radius=(u:RunTurtle)=>this.battle?.units.find(a=>a.id===u.id)?.range??petRange(u.turtle)*(BATTLE_MAPS[this.run.levelId].layoutVersion===2&&u.turtle.role!=='stone'&&u.turtle.role!=='leaf'?.9:1)+(u.turtle.skills.includes('reach')?.3:0);
    const landing=(active:boolean,nearest:number|null=null)=>{
      const source=this.units.find(u=>u.id===id),full=source?.slot===null&&this.units.filter(u=>u.slot!==null).length>=5;
      for(const marker of this.ui.root.children.filter(n=>n.name.startsWith('地图候选站位:'))){
        const index=Number(marker.name.split(':')[1]),occupied=this.units.some(u=>u.slot===index),legal=!full||occupied,g=marker.getComponent(Graphics);if(!g)continue;
        const picked=active&&nearest===index&&legal;g.clear();g.lineWidth=picked?3:2;
        g.strokeColor=color(active&&legal?'#34CF89':'#82B9A2',active?(legal?230:35):occupied?65:145);
        g.fillColor=color('#79E9A9',active&&legal?(picked?140:65):occupied?8:42);
        g.ellipse(0,0,picked?29:26,picked?16:14);g.fill();g.stroke();
      }
    };
    const clear=()=>{if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}if(start||dragged)this.setMoving(false);ghost?.destroy();ghost=undefined;dragHint=undefined;start=undefined;dragged=false;longPress=false;this.world.showRange(null);landing(false);};
    node.off(Node.EventType.TOUCH_START);node.off(Node.EventType.TOUCH_END);node.off(Node.EventType.TOUCH_CANCEL);
    node.on(Node.EventType.TOUCH_START,(event:EventTouch)=>{if(!current()||this.modal||this.paused)return;const p=local(event);if(!p)return;start={x:p.x,y:p.y};dragged=false;longPress=false;this.selected=id;pressTimer=setTimeout(()=>{pressTimer=undefined;if(!start||!current())return;longPress=true;this.setMoving(true);const u=this.units.find(u=>u.id===id);if(u?.slot!==null&&u)this.world.showRange(u.slot,radius(u),u.turtle.role==='leaf',u.placement);},280);});
    node.on(Node.EventType.TOUCH_MOVE,(event:EventTouch)=>{
      if(!current()||!start)return;const p=local(event);if(!p)return;
      if(Math.hypot(p.x-start.x,p.y-start.y)>8){dragged=true;if(!longPress){if(pressTimer!==undefined){clearTimeout(pressTimer);pressTimer=undefined;}longPress=true;this.setMoving(true);}}
      if(!longPress)return;
      if(dragged){
        const u=this.units.find(u=>u.id===id);if(!u)return;
        if(!ghost){ghost=this.ui.group('正在拖动的伙伴',p.x,p.y,this.ui.root,108,108);this.ui.battleFigure(u.turtle.role,0,0,130,ghost);const hint=this.ui.panel(0,79,220,36,ghost);dragHint=this.ui.text('',0,0,19,UI_COLORS.ink,hint,210,30);}
        ghost.setPosition(p.x,p.y,0);const at=this.groundPoint(event.getLocation()),issue=at?this.landingIssue(id,at):'请拖到地图上';
        this.world.showRange(null,radius(u),u.turtle.role==='leaf',at);this.world.tintRange(!issue);
        if(dragHint){const m=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId],occupied=at&&this.units.some(v=>v.id!==id&&v.slot!==null&&Math.hypot((v.placement??m.slots[v.slot]).x-at.x,(v.placement??m.slots[v.slot]).z-at.z)<.78);dragHint.string=issue??(occupied?(u.slot===null?'松手替换出战伙伴':'松手互换位置'):'松手放置 · 波间自由 / 战中转移');}
      }
    });
    const finish=(event:EventTouch)=>{
      if(!current()||!start){clear();return;}
      if(!dragged){clear();this.selected=id;this.ui.click();if(worldTarget){this.render();this.ui.toast('长按伙伴并拖到合法陆地，不支持点击落点');}else this.unitDetails(id,()=>this.render());return;}
      const point=event.getLocation();let slot:number|undefined;
      for(const [index,target] of this.benchTargets)if(target.getComponent(UITransform)?.hitTest(point)){
        clear();const source=this.units.find(u=>u.id===id),other=this.units.find(u=>u.benchSlot===index);
        if(!source)return;
        if(source.slot!==null)this.act(()=>{this.service.moveUnit(this.command('bench'),id,null,this.battle,index);this.battle=this.run.battle;this.selected=id;});
        else if(other&&other.id!==id&&this.run.mode==='chapter')this.confirmBenchFusion(id,other.id);
        return;
      }
      for(const [index,target] of this.dropTargets)if(target.getComponent(UITransform)?.hitTest(point)){slot=index;break;}
      const source=this.units.find(u=>u.id===id);
      // Broad character hit boxes start a drag, but never steal a nearby free-ground drop.
      if(slot===undefined){const p=this.groundPoint(point),map=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId];if(p)for(const other of this.units.filter(u=>u.id!==id&&u.slot!==null)){const q=other.placement??map.slots[other.slot!];if(Math.hypot(q.x-p.x,q.z-p.z)<.78){slot=other.slot!;break;}}}
      const at=slot===undefined?this.groundPoint(point):undefined;clear();
      if(slot!==undefined){const map=this.battle?battleMap(this.battle):BATTLE_MAPS[this.run.levelId],target=this.units.find(u=>u.slot===slot),at=target?.placement??map.slots[slot],issue=this.landingIssue(id,at);if(issue){this.ui.toast(issue);return;}this.act(()=>{this.service.moveUnit(this.command('move'),id,slot!,this.battle);this.battle=this.run.battle;this.selected=id;});}
      else if(at){const issue=this.landingIssue(id,at);if(issue){this.ui.toast(issue);return;}this.act(()=>{this.service.placeUnit(this.command('place'),id,at,this.battle);this.battle=this.run.battle;this.selected=id;});}
      else this.ui.toast('请放到陆地空处或备战槽');
    };
    node.on(Node.EventType.TOUCH_END,finish);
    node.on(Node.EventType.TOUCH_CANCEL,(event:EventTouch)=>{if(event.getEventCode()===Node.EventType.TOUCH_END&&dragged)finish(event);else clear();});
    node.once(Node.EventType.NODE_DESTROYED,clear);
  }
  private runStatus(u:RunTurtle):string|undefined{const actor=this.battle?.units.concat(this.battle.benchUnits??[]).find(a=>a.id===u.id),sleep=actor?.sleepUntilWave??u.sleepUntilWave;if(sleep&&sleep>this.run.wave+1)return `第${sleep}波苏醒`;if(actor?!actor.alive:u.fallen&&sleep===undefined)return '本局已倒下';return undefined;}
  private prototypeDetails(id:string,back:()=>void):void{
    const u=this.units.find(u=>u.id===id);if(!u){back();return;}this.selected=id;const t=u.turtle,q=turtleQuality(t);
    const p=this.sheet(this.petName(t),`${ROLES[t.role].job} · ${t.skills.length} 技能 · ${q.name}（综合参考）`,back);
    this.ui.pet(t,-422,40,224,p);this.ui.text(u.benchSlot===undefined?'正在战场驻守':`备战 ${u.benchSlot+1}${u.benchLocked?' · 已锁定':''}`,-422,-100,28,UI_COLORS.sand,p,302,42);
    this.ui.text(`综合 ${q.score.toFixed(1)} 分 · Lv.${u.level}`,-422,-152,26,q.color,p,302,40);
    this.ui.text(`攻击 ${t.innate.attack+t.training.attack} · 生命 ${t.innate.health+t.training.health} · 防御 ${t.innate.defense+t.training.defense} · 成长 ${((t.innate.growth+t.training.growth)/100).toFixed(2)}`,0,178,28,UI_COLORS.sand,p,1080,40);
    t.skills.forEach((skill,i)=>this.skillCard(skill,-136+(i%4)*204,104-Math.floor(i/4)*104,180,p,()=>this.prototypeDetails(id,back)));
    if(u.benchSlot!==undefined&&this.run.phase!=='result'){
      this.button(u.benchLocked?'解除刷新锁':'锁定到下波',-348,-276,400,88,()=>{try{this.service.lockBench(this.command('benchLock'),id,!u.benchLocked);this.prototypeDetails(id,back);}catch(error){this.onError(error);}},{parent:p});
      this.button('返回后拖动上场',212,-276,664,88,()=>this.render(),{parent:p,primary:true});
    }else this.button('返回',0,-276,400,88,back,{parent:p,primary:true});
  }
  private prototypeReveal():void{
    const r=this.run,event=r.merges[r.pendingMergeId!],u=r.units[event.outputId],t=u.turtle,q=turtleQuality(t);
    const p=this.sheet('泡泡里藏着新伙伴','两只备战龟已经消耗。新结果已保存，不会重新抽取。');
    this.ui.fusionCard(t,p);
    const epoch=this.pageEpoch;
    new BubbleReveal(this.ui,p,event.id,()=>{
      try{const result=this.service.reveal(`reveal:${event.id}`);this.battle=this.run.battle;this.audio.effect(q.tier===4?'sfx_rare_reveal':'sfx_fusion_complete');this.prototypeDetails(result.id,()=>{this.setPauseState(false,false);this.render();});return true;}
      catch(error){this.onError(error);return false;}
    },()=>!this.destroyed&&!this.hidden&&this.pageEpoch===epoch,()=>{this.audio.effect('sfx_bubble_rub',180);this.audio.effect('sfx_bubble_pop',90);});
  }
  private rewardName(g:RewardGrant):string{return g.kind==='gold'?'金币':g.kind==='material'?MATERIAL_NAMES[g.material]:`${(g.kind==='bookPack'?PACK_NAMES[g.grade]:SKILL_BY_ID[g.skillId].name)}技能书`;}
  private resourceChoices(node:RewardNode):void{
    const modern=node.format==='stop-and-open',drawing=modern?!!node.drawing:true;
    if(drawing&&node.randomIndex===undefined){try{this.service.prepareEndlessReward(`rewardDraw:${this.run.id}:${node.wave}:${node.opened?.length??0}`,node.wave);node=this.run.rewardNodes!.find(n=>n.wave===node.wave)!;}catch(error){this.onError(error);return;}}
    const p=this.sheet('海湾宝藏',`第 ${node.wave} 波 · ${drawing?'光框跳动中，确认后领取随机一份':'已领取的奖励会在结束挑战后带回'}`),epoch=this.pageEpoch;
    const cards=node.choices.map((g,i)=>{
      const claimed=node.opened?.includes(i)??node.chosen===i,n=this.ui.panel(-432+i*216,24,200,196,p,claimed?'#536766':UI_COLORS.dark);n.name='随机奖励卡:'+i;
      this.ui.icon(g.kind==='gold'?'gold':(g.kind==='book'||g.kind==='bookPack')?'growth-history':g.material==='attack'?'attack-medicine':g.material==='health'?'health-medicine':g.material==='defense'?'defense-medicine':'growth-medicine',0,48,48,n);
      this.ui.text(this.rewardName(g),0,-7,26,g.kind==='book'?UI_COLORS.gold:UI_COLORS.cream,n,182,68,true);
      this.ui.text(claimed?`已领 ×${g.amount}`:`× ${g.amount}`,0,-66,28,claimed?UI_COLORS.sand:UI_COLORS.gold,n,184,40);return n;
    });
    const hint=this.ui.text(drawing?'每个未开出的奖励被选中的机会相同':'可用金币继续开；也可以保留已得奖励并离开',0,-128,28,UI_COLORS.sand,p,1100,48);
    if(!drawing){
      this.ui.text(`持有金币 ${this.service.snapshot.gold} · 本组已花 ${node.spentGold??0} 金币`,0,-188,28,UI_COLORS.gold,p,1080,42);
      if(node.closed){this.button('继续挑战',0,-276,528,88,()=>{this.setPauseState(false,false);this.render();},{parent:p,primary:true});return;}
      const next=goldAmount(this.service.snapshot,rewardPrice(node)),all=goldAmount(this.service.snapshot,rewardPrice(node,true)),gold=this.service.snapshot.gold;
      this.button(`再开一个 ${next}金`,-376,-276,352,88,()=>this.act(()=>this.service.buyEndlessReward(this.command('rewardBuy'),node.wave)),{parent:p,disabled:gold<next,primary:true,size:28});
      this.button(`全开 ${all}金·省10%`,0,-276,352,88,()=>this.act(()=>this.service.buyEndlessReward(this.command('rewardAll'),node.wave,true)),{parent:p,disabled:gold<all,size:28});
      this.button('放弃其余奖励',376,-276,352,88,()=>this.act(()=>this.service.closeEndlessReward(this.command('rewardClose'),node.wave)),{parent:p,size:28});return;
    }
    const frame=this.ui.group('开奖光框',0,0,p),g=frame.addComponent(Graphics);g.strokeColor=color(UI_COLORS.gold);g.lineWidth=7;g.roundRect(-101,-101,202,202,22);g.stroke();
    const available=remainingRewardIndices(node);let elapsed=0,step=-1,finished=false;
    const finish=()=>{
      if(finished||this.destroyed||this.hidden||epoch!==this.pageEpoch)return;
      try{
        const grant=this.service.chooseEndlessReward(`reward:${this.run.id}:${node.wave}:${node.opened?.length??0}`,node.wave);finished=true;this.rewardFrame=undefined;
        frame.setPosition(-432+node.randomIndex!*216,24,0);hint.string=`获得 ${this.rewardName(grant)} ×${grant.amount}`;this.audio.effect('sfx_collect');
        const updated=this.run.rewardNodes!.find(n=>n.wave===node.wave)!;
        this.resourceChoices(modern?updated:{...updated,format:'stop-and-open',opened:[updated.chosen!],closed:true,drawing:false,spentGold:0});
      }catch(error){hint.string='保存未完成，请重试确认开奖。';this.onError(error);}
    };
    this.button('确认开奖',0,-276,528,88,finish,{parent:p,primary:true});
    this.rewardFrame=(dt:number)=>{if(epoch!==this.pageEpoch)return;elapsed+=Math.max(0,Math.min(dt,.25));const next=Math.floor(elapsed/.12);if(next!==step){step=next;this.audio.effect('sfx_draw_tick',110,.8);const n=available.length,cycle=Math.max(1,n*2-2),at=next%cycle,index=available[at<n?at:cycle-at];frame.setPosition(-432+index*216,24,0);}};
  }
  private prototypeResult():void{
    const s=this.service.snapshot,r=this.run,result=s.results[r.id],endless=r.mode==='endless',pending=pendingTakeaways(s).length;
    if(this.ui.art?.ready){
      this.pageEpoch++;this.ui.clear();
      const p=this.ui.dialog(result.victory?'守护成功':endless?'挑战完成':'整装再出发',`${BATTLE_MAPS[r.levelId].name} · ${result.waves} 波 · ${this.time(result.combatSeconds)}`,undefined,1040,580);
      const rewards=this.ui.panel(0,48,924,212,p,'#E7F2EB',255,18);
      this.ui.icon('gold',-360,44,62,rewards);this.ui.text((result.baseGold+result.firstClearGold+(result.doubled?result.baseGold:0)).toLocaleString(),-160,44,42,UI_COLORS.ink,rewards,310,60);
      this.ui.text('本局金币',-214,-15,21,UI_COLORS.sand,rewards,200,32);
      const materials=Object.entries(result.materials??{}).map(([key,n])=>`${MATERIAL_NAMES[key as TrainingMaterial]} ×${n}`).join('  ');
      this.ui.text(materials||'继续挑战可获得更多培养材料',218,45,23,UI_COLORS.ink,rewards,380,90,true);
      this.ui.text(`新伙伴 ${result.broughtIds?.length??0} · 技能 ${Object.values(result.skillBooks??{}).reduce((n,v)=>n+(v??0),0)}`,218,-30,22,UI_COLORS.sand,rewards,380,38);
      [['伙伴资料',()=>this.team()],['战斗表现',()=>this.contributionDetails()],['全部奖励',()=>this.rewardDetails()]].forEach(([name,action],i)=>this.button(String(name),-308+i*308,-110,288,54,action as ()=>void,{parent:p,size:25}));
      this.ui.text(pending?`${pending} 位伙伴等待整理，回海岛后收录。`:'奖励已保存；培养伙伴后再来挑战。',-112,-170,21,UI_COLORS.sand,p,695,36);
      if(this.ui.share&&!s.solo)this.button('分享战绩',350,-169,212,40,()=>this.ui.share?.('海岛战绩 · '+BATTLE_MAPS[r.levelId].name,`完成 ${result.waves} 波，守护 ${r.coreHealth}/20，一起来挑战！`),{parent:p,size:21});
      if(result.chestId){const id=result.chestId,claimed=s.progression?.chests.find(c=>c.id===id)?.claimed;this.button(claimed?'层数宝箱已领取':'打开 '+result.waves+' 层宝箱',-199,-230,504,54,()=>this.act(()=>this.service.claimChest(this.command('endlessChest'),id)),{parent:p,primary:true,size:25,disabled:!!claimed});}else if(!s.solo)this.button('自愿看广告 · 基础金币翻倍',-199,-230,504,54,()=>this.ui.requestReward?.('doubleGold',r.id,()=>this.render()),{parent:p,size:23,disabled:result.doubled||result.baseGold<=0});
      if(s.solo)this.ui.text(endless?'本档最高 '+(s.solo.best[(r.expedition?.difficulty??1)-1]??0)+' 波':'成就进度已同步',-205,-230,23,UI_COLORS.sand,p,440,40);
      this.button('回到海岛',302,-230,308,54,()=>this.onHome(),{parent:p,primary:true,size:27});return;
    }
    const p=this.sheet(result.victory?'伙伴们回家啦！':endless?'这次闯到了这里':'休息一下，再来挑战',`${endless?'无尽海湾':BATTLE_MAPS[r.levelId].name} · 完成 ${result.waves} 波 · 战斗 ${this.time(result.combatSeconds)}`);
    this.ui.text(`金币 +${result.baseGold+result.firstClearGold+(result.doubled?result.baseGold:0)}`,0,132,46,UI_COLORS.gold,p,1080,72);
    const materials=Object.entries(result.materials??{}).map(([key,count])=>`${MATERIAL_NAMES[key as TrainingMaterial]}×${count}`).join('　');
    this.ui.text(materials||'本局没有额外培养食材',0,62,28,UI_COLORS.sand,p,1080,70,true);
    const books=Object.values(result.skillBooks??{}).reduce((sum,n)=>sum+(n??0),0);
    this.ui.text(endless?`技能书 ${books} 本 · 最好成绩 ${result.bestWave??0} 波`:`已带回 ${result.broughtIds?.length??0} 位新伙伴${pending?` · ${pending} 位待整理`:''}`,0,-14,30,UI_COLORS.cream,p,1080,60,true);
    this.button('伙伴资料',-370,-122,320,88,()=>this.team(),{parent:p});
    this.button('战斗表现',0,-122,320,88,()=>this.contributionDetails(),{parent:p});
    this.button('全部奖励',370,-122,320,88,()=>this.rewardDetails(),{parent:p});
    this.ui.text(pending?'收藏已满，新伙伴仍在行囊中；回海岛整理后决定带走哪些。':endless?'资源已经保存。回去培养伙伴，再来挑战更高波次。':result.victory?'最终有效的新伙伴已进入收藏，原有伙伴不会被复制。':'未参与合成的收藏保留；未通关的新伙伴不能带回。',0,-202,28,UI_COLORS.sand,p,1100,36);
    if(!this.service.snapshot.solo)this.button('自愿看广告 · 基础金币翻倍',-228,-276,584,88,()=>this.ui.requestReward?.('doubleGold',r.id,()=>this.render()),{parent:p,size:30,disabled:result.doubled||result.baseGold<=0});
    this.button('回到海岛',374,-276,352,88,()=>this.onHome(),{parent:p,primary:true,size:32});
  }
  private rewardDetails(page=0):void{
    const result=this.service.snapshot.results[this.run.id],grants:RewardGrant[]=[{kind:'gold',amount:result.baseGold+result.firstClearGold+(result.doubled?result.baseGold:0)}];
    for(const [material,amount] of Object.entries(result.materials??{}))grants.push({kind:'material',material:material as TrainingMaterial,amount:amount!});
    for(const [skillId,amount] of Object.entries(result.skillBooks??{}))grants.push({kind:'book',skillId:skillId as SkillId,amount:amount!});
    const current=this.page(page,grants.length),pages=Math.max(1,Math.ceil(grants.length/6)),p=this.sheet('本局全部奖励','这里展示的是已经带回并保存的实际资源。',()=>this.prototypeResult());
    grants.slice(current*6,current*6+6).forEach((g,i)=>{const n=this.ui.panel(-384+(i%3)*384,104-Math.floor(i/3)*192,360,176,p);this.ui.text(this.rewardName(g),0,34,32,UI_COLORS.cream,n,336,64,true);this.ui.text(`× ${g.amount}`,0,-42,40,UI_COLORS.gold,n,336,60);});
    const packs=(result.stages??[]).flatMap(row=>row.grants.filter(g=>g.kind==='book'&&g.pack).map(g=>`${row.wave}波${g.kind==='book'&&g.pack==='fine'?'精品':'普通'}礼包`));
    this.ui.text(packs.length?`${packs.join('、')}已打开，书计入上方总数。`:'阶段奖励已计入总数，不会重复发放。',0,-202,26,UI_COLORS.sand,p,1100,36);
    this.button('上一页',-300,-276,224,88,()=>this.rewardDetails(current-1),{parent:p,disabled:current===0});this.ui.text(`${current+1}/${pages}`,0,-276,30,UI_COLORS.sand,p,160,40);
    this.button('下一页',300,-276,224,88,()=>this.rewardDetails(current+1),{parent:p,disabled:current===pages-1});
  }
  private contributionDetails(page=0):void{
    const result=this.service.snapshot.results[this.run.id];
    const rows=Object.entries(result.contributions??{}).sort((a,b)=>b[1].damage-a[1].damage),pages=Math.max(1,Math.ceil(rows.length/5));
    page=Math.max(0,Math.min(page,pages-1));
    const p=this.sheet('战斗表现','记录实际伤害、有效治疗与护盾吸收；反伤已计入伤害。',()=>this.prototypeResult());
    [['伙伴',-434],['伤害',-211],['治疗',-15],['护盾',164],['反伤 / 重生',390]].forEach(([name,x])=>this.ui.text(String(name),Number(x),163,25,UI_COLORS.sand,p,200,38));
    rows.slice(page*5,page*5+5).forEach(([id,row],i)=>{
      const y=105-i*60,unit=this.units.find(u=>u.id===id);
      this.ui.text(unit?this.shortName(this.petName(unit.turtle),7):row.name,-434,y,26,UI_COLORS.ink,p,210,40);
      [row.damage,row.healing,row.shield].forEach((v,j)=>this.ui.text(Math.round(v).toLocaleString(),[-211,-15,164][j],y,26,UI_COLORS.ink,p,170,40));
      this.ui.text(`${Math.round(row.reflected)} / ${row.rebirths}次`,390,y,26,UI_COLORS.ink,p,224,40);
    });
    if(!rows.length)this.ui.text('本次挑战还没有产生战斗记录',0,0,30,UI_COLORS.sand,p,900,50);
    this.button('上一页',-280,-276,224,88,()=>this.contributionDetails(page-1),{parent:p,disabled:page===0});
    this.ui.text(`${page+1}/${pages}`,0,-276,28,UI_COLORS.sand,p,130,42);
    this.button('下一页',280,-276,224,88,()=>this.contributionDetails(page+1),{parent:p,disabled:page===pages-1});
  }
  private team(page=this.teamPage):void{
    if(this.destroyed)return;const units=this.units;this.teamPage=this.page(page,units.length);
    if(!units.some(u=>u.id===this.selected))this.selected=units[0]?.id??'';
    const result=this.run.phase==='result',modern=this.run.rulesVersion==='0.6',bench=modern?'备战':'替补',p=this.sheet('本局队伍',`${units.length}/10 位伙伴 · ${bench} ${units.filter(u=>u.slot===null).length}/5`,()=>this.render());
    units.slice(this.teamPage*6,this.teamPage*6+6).forEach((u,i)=>this.card(u.turtle,u.slot===null?`${bench}伙伴`:`位置 ${u.slot+1}`,`${u.turtle.skills.length}技能·Lv.${u.level}`,i,p,()=>{this.selected=u.id;this.team();},this.selected===u.id));
    this.ui.text(`第 ${this.teamPage+1}/${Math.max(1,Math.ceil(units.length/6))} 页 · 点击卡片选择伙伴`,0,-202,28,UI_COLORS.sand,p,1100,36);
    this.button('上一页',-478,-276,144,88,()=>this.team(this.teamPage-1),{parent:p,disabled:this.teamPage===0});
    this.button('下一页',-314,-276,144,88,()=>this.team(this.teamPage+1),{parent:p,disabled:(this.teamPage+1)*6>=units.length});
    this.button('全部技能',-38,-276,328,88,()=>this.unitDetails(this.selected,()=>this.team()),{parent:p,disabled:!this.selected});
    this.button(result&&!modern?'比较收录':'选中并返回',380,-276,352,88,()=>result&&!modern?this.compare(this.selected):this.render(),{parent:p,primary:true,disabled:!this.selected});
  }
  private unitDetails(id:string,back:()=>void):void{
    if(this.run.rulesVersion==='0.6'){this.prototypeDetails(id,back);return;}
    if(this.destroyed)return;const u=this.units.find(u=>u.id===id);if(!u){back();return;}
    const t=u.turtle,p=this.sheet(this.petName(t),`${ROLES[t.role].job} · Lv.${u.level} · ${t.skills.length} 技能${u.slot===null?'上场后生效':'全部生效'}`,back);
    this.ui.pet(t,-422,54,224,p);
    this.ui.text(u.slot===null?'替补伙伴':`站位 ${u.slot+1}`,-422,-104,30,UI_COLORS.cream,p,288,44);
    this.ui.text(`第 ${t.generation} 代`,-422,-152,28,UI_COLORS.sand,p,288,40);
    t.skills.forEach((skill,i)=>this.skillCard(skill,-136+(i%4)*204,104-Math.floor(i/4)*104,180,p,()=>this.unitDetails(id,back)));
    this.ui.text('点击技能查看说明；主动技能在战斗底栏释放。',0,-276,28,UI_COLORS.sand,p,1100,44);
  }
  private formation():void{
    if(this.run.rulesVersion==='0.6'){this.render();this.ui.toast('长按伙伴，再拖到合法陆地调整站位');return;}
    if(this.destroyed)return;const r=this.run;if(r.phase!=='prep'&&r.phase!=='between')return;
    const modern=r.rulesVersion==='0.6',units=this.units,selected=units.find(u=>u.id===this.selected);if(!selected){this.team();return;}
    const incoming=modern&&selected.benchSlot!==undefined,p=this.sheet('调整布阵',`当前选择：${this.petName(selected.turtle)} · 点击站位即可${incoming?'替换上场':'调换位置'}`,()=>this.render());
    const slots=modern?BATTLE_MAPS[r.levelId].slots.length:5;
    for(let slot=0;slot<slots;slot++){
      const occupant=units.find(u=>u.slot===slot),n=this.button('',-432+(slot%4)*288,142-Math.floor(slot/4)*94,270,82,()=>this.act(()=>{
        if(incoming){this.service.deployBench(this.command('deploy'),selected.id,slot,this.battle);this.battle=this.run.battle;}
        else this.service.moveUnit(this.command('move'),selected.id,slot);
      }),{parent:p,selected:selected.slot===slot,disabled:incoming&&!occupant&&units.filter(u=>u.slot!==null).length>=5});
      n.name='布阵站位:'+slot;this.ui.text(`位置 ${slot+1}`,-48,19,20,UI_COLORS.sand,n,154,28);
      if(occupant)this.ui.pet(occupant.turtle,84,0,62,n);
      this.ui.text(occupant?this.shortName(this.petName(occupant.turtle),6):'可调动至此',-48,-18,21,UI_COLORS.cream,n,156,30);
    }
    this.ui.text('场上最多5只 · 波间自由调位 · 备战槽独立保留',0,-214,23,UI_COLORS.sand,p,1100,34);
    this.button('选择其他伙伴',-264,-276,400,88,()=>this.team(),{parent:p});
    if(modern)this.button('返回战场',264,-276,400,88,()=>this.render(),{parent:p});
    else this.button('放入替补',264,-276,400,88,()=>this.act(()=>this.service.moveUnit(this.command('bench'),selected.id,null)),{parent:p,disabled:selected.slot===null||units.filter(u=>u.slot!==null).length<=1||units.filter(u=>u.slot===null).length>=5});
  }
  private recruit(page=this.recruitPage):void{
    if(this.destroyed)return;const r=this.run,s=this.service.snapshot;
    const entries=[...r.selectedSources.filter(id=>!r.usedSources.includes(id)&&s.collection[id]).map(id=>({t:s.collection[id],permanent:true})),...r.recruitCandidates.map(t=>({t,permanent:false}))];
    this.recruitPage=this.page(page,entries.length);if(!entries.some(e=>e.t.id===this.recruitSelection))this.recruitSelection='';
    const p=this.sheet('伙伴来啦','先选择一位伙伴，再确认加入队伍。',()=>this.render(),'先想想');
    entries.slice(this.recruitPage*6,this.recruitPage*6+6).forEach(({t,permanent},i)=>this.card(t,permanent?'收藏伙伴':'海岛新朋友',`${ROLES[t.role].job}·${t.skills.length}技能`,i,p,()=>{this.recruitSelection=t.id;this.recruit();},t.id===this.recruitSelection));
    this.ui.text(`第 ${this.recruitPage+1}/${Math.max(1,Math.ceil(entries.length/6))} 页 · ${this.recruitSelection?'已选择，确认后消耗本波招募机会':'尚未选择伙伴'}`,0,-202,28,UI_COLORS.sand,p,1100,36);
    this.button('上一页',-478,-276,144,88,()=>this.recruit(this.recruitPage-1),{parent:p,disabled:this.recruitPage===0});
    this.button('下一页',-314,-276,144,88,()=>this.recruit(this.recruitPage+1),{parent:p,disabled:(this.recruitPage+1)*6>=entries.length});
    this.button('自愿看广告 · 换一批',-38,-276,328,88,()=>{
      this.ui.requestReward?.('refresh',undefined,()=>this.recruit());
    },{parent:p,size:28,disabled:r.refreshUsed});
    this.button('加入队伍',380,-276,352,88,()=>this.act(()=>{
      const entry=entries.find(e=>e.t.id===this.recruitSelection);if(!entry)return;
      this.service.recruit(this.command('recruit'),entry.permanent?{permanentId:entry.t.id}:{candidateId:entry.t.id});this.recruitSelection='';
    }),{parent:p,primary:true,disabled:!this.recruitSelection||!r.recruitAvailable||this.units.length>=10});
  }
  private fusion(page=this.fusionPage):void{
    if(this.destroyed)return;void this.audio.playMusic('bgm_home');const r=this.run,modern=r.rulesVersion==='0.6',units=this.units.filter(u=>!modern||u.benchSlot!==undefined);
    this.fusionPage=this.page(page,units.length);this.mergeSelection=this.mergeSelection.filter(id=>units.some(u=>u.id===id));
    const p=this.sheet('合成新龟',modern?'两只备战龟消耗，得到一只新龟；结果默认锁定，可手动解锁。':'两只本局伙伴合成一只，满意后再收录。',()=>{this.mergeSelection=[];this.render();});
    units.slice(this.fusionPage*6,this.fusionPage*6+6).forEach((u,i)=>{
      const order=this.mergeSelection.indexOf(u.id);
      this.card(u.turtle,order<0?'未选择':`已选第 ${order+1} 位`,`${u.turtle.skills.length}技能·Lv.${u.level}`,i,p,()=>{
        const index=this.mergeSelection.indexOf(u.id);if(index>=0)this.mergeSelection.splice(index,1);else if(this.mergeSelection.length<2)this.mergeSelection.push(u.id);this.fusion();
      },order>=0);
    });
    let odds='请选择两只不同的伙伴',ready=false;
    if(this.mergeSelection.length===2){try{
      const branches=this.service.mergePreview(this.mergeSelection[0],this.mergeSelection[1]),chance=combinedCountChance(branches,12);
      odds=chance>0?`本次12技能概率 ${(chance*100).toFixed(3)}%`:`本次技能池最多 ${Math.max(...branches.map(b=>b.pool.length))} 项，还需慢慢积累`;ready=true;
    }catch(error){odds=error instanceof Error?error.message:'暂时无法预览，请重新选择伙伴';console.error('[FUSION_PREVIEW]',error);}}
    this.ui.text(odds,0,-202,28,UI_COLORS.sand,p,1100,36);
    this.button('上一页',-478,-276,164,88,()=>this.fusion(this.fusionPage-1),{parent:p,disabled:this.fusionPage===0});
    this.button('下一页',-286,-276,164,88,()=>this.fusion(this.fusionPage+1),{parent:p,disabled:(this.fusionPage+1)*6>=units.length});
    this.ui.text(`第 ${this.fusionPage+1}/${Math.max(1,Math.ceil(units.length/6))} 页\n已选 ${this.mergeSelection.length}/2`,-60,-276,28,UI_COLORS.sand,p,240,76,true);
    const mergeCommand=modern?this.command('merge'):`merge:${r.id}:${r.wave}`;
    this.button('开始合成',360,-276,400,88,()=>{
      const [a,b]=this.mergeSelection;
      if(modern&&this.units.some(u=>(u.id===a||u.id===b)&&u.savedId)){this.confirmBenchFusion(a,b);return;}
      this.act(()=>{this.service.merge(mergeCommand,a,b,modern?this.battle:undefined);this.audio.effect('sfx_fusion_start');this.mergeSelection=[];});
    },{parent:p,primary:true,size:32,disabled:!ready});
  }
  private confirmBenchFusion(aId:string,bId:string):void{
    const a=this.units.find(u=>u.id===aId),b=this.units.find(u=>u.id===bId);if(!a||!b||aId===bId)return;
    const permanent=!!(a.savedId||b.savedId),p=this.sheet(permanent?'这次会消耗收藏本体':'合成这两位伙伴？','确认后 A、B 消耗，得到一只新龟 C。',()=>this.render(),'取消');
    this.ui.text(permanent?'建议回家再合，战斗中合成有损失本体的风险。':'拖动仅选中合成对象，确认才会消耗伙伴。',0,166,28,permanent?UI_COLORS.gold:UI_COLORS.sand,p,1100,60,true);
    [a,b].forEach((u,i)=>{
      const n=this.ui.panel(i===0?-264:264,36,464,176,p);this.ui.pet(u.turtle,-142,0,112,n);
      this.ui.text(`${i===0?'A':'B'} · ${this.petName(u.turtle)}`,66,42,30,UI_COLORS.cream,n,296,46);
      this.ui.text(`${u.turtle.skills.length}技能 · ${u.savedId?'已收录本体':'本局新龟'}`,66,-16,28,u.savedId?UI_COLORS.gold:UI_COLORS.sand,n,296,60,true);
    });
    try{
      const branches=this.service.mergePreview(aId,bId),parts=Array.from({length:12},(_,i)=>i+1).map(k=>({k,p:combinedCountChance(branches,k)})).filter(e=>e.p>0);
      this.ui.text(parts.map(e=>`${e.k}技 ${(e.p*100).toFixed(e.k>=11?3:1)}%`).join('　'),0,-122,26,UI_COLORS.sand,p,1100,104,true);
    }catch(error){this.onError(error);return;}
    this.ui.text(permanent?'确认后参与的收藏本体永久消失；新龟需通关才能带回。':'新龟默认锁定；确认后不因关闭或刷新而重新抽取。',0,-202,26,UI_COLORS.gold,p,1100,38);
    const command=this.command('merge');
    this.button('先不合成',-276,-276,440,88,()=>this.render(),{parent:p,primary:permanent});
    this.button(permanent?'仍要合成，消耗本体':'确认合成',264,-276,488,88,()=>this.act(()=>{
      this.service.merge(command,aId,bId,this.battle,permanent);this.audio.effect('sfx_fusion_start');this.battle=this.run.battle;this.mergeSelection=[];
    }),{parent:p,primary:!permanent,size:28});
  }
  private reveal():void{
    if(this.run.rulesVersion==='0.6'){this.prototypeReveal();return;}
    if(this.destroyed)return;const r=this.run,event=r.merges[r.pendingMergeId!],candidate=r.units[event.outputId].turtle;
    const p=this.sheet('泡泡里藏着新伙伴','擦开泡泡看看它的技能，也可以直接揭晓。');
    const cover=this.ui.group('可以擦开的泡泡',0,0,p,1120,384),bubbles:Node[]=[];
    // Wiping reveals the committed offspring. It cannot reroll any value or skill.
    this.ui.pet(candidate,-422,40,224,cover);
    this.ui.text(this.shortName(this.petName(candidate),9),-422,-112,30,UI_COLORS.cream,cover,292,44);
    this.ui.text(`${candidate.skills.length} 技能 · 成长 ${(candidate.innate.growth/100).toFixed(2)}`,-422,-160,28,UI_COLORS.gold,cover,292,40);
    candidate.skills.forEach((id,i)=>{
      const n=this.ui.panel(-136+(i%4)*204,104-Math.floor(i/4)*104,180,88,cover);
      this.ui.text(SKILL_BY_ID[id].name,0,19,30,UI_COLORS.cream,n,164,40);
      this.ui.text(SKILL_BY_ID[id].active?'主动技能':'被动技能',0,-20,28,UI_COLORS.sand,n,164,36);
    });
    for(let i=0;i<24;i++){
      const x=-468+(i%6)*187,y=-132+Math.floor(i/6)*88,n=this.ui.group('泡泡',x,y,cover,184,120),g=n.addComponent(Graphics);
      g.fillColor=color(i%2?'#91D8DE':'#C0E8E5',244);g.ellipse(0,0,94,64);g.fill();g.strokeColor=color('#F8F8D7',220);g.lineWidth=2;g.ellipse(0,0,92,62);g.stroke();g.fillColor=color('#FFFFFF',170);g.ellipse(-24,25,15,9);g.fill();bubbles.push(n);
    }
    const progress=this.ui.text('轻轻擦一擦',0,-202,28,UI_COLORS.cream,p,1100,36),epoch=this.pageEpoch;let finished=false;
    const finish=()=>{
      if(this.destroyed||finished||epoch!==this.pageEpoch)return;
      try{const u=this.service.reveal(`reveal:${event.id}`);finished=true;this.audio.effect(u.turtle.skills.length>=10?'sfx_rare_reveal':'sfx_fusion_complete');this.compare(u.id);}catch(error){this.onError(error);}
    };
    const rub=(e:EventTouch)=>{
      if(this.destroyed||finished||epoch!==this.pageEpoch)return;
      let canvas:Canvas|null=null;
      for(let ancestor:Node|null=this.ui.root;ancestor&&!canvas;ancestor=ancestor.parent)canvas=ancestor.getComponent(Canvas);
      const transform=cover.getComponent(UITransform),camera=canvas?.cameraComponent;
      if(!camera||!transform)return;
      // Touch screen pixels -> actual UI camera -> cover local space, including
      // letterboxing and any scale/translation on the UI root (no fixed 640/360).
      const point=e.getLocation(),local=transform.convertToNodeSpaceAR(camera.screenToWorld(new Vec3(point.x,point.y,0)));let changed=false;
      for(const bubble of bubbles)if(bubble.active&&Math.hypot((bubble.position.x-local.x)/1.45,bubble.position.y-local.y)<94){bubble.active=false;changed=true;}
      if(changed){this.audio.effect('sfx_bubble_rub',180);this.audio.effect('sfx_bubble_pop',90);const count=bubbles.filter(b=>!b.active).length;progress.string=`泡泡散开了 ${Math.round(count/24*100)}%`;if(count>=18)finish();}
    };
    cover.on(Node.EventType.TOUCH_START,rub);cover.on(Node.EventType.TOUCH_MOVE,rub);
    this.button('直接揭晓',0,-276,400,88,finish,{parent:p,primary:true,size:32});
  }
  private compare(id:string,sourceIndex=0,tab:'stats'|'skills'|'origin'='stats',page=0):void{
    if(this.destroyed)return;let preview:ReturnType<GameService['collectionPreview']>;
    try{preview=this.service.collectionPreview(id);}catch(error){this.onError(error);return;}
    const t=preview.candidate,index=Math.max(0,Math.min(preview.sources.length-1,sourceIndex)),source=preview.sources[index];
    const count=Math.max(t.skills.length,source?.skills.length??0),skillPage=this.page(page,count);
    const subtitle=preview.lockedSources.length?`${preview.lockedSources.length} 份收藏来源已锁定，解锁后才能收录。`:preview.sources.length?'收录会将全部来源转为历史；暂不收录则保留原收藏。':'这位伙伴没有收藏来源，收录后直接加入收藏。';
    const p=this.sheet(preview.alreadySaved?'已经是你的伙伴':'把新伙伴带回家？','',()=>this.render());
    this.ui.text(subtitle,-84,230,28,UI_COLORS.sand,p,900,36);
    const back=()=>this.compare(id,index,tab,skillPage);
    this.button('天赋',-420,166,260,88,()=>this.compare(id,index,'stats',skillPage),{parent:p,selected:tab!=='skills'});
    this.button('技能',-132,166,260,88,()=>this.compare(id,index,'skills',skillPage),{parent:p,selected:tab==='skills'});
    if(tab==='skills'){
      this.button('上一页',176,166,160,88,()=>this.compare(id,index,tab,skillPage-1),{parent:p,disabled:skillPage===0});
      this.button('下一页',360,166,160,88,()=>this.compare(id,index,tab,skillPage+1),{parent:p,disabled:(skillPage+1)*6>=count});
    }else this.button(tab==='origin'?'查看当前总值':'查看天生 / 培养',268,166,344,88,()=>this.compare(id,index,tab==='origin'?'stats':'origin',skillPage),{parent:p,size:28});
    const show=(turtle:Turtle,x:number,newTurtle:boolean)=>{
      const n=this.ui.panel(x,-66,548,300,p,'#F4F1E6',255,18);
      const first=skillPage*6<turtle.skills.length?skillPage*6+1:0,last=first?Math.min((skillPage+1)*6,turtle.skills.length):0;
      this.ui.text(tab==='skills'?`${this.shortName(this.petName(turtle))} · 技能 ${first}–${last}/${turtle.skills.length}`:this.petName(turtle),x,100,30,UI_COLORS.cream,p,548,36);
      if(tab!=='skills'){
        (['attack','health','defense','growth'] as const).forEach((key,i)=>{
          const format=(v:number)=>key==='growth'?(v/100).toFixed(2):String(v),name=({attack:'攻击',health:'生命',defense:'防御',growth:'成长'})[key];
          const value=tab==='origin'?`${name}  天生 ${format(turtle.innate[key])} + 培养 ${format(turtle.training[key])}`:`${name}  ${format(turtle.innate[key]+turtle.training[key])}`;
          this.ui.text(value,0,110-i*64,30,UI_COLORS.gold,n,524,44);
        });
        this.ui.text(tab==='origin'?'合成只遗传天生数值':'此页显示天生 + 培养的当前总值',0,-132,28,UI_COLORS.sand,n,524,36);
      }else{
        turtle.skills.slice(skillPage*6,skillPage*6+6).forEach((skill,i)=>this.skillCard(skill,x-134+(i%2)*268,36-Math.floor(i/2)*104,248,p,back,88));
        if(skillPage*6>=turtle.skills.length)this.ui.text('本页没有更多技能',0,0,30,UI_COLORS.sand,n,500,56);
      }
      n.name=newTurtle?'本局新伙伴':'收藏来源';
    };
    show(t,-286,true);if(source)show(source,286,false);else{
      this.ui.panel(286,-66,548,300,p,'#F4F1E6',255,18);
      this.ui.text('没有需要替换的收藏来源',286,-30,30,UI_COLORS.cream,p,516,88,true);
      this.ui.text('收录后直接加入收藏。',286,-124,28,UI_COLORS.sand,p,516,80,true);
    }
    this.button('暂不收录',-450,-276,224,88,()=>this.render(),{parent:p});
    this.button(preview.sources.length?`来源 ${index+1}/${preview.sources.length}\n点击切换`:'无收藏来源',-202,-276,224,88,()=>this.compare(id,(index+1)%preview.sources.length,tab,skillPage),{parent:p,size:28,disabled:preview.sources.length<=1});
    this.button('解锁这些来源',46,-276,224,88,()=>{
      try{for(const sourceId of preview.lockedSources)this.service.setLocked(this.command('unlock'),sourceId,false);this.compare(id,index,tab,skillPage);}catch(error){this.onError(error);}
    },{parent:p,size:28,disabled:preview.lockedSources.length===0});
    this.button(preview.alreadySaved?'已收录':'确认收录',350,-276,336,88,()=>this.act(()=>{this.service.collect(`collect:${this.run.id}:${t.id}`,id);this.audio.effect('sfx_collect');}),{parent:p,primary:true,disabled:preview.alreadySaved||preview.lockedSources.length>0});
  }
  private result():void{
    if(this.run.rulesVersion==='0.6'){this.prototypeResult();return;}
    if(this.destroyed)return;const r=this.run,result=this.service.snapshot.results[r.id];
    const p=this.sheet(result.victory?'海湾守住啦！':'休息一下，再来挑战',`${BATTLE_MAPS[r.levelId].name} · 完成 ${result.waves} 波 · 战斗 ${this.time(result.combatSeconds)}`);
    this.ui.text(`金币 +${result.baseGold+result.firstClearGold+(result.doubled?result.baseGold:0)}`,0,134,46,UI_COLORS.gold,p,1080,72);
    this.ui.text(`基础 ${result.baseGold}${result.firstClearGold?` · 首通 ${result.firstClearGold}`:''}${result.doubled?' · 已翻倍':''}`,0,68,30,UI_COLORS.sand,p,1080,44);
    const materials=Object.entries(result.materials??{}).map(([key,count])=>`${MATERIAL_NAMES[key as TrainingMaterial]} ×${count}`).join('　');
    this.ui.text(materials?`首通奖励：${materials}`:result.materials===undefined?'旧版结算未记录材料明细':'奖励已存入背包',0,-4,28,UI_COLORS.gold,p,1060,92,true);
    this.button(`比较伙伴 · ${this.units.length} 位`,0,-124,576,88,()=>this.team(),{parent:p});
    this.ui.text('离开前可比较全部本局伙伴，满意后再收录。',0,-202,28,UI_COLORS.cream,p,1100,36);
    if(!this.service.snapshot.solo)this.button('自愿看广告 · 基础金币翻倍',-228,-276,584,88,()=>this.ui.requestReward?.('doubleGold',r.id,()=>this.render()),{parent:p,size:30,disabled:result.doubled||result.baseGold<=0});
    this.button('回到海岛',374,-276,352,88,()=>this.onHome(),{parent:p,primary:true,size:32});
  }
  private showPause():void{
    if(this.run.rewardNodes?.some(hasPendingReward)){this.render();return;}
    if(this.destroyed)return;this.setPauseState(true,true);try{this.checkpoint();}catch(error){this.onError(error);return;}
    this.pageEpoch++;this.ui.clear();const p=this.ui.dialog('战斗菜单','关闭菜单后自动回到战斗。',()=>{this.setPauseState(false,false);this.render();},700,360);

    this.button('保存并回到海岛',0,-36,430,54,()=>this.onHome(),{parent:p,size:30});
    this.button('结束本次挑战',0,-114,430,54,()=>this.act(()=>{this.service.abandonRun(this.command('abandon'));this.battle=undefined;this.setPauseState(false,false);}),{parent:p,size:30});
  }
}

