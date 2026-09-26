import {migrateSceneArena} from './sceneMigration';
import {grantExperience} from './development';
import type {GameSave,Point} from './types';
import {arenaLocked,progression,recordArena} from './progression';
export function matchArena(s:GameSave):string{const c=communityOf(s),rank=c.arenaOrder.indexOf(LOCAL_PLAYER);const candidates=c.arenaOrder.filter(id=>id!==LOCAL_PLAYER&&c.aiPlayers[id]).sort((a,b)=>Math.abs(c.arenaOrder.indexOf(a)-rank)-Math.abs(c.arenaOrder.indexOf(b)-rank));if(!candidates.length)throw Error('暂时没有合适的对手');return candidates[progression(s).arena.games%Math.min(3,candidates.length)];}

import type {ArenaSession} from './communityTypes';
import {createBattle,duelActions,turtleEnemy,BATTLE_RULES,blockCapacity} from './battle';
import type {BattleUnit} from './battle';
import {initCommunity,communityOf,ensureCommunityHome,choosePets,reserveLoans,finishLoans,LOCAL_PLAYER} from './community';
import {copy,requireRule} from './save';
import {LEVELS} from './data';

export function startArena(s:GameSave,now:number,opponentId:string,selection:string[],practice=false):ArenaSession{
  initCommunity(s,now);ensureCommunityHome(s);const c=communityOf(s),rank=c.arenaOrder.indexOf(LOCAL_PLAYER),opponentRank=c.arenaOrder.indexOf(opponentId);
  requireRule(practice||!arenaLocked(now),'本周赛季已结算，周一开启新赛季');
  requireRule(practice||opponentRank>=0&&opponentId!==LOCAL_PLAYER&&Math.abs(rank-opponentRank)<=3,'匹配对手需在相近排名范围');
  const pets=choosePets(s,selection,now);requireRule(pets.length===5,'竞技场进攻需要五只伙伴');requireRule(pets.every(p=>!p.loanId),'借用和租赁的龟仅可用于关卡、无尽模式；竞技场只能使用自有龟');
  const opponent=c.aiPlayers[opponentId];requireRule(opponent,'当前只能挑战本地AI对手');
  if(practice)requireRule(pets.every(p=>!p.loanId),'防守仅能使用自有龟');
  const defense=practice?pets.map(p=>p.turtle):Object.values(opponent.pets).slice(0,5);requireRule(defense.length===5,'对方防守阵容不完整');
  const battle=createBattle(54,1,defense.map((turtle,slot)=>({id:`def:${turtle.id}`,turtle,slot,level:10})),{rulesVersion:'0.6',mode:'endless',formationVersion:2});
  const attackers=practice?Object.values(opponent.pets).slice(0,5).map(turtle=>({id:turtle.id,turtle})):pets;
  const attack=createBattle(54,1,attackers.map((p,slot)=>({id:`atk:${p.id}`,turtle:p.turtle,slot,level:10})),{rulesVersion:'0.6',mode:'endless',formationVersion:2});
  // Arena-only endurance. Saved battles retain their recorded stats; pets and PvE are unchanged.
  if(s.livingVersion)for(const u of [...attack.units,...battle.units]){u.maxHp*=1.75;u.hp*=1.75;for(const shield of u.shields)shield.amount*=1.75;u.shield*=1.75;}
  battle.spawns=[];battle.spawnCursor=0;battle.events=[];battle.nextEventId=1;
  const id=`arena-${++s.idCounter}`;if(!practice)reserveLoans(s,pets,id);
  const arena:ArenaSession={seasonWeek:progression(s).arena.week,ratingBefore:progression(s).arena.rating,autoDeploy:true,...(practice?{practice:true,defending:true}:{}),id,opponentId,phase:'combat',attackers:attack.units,defenders:battle.units,movers:attack.units.map((u,i)=>({id:u.id,distance:0,enterTick:1+i*(s.livingVersion?8:50),escaped:false})),battle,passed:0,seconds:0,settled:false,rankBefore:rank+1,startedAt:now};
  battle.autoSkills=s.settings.autoSkills??false;battle.controlledUnitIds=(practice?arena.defenders:arena.attackers).map(u=>u.id);
  if(!practice)c.arenaAttack=[...selection];c.arena=arena;return copy(arena);
}
function along(route:Point[],value:number):Point{
  let remaining=value;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(a.x-b.x,a.z-b.z);if(remaining<=length){const n=remaining/length;return {x:a.x+(b.x-a.x)*n,z:a.z+(b.z-a.z)*n};}remaining-=length;}return {...route[route.length-1]};
}
export function withArenaPlayer<T>(a:ArenaSession,action:(battle:import('./battle').BattleState)=>T):T{
  const b=a.battle,units=b.units,enemies=b.enemies;
  b.controlledUnitIds=(a.defending?a.defenders:a.attackers).map(u=>u.id);
  b.units=a.defending?a.defenders:a.attackers.filter(u=>a.movers.some(m=>m.id===u.id&&m.enterTick<=b.tick&&!m.escaped&&!m.waiting));
  b.enemies=(a.defending?a.attackers.filter(u=>a.movers.some(m=>m.id===u.id&&m.enterTick<=b.tick&&!m.escaped&&!m.waiting)):a.defenders).map(u=>turtleEnemy(u));
  try{return action(b);}finally{b.units=units;b.enemies=enemies;}
}
/** Count the whole roster, including queued entrants and a successful rebirth.
 * Escaped attackers have completed their route; they are not dead defenders. */
