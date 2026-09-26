const test=require('node:test'),assert=require('node:assert/strict');
const {makeInitialSave,GameService}=require('../.test-build/core/game.js');
const {SaveRepository,encodeSave,decodeSave,SAVE_KEY}=require('../.test-build/core/save.js');
const {MemoryStorage}=require('../.test-build/platform/storage.js');
const P=require('../.test-build/core/progression.js');
const {createBattle,stepBattle}=require('../.test-build/core/battle.js');
const {validateBattle}=require('../.test-build/core/battleValidation.js');
const {startRaid,raidBattle,raidMapId}=require('../.test-build/core/raids.js');
const {matchArena}=require('../.test-build/core/arena.js');
const at=s=>Date.parse(s+'+08:00'),NOW=at('2026-09-14T12:00:00');
function fixture(){const s=makeInitialSave(NOW,72);P.syncProgression(s,NOW);return s;}
test('codex rewards require actual discovery, survive reload, and cannot be claimed twice',()=>{
 const s=fixture(),id=s.progression.skills[0],before=s.gold;assert.ok(P.claimCodex(s,'skill',id)>0);assert.ok(s.gold>before);
 const copy=decodeSave(encodeSave(s));assert.throws(()=>P.claimCodex(copy,'skill',id));assert.throws(()=>P.claimCodex(copy,'boss','tide-emperor'));
});
test('chest grants are atomic and idempotent through the real service transaction',()=>{
 const s=fixture();P.grantChest(s,'proof','测试宝箱',3,[{kind:'gold',amount:300},{kind:'book',skillId:'scatter',amount:1}]);
 const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(s));const game=new GameService(new SaveRepository(storage),{now:()=>NOW});
 game.claimChest('claim:proof','proof');const after=game.snapshot;game.claimChest('claim:proof','proof');assert.deepEqual(game.snapshot,after);
 assert.equal(after.gold,s.gold+300);assert.equal(after.skillBooks.scatter,(s.skillBooks?.scatter??0)+1);assert.throws(()=>game.claimChest('duplicate','proof'));
});
test('22:00 daily and Sunday seasonal rewards are once-only; Monday resets tiers and unlocks matches',()=>{
 const s=makeInitialSave(at('2026-09-20T21:59:00'),31);P.syncProgression(s,s.clockHighWater);P.recordArena(s,true,false);s.progression.arena.rating=560;s.progression.arena.best=560;
 const sunday=at('2026-09-20T22:00:00');P.syncProgression(s,sunday);assert.equal(P.arenaLocked(sunday),true);assert.equal(s.progression.chests.length,2);assert.ok(s.progression.arena.weeklySettled);
 P.syncProgression(s,sunday+60000);assert.equal(s.progression.chests.length,2);
 const monday=at('2026-09-21T00:00:00');P.syncProgression(s,monday);assert.equal(P.arenaLocked(monday),false);assert.equal(s.progression.arena.rating,0);assert.equal(s.progression.chests.length,2);
});
test('offline Sunday settlement is recovered before resetting the old tier',()=>{
 const s=makeInitialSave(at('2026-09-19T19:00:00'),31);P.syncProgression(s,s.clockHighWater);P.recordArena(s,true,false);s.progression.arena.rating=900;s.progression.arena.best=900;
 P.syncProgression(s,at('2026-09-21T08:00:00'));assert.ok(s.progression.chests.some(c=>c.title==='赛季结算 · 钻石'));assert.equal(s.progression.arena.rating,0);
});
test('difficulty-three extra map uses a connected loop and continuous timed waves',()=>{
 const s=fixture();const r=startRaid(s,NOW,3,Object.keys(s.collection).slice(0,5)),b=raidBattle(r);
 assert.equal(raidMapId(3),55);assert.equal(b.spawns.length,240);assert.equal(b.spawns[239].time,239*(.58/.82));assert.deepEqual(b.route[0],b.route.at(-1));
 assert.ok(b.spawns.at(-1).hpScale>b.spawns[0].hpScale);validateBattle(b);
});
test('timed raid lasts 180 seconds even with no live targets, and leftover threshold governs result',()=>{
 const b=createBattle(55,1,[],{rulesVersion:'0.6',mode:'endless'});b.spawns=[];stepBattle(b,179);assert.equal(b.status,'fighting');stepBattle(b,1);assert.equal(b.status,'won');validateBattle(b);
 const crowded=createBattle(55,1,[],{rulesVersion:'0.6',mode:'endless'});crowded.spawns=Array.from({length:16},()=>({kind:'ink',time:0,hpScale:1,attackScale:1}));stepBattle(crowded,180);assert.equal(crowded.status,'lost');assert.equal(crowded.coreHealth,20);assert.equal(crowded.leaked,0);validateBattle(crowded);
});
test('boss discovery counts kills but not escapes, and records different enemies by actual boss identity',()=>{
 const s=fixture();P.discoverBattle(s,{enemies:[{bossId:'reef-pirate',alive:false,hp:1},{bossId:'ink-oracle',alive:false,hp:0}]});assert.deepEqual(s.progression.bosses,['ink-oracle']);
});

test('offline catch-up never assigns old-season play to a later inactive week',()=>{
 const s=makeInitialSave(at('2026-09-19T19:00:00'),31);P.syncProgression(s,s.clockHighWater);P.recordArena(s,true,false);
 P.syncProgression(s,at('2026-10-05T08:00:00'));const daily=s.progression.chests.filter(c=>c.id.startsWith('arena-day:'));assert.equal(daily.length,1);assert.equal(daily[0].at,at('2026-09-20T22:00:00'));
});
