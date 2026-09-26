const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {SaveRepository,SAVE_KEY,encodeSave}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {SHOP_PACKS,packRemaining,packBookOdds,ATTACK_BOOKS,purchaseShopPack}=require('../.test-build/core/shop.js');
const {SKILLS,skillsForRole}=require('../.test-build/core/data.js');
const NOW=Date.UTC(2026,8,9,15,59,0),clone=x=>JSON.parse(JSON.stringify(x));
function fixture(edit=()=>{}){const s=makeInitialSave(NOW,1327);s.gold=1000000;edit(s);const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(s));let now=NOW;const clock={now:()=>now};let game=new GameService(new SaveRepository(storage),clock);game.enablePrototype('proto');game.enableIncrement('inc');return {storage,get game(){return game;},time(value){now=value;},reload(){game=new GameService(new SaveRepository(storage),clock);}};}
test('all six gold packages credit their exact contents, persist reveal, and leave recruitment guarantees alone',()=>{
 const f=fixture();for(const config of SHOP_PACKS){const before=f.game.snapshot,r=f.game.purchaseShopPack(config.id,config.id),after=f.game.snapshot;
  assert.equal(before.gold-after.gold,config.price*1000);assert.equal(packRemaining(after,NOW,config.id),19);assert.equal(after.shop.turtleCount,0);assert.equal(after.shop.bookCount,0);
  if(config.id.startsWith('turtle')){assert.equal(Object.keys(after.collection).length,Object.keys(before.collection).length+1);const t=r.draws[0].turtle;assert.ok(t.skills.every(id=>skillsForRole(t.role).includes(id)));assert.ok(config.id==='turtleBasic'?t.skills.length>=1&&t.skills.length<=4:t.skills.length===4||t.skills.length===5);}
  if(config.id==='bookAttack')assert.ok(ATTACK_BOOKS.includes(r.draws[0].skillId));
  if(config.id.startsWith('material')){assert.equal(r.draws.reduce((sum,d)=>sum+d.amount,0),config.id==='materialFixed'?32:20);for(const d of r.draws)assert.equal(after.materials[d.material]-before.materials[d.material],d.amount);if(config.id==='materialFixed')assert.ok(r.draws.every(d=>d.amount===8));}
  assert.deepEqual(f.game.purchaseShopPack(config.id,config.id),r);assert.deepEqual(f.game.snapshot,after);f.reload();assert.deepEqual(f.game.snapshot.shop.pending,r);f.game.finishShopReveal('close:'+config.id);
 }
});
test('twenty per product is independent, persists restart, resets at China midnight and resists backward clock',()=>{
 const f=fixture();for(let i=0;i<20;i++){f.game.purchaseShopPack('buy:'+i,'bookRandom');f.game.finishShopReveal('close:'+i);}f.reload();const before=f.game.snapshot;
 assert.equal(packRemaining(before,NOW,'bookRandom'),0);assert.equal(packRemaining(before,NOW,'bookAttack'),20);assert.throws(()=>f.game.purchaseShopPack('over','bookRandom'),/20次/);assert.deepEqual(f.game.snapshot,before);
 f.time(NOW+120000);f.game.purchaseShopPack('new-day','bookRandom');assert.equal(packRemaining(f.game.snapshot,NOW+120000,'bookRandom'),19);f.game.finishShopReveal('new-close');f.time(NOW);f.game.purchaseShopPack('clock-back','bookRandom');assert.equal(f.game.snapshot.shop.daily.counts.bookRandom,2);
});
test('packages roll back money, RNG, daily stock and inventory on failed storage or insufficient capacity',()=>{
 const f=fixture(),before=f.game.snapshot,set=f.storage.setItem.bind(f.storage);f.storage.setItem=(k,v)=>{if(k===SAVE_KEY)throw new Error('disk full');set(k,v);};assert.throws(()=>f.game.purchaseShopPack('write','materialRandom'));assert.deepEqual(f.game.snapshot,before);f.storage.setItem=set;
 const receipt=f.game.purchaseShopPack('write','materialRandom'),control=fixture().game.purchaseShopPack('write','materialRandom');assert.deepEqual(receipt,control);
 const low=fixture(s=>s.gold=0),lowBefore=low.game.snapshot;assert.throws(()=>low.game.purchaseShopPack('no-gold','bookRandom'));assert.deepEqual(low.game.snapshot,lowBefore);
 const full=fixture(s=>{const t=Object.values(s.collection)[0];for(let i=5;i<50;i++)s.collection['cap-'+i]={...t,id:'cap-'+i};}),fullBefore=full.game.snapshot;assert.throws(()=>full.game.purchaseShopPack('full','turtleAdvanced'));assert.deepEqual(full.game.snapshot,fullBefore);
});
test('published book probabilities normalize and cover exactly the advertised eligible pool',()=>{
 const all=packBookOdds('bookRandom'),attack=packBookOdds('bookAttack');assert.equal(all.length,SKILLS.length);for(const rows of [all,attack])assert.ok(Math.abs(rows.reduce((sum,r)=>sum+r.chance,0)-1)<1e-12);
 assert.deepEqual(new Set(attack.map(r=>r.skillId)),new Set(ATTACK_BOOKS));assert.equal(attack.find(r=>r.skillId==='piercingShot').chance,.01);assert.equal(attack.find(r=>r.skillId==='crystalCannon').chance,.01);
});
test('seeded package sampling matches the advertised skill-count odds and never creates six-skill shortcuts',()=>{
 const s=makeInitialSave(NOW,813);s.capacity=50;s.economyVersion=2;const template=clone(Object.values(s.collection)[0]),counts={};
 for(const pack of ['turtleBasic','turtleAdvanced']){if(s.shop)delete s.shop.daily;const sample={};for(let i=0;i<3000;i++){s.gold=1e12;s.collection={};if(s.shop)delete s.shop.pending;const r=purchaseShopPack(s,NOW+Math.floor(i/20)*86400000,'sample',pack,(state,now)=>({...clone(template),id:'sample-'+(++state.idCounter),createdAt:now}));const n=r.draws[0].turtle.skills.length;sample[n]=(sample[n]??0)+1;}counts[pack]=sample;}
 [54,30,13,3].forEach((percent,i)=>assert.ok(Math.abs((counts.turtleBasic[i+1]??0)/30-percent)<3));assert.ok(Math.abs(counts.turtleAdvanced[5]/30-10)<3);assert.deepEqual(Object.keys(counts.turtleAdvanced).sort(),['4','5']);
});
