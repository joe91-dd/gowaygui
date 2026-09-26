const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {SaveRepository,SAVE_KEY,encodeSave,validateSave}=require('../.test-build/core/save.js');
const {SKILLS,skillsForRole,ROLES}=require('../.test-build/core/data.js');
const {initialTalents,initialSkills,talentDistribution,TALENT_KEYS}=require('../.test-build/core/talents.js');
const {previewFusion,generateFusion}=require('../.test-build/core/fusion.js');
const {createBattle,stepBattle,getBattleEvents,commandBattle}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {recordEndlessWave,hasPendingReward,rewardPrice}=require('../.test-build/core/prototype.js');
const {availablePets,petRanking,progressRanking,taxFor}=require('../.test-build/core/community.js');
const {stepRaid,swapRaidPet}=require('../.test-build/core/raids.js');
const {stepArena}=require('../.test-build/core/arena.js');
const NOW=1788948000000,copy=x=>JSON.parse(JSON.stringify(x));
function fixture(edit=()=>{}){
  const storage=new MemoryStorage(),s=makeInitialSave(NOW,9137);edit(s);storage.setItem(SAVE_KEY,encodeSave(s));let now=NOW,g=new GameService(new SaveRepository(storage),{now:()=>now});g.enablePrototype('v07');
  return {storage,get g(){return g;},advance(n){now+=n;g.refreshClock('time:'+now);},reload(){g=new GameService(new SaveRepository(storage),{now:()=>now});return g;},init(){g.communityAction('community:init',{kind:'init'});return g.snapshot.community;}};
}
function pet(role='stone',skills=['strong']){return {id:role,role,name:'',skills,innate:{attack:70,health:70,defense:70,growth:100},training:{attack:0,health:0,defense:0,growth:0},generation:0,bornAt:NOW,parentIds:[],locked:false};}
test('V07 newborn roles favor their own talent and can roll a perfect focus and growth; initial skill roles remain themed',()=>{
  for(const [role,focus] of Object.entries({stone:'defense',spike:'attack',crystal:'attack',leaf:'health',bubble:'health'})){
    const rng={rng:1234},count={perfect:0,growth:0},sums={attack:0,health:0,defense:0};
    for(let i=0;i<10000;i++){const t=initialTalents(rng,role);if(t[focus]===100)count.perfect++;if(t.growth===110)count.growth++;for(const key of Object.keys(sums))sums[key]+=t[key];const skills=initialSkills(rng,role,3);assert.equal(new Set(skills).size,3);assert.ok(skills.every(id=>!SKILLS.find(x=>x.id===id).role||SKILLS.find(x=>x.id===id).role===role));}
    assert.ok(count.perfect>140&&count.perfect<260);assert.ok(count.growth>65&&count.growth<140);for(const key of Object.keys(sums))if(key!==focus)assert.ok(sums[focus]>sums[key]);
  }
});
test('V07 trained panel inheritance reaches combined four maximum talents and the exact preview distribution sums to one',()=>{
  const a=pet('spike'),b=pet('leaf');a.innate.attack=90;a.training.attack=10;a.innate.health=100;b.innate.defense=100;b.innate.growth=105;b.training.growth=5;
  for(const key of TALENT_KEYS){const d=talentDistribution(a,b,key);assert.ok(Math.abs(d.reduce((n,x)=>n+x.probability,0)-1)<1e-12);assert.ok(d.some(x=>x.value===(key==='growth'?110:100)&&x.probability>0));}
  const rng={rng:719},before=copy([a,b]);let perfect=false;
  for(let i=0;i<120000&&!perfect;i++){const c=generateFusion(rng,a,b,'candidate',NOW);perfect=TALENT_KEYS.every(k=>c.innate[k]===(k==='growth'?110:100));assert.deepEqual(c.training,{attack:0,health:0,defense:0,growth:0});}
  assert.ok(perfect,'a fully inherited panel must be obtainable');assert.deepEqual([a,b],before);
  const untrained=copy(a);untrained.training.attack=0;assert.notDeepEqual(talentDistribution(a,b,'attack'),talentDistribution(untrained,b,'attack'));
});
test('V07 main/sub parents give 60/40 appearance; all passive skills transfer but only matching active can transfer',()=>{
  const a=pet('stone',['hold','reflect']),b=pet('leaf',['greatHeal','doubleHeal']);const branches=previewFusion(a,b);assert.deepEqual(branches.map(x=>x.probability),[.6,.4]);
  assert.ok(branches[0].pool.includes('doubleHeal'));assert.ok(!branches[0].pool.includes('greatHeal'));assert.ok(branches[1].pool.includes('reflect'));assert.ok(!branches[1].pool.includes('hold'));
  const rng={rng:83};let main=0;for(let i=0;i<20000;i++)if(generateFusion(rng,a,b,'c',NOW).role==='stone')main++;assert.ok(main>11600&&main<12400);
  assert.equal(SKILLS.length,50);for(const role of Object.keys(ROLES)){assert.ok(skillsForRole(role).includes('reflect'));assert.ok(skillsForRole(role).includes('taunt'));assert.equal(SKILLS.filter(x=>x.active&&skillsForRole(role).includes(x.id)).length,1);}
});
test('V07 books can teach a foreign passive, cannot teach foreign active, and keep the learned result after reload',()=>{
  const f=fixture(s=>{s.collection['t-4'].skills=['strong','greatHeal'];s.skillBooks={reflect:1,hold:1};});f.g.learnSkillBook('passive','t-4','reflect');f.reload();assert.ok(f.g.snapshot.collection['t-4'].skills.includes('reflect'));f.g.finishBookReveal('reveal');const before=f.g.snapshot;assert.throws(()=>f.g.learnSkillBook('wrongActive','t-4','hold'));assert.deepEqual(f.g.snapshot,before);
});
function enemyArena(skills){const t=pet('stone',skills);const b=createBattle(0,1,[{id:t.id,turtle:t,slot:0,level:1}],{seed:11,rulesVersion:'0.6',mode:'chapter'});b.spawns=[{kind:'ink',time:0,hpScale:1000,attackScale:1}];stepBattle(b,.05);const u=b.units[0],e=b.enemies[0];Object.assign(e,{x:u.x,z:u.z,distance:4,speed:0,attack:1e9,nextAttackTick:b.tick+1});u.nextAttackTick=1e9;return b;}
test('V07 rebirth rolls once per wave; successful revival can later fall asleep and the sleep wave is fixed in saved state',()=>{
  let found=false;
  for(let seed=1;seed<500&&!found;seed++){const b=enemyArena(['rebirth','sleep']);b.rng=seed*199999;stepBattle(b,.05);const u=b.units[0];if(u.alive){found=true;assert.equal(u.hp,u.maxHp*.4);assert.equal(u.rebirthUsed,true);assert.equal(u.sleepUntilWave,undefined);b.enemies[0].nextAttackTick=b.tick+1;stepBattle(b,.05);assert.equal(u.alive,false);assert.ok(u.sleepUntilWave>=4&&u.sleepUntilWave<=6);validateBattle(b);const restored=copy(b);stepBattle(b,1);stepBattle(restored,1);assert.deepEqual(b,restored);}}
  assert.ok(found);
});
test('V07 sleeping turtles stay unavailable through the exact wake wave when recreating battle',()=>{
  const t=pet('stone',['sleep']);for(let wave=2;wave<=5;wave++){const b=createBattle(4,wave,[{id:t.id,turtle:t,slot:0,level:1,sleepUntilWave:5}],{rulesVersion:'0.6',mode:'endless'});assert.equal(b.units[0].alive,wave===5);assert.equal(b.units[0].hp,wave===5?b.units[0].maxHp:0);validateBattle(b);}
});
test('V07 stone blocks one enemy for three seconds rather than holding two indefinitely',()=>{
  const t=pet(),b=createBattle(0,1,[{id:'stone',turtle:t,slot:0,level:1}],{});b.rulesVersion='0.6';b.mode='chapter';b.spawns=Array.from({length:3},()=>({kind:'ink',time:0,hpScale:1000,attackScale:0}));b.units[0].nextAttackTick=1e9;stepBattle(b,.05);
  b.enemies.forEach((e,i)=>Object.assign(e,{x:-5,z:0,distance:4,speed:.05,nextAttackTick:1e9}));stepBattle(b,.05);assert.equal(b.enemies.filter(e=>e.blockedBy).length,1);const held=b.enemies.find(e=>e.blockedBy);stepBattle(b,3.1);assert.equal(held.blockedBy,undefined);assert.ok(held.distance>4);validateBattle(b);
});
function rewardFixture(){const f=fixture(s=>{s.cleared=[0,1];});f.g.beginPrototypeRun('run',4,Object.keys(f.g.snapshot.collection),'endless');const s=f.g.snapshot;s.run.phase='between';s.run.wave=5;recordEndlessWave(s,s.run);f.storage.setItem(SAVE_KEY,encodeSave(s));f.reload();return f;}

