import {Label} from 'cc';
import {GameService,makeInitialSave} from '../core/game';
import {startArena,stepArena} from '../core/arena';
import {getBattleEvents} from '../core/battle';
import {IslandUI,UI_COLORS} from './IslandUI';
import {BattleWorld} from './BattleWorld';
import {IslandAudio} from './IslandAudio';
import type {ArenaSession} from '../core/communityTypes';
/** A clearly labelled simulation of the selected defense, never a fabricated replay. */
export class ArenaWatchScreen {
 private arena:ArenaSession;private paused=false;private destroyed=false;private heading?:Label;private done=false;
 constructor(service:GameService,id:string,private ui:IslandUI,private world:BattleWorld,private home:()=>void,private audio:IslandAudio){const s=service.snapshot,c=s.community!,target=c.aiPlayers[id];if(!target)throw Error('对手不存在');delete s.run;delete s.outsideFusion;delete s.bookReveal;delete c.raid;delete c.arena;if(s.shop)delete s.shop.pending;s.collection=JSON.parse(JSON.stringify(target.pets));const attacker=Object.keys(c.aiPlayers).find(v=>v!==id)!;this.arena=startArena(s,s.clockHighWater,attacker,Object.keys(s.collection).slice(0,5),true);this.arena.battle.autoSkills=true;this.arena.battle.manualSkillTurtles=[];world.setLevel(54);this.render();}
 get diagnosticContext(){return {levelId:54,wave:1};}checkpoint(){}hide(){this.paused=true;}show(){this.paused=false;this.render();}destroy(){this.destroyed=true;this.world.destroy();}
 update(dt:number){if(this.destroyed||this.paused||this.done)return;stepArena(this.arena,Math.min(dt,.1));const events=getBattleEvents(this.arena.battle);this.world.update(this.arena.battle,events,dt);this.audio.battleEvents(this.arena.battle,events);if(this.heading)this.heading.string=`防线演练 · ${Math.floor(this.arena.seconds)} 秒 · 突破 ${this.arena.passed}/5`;if(this.arena.phase==='result'){this.done=true;this.audio.effect(this.arena.victory?'sfx_victory':'sfx_defeat');this.render();}}
 render(){void this.audio.playMusic(this.done?'bgm_home':'bgm_battle');this.ui.clear();this.world.update(this.arena.battle,[],0);const p=this.ui.panel(-60,321,1100,50);this.heading=this.ui.text('观战 · 防线演练',0,0,24,UI_COLORS.ink,p,1000,40);this.ui.button('返回',529,-318,170,48,this.home,{size:24});this.ui.button(this.paused?'继续':'暂停',-516,-318,190,48,()=>{this.paused=!this.paused;this.render();},{size:23});this.ui.text('根据对手当前阵容进行自动演练，不改变排名或奖励。',0,-319,21,UI_COLORS.ink,this.ui.root,782,34);if(this.done){const d=this.ui.dialog(this.arena.victory?'防线守住了':'防线被突破',`演练用时 ${Math.floor(this.arena.seconds)} 秒`,undefined,740,350);this.ui.text('调整阵容与技能会改变对局结果。',0,0,25,UI_COLORS.ink,d,640,70);this.ui.button('返回竞技场',0,-110,410,54,this.home,{parent:d,primary:true,size:25});}}
}
