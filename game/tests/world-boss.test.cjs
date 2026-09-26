const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const core=path.resolve(__dirname,'../.test-build/core');
const {WORLD_BOSSES,WORLD_DAMAGE_TIERS,worldBossDay,createWorldBossFight,stepWorldBoss,worldBossAction}=require(core+'/worldBoss.js');
const {makeInitialSave}=require(core+'/game.js'),{enablePrototype}=require(core+'/prototype.js'),{enableLiving}=require(core+'/living.js');
const {createWorldBossService}=require('../server/world-boss-service.cjs');
const at=Date.parse('2026-09-15T12:00:00+08:00');
function roster(){const s=makeInitialSave(at,731);enablePrototype(s);enableLiving(s);return Object.values(s.collection).slice(0,5);}
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-world-test-')),file=path.join(dir,'world.json');let time=at;const client={id:'islander-a',name:'测试甲',region:'island-1',roster:roster()};let service=createWorldBossService({core,file,now:()=>time}),n=0;
 t.after(()=>{fs.rmSync(dir,{recursive:true,force:true});});return {client,get service(){return service;},call:(action,body={},owner=client)=>service.handle(action,owner,{requestId:'op-'+(++n),...body}),setTime:n=>time=n,advance:n=>time+=n,restart:()=>{service.persist();service=createWorldBossService({core,file,now:()=>time});}};}
