const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const core=path.resolve(__dirname,'../.test-build/core');process.env.GOWAYGUI_ROOM_CORE=core;
const {createLobbyServer}=require('../server/lobby-server.cjs'),{makeInitialSave}=require(core+'/game.js'),{enablePrototype}=require(core+'/prototype.js'),{enableLiving}=require(core+'/living.js');
test('world HTTP API authenticates account identity, restores mail only after cloud save, and never accepts reported scores',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-world-http-'));let now=Date.parse('2026-09-15T12:00:00+08:00');const app=createLobbyServer({dataFile:path.join(dir,'rooms.json'),now:()=>now});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await new Promise(r=>app.server.close(r));for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);});let seq=0;
 async function api(route,body,auth,account){const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer '+auth}:{}),...(account?{'x-game-account':account,'x-game-region':'island-1'}:{})},body:JSON.stringify({requestId:'http-'+(++seq),...body})});return r.json();}
 const save=makeInitialSave(now,731);enablePrototype(save);enableLiving(save);const profile={name:'首领测试',roster:Object.values(save.collection).slice(0,5)},guest=(await api('register',profile)).data;
 assert.equal((await api('world-boss/state',{})).ok,false);assert.equal((await api('world-boss/state',{},guest.token,'invalid-token')).ok,false);
 const username='world_'+Date.now(),password='WorldBossLocalTest_0915';assert.equal((await api('account/register',{username,password})).ok,true);const account=(await api('account/login',{username,password})).data.token;
 let result=await api('world-boss/start',{},guest.token,account);assert.equal(result.ok,false);assert.match(result.error,/保存账号/);
 let version=(await api('account/save',{region:'island-1',version:0,save},account)).data.version;
 const active=await api('world-boss/start',{},guest.token,account);assert.equal(active.ok,true,active.error);const id=active.data.fight.id;
 const second=(await api('register',profile)).data,again=await api('world-boss/state',{},second.token,account);assert.equal(again.data.fight.id,id);assert.equal(again.data.attempts,1,'different room tokens retain the account challenge');
 assert.equal((await api('world-boss/score',{fightId:id,damage:9999999},guest.token,account)).ok,false);assert.equal((await api('world-boss/settings',{fightId:id,auto:false},second.token)).ok,false,'guest cannot command account fight');
 now+=90000;const complete=(await api('world-boss/state',{},guest.token,account)).data;assert.equal(complete.fight.phase,'result');assert.ok(complete.best>=2000);assert.equal(complete.ranking.length,1);
 const claim=await api('world-boss/claim',{tier:0},guest.token,account);assert.equal(claim.ok,true);let mails=(await api('state',{},guest.token,account)).data.mail;assert.equal(mails.length,1);const mail=mails[0];assert.equal((await api('ack',{id:mail.id},guest.token,account)).ok,false,'uncommitted account mail remains recoverable');
 const {GameService}=require(core+'/game.js'),{MemoryStorage}=require(core+'/../platform/storage.js'),{SaveRepository}=require(core+'/save.js');const storage=new MemoryStorage(),game=new GameService(new SaveRepository(storage),{now:()=>now},731);game.enablePrototype('proto');game.enableLiving('living');
 const receipt='received:'+mail.id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,144);game.receiveRoomMail(receipt,mail);
 assert.equal((await api('account/save',{region:'island-1',version,save:game.snapshot},account)).ok,true);assert.equal((await api('ack',{id:mail.id},second.token,account)).ok,true);assert.equal((await api('state',{},guest.token,account)).data.mail.length,0);
 now=Date.parse('2026-09-15T22:00:00+08:00');mails=(await api('state',{},second.token,account)).data.mail;assert.equal(mails.length,1);assert.match(mails[0].title,/第 1 名/);assert.equal((await api('world-boss/start',{},guest.token,account)).ok,false);
});
