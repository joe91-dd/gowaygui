const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave}=require('../.test-build/core/game.js');const {initCommunity}=require('../.test-build/core/community.js');
const {filterMarket}=require('../.test-build/core/marketView.js');const {rewardBoard,stageRewards}=require('../.test-build/core/prototypeConfig.js');
const {startRaid,beginRaidWave,stepRaid,finishRaid,RAIDS}=require('../.test-build/core/raids.js');
const NOW=1788948000000;
test('market filters compose category, search, rental appearance and both price orders without mutation',()=>{
 const s=makeInitialSave(NOW,1337);initCommunity(s,NOW);const before=JSON.stringify(s.community.listings),f={kind:'trade',ownerId:'local-player',mine:false,asset:'book',role:'all',search:'',sort:'asc'};
 let rows=filterMarket(s.community.listings,f);assert.ok(rows.length>1);assert.ok(rows.every(l=>l.kind==='book'));assert.ok(rows.every((l,i)=>!i||l.price>=rows[i-1].price));
 rows=filterMarket(s.community.listings,{...f,sort:'desc'});assert.ok(rows.every((l,i)=>!i||l.price<=rows[i-1].price));
 rows=filterMarket(s.community.listings,{...f,kind:'rental',role:'stone',search:'石头',sort:'desc'});assert.ok(rows.length);assert.ok(rows.every(l=>l.kind==='rental'&&l.pet.role==='stone'));assert.equal(JSON.stringify(s.community.listings),before);
});
test('current endless boards keep five fixed slots while lowering food frequency and increasing ordinary books',()=>{
 const s={rng:137};let food=0,book=0;for(let i=0;i<2000;i++){const board=rewardBoard(s,10,true);assert.equal(board.length,5);assert.equal(board.filter(g=>g.kind==='gold').length,2);food+=board.filter(g=>g.kind==='material').length;book+=board.filter(g=>g.kind==='book').length;}
 assert.ok(food>2500&&food<2900);assert.ok(book>3100&&book<3500);
 const stages=[10,20,30].flatMap(wave=>stageRewards(s,wave,true));assert.equal(stages.filter(g=>g.kind==='material').length,2);assert.equal(stages.filter(g=>g.kind==='book').length,3);
});
test('failed raids pay only a small completed-wave progress reward, with zero for no progress',()=>{
 const s=makeInitialSave(NOW,137);initCommunity(s,NOW);startRaid(s,NOW,0,Object.keys(s.collection));const empty=finishRaid(s,s.community.raid,true);assert.deepEqual(empty.rewards,[]);
 startRaid(s,NOW,0,Object.keys(s.collection));beginRaidWave(s);const r=s.community.raid;r.battle.autoSkills=true;while(r.battle.status==='fighting')stepRaid(r,.5);assert.equal(r.battle.status,'won');finishRaid(s,r);
 const before=s.gold,result=finishRaid(s,s.community.raid,true);assert.ok(result.rewards.length===1&&result.rewards[0].kind==='gold');assert.ok(s.gold>before&&s.gold-before<RAIDS[0].gold*.08);assert.throws(()=>finishRaid(s,result,true),/已结算/);
});