test('Endless paid reveals validate the migrated gold denomination, survive reload and still reject excess spending',()=>{
  const f=rewardFixture();f.g.chooseEndlessReward('free',5);
  const s=f.g.snapshot;require('../.test-build/core/economy.js').migrateEconomy(s);
  f.storage.setItem(SAVE_KEY,encodeSave(s));f.reload();
  f.g.buyEndlessReward('paid',5);f.reload();
  assert.equal(f.g.snapshot.gold,280000);
  assert.equal(f.g.snapshot.run.rewardNodes[0].spentGold,20000);
  f.g.chooseEndlessReward('second',5);f.g.buyEndlessReward('all',5,true);f.reload();
  assert.equal(f.g.snapshot.gold,127000);
  assert.equal(f.g.snapshot.run.rewardNodes[0].opened.length,5);
  validateSave(f.g.snapshot);
  const broken=f.g.snapshot;broken.run.rewardNodes[0].spentGold=190001;
  assert.throws(()=>validateSave(broken),/开奖费用损坏/);
});
test('V07 reward board is exactly two gold, two distinct foods and one book; pause, continued draws and discounted all-open are atomic',()=>{
  const f=rewardFixture(),node=f.g.snapshot.run.rewardNodes[0];assert.equal(node.choices.filter(x=>x.kind==='gold').length,2);assert.equal(new Set(node.choices.filter(x=>x.kind==='material').map(x=>x.material)).size,2);assert.equal(node.choices.filter(x=>x.kind==='book').length,1);
  const fixed=node.randomIndex;f.g.chooseEndlessReward('pause',5,(fixed+1)%5);f.g.chooseEndlessReward('pause',5);f.reload();let n=f.g.snapshot.run.rewardNodes[0];assert.deepEqual(n.opened,[fixed]);assert.equal(rewardPrice(n),20);assert.equal(rewardPrice(n,true),171);
  assert.throws(()=>f.g.beginWave('blocked',f.g.snapshot.run.id,{}));f.g.buyEndlessReward('next',5);assert.equal(f.g.snapshot.gold,280);const next=f.g.snapshot.run.rewardNodes[0].randomIndex;assert.notEqual(next,fixed);f.reload();assert.equal(f.g.snapshot.run.rewardNodes[0].randomIndex,next);assert.throws(()=>f.g.closeEndlessReward('no-refund',5));f.g.chooseEndlessReward('second',5);
  const allCost=rewardPrice(f.g.snapshot.run.rewardNodes[0],true);assert.equal(allCost,153);f.g.buyEndlessReward('all',5,true);f.g.buyEndlessReward('all',5,true);n=f.g.snapshot.run.rewardNodes[0];assert.equal(f.g.snapshot.gold,127);assert.equal(n.opened.length,5);assert.equal(hasPendingReward(n),false);assert.equal(f.g.snapshot.run.rewardLedger.filter(x=>x.source==='choice').length,5);
  const before=f.g.snapshot.gold,expected=n.choices.filter(x=>x.kind==='gold').reduce((n,x)=>n+x.amount,0);f.g.abandonRun('end');assert.equal(f.g.snapshot.gold,before+expected);f.reload();validateSave(f.g.snapshot);
});
test('V07 failed gold draw purchase and failed storage write leave the board, wallet and RNG unchanged',()=>{
  const f=rewardFixture();f.g.chooseEndlessReward('first',5);const before=f.g.snapshot,write=f.storage.setItem;f.storage.setItem=(k,v)=>{if(k===SAVE_KEY)throw new Error('disk full');return write.call(f.storage,k,v);};assert.throws(()=>f.g.buyEndlessReward('fail',5));assert.deepEqual(f.g.snapshot,before);f.storage.setItem=write;f.g.closeEndlessReward('leave',5);assert.equal(f.g.snapshot.gold,300);
});
test('V07 local friends, AI chat, three assists, expired loans and battle-use loans survive restart without making permanent duplicates',()=>{
  const f=fixture(),c=f.init(),friend=Object.values(c.aiPlayers)[0],t=friend.assists[0];f.g.communityAction('aid',{kind:'assists',ids:Object.keys(f.g.snapshot.collection).slice(0,3)});assert.throws(()=>f.g.communityAction('tooMany',{kind:'assists',ids:Object.keys(f.g.snapshot.collection).slice(0,4)}));
  f.g.communityAction('chat',{kind:'chat',to:friend.id,text:'能借伙伴打副本吗'});assert.equal(f.g.snapshot.community.messages.length,2);assert.match(f.g.snapshot.community.messages[1].text,/援助/);
  const loan=f.g.communityAction('borrow',{kind:'borrow',ownerId:friend.id,petId:t});f.reload();assert.ok(availablePets(f.g.snapshot).some(p=>p.id===loan.id));assert.throws(()=>f.g.communityAction('duplicate',{kind:'borrow',ownerId:friend.id,petId:t}));
  f.g.beginPrototypeRun('adventure',0,[loan.id,'t-1']);assert.ok(f.g.snapshot.run.units);f.g.abandonRun('end');assert.equal(f.g.snapshot.community.loans[0].finished,true);assert.equal(Object.keys(f.g.snapshot.collection).length,5);assert.ok(f.g.snapshot.community.aiPlayers[friend.id].pets[t]);
  const second=f.g.communityAction('borrow2',{kind:'borrow',ownerId:friend.id,petId:t});f.advance(3600001);assert.ok(!availablePets(f.g.snapshot).some(p=>p.id===second.id));f.reload();validateSave(f.g.snapshot);
});
test('V07 market escrow, transfers, taxes, cancellation and retries conserve coins and ownership',()=>{
  const f=fixture(),c=f.init(),stock=c.listings.find(l=>l.kind==='pet'),before=f.g.snapshot;f.g.communityAction('buy',{kind:'buy',id:stock.id});f.g.communityAction('buy',{kind:'buy',id:stock.id});f.reload();let s=f.g.snapshot;assert.ok(s.collection[stock.pet.id]);assert.equal(s.gold,before.gold-stock.price);assert.equal(s.community.aiPlayers[stock.ownerId].gold,before.community.aiPlayers[stock.ownerId].gold+stock.price-taxFor(stock.price));
  const sale=f.g.communityAction('list',{kind:'list',asset:'pet',id:stock.pet.id,price:101});assert.ok(!f.g.snapshot.collection[stock.pet.id]);f.g.communityAction('sold',{kind:'aiPurchase',id:sale.id});s=f.g.snapshot;assert.equal(s.community.receipts.at(-1).tax,21);assert.equal(s.community.receipts.at(-1).net,80);assert.throws(()=>f.g.communityAction('again',{kind:'aiPurchase',id:sale.id}));
  const own='t-1',listing=f.g.communityAction('escrow',{kind:'list',asset:'pet',id:own,price:150});f.reload();f.g.communityAction('cancel',{kind:'cancelListing',id:listing.id});assert.ok(f.g.snapshot.collection[own]);validateSave(f.g.snapshot);
});
test('V07 rental daily five limits, same-body five limits and owner usage remain independent',()=>{
  const f=fixture(s=>s.gold=10000),c=f.init(),listing=c.listings.find(l=>l.kind==='rental'),own=f.g.communityAction('offer',{kind:'list',asset:'rental',id:'t-1',price:10});
  for(let i=0;i<5;i++)f.g.communityAction('aiRent'+i,{kind:'aiPurchase',id:own.id});assert.throws(()=>f.g.communityAction('sixthAI',{kind:'aiPurchase',id:own.id}));assert.ok(f.g.snapshot.collection['t-1']);
  for(let i=0;i<5;i++){const loan=f.g.communityAction('rent'+i,{kind:'rent',id:listing.id});f.g.beginPrototypeRun('run'+i,0,[loan.id,'t-1']);f.g.abandonRun('end'+i);}
  assert.equal(f.g.snapshot.community.daily.borrowed,5);assert.throws(()=>f.g.communityAction('sixth',{kind:'rent',id:listing.id}));f.advance(86400000);f.g.communityAction('reset',{kind:'refresh'});assert.equal(f.g.snapshot.community.daily.borrowed,0);f.reload();validateSave(f.g.snapshot);
});
test('V07 score ordering, hiding and fastest-progress ordering use saved arrivals and completed receipts',()=>{
  const f=fixture(),c=f.init();const original=petRanking(f.g.snapshot),ours=original.find(p=>p.ownerId==='local-player');f.g.communityAction('hidePet',{kind:'rankVisibility',petId:ours.turtle.id,hidden:true});assert.ok(!petRanking(f.g.snapshot).some(x=>x.turtle.id===ours.turtle.id));f.g.communityAction('hideAll',{kind:'rankVisibility',hidden:true});assert.ok(petRanking(f.g.snapshot).every(x=>x.ownerId!=='local-player'));const before=f.g.snapshot.community.scoreArrivals;f.reload();f.g.communityAction('refresh',{kind:'refresh'});assert.deepEqual(f.g.snapshot.community.scoreArrivals,before);const rows=progressRanking(f.g.snapshot,'endless');assert.ok(rows.every((r,i)=>i===0||rows[i-1].progress>=r.progress));
});
test('V07 five-person raid uses five owned reserves per member, retains swapped HP, checkpoints and settles once',()=>{
 const f=fixture();f.init();f.g.beginRaid('raid',0,Object.keys(f.g.snapshot.collection));let r=f.g.snapshot.community.raid;assert.equal(r.members.length,5);assert.ok(r.members.every(m=>m.roster.length===5));assert.ok(r.members[0].roster.every(p=>!p.loanId));
 f.g.beginRaidWave('wave');r=f.g.snapshot.community.raid;stepRaid(r,2);const first=r.members[0].activeId,actor=r.battle.units.find(u=>u.id===first);actor.hp=actor.maxHp*.7;const alternative=r.members[0].roster.find(p=>p.id!==first);swapRaidPet(r,0,alternative.id);assert.throws(()=>swapRaidPet(r,0,first),/冷却/);for(const spawn of r.battle.spawns.slice(r.battle.spawnCursor))spawn.time+=100;r.battle.enemies.forEach(e=>{e.attack=0;e.speed=0;e.hp=e.maxHp=1e6;});stepBattle(r.battle,8);swapRaidPet(r,0,first);assert.equal(r.battle.units.find(u=>u.id===first).hp,actor.hp);
 f.g.checkpointRaid('checkpoint',r);f.reload();assert.deepEqual(f.g.snapshot.community.raid,r);f.g.finishRaid('quit',r,true);f.g.finishRaid('quit',r,true);assert.equal(f.g.snapshot.community.raid.settled,true);validateSave(f.g.snapshot);
});

