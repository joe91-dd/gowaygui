const test=require('node:test'),assert=require('node:assert/strict');
const {GameService,makeInitialSave}=require('../.test-build/core/game.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const {SaveRepository,encodeSave,SAVE_KEY}=require('../.test-build/core/save.js');
const {shopPrice,ATTACK_BOOKS}=require('../.test-build/core/shop.js');
const {SKILL_BY_ID}=require('../.test-build/core/data.js');
const NOW=1788948000000;
function setup(edit=()=>{}){const s=makeInitialSave(NOW,8142);s.gold=100000;edit(s);const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(s));const g=new GameService(new SaveRepository(storage),{now:()=>NOW});g.enablePrototype('enable-prototype');g.enableIncrement('increment');return {g,storage};}
test('gold denomination migration is idempotent and preserves costs, AI wallets and pending grants',()=>{
 const {g,storage}=setup();assert.equal(g.snapshot.gold,100000000);assert.equal(shopPrice(g.snapshot,'turtle',10),720000);
 g.communityAction('init',{kind:'init'});assert.equal(Object.values(g.snapshot.community.aiPlayers)[0].gold,3000000);
 const before=g.snapshot;g.enableIncrement('again');assert.deepEqual(g.snapshot,before);
 const again=new GameService(new SaveRepository(storage),{now:()=>NOW});again.enableIncrement('reload');assert.deepEqual(again.snapshot,before);
 const t=Object.values(g.snapshot.collection).find(t=>t.innate.attack<100);const cost=100000;g.train('train',t.id,'attack');assert.equal(before.gold-g.snapshot.gold,cost);
});
test('turtle single and ten draws share hundred counter, guarantee four and fixed six, and retry once',()=>{
 const {g,storage}=setup(s=>s.shop={turtleCount:89,bookCount:0});
 const ten=g.purchaseShop('ten','turtle',10);assert.ok(ten.draws.some(d=>d.turtle.skills.length>=4));assert.equal(g.snapshot.shop.turtleCount,99);
 const state=g.snapshot;assert.deepEqual(g.purchaseShop('ten','turtle',10),ten);assert.deepEqual(g.snapshot,state);
 const reload=new GameService(new SaveRepository(storage),{now:()=>NOW});assert.deepEqual(reload.snapshot.shop.pending,ten);reload.finishShopReveal('seen');
 const hundred=reload.purchaseShop('one','turtle',1);assert.equal(hundred.draws[0].turtle.skills.length,6);assert.equal(hundred.draws[0].guarantee,'hundred');assert.equal(reload.snapshot.shop.bookCount,0);
});
test('book ten draw and hundred guarantees coexist with independent persisted counters',()=>{
 for(const count of [90,95,99]){const {g}=setup(s=>s.shop={turtleCount:47,bookCount:count}),receipt=g.purchaseShop('book','book',10);
 assert.ok(receipt.draws.some(d=>ATTACK_BOOKS.includes(d.skillId)));const special=receipt.draws.find(d=>d.guarantee==='hundred');assert.ok(special&&SKILL_BY_ID[special.skillId].active);
 assert.equal(g.snapshot.shop.turtleCount,47);assert.equal(g.snapshot.shop.bookCount,count+10);
 assert.equal(receipt.cost,315000);assert.equal(Object.values(g.snapshot.skillBooks).reduce((a,b)=>a+b,0),10);}
});
test('insufficient coins, full collection and failed commit never move RNG, guarantees, money or items',()=>{
 const {g,storage}=setup();const before=g.snapshot;const set=storage.setItem.bind(storage);storage.setItem=(k,v)=>{if(k===SAVE_KEY)throw new Error('disk full');set(k,v);};
 assert.throws(()=>g.purchaseShop('failed','book',10));assert.deepEqual(g.snapshot,before);storage.setItem=set;
 const receipt=g.purchaseShop('failed','book',10);assert.equal(g.snapshot.shop.bookCount,10);assert.deepEqual(g.purchaseShop('failed','book',10),receipt);
 const low=setup(s=>s.gold=0).g,lowBefore=low.snapshot;assert.throws(()=>low.purchaseShop('low','turtle',1));assert.deepEqual(low.snapshot,lowBefore);
 const full=setup(s=>{const t=Object.values(s.collection)[0];for(let i=5;i<50;i++){const id='full-'+i;s.collection[id]={...t,id};}}).g,fullBefore=full.snapshot;assert.throws(()=>full.purchaseShop('full','turtle',1));assert.deepEqual(full.snapshot,fullBefore);
});
test('rename counts CJK and ASCII widths while leaving talents untouched',()=>{
 const {g}=setup(),t=Object.values(g.snapshot.collection)[0];g.rename('name',t.id,'龟龟ABCDEF');assert.equal(g.snapshot.collection[t.id].name,'龟龟ABCDEF');assert.deepEqual(g.snapshot.collection[t.id].innate,t.innate);assert.throws(()=>g.rename('long',t.id,'一二三四五六七'));
});
test('legacy rounded taxes and high listings migrate without changing historical purchasing power',()=>{
 const {initCommunity}=require('../.test-build/core/community.js');const {g}=setup(s=>{
   initCommunity(s,NOW);const owner=Object.keys(s.community.aiPlayers)[0];s.community.listings[0].price=100000000;
   s.community.receipts.push({id:'rounding',kind:'buy',listingId:'old',gross:7,tax:2,net:5,at:NOW,otherId:owner});
   s.commands['old-double']={kind:'ad:doubleGold',result:7};
 });
 const r=g.snapshot.community.receipts[0];assert.deepEqual([r.gross,r.tax,r.net,r.taxDenomination],[7000,2000,5000,1000]);
 assert.equal(g.snapshot.community.listings[0].price,100000000000);assert.equal(g.snapshot.commands['old-double'].result,7000);
});
