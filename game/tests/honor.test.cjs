const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const core=path.resolve(__dirname,'../.test-build/core'),{makeInitialSave}=require(core+'/game'),{enablePrototype}=require(core+'/prototype'),{enableLiving}=require(core+'/living');
const {initCommunity,dispatchCommunity,petRanking}=require(core+'/community'),{showcasePets}=require(core+'/honor');
const at=Date.parse('2026-09-17T12:00:00+08:00');
function save(){const s=makeInitialSave(at,731);enablePrototype(s);enableLiving(s);initCommunity(s,at);return s;}
test('showcase rotation is saved independently of scores and attack/defense rosters',()=>{
 const s=save(),pets=Object.values(s.collection),order=petRanking(s).map(r=>r.turtle.id),attack=[...s.community.arenaAttack],defense=[...s.community.arenaDefense];
 dispatchCommunity(s,at,{kind:'showcase',ids:[pets[3].id,pets[1].id],rotate:true});
 assert.deepEqual(showcasePets(s).map(t=>t.id),[pets[3].id,pets[1].id]);assert.deepEqual(petRanking(s).map(r=>r.turtle.id),order);assert.deepEqual(s.community.arenaAttack,attack);assert.deepEqual(s.community.arenaDefense,defense);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(restored.community.showcase.rotate,true);assert.equal(showcasePets(restored)[0].id,pets[3].id);
});
test('cannot showcase borrowed, hidden, duplicate or more than five pets; removed pet falls back safely',()=>{
 const s=save(),pets=Object.values(s.collection),id=pets[0].id;
 for(const ids of [[],[id,id],['unknown'],Array(6).fill(id)])assert.throws(()=>dispatchCommunity(s,at,{kind:'showcase',ids,rotate:true}));
 dispatchCommunity(s,at,{kind:'rankVisibility',petId:id,hidden:true});assert.throws(()=>dispatchCommunity(s,at,{kind:'showcase',ids:[id],rotate:true}));
 dispatchCommunity(s,at,{kind:'showcase',ids:[pets[1].id],rotate:false});delete s.collection[pets[1].id];assert.ok(showcasePets(s).every(t=>!!s.collection[t.id]&&!s.community.hiddenPets.includes(t.id)));
});
test('world showcase persists across service restart without changing attempts or best damage',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-honor-')),file=path.join(dir,'world.json'),s=save();
 t.after(()=>{const resolved=path.resolve(dir);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(resolved,{recursive:true,force:true});});
 const {createWorldBossService}=require('../server/world-boss-service.cjs'),client={id:'a',name:'甲',region:'island-1',roster:Object.values(s.collection).slice(0,5)};
 let clock=at,service=createWorldBossService({core,file,now:()=>clock});service.handle('start',client,{requestId:'start'});clock+=90000;const before=service.handle('state',client,{});
 const pet=client.roster[2],result=service.handle('showcase',client,{requestId:'display',pets:[pet],rotate:true});assert.equal(result.best,before.best);assert.equal(result.attempts,1);assert.equal(result.ranking[0].showcase[0].id,pet.id);assert.equal(result.ranking[0].own,true);
 const second={...client,id:'b'};assert.equal(service.handle('state',second,{}).ranking[0].own,false);
 service=createWorldBossService({core,file,now:()=>clock});assert.equal(service.handle('state',client,{}).ranking[0].showcase[0].id,pet.id);
 assert.throws(()=>service.handle('showcase',client,{requestId:'bad',pets:[{id:'invalid'}]}));
});