test('V07 arena plays actual ordered turtles against defense, resumes deterministically, and persists rank or practice result once',()=>{
  const f=fixture(),c=f.init(),opponent=c.arenaOrder.at(-2);f.g.beginArena('arena',opponent,Object.keys(f.g.snapshot.collection));let a=f.g.snapshot.community.arena;stepArena(a,5);f.g.checkpointArena('save',a);f.reload();const restored=f.g.snapshot.community.arena;stepArena(a,2);stepArena(restored,2);assert.deepEqual(a,restored);
  for(let i=0;i<120&&a.phase==='combat';i++)stepArena(a,1);assert.equal(a.phase,'result');assert.equal(a.victory,a.passed>=3);const done=f.g.finishArena('finish',a);f.g.finishArena('finish',a);assert.equal(done.rankAfter,f.g.snapshot.community.arenaOrder.indexOf('local-player')+1);
  f.g.communityAction('defense',{kind:'arenaDefense',ids:Object.keys(f.g.snapshot.collection).reverse()});f.g.beginArenaPractice('practice',Object.keys(c.aiPlayers)[0]);a=f.g.snapshot.community.arena;assert.equal(a.defenders[0].turtleId,'t-5');for(let i=0;i<120&&a.phase==='combat';i++)stepArena(a,1);const before=f.g.snapshot.community.arenaOrder;f.g.finishArena('practiceDone',a);assert.deepEqual(f.g.snapshot.community.arenaOrder,before);f.reload();validateSave(f.g.snapshot);
});

