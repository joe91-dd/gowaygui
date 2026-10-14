import type {GameSave,RunState,Turtle,RunResult,SkillId} from './types';
import {createBattle,expeditionAction,BattleState} from './battle';
import {newExpedition,chapterWaves,BuffId,openingStations} from './expeditionRules';
import {BATTLE_MAPS,ROLES,SKILLS} from './data';
import {levelInfo,grantExperience} from './development';
import {random} from './random';
import {unlockedBuffs,skillUnlocked} from './soloProgress';
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
export function initializeExpeditionRun(s:GameSave,r:RunState):void{
 const templates=r.selectedSources.map(id=>s.collection[id]).filter(Boolean);if(!templates.length)throw Error('请先选择出战龟龟');
 const e=newExpedition(r.mode==='endless'?'endless':'chapter',r.levelId,[{id:'local-player',templates}]);
 if(s.solo){e.solo=true;e.allowedBuffs=unlockedBuffs(s);if(r.mode==='endless')e.difficulty=s.solo.difficulty;}
 r.expedition=e;if(r.mode==='chapter')r.waveLimit=chapterWaves(r.levelId);else delete r.waveLimit;
 delete r.bossRescuedWaves;r.merges={};r.units={};r.usedSources=templates.map(t=>t.id);r.recruitAvailable=false;r.rewardNodes=[];r.rewardLedger=[];
 const b=createBattle(r.levelId,1,[],{rulesVersion:'0.6',mode:r.mode,formationVersion:2,expedition:e,seed:Math.floor(random(s)*4294967296)});
 b.units.forEach(u=>u.placement={x:u.x,z:u.z});b.autoSkills=s.settings.autoSkills??false;r.battle=b;syncExpeditionRun(r,b);
}
export function syncExpeditionRun(r:RunState,b:BattleState):void{
 if(!b.expedition)throw Error('缺少局内征召规则');r.expedition=clone(b.expedition);r.wave=b.expedition.completed;r.battle=clone(b);
 const old=r.units;r.units={};for(const u of b.units){const template=b.expedition.players.flatMap(p=>p.templates).find(t=>t.id===u.turtleId);if(!template)throw Error('培养模板丢失');r.units[u.id]={id:u.id,turtle:clone(template),sources:[],slot:u.slot,placement:clone(u.placement??{x:u.x,z:u.z}),level:u.level,fusionRank:u.fusionRank,fallen:!u.alive,...(u.sleepUntilWave!==undefined?{sleepUntilWave:u.sleepUntilWave}:{})};}
}
export function settleExpeditionRun(s:GameSave,r:RunState,victory:boolean,now:number,generate:(s:GameSave,now:number)=>Turtle):RunResult{
 if(s.results[r.id])return s.results[r.id];const e=r.battle?.expedition??r.expedition!;r.wave=e.completed;
 const endless=r.mode==='endless',progress=endless?Math.floor(r.wave/5):victory?1+Math.floor(r.levelId/10):0;
 const baseGold=Math.round((100*r.wave+(victory?300+80*r.levelId:0))*(endless?1+((e.difficulty??1)-1)*.3:1)),materials:RunResult['materials']={},books:Partial<Record<SkillId,number>>={};
 const common=SKILLS.filter(v=>skillUnlocked(s,v.id)&&!v.active&&!v.specialization&&!v.precious).map(v=>v.id),precious=SKILLS.filter(v=>skillUnlocked(s,v.id)&&v.precious&&!v.specialization).map(v=>v.id);
 for(let i=0;i<progress;i++){
  for(const key of ['attack','health','defense','growth'] as const){const n=key==='growth'?Math.max(1,Math.floor((i+1)/2)):1+i;s.materials[key]+=n;materials[key]=(materials[key]??0)+n;}
  const pool=endless&&precious.length&&random(s)<.08?precious:common,id=pool[Math.floor(random(s)*pool.length)];s.skillBooks??={};s.skillBooks[id]=(s.skillBooks[id]??0)+1;books[id]=(books[id]??0)+1;
 }
 const first=victory&&!endless&&!s.cleared.includes(r.levelId),result:RunResult={runId:r.id,levelId:r.levelId,mode:r.mode,victory,waves:r.wave,baseGold,firstClearGold:first?500:0,combatSeconds:r.combatSeconds+(r.battle?.elapsed??0),at:now,doubled:false,materials,skillBooks:books,broughtIds:[]};
 if(endless&&(!s.endlessBest||r.wave>s.endlessBest.waves))s.endlessBest={waves:r.wave,at:now,team:clone(e.players[0].templates)};
 if(endless&&s.solo){const d=(e.difficulty??1)-1;s.solo.best[d]=Math.max(s.solo.best[d],r.wave);}
 if(endless)result.bestWave=s.endlessBest?.waves??0;
 r.lootIds=[];const loot=progress?Math.min(5,endless?Math.floor(r.wave/10):1+Math.floor(r.levelId/20)):0;
 for(let i=0;i<loot;i++){const t=generate(s,now),pool=SKILLS.filter(v=>skillUnlocked(s,v.id)&&!v.specialization&&(!v.role||v.role===t.role)).map(v=>v.id),n=Math.min(10,4+Math.floor((endless?r.wave:r.levelId)/10));t.skills=[];const active=SKILLS.find(v=>v.active&&v.role===t.role)!.id;t.skills.push(active);while(t.skills.length<Math.min(n,pool.length)){const id=pool[Math.floor(random(s)*pool.length)];if(!t.skills.includes(id))t.skills.push(id);}const id='loot-'+t.id;r.units[id]={id,turtle:t,level:1,slot:null,benchSlot:i,benchLocked:true,sources:[]};r.lootIds.push(id);if(Object.keys(s.collection).length<s.capacity){s.collection[t.id]=clone(t);r.units[id].savedId=t.id;r.units[id].sources=[t.id];result.broughtIds!.push(t.id);}}
 s.gold+=baseGold+result.firstClearGold;s.results[r.id]=result;r.phase='result';delete r.battle;grantExperience(s,r.usedSources,r.wave*15);
 if(first){s.cleared.push(r.levelId);s.unlockedLevel=Math.max(s.unlockedLevel,Math.min(49,r.levelId+1));}if(victory&&r.levelId===0)s.tutorialDone=true;return result;
}