export function arenaOutcome(a:ArenaSession):{attackWon:boolean;draw:boolean;reason:'eliminated'|'route-complete'|'timeout'}|undefined{
  const defendingAlive=a.defenders.some(u=>u.alive&&u.hp>0);
  const remaining=a.attackers.some(u=>u.alive&&u.hp>0&&!a.movers.find(m=>m.id===u.id)?.escaped);
  if(!defendingAlive)return {attackWon:true,draw:false,reason:'eliminated'};
  if(!remaining)return {attackWon:a.passed>=3,draw:false,reason:a.passed?'route-complete':'eliminated'};
  // A safety limit is a draw, never a fabricated defeat of surviving units.
  if(a.battle.tick>=2400)return {attackWon:false,draw:true,reason:'timeout'};
  return undefined;
}
export function stepArena(a:ArenaSession,dt:number):void{
  migrateSceneArena(a);
  requireRule(Number.isFinite(dt)&&dt>=0&&dt<=10,'竞技场推进时间不合法');if(a.phase!=='combat')return;
  const b=a.battle;b.pendingSeconds+=dt;
  while(b.pendingSeconds+1e-9>=.05&&a.phase==='combat'){
    b.pendingSeconds=Math.max(0,b.pendingSeconds-.05);b.tick++;b.elapsed=b.tick*.05;a.seconds=b.elapsed;
    if((b.stationVersion??0)>=6)for(const [i,m] of a.movers.entries()){
      if(m.distance>0||m.enterTick>b.tick||m.escaped)continue;
      m.waiting=a.movers.slice(0,i).some(other=>!other.escaped&&a.attackers.find(u=>u.id===other.id)?.alive&&(other.waiting||other.enterTick>b.tick||other.distance<1.12));
    }
    const active=a.attackers.filter(u=>a.movers.some(m=>m.id===u.id&&m.enterTick<=b.tick&&!m.escaped&&!m.waiting));
    const blockedCounts:Record<string,number>={};
    for(const u of active){
      const mover=a.movers.find(m=>m.id===u.id)!;if(!u.alive)continue;
      Object.assign(u,along(b.route,mover.distance));
      const eligible=(d:BattleUnit)=>d.alive&&d.role==='stone'&&Math.hypot(d.x-u.x,d.z-u.z)<=1.2&&(blockedCounts[d.id]??0)<blockCapacity(d,b.tick);
      let stone=(mover.blockUntilTick??0)>b.tick?a.defenders.find(d=>(!mover.blockOwnerId||d.id===mover.blockOwnerId)&&eligible(d)):undefined;
      if(!stone&&!mover.blockUsed){stone=a.defenders.find(eligible);if(stone){mover.blockUsed=true;mover.blockUntilTick=b.tick+60;}}
      if(stone){mover.blockOwnerId=stone.id;blockedCounts[stone.id]=(blockedCounts[stone.id]??0)+1;}else if((mover.blockUntilTick??0)>b.tick)mover.blockUntilTick=b.tick;
      const rooted=u.statuses.some(s=>(s.kind==='stun'||s.kind==='root')&&s.untilTick>b.tick),slow=u.statuses.filter(s=>s.kind==='slow'&&s.untilTick>b.tick).reduce((n,s)=>Math.max(n,s.amount),0);
      if(!rooted&&(mover.blockUntilTick??0)<=b.tick){
        let next=mover.distance+.9*(1-Math.min(BATTLE_RULES.slowCap,slow))*.05;
        if((b.stationVersion??0)>=6){
          const i=a.movers.indexOf(mover);
          for(const other of a.movers)if(other!==mover&&!other.escaped&&!other.waiting&&other.enterTick<=b.tick&&a.attackers.find(unit=>unit.id===other.id)?.alive&&(other.distance>mover.distance||other.distance===mover.distance&&a.movers.indexOf(other)<i))next=Math.min(next,Math.max(mover.distance,other.distance-1.1));
        }
        mover.distance=next;
      }
      Object.assign(u,along(b.route,mover.distance));
      if(mover.distance>=b.routeLength){mover.escaped=true;a.passed++;}
    }
    duelActions(b,a.attackers.filter(u=>a.movers.some(m=>m.id===u.id&&m.enterTick<=b.tick&&!m.escaped&&!m.waiting)),a.defenders);
    const outcome=arenaOutcome(a);
    if(outcome){
      a.draw=outcome.draw;a.endReason=outcome.reason;
      a.victory=!outcome.draw&&(a.defending?!outcome.attackWon:outcome.attackWon);
      a.phase='result';b.status=a.victory?'won':'lost';
    }
  }
  b.units=a.defenders;
  b.enemies=a.attackers.filter(u=>a.movers.some(m=>m.id===u.id&&m.enterTick<=b.tick&&!m.waiting)).map(u=>{
    const m=a.movers.find(m=>m.id===u.id)!,e=turtleEnemy(u,m.distance);e.statuses=copy(u.statuses);if(m.escaped)e.alive=false;return e;
  });
  b.kills=b.enemies.filter(e=>!e.alive).length;b.leaked=a.passed;b.nextEnemyId=b.enemies.length+1;
}
export function validateArenaCheckpoint(current:ArenaSession,next:ArenaSession):void{
  requireRule(current.id===next.id&&current.opponentId===next.opponentId&&!current.settled&&next.battle.tick>=current.battle.tick&&next.battle.tick<=2400,'竞技场检查点不属于当前挑战');
  requireRule(current.practice===next.practice&&current.defending===next.defending,'竞技场双方身份不能改变');
  requireRule(next.autoDeploy===undefined||typeof next.autoDeploy==='boolean','竞技场出场模式损坏');
  requireRule(next.attackers.length===5&&next.defenders.length===5&&next.movers.length===5,'竞技场阵容损坏');
  for(const team of ['attackers','defenders'] as const)next[team].forEach((u,i)=>{
    const old=current[team][i];requireRule(u.id===old.id&&u.turtleId===old.turtleId&&u.role===old.role&&u.maxHp===old.maxHp&&JSON.stringify(u.skills)===JSON.stringify(old.skills),'竞技场战斗中不能调整队伍');
    requireRule(Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=u.maxHp&&typeof u.alive==='boolean'&&(!u.alive||u.hp>0),'竞技场生命资料损坏');
  });
  requireRule(Number.isSafeInteger(next.passed)&&next.passed===next.movers.filter(m=>m.escaped).length&&next.passed<=5&&next.seconds===next.battle.tick*.05,'竞技场进度损坏');
  next.movers.forEach((m,i)=>requireRule(m.id===current.movers[i].id&&Number.isSafeInteger(m.enterTick)&&(m.enterTick===current.movers[i].enterTick||m.enterTick>=next.battle.tick)&&Number.isFinite(m.distance)&&m.distance>=0&&m.distance<=next.battle.routeLength+.1,'竞技场出场顺序或行进资料损坏'));
}
export function finishArena(s:GameSave,next:ArenaSession,abandon=false):ArenaSession{
  const c=communityOf(s),current=c.arena;requireRule(current,'没有竞技场挑战');validateArenaCheckpoint(current,next);
  requireRule(!current.settled,'竞技场已结算');
  const outcome=arenaOutcome(next);
  requireRule(abandon||next.phase==='result'&&!!outcome,'竞技场还有有效伙伴，战斗尚未结束');
  const a=copy(next);a.phase='result';a.draw=!abandon&&!!outcome?.draw;a.endReason=abandon?'abandoned':outcome!.reason;
  a.victory=!abandon&&!a.draw&&(a.defending?!outcome!.attackWon:outcome!.attackWon);a.settled=true;
  const sameSeason=a.seasonWeek===undefined||a.seasonWeek===progression(s).arena.week;
  if(!a.practice&&sameSeason&&!progression(s).arena.weeklySettled){recordArena(s,!!a.victory,!!a.draw);a.ratingAfter=progression(s).arena.rating;}
  if(a.victory&&!a.practice&&sameSeason&&!progression(s).arena.weeklySettled){const ours=c.arenaOrder.indexOf(LOCAL_PLAYER),theirs=c.arenaOrder.indexOf(a.opponentId);if(theirs>=0&&theirs<ours){c.arenaOrder.splice(ours,1);c.arenaOrder.splice(theirs,0,LOCAL_PLAYER);}}
  if(!a.practice)grantExperience(s,c.arenaAttack,a.victory?65:abandon?0:32);
  a.rankAfter=c.arenaOrder.indexOf(LOCAL_PLAYER)+1;c.arena=a;finishLoans(s,a.id);return copy(a);
}