test('V07 death persists across waves and restart, prevents a fresh-wave revive, and leaves the permanent body healthy next run',()=>{
  const f=fixture(s=>s.collection['t-1'].skills=['strong']);f.g.beginPrototypeRun('run',0,['t-1']);let r=f.g.snapshot.run;
  const field=()=>Object.values(f.g.snapshot.run.units).filter(u=>u.slot!==null&&!u.removed&&!u.consumedBy);
  const b=createBattle(0,1,field(),{rulesVersion:'0.6',mode:'chapter'});f.g.beginWave('wave',r.id,b);
  // Controlled completed-wave fixture isolates death carry-over; damage and revival are tested with actual enemy attacks above.
  Object.assign(b.units[0],{hp:0,alive:false});Object.assign(b,{tick:20,elapsed:1,status:'won',spawns:[],spawnCursor:0,events:[]});f.g.completeWave('done',r.id,b);f.reload();r=f.g.snapshot.run;assert.equal(field()[0].fallen,true);
  const wrong=createBattle(0,2,field().map(({fallen,...u})=>u),{rulesVersion:'0.6',mode:'chapter'});assert.throws(()=>f.g.beginWave('exploit',r.id,wrong),/倒下/);
  const next=createBattle(0,2,field(),{rulesVersion:'0.6',mode:'chapter'});assert.equal(next.units[0].alive,false);f.g.beginWave('next',r.id,next);f.reload();assert.equal(f.g.snapshot.run.battle.units[0].hp,0);
  f.g.abandonRun('home');assert.equal(f.g.snapshot.collection['t-1'].fallen,undefined);f.g.beginPrototypeRun('new',0,['t-1']);const fresh=createBattle(0,1,field(),{rulesVersion:'0.6'});assert.equal(fresh.units[0].alive,true);
});

