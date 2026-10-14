'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const check=(v,m)=>{if(!v)throw Error(m);},copy=value=>require('./clone.cjs')(value);
function createWorldBossService({core,file,data:initialData,deferRankMail=false,replayMemo,now=Date.now}){
 const {validateTurtle}=require(core+'/save.js');
 const {worldBossDay,WORLD_BOSSES,WORLD_DAMAGE_TIERS,worldTierGrants,worldRankGrants,createWorldBossFight,stepWorldBoss,worldBossAction}=require(core+'/worldBoss.js');
 const data=initialData??(file&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{days:{},fights:{},mail:{},requests:{}});let dirty=false;
 // Keep old results/attempt counts; remap the removed fifth visual on unfinished fights.
 for(const d of Object.values(data.days)){
  if(d.bossIndex>=WORLD_BOSSES.length){d.legacyBossName??='破浪鲨君';d.bossIndex=d.bossIndex%WORLD_BOSSES.length;dirty=true;}
 }
 for(const f of Object.values(data.fights)){
  if(f.bossIndex>=WORLD_BOSSES.length){f.bossIndex=f.bossIndex%WORLD_BOSSES.length;dirty=true;}
  for(const e of f.battle?.enemies??[])if(e.worldBossIndex>=WORLD_BOSSES.length){e.worldBossIndex=e.worldBossIndex%WORLD_BOSSES.length;dirty=true;}
 }
 const persist=()=>{if(!dirty||initialData)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);dirty=false;};
 const rows=d=>Object.entries(d.players).filter(([,p])=>p.best>0).sort((a,b)=>b[1].best-a[1].best||a[1].bestAt-b[1].bestAt||a[0].localeCompare(b[0]));
 function mail(id,client,title,body,grants){if(!data.mail[id])data.mail[id]={id,clientId:client,title,body,grants,xp:0,petIds:[],at:now(),acknowledged:false};dirty=true;}
 function complete(f){const d=data.days[f.board],p=d.players[f.owner];if(f.recorded)return;if(f.damage>p.best){p.best=Math.floor(f.damage);p.bestAt=f.finishedAt??now();}f.recorded=true;dirty=true;}
 function resumeClock(f,at){if(f.pauseStartedAt!==undefined){f.pausedMs=(f.pausedMs??0)+Math.max(0,Math.min(at,f.pauseLeaseUntil)-f.pauseStartedAt);delete f.pauseStartedAt;delete f.pauseLeaseUntil;f.operationPaused=false;dirty=true;}}
 function tick(){const at=now();for(const f of Object.values(data.fights)){
   if(f.phase!=='combat')continue;const cutoff=Math.min(at,data.days[f.board]?.closes??at);
   if(f.pauseStartedAt!==undefined&&cutoff>=f.pauseLeaseUntil)resumeClock(f,f.pauseLeaseUntil);
   const pendingPause=f.pauseStartedAt===undefined?0:Math.max(0,cutoff-f.pauseStartedAt);
   const elapsed=Math.min(90,Math.max(0,(cutoff-f.startedAt-(f.pausedMs??0)-pendingPause)/1000)),delta=Math.max(0,elapsed-f.battle.elapsed-f.battle.pendingSeconds);
   f.endsAt=f.startedAt+90000+(f.pausedMs??0)+pendingPause;
   if(delta>0){
    // A rolled-back storage conflict must not replay 90 seconds of identical
    // authoritative combat again. Fingerprint the complete input and time;
    // changed actions/clock/roster always re-simulate. Rewards are never cached.
    const key=replayMemo&&crypto.createHash('sha256').update(JSON.stringify([f,delta])).digest('hex');
    const cached=replayMemo?.get(f.id);
    if(cached&&cached.key===key)Object.assign(f,copy(cached.fight));
    else{stepWorldBoss(f,Math.min(90,delta));delete f.battle.combatInputs;f.battle.events=f.battle.events.slice(-180);if(replayMemo)replayMemo.set(f.id,{key,fight:copy(f)});}
    dirty=true;
   }if(f.phase==='result'){f.finishedAt=cutoff;complete(f);}
  }
  for(const [key,d] of Object.entries(data.days)){if(d.settled||at<d.closes||Object.values(d.active??{}).some(Boolean))continue;
   for(const f of Object.values(data.fights))if(f.board===key&&f.phase==='combat'){resumeClock(f,d.closes);f.phase='result';f.battle.status='won';f.finishedAt=d.closes;complete(f);}
   rows(d).forEach(([,p],i)=>p.finalRank=i+1);
   if(!deferRankMail)rows(d).forEach(([id,p],i)=>mail('world:rank:'+key+':'+id,id,`${d.day} 世界首领 · 第 ${i+1} 名`,`${d.legacyBossName??WORLD_BOSSES[d.bossIndex].name} · 当日最高伤害 ${p.best.toLocaleString()}。排名按最高伤害排序，同伤害先达成者在前。`,worldRankGrants(i+1)));d.settled=true;dirty=true;
  }
 }

 function board(client){const day=worldBossDay(now()),key=day.key+':'+client.region;data.days[key]??={day:day.key,bossIndex:day.bossIndex,closes:day.closes,players:{},settled:false};const d=data.days[key];d.players[client.id]??={name:client.name,attempts:0,best:0,bestAt:0,claimed:[]};d.players[client.id].name=client.name;return {day,key,d,p:d.players[client.id]};}
 function view(client){tick();const {day,d,p}=board(client),sorted=rows(d),active=Object.values(data.fights).filter(f=>f.owner===client.id).sort((a,b)=>b.startedAt-a.startedAt)[0];return {day:day.key,bossIndex:d.bossIndex,closes:day.closes,next:day.next,serverTime:now(),canStart:day.canStart&&!d.settled,attempts:p.attempts,best:p.best,rank:sorted.findIndex(([id])=>id===client.id)+1||undefined,claimed:copy(p.claimed),ranking:sorted.slice(0,50).map(([id,p],i)=>({id,name:p.name,damage:p.best,rank:i+1,own:id===client.id,showcase:copy(p.showcase??p.roster?.slice(0,1)??[]),rotate:!!p.rotate,roster:copy(p.roster??[])})),participants:sorted.length,...(active&&(active.phase==='combat'||active.day===day.key)?{fight:copy(active)}:{})};}
 function handle(action,client,body={}){tick();const {day,key,d,p}=board(client),request=client.id+':'+body.requestId;if(action!=='state'){check(typeof body.requestId==='string'&&body.requestId.length<=100,'缺少操作编号');if(data.requests[request])return view(client);}
  if(action==='showcase'){check(Array.isArray(body.pets)&&body.pets.length>=1&&body.pets.length<=5,'请选择1至5只展示伙伴');check(new Set(body.pets.map(t=>t.id)).size===body.pets.length,'展示伙伴不能重复');body.pets.forEach(validateTurtle);p.showcase=copy(body.pets);p.rotate=!!body.rotate;dirty=true;}
  else if(action==='start'){check(day.canStart&&!d.settled,'今日挑战已结束，每日 00:00 开启下一位首领');check(!Object.values(data.fights).some(f=>f.owner===client.id&&f.phase==='combat'),'已有挑战进行中，请返回战场');const f=createWorldBossFight(crypto.randomUUID(),day.key,d.bossIndex,client.roster,now(),body.placements);f.owner=client.id;f.board=key;for(const [id,old] of Object.entries(data.fights))if(old.owner===client.id&&old.phase==='result'&&old.recorded)delete data.fights[id];data.fights[f.id]=f;p.roster=copy(client.roster);p.attempts++;dirty=true;}
  else if(action==='claim'){check(Number.isInteger(body.tier)&&body.tier>=0&&body.tier<10,'宝箱档位无效');check(p.best>=WORLD_DAMAGE_TIERS[body.tier],'今日最高伤害尚未达标');if(!p.claimed.includes(body.tier)){mail('world:stage:'+key+':'+client.id+':'+body.tier,client.id,`${day.key} 世界首领 · 第 ${body.tier+1} 档`,`${WORLD_DAMAGE_TIERS[body.tier].toLocaleString()} 伤害已达成，奖励每天每档领取一次。`,worldTierGrants(body.tier));p.claimed.push(body.tier);}dirty=true;}
  else if(action!=='state'){const f=data.fights[body.fightId];check(f&&f.owner===client.id,'挑战不存在或不属于当前玩家');if(action==='operationPause'){check(f.phase==='combat','挑战已经结束');f.pauseStartedAt??=now();f.pauseLeaseUntil=now()+30000;f.operationPaused=true;}
   else if(action==='operationResume'){resumeClock(f,now());}
   else worldBossAction(f,action,body);dirty=true;}
  if(action!=='state'){data.requests[request]=true;const keys=Object.keys(data.requests);if(keys.length>2000)delete data.requests[keys[0]];}persist();return view(client);
 }
 const pending=client=>{tick();return Object.values(data.mail).filter(m=>m.clientId===client.id&&!m.acknowledged).map(copy);};
 const ack=(client,id)=>{const m=data.mail[id];check(m&&m.clientId===client.id,'奖励邮件不存在');m.acknowledged=true;dirty=true;persist();};
 return {handle,pending,ack,tick,persist,data,flush(){dirty=true;persist();}};
}
module.exports={createWorldBossService};
