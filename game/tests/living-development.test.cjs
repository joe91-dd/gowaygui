const test=require('node:test'),assert=require('node:assert/strict');
const core='../.test-build/core/';
const {makeInitialSave,GameService}=require(core+'game.js'),{enablePrototype}=require(core+'prototype.js'),{enableLiving}=require(core+'living.js'),{migrateEconomy,migrateGoldV3,goldAmount}=require(core+'economy.js');
const dev=require(core+'development.js'),{createBattle}=require(core+'battle.js'),{SaveRepository,encodeSave,decodeSave,validateSave,SAVE_KEY}=require(core+'save.js'),mail=require(core+'mail.js'),packs=require(core+'rewardPacks.js'),prog=require(core+'progression.js');
const now=Date.parse('2026-09-14T09:00:00+08:00');
function save(){const s=makeInitialSave(now,731);enablePrototype(s);enableLiving(s);return s;}
function harness(s){const data=new Map([[SAVE_KEY,encodeSave(s)]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};return new GameService(new SaveRepository(storage),{now:()=>now});}
test('permanent XP yields three points per level, cap 50, no duplicate-member XP and no over-allocation',()=>{
 const s=save(),t=Object.values(s.collection)[0];dev.grantExperience(s,[t.id,t.id],dev.levelCost(1));assert.equal(t.development.xp,dev.levelCost(1));assert.deepEqual(dev.levelInfo(t),{level:2,current:0,needed:dev.levelCost(2),available:3});
 const before=dev.petPanel(t);dev.allocatePoints(s,t.id,{attack:3,health:0,defense:0});assert.ok(dev.developmentBonus(t).attack>1.01);assert.equal(dev.levelInfo(t).available,0);assert.throws(()=>dev.allocatePoints(s,t.id,{attack:1,health:0,defense:0}),/不足/);
 assert.throws(()=>dev.allocatePoints(s,t.id,{attack:-1,health:3,defense:0}),/无效/);dev.grantExperience(s,[t.id],1e7);assert.equal(dev.levelInfo(t).level,50);assert.equal(dev.levelInfo(t).available,144);validateSave(s);assert.deepEqual(decodeSave(encodeSave(s)).collection[t.id].development,t.development);
});
test('allocation/reset transactions are idempotent, failed allocations keep currency and allocated points unchanged',()=>{
 const s=save(),t=Object.values(s.collection)[0];dev.grantExperience(s,[t.id],1000);const g=harness(s),initial=g.snapshot.gold;
 g.allocatePetPoints('allocation',t.id,{attack:3,health:3,defense:3});g.allocatePetPoints('allocation',t.id,{attack:3,health:3,defense:3});assert.deepEqual(g.snapshot.collection[t.id].development.points,{attack:3,health:3,defense:3});
 const copy=g.snapshot;assert.throws(()=>g.allocatePetPoints('invalid',t.id,{attack:999,health:0,defense:0}));assert.deepEqual(g.snapshot,copy);
 const cost=dev.resetPointCost(g.snapshot,g.snapshot.collection[t.id]);g.resetPetPoints('reset',t.id);g.resetPetPoints('reset',t.id);assert.equal(g.snapshot.gold,initial-cost);assert.equal(Object.values(g.snapshot.collection[t.id].development.points).reduce((a,b)=>a+b),0);
});
test('living battle ranges match archer/mage and extend warrior, with bonuses visible in actual battle stats',()=>{
 const s=save(),all=Object.values(s.collection),roles=['stone','spike','crystal','leaf','bubble'],units=roles.map((role,i)=>({id:'u'+i,slot:i,level:1,turtle:all.find(t=>t.role===role)}));
 const base=createBattle(0,1,units);assert.equal(base.units[1].range-(base.units[1].skills.includes('reach')?.3:0),base.units[2].range-(base.units[2].skills.includes('reach')?.3:0));assert.ok(base.units[0].range>=2.8);
 const t=units[0].turtle;dev.grantExperience(s,[t.id],1e7);dev.allocatePoints(s,t.id,{attack:49,health:49,defense:49});const enhanced=createBattle(0,1,units);assert.ok(enhanced.units[0].attack>base.units[0].attack);assert.ok(enhanced.units[0].maxHp>base.units[0].maxHp);assert.ok(enhanced.units[0].armor>base.units[0].armor);
});
test('one cultivation material equals one star tick and old trained pets remain readable',()=>{
 const s=save(),t=Object.values(s.collection)[0];s.materials.attack=50;const before=dev.talentTicks(t,'attack'),g=harness(s);g.train('train',t.id,'attack');assert.equal(dev.talentTicks(g.snapshot.collection[t.id],'attack'),before+1);assert.equal(g.snapshot.materials.attack,49);
 t.innate.attack=100;t.training.attack=10;t.innate.growth=110;t.training.growth=5;validateSave(s);assert.doesNotThrow(()=>createBattle(0,1,[{id:'old-trained',slot:0,level:1,turtle:t}]));assert.equal(dev.talentTicks(t,'attack'),50);
});
test('gold migration divides balances, pending grants and both shop types once',()=>{
 const s=makeInitialSave(now,3);enablePrototype(s);migrateEconomy(s);const before=s.gold;
 s.commands.test={kind:'fixture',result:{pool:'pack',cost:220000,grants:[{kind:'gold',amount:7000}],spentGold:310000}};
 migrateGoldV3(s);assert.equal(s.gold,before/10);assert.equal(s.commands.test.result.cost,22000);assert.equal(s.commands.test.result.spentGold,31000);assert.equal(s.commands.test.result.grants[0].amount,700);assert.equal(goldAmount(s,22),2200);const copy=structuredClone(s);migrateGoldV3(s);assert.deepEqual(s,copy);
});
test('room reward recovery and mailbox claims cannot duplicate pet XP, items or gold',()=>{
 const s=save(),g=harness(s),id=Object.keys(s.collection)[0],originalGold=g.snapshot.gold,delivery={id:'room:abc:me',clientId:'me',title:'副本完成',body:'胜利',at:now,xp:100,petIds:[id],grants:[{kind:'gold',amount:120},{kind:'bookPack',grade:'precious',amount:1}]};
 delivery.chest={title:'联机三星宝箱',stars:3,grants:[{kind:'gold',amount:250}]};g.receiveRoomMail('receive',delivery);g.receiveRoomMail('receive',delivery);g.receiveRoomMail('retry',delivery);assert.equal(g.snapshot.collection[id].development.xp,100);assert.equal(g.snapshot.gold,originalGold);g.claimMail('claim',delivery.id);g.claimMail('claim',delivery.id);assert.equal(g.snapshot.gold,originalGold+120);assert.equal(g.snapshot.bookPacks.precious,1);
 g.claimMail('different',delivery.id);assert.equal(g.snapshot.gold,originalGold+120);const skill=g.openBookPack('pack','precious');assert.ok(packs.packPool('precious').includes(skill));assert.equal(g.snapshot.bookPacks.precious,0);assert.ok(g.snapshot.skillBooks[skill]>0);assert.equal(g.snapshot.progression.chests.filter(c=>c.id==='raid:'+delivery.id).length,1);g.claimChest('room-chest','raid:'+delivery.id);g.claimChest('room-chest','raid:'+delivery.id);assert.equal(g.snapshot.gold,originalGold+370);validateSave(g.snapshot);
});
test('weekly arena mail is issued once at Sunday 22:00 and next week resets rating',()=>{
 const s=save(),p=prog.progression(s);p.arena.games=3;p.arena.rating=850;const cut=prog.arenaSettlementAt(now);prog.syncProgression(s,cut-1);assert.equal(s.mailbox.items.filter(m=>m.source==='arena').length,0);prog.syncProgression(s,cut);prog.syncProgression(s,cut+1);assert.equal(s.mailbox.items.filter(m=>m.source==='arena').length,1);assert.ok(prog.arenaLocked(cut));prog.syncProgression(s,cut+2*3600000);assert.equal(p.arena.rating,0);assert.equal(s.mailbox.items.filter(m=>m.source==='arena').length,1);
});