test('V07 all friend loans and rentals are rejected by raids and arena entry, attack order and defense configuration',()=>{
 const f=fixture(s=>s.gold=1000),c=f.init(),friend=Object.values(c.aiPlayers)[0],loan=f.g.communityAction('borrow',{kind:'borrow',ownerId:friend.id,petId:friend.assists[0]});const listing=c.listings.find(l=>l.kind==='rental'&&l.ownerId!==friend.id),rental=f.g.communityAction('rent',{kind:'rent',id:listing.id});
 for(const p of [loan,rental]){const ids=[p.id,'t-2','t-3','t-4','t-5'],before=f.g.snapshot;assert.throws(()=>f.g.beginRaid('raid:'+p.id,0,ids),/自有龟/);assert.throws(()=>f.g.beginArena('arena:'+p.id,c.arenaOrder.at(-2),ids),/自有龟/);assert.throws(()=>f.g.communityAction('attack:'+p.id,{kind:'arenaAttack',ids}),/自有龟/);assert.throws(()=>f.g.communityAction('defense:'+p.id,{kind:'arenaDefense',ids}),/自有龟/);assert.deepEqual(f.g.snapshot,before);}
 f.reload();assert.ok(f.g.snapshot.community.loans.every(l=>!l.usedBy&&!l.finished));validateSave(f.g.snapshot);
});

