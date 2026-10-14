const assert=require('node:assert/strict');
const C=n=>require((process.env.GOWAYGUI_TEST_CORE??'../.server-build-pearl/core')+'/'+n),B=C('battle'),R=C('expeditionRules'),E=C('expeditionEconomy'),V=C('battleValidation');
const templates=Object.values(C('allMapsReview').allMapsReviewSave(1790424000000,false,true).collection);
function fresh(map=0,kind='chapter',players=1,limit=R.chapterWaves(map)){
 const e=R.newExpedition(kind,map,Array.from({length:players},(_,i)=>({id:i?'ally':'local-player',templates})),limit);
 return B.createBattle(map,1,[],{seed:41,rulesVersion:'0.6',mode:kind==='endless'?'endless':'chapter',formationVersion:2,expedition:e});
}
const b=fresh(),e=b.expedition,p=e.players[0],act=(type,args={})=>B.expeditionAction(b,p.id,type,args);
assert.equal(b.units.length,0);assert.equal(p.coins,90);assert.equal(E.expeditionRecruitCost(e,p),40);
act('recruit');assert.equal(p.coins,50);assert.equal(E.expeditionRecruitCost(e,p),50);
act('recruit');assert.equal(p.coins,0);assert.equal(E.expeditionRecruitCost(e,p),60);V.validateBattle(b);
const failed=JSON.stringify(b);assert.throws(()=>act('recruit'),/干粮不足/);assert.equal(JSON.stringify(b),failed);
const before=p.spent;act('move',{a:b.units[0].id,slot:b.units[1].slot});assert.equal(b.units[0].fusionRank,2);assert.equal(p.spent,before);assert.equal(E.expeditionRecruitCost(e,p),60);V.validateBattle(b);
p.coins+=10000;p.earned+=10000;while(b.units.length<12)act('recruit');
const full=JSON.stringify(b);assert.throws(()=>act('recruit'));assert.equal(JSON.stringify(b),full);V.validateBattle(b);
while(p.recruited<20){const a=b.units.find(u=>u.fusionRank<3&&b.units.some(v=>v!==u&&v.fusionRank===u.fusionRank));assert.ok(a);const v=b.units.find(v=>v!==a&&v.fusionRank===a.fusionRank);act('move',{a:a.id,slot:v.slot});act('recruit');}
assert.equal(p.spent,2700);assert.equal(p.recruited,20);assert.throws(()=>act('recruit'),/20只/);V.validateBattle(b);
for(const [map,kind,limit,players]of [[0,'chapter',10,1],[14,'chapter',15,1],[49,'chapter',20,1],[51,'raid',10,2],[52,'raid',15,2],[53,'raid',20,2],[55,'raid',20,2]]){
 const s=fresh(map,kind,players,limit);let earned=0;
 for(let wave=1;wave<=limit;wave++){s.wave=wave;const sp=R.expeditionSpawns(s);const amount=sp.reduce((a,v)=>a+v.rations,0)+E.waveClearRations(s.expedition,wave);assert.ok(Number.isInteger(amount));earned+=amount;}
 assert.equal(earned,2780);assert.equal(90+earned-E.recruitmentSpent(20),170);
}
const raid=fresh(51,'raid',2,10);B.expeditionAction(raid,'local-player','recruit',{});
assert.equal(E.expeditionRecruitCost(raid.expedition,raid.expedition.players[0]),50);assert.equal(E.expeditionRecruitCost(raid.expedition,raid.expedition.players[1]),40);assert.equal(raid.expedition.players[1].coins,90);V.validateBattle(raid);
const reward=fresh();reward.wave=1;const rp=reward.expedition.players[0];const mob={...reward.enemies[0],kind:'ink',expeditionBounty:true,rations:5};R.expeditionKill(reward,mob);assert.equal(rp.coins,95);R.expeditionKill(reward,{...mob,mechanismOwner:'summon'});assert.equal(rp.coins,95);R.expeditionWaveCleared(reward);assert.equal(rp.coins,125);R.expeditionWaveCleared(reward);assert.equal(rp.coins,125);
const endless=fresh(50,'endless');for(let block=0;block<10;block++){const sum=Array.from({length:10},(_,i)=>E.waveRationBudget(endless.expedition,block*10+i+1)).reduce((a,b)=>a+b,0);assert.equal(sum,E.recruitmentSpent((block+1)*12)-E.recruitmentSpent(block*12));}
const old=fresh();delete old.expedition.economyVersion;old.expedition.cost=R.recruitCost(10);old.expedition.players[0].coins=old.expedition.cost*2;old.spawns.forEach(s=>delete s.rations);B.expeditionAction(old,'local-player','recruit',{});assert.equal(E.expeditionRecruitCost(old.expedition,old.expedition.players[0]),R.recruitCost(10));V.validateBattle(old);
// Atlas/interface changes must not alter any world routes or legal stations.
const oldR=require('../.server-build-art/core/expeditionRules'),oldD=require('../.server-build-art/core/data');
for(let id=0;id<57;id++){assert.deepEqual(R.expeditionSlots(id),oldR.expeditionSlots(id));assert.deepEqual(C('data').BATTLE_MAPS[id],oldD.BATTLE_MAPS[id]);}
console.log('PASS: empty/90 start, 40/50/60 pricing, failed/full recruits atomic, merge/swap ledger, 20 cap, 10/15/20-wave budgets, two-player independent ledgers, no summoned bounty, clear paid once, endless scaling, legacy saves, all 57 map geometries unchanged.');