test('four approved bosses rotate by Beijing date; 90-second final entry ends exactly at 22:00',()=>{
 assert.equal(WORLD_BOSSES.length,4);assert.equal(new Set(WORLD_BOSSES.map(b=>b.art)).size,4);assert.equal(new Set(Array.from({length:4},(_,i)=>worldBossDay(at+i*86400000).bossIndex)).size,4);
 assert.equal(worldBossDay(Date.parse('2026-09-15T23:59:59+08:00')).key,'2026-09-15');assert.equal(worldBossDay(Date.parse('2026-09-16T00:00:00+08:00')).key,'2026-09-16');
 assert.equal(worldBossDay(Date.parse('2026-09-15T21:58:30+08:00')).canStart,true);assert.equal(worldBossDay(Date.parse('2026-09-15T21:58:30.001+08:00')).canStart,false);assert.equal(worldBossDay(Date.parse('2026-09-15T22:00:00+08:00')).canStart,false);
 assert.equal(WORLD_DAMAGE_TIERS.length,10);assert.ok(WORLD_DAMAGE_TIERS.every((n,i)=>Number.isFinite(n)&&n>(WORLD_DAMAGE_TIERS[i-1]??0)));
});
test('each world boss lasts 90 seconds, marches left to right and scores actual hits',()=>{
 for(let i=0;i<4;i++){const f=createWorldBossFight('fight','day',i,roster(),at);assert.equal(f.battle.enemies.length,1);assert.equal(f.battle.enemies[0].x,-5.8);assert.ok(f.battle.units.every(u=>Math.abs(u.z-f.battle.route[0].z)>.76));stepWorldBoss(f,45);assert.ok(Math.abs(f.battle.enemies[0].x)<.01);assert.ok(f.damage>0);stepWorldBoss(f,45);assert.equal(f.phase,'result');assert.equal(f.battle.elapsed,90);assert.ok(Math.abs(f.battle.enemies[0].x-5.79)<.001);assert.ok(f.damage>=WORLD_DAMAGE_TIERS[0]);assert.ok(f.battle.enemies[0].alive);}
});
test('different client frame chunks cannot alter damage or clock',()=>{
 const a=createWorldBossFight('x','day',0,roster(),at),b=structuredClone(a);stepWorldBoss(a,90);for(let i=0;i<5400;i++)stepWorldBoss(b,1/60);assert.equal(b.battle.tick,a.battle.tick);assert.ok(Math.abs(a.damage-b.damage)<.1,`${a.damage} vs ${b.damage}`);
});
test('server polling does not accumulate fractional time; server owns score, daily tries and highest value',t=>{
 const f=fixture(t);assert.equal(f.call('state').ranking.length,0);let v=f.call('start',{requestId:'one'}),id=v.fight.id;assert.equal(v.attempts,1);assert.equal(f.call('start',{requestId:'one'}).attempts,1);assert.throws(()=>f.call('start'),/已有挑战/);
 f.advance(25);for(let i=0;i<10;i++)v=f.call('state');assert.equal(v.fight.battle.tick,0);f.advance(25);assert.equal(f.call('state').fight.battle.tick,1);
 assert.throws(()=>f.call('score',{fightId:id,damage:999999999}),/不支持/);f.advance(89950);v=f.call('state');assert.equal(v.fight.phase,'result');const high=v.best;assert.ok(high>0);assert.equal(v.ranking.length,1);assert.equal(v.rank,1);
 for(let i=0;i<2;i++){v=f.call('start');f.call('settings',{fightId:v.fight.id,auto:false,held:[]});f.advance(90000);v=f.call('state');assert.ok(v.best>=high);}
 assert.equal(v.attempts,3);assert.throws(()=>f.call('start'),/3 次/);f.restart();assert.equal(f.call('state').attempts,3);assert.ok(f.call('state').best>=high);
});
test('milestone mail is deduplicated, only owner can acknowledge, and restart preserves claims',t=>{
 const f=fixture(t);assert.throws(()=>f.call('claim',{tier:0}),/尚未达标/);f.call('start');f.advance(90000);f.call('state');f.call('claim',{tier:0});f.call('claim',{tier:0});assert.equal(f.service.pending(f.client).length,1);const m=f.service.pending(f.client)[0];assert.ok(m.grants.length>=2);assert.throws(()=>f.service.ack({...f.client,id:'b'},m.id),/不存在/);f.service.ack(f.client,m.id);f.restart();assert.deepEqual(f.call('state').claimed,[0]);assert.equal(f.service.pending(f.client).length,0);assert.throws(()=>f.call('claim',{tier:10}),/档位无效/);
});
test('22:00 automatically mails unique ranking rewards; restart catches up and next day resets',t=>{
 const f=fixture(t),b={...f.client,id:'islander-b',name:'测试乙'};f.call('start');f.call('start',{},b);f.advance(90000);f.call('state');f.restart();f.setTime(Date.parse('2026-09-15T22:00:00+08:00'));f.service.tick();f.service.tick();const aMail=f.service.pending(f.client),bMail=f.service.pending(b);assert.equal(aMail.length,1);assert.equal(bMail.length,1);assert.match(aMail[0].title,/第 1 名/);assert.match(bMail[0].title,/第 2 名/);f.restart();assert.equal(f.service.pending(f.client).length,1);f.setTime(Date.parse('2026-09-16T00:00:00+08:00'));const next=f.call('state');assert.equal(next.attempts,0);assert.equal(next.best,0);assert.equal(next.rank,undefined);assert.equal(next.ranking.length,0);assert.equal(next.claimed.length,0);assert.equal(f.service.pending(f.client).length,1);
});
test('unconnected challenges finish on the server and ranks are separated by region',t=>{
 const f=fixture(t);f.call('start');f.restart();f.advance(95000);const v=f.call('state');assert.equal(v.fight.phase,'result');assert.equal(v.fight.battle.tick,1800);const r=f.call('state',{}, {...f.client,id:'islander-a:island-2',region:'island-2'});assert.equal(r.best,0);assert.equal(r.ranking.length,0);
});
test('occupied ally drop swaps positions; path drops and foreign commands are rejected',()=>{
 const f=createWorldBossFight('x','day',0,roster(),at),[a,b]=f.battle.units,old={...a.placement},target={...b.placement};worldBossAction(f,'move',{unitId:a.id,point:target});assert.deepEqual(a.placement,target);assert.deepEqual(b.placement,old);assert.throws(()=>worldBossAction(f,'move',{unitId:a.id,point:old}),/调位冷却/);assert.throws(()=>worldBossAction(f,'move',{unitId:' чужой',point:old}),/不存在/);assert.throws(()=>worldBossAction(f,'move',{unitId:f.battle.units[2].id,point:{x:0,z:f.battle.route[0].z}}),/通行路线/);
});
test('removed fifth world identity migrates without losing attempts, damage or ranking mail',t=>{
 const f=fixture(t),v=f.call('start'),id=v.fight.id;
 const saved=f.service.data.fights[id],board=f.service.data.days[saved.board];
 saved.bossIndex=4;saved.battle.enemies[0].worldBossIndex=4;board.bossIndex=4;
 f.call('settings',{fightId:id,auto:true,held:[]});f.restart();
 const restored=f.call('state');assert.equal(restored.attempts,1);assert.equal(restored.bossIndex,0);
 assert.equal(restored.fight.bossIndex,0);assert.equal(restored.fight.battle.enemies[0].worldBossIndex,0);
 f.advance(90000);assert.ok(f.call('state').best>0);
 f.setTime(Date.parse('2026-09-15T22:00:00+08:00'));f.service.tick();
 assert.equal(f.service.pending(f.client).length,1);assert.match(f.service.pending(f.client)[0].body,/破浪鲨君/);
});