test('V07 extra-target basic adds one full-strength distinct hit and mage splash retains two forty-percent hits',()=>{
  for(const role of ['spike','crystal']){const t=pet(role,['extraTarget']),b=createBattle(0,1,[{id:role,turtle:t,slot:0,level:1}]);b.spawns=Array.from({length:5},()=>({kind:'ink',time:0,hpScale:1000,attackScale:0}));stepBattle(b,.05);getBattleEvents(b);const u=b.units[0];u.nextAttackTick=b.tick+1;
    b.enemies.forEach((e,i)=>Object.assign(e,{x:u.x+i*.1,z:u.z,distance:4+i*.1,speed:0,nextAttackTick:1e9}));stepBattle(b,.05);const hits=getBattleEvents(b).filter(e=>e.type==='damage'&&e.sourceId===u.id);assert.equal(hits.length,role==='spike'?2:4);assert.equal(new Set(hits.map(e=>e.targetId)).size,hits.length);assert.equal(hits.filter(e=>Math.abs(e.amount-u.attack)<1e-7).length,2);if(role==='crystal')assert.equal(hits.filter(e=>Math.abs(e.amount-u.attack*.4)<1e-7).length,2);
  }
});

test('V07 book escrow and rental income disk failure roll back atomically and retry only once',()=>{
  const f=fixture(s=>s.skillBooks={rebirth:2});f.init();const list=f.g.communityAction('list',{kind:'list',asset:'book',id:'rebirth',price:100});assert.equal(f.g.snapshot.skillBooks.rebirth,1);
  const before=f.g.snapshot,write=f.storage.setItem;let fail=true;f.storage.setItem=function(k,v){if(k===SAVE_KEY&&fail){fail=false;throw Error('disk full');}return write.call(this,k,v);};assert.throws(()=>f.g.communityAction('buy',{kind:'aiPurchase',id:list.id}));assert.deepEqual(f.g.snapshot,before);f.reload();f.g.communityAction('buy',{kind:'aiPurchase',id:list.id});f.g.communityAction('buy',{kind:'aiPurchase',id:list.id});assert.equal(f.g.snapshot.gold,before.gold+80);assert.equal(f.g.snapshot.community.receipts.length,1);
  const rental=f.g.communityAction('rentList',{kind:'list',asset:'rental',id:'t-1',price:10});f.g.train('train','t-1','attack');assert.deepEqual(f.g.snapshot.community.listings.find(l=>l.id===rental.id).pet,f.g.snapshot.collection['t-1']);
});

test('V07 arena rejects even a loan from a different owner without consuming the loan',()=>{
 const f=fixture(),c=f.init(),owner=c.arenaOrder.at(-2),source=c.aiPlayers[owner].assists[0];f.g.communityAction('friend',{kind:'friend',id:owner,action:'add'});const loan=f.g.communityAction('borrow',{kind:'borrow',ownerId:owner,petId:source});const before=f.g.snapshot;
 assert.throws(()=>f.g.beginArena('conflict',owner,[loan.id,'t-2','t-3','t-4','t-5']),/仅可用于关卡、无尽/);assert.deepEqual(f.g.snapshot,before);assert.equal(f.g.snapshot.community.loans[0].usedBy,undefined);
});
