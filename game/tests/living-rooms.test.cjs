const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
process.env.GOWAYGUI_ROOM_CORE=path.resolve(__dirname,'../.test-build/core');
const {createLobbyServer}=require('../server/lobby-server.cjs');
const {makeInitialSave}=require('../.test-build/core/game.js'),{enablePrototype}=require('../.test-build/core/prototype.js'),{enableLiving}=require('../.test-build/core/living.js');
function profile(name){const s=makeInitialSave(Date.now(),731);enablePrototype(s);enableLiving(s);return {name,roster:Object.values(s.collection).slice(0,5)};}
test('two real HTTP clients share a persistent room, manual AI, owned commands and exactly one mailed settlement',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gowaygui-room-test-')),dataFile=path.join(dir,'rooms.json');
 let app=createLobbyServer({dataFile,adminToken:'test-admin'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await new Promise(r=>app.server.close(r));for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);});
 let n=0;async function api(route,body,client){const response=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(client?{authorization:'Bearer '+client.token}:{})},body:body?JSON.stringify({requestId:'op-'+(++n),...body}):undefined});return response.json();}
 const a=(await api('register',profile('岛主甲'))).data,b=(await api('register',profile('岛主乙'))).data;
 assert.notEqual(a.id,b.id);assert.notEqual(a.token,b.token);
 assert.equal((await api('state')).ok,false,'unauthenticated requests rejected');
 let r=(await api('create',{tier:0},a)).data;assert.equal(r.members.length,1);const id=r.id;
 const act=(client,action,extra={})=>api('action',{roomId:id,action,...extra},client);
 assert.equal((await act(a,'start')).ok,false,'no invisible AI slots');
 assert.equal((await api('match',{tier:0},b)).data,null,'closed room is not matched');
 assert.equal((await act(a,'invite',{target:b.id})).ok,true);
 const invited=(await api('state',undefined,b)).data;assert.equal(invited.invitations[0].code,r.code);
 r=(await api('join',{code:r.code},b)).data;assert.equal(r.members.length,2);assert.equal(r.members[1].name,'岛主乙');
 assert.equal((await act(b,'kick',{target:a.id})).ok,false,'guest cannot kick host');
 await act(a,'kick',{target:b.id});assert.equal((await api('state',undefined,b)).data.room,null);
 await act(a,'matching',{enabled:true});r=(await api('match',{tier:0},b)).data;assert.equal(r.id,id);
 for(let i=0;i<3;i++)assert.equal((await act(a,'ai')).ok,true);
 assert.equal((await act(a,'ai')).ok,false,'five-member cap');
 await act(a,'ready',{enabled:true});assert.equal((await act(a,'start')).ok,false,'unready human blocks start');await act(b,'ready',{enabled:true});
 r=(await act(a,'start')).data;assert.equal(r.phase,'prep');assert.equal(r.raid.members.length,5);assert.equal(r.members.filter(m=>m.ai).length,3);
 assert.equal((await act(a,'start')).ok,false,'cannot restart a running raid');
 const mine=r.raid.members.find(m=>m.ownerId===a.id),other=r.raid.members.find(m=>m.ownerId===b.id);
 assert.equal((await act(a,'swap',{petId:'not-owned'})).ok,false);assert.equal((await act(a,'swap',{petId:mine.roster[1].originalId})).ok,true);
 assert.equal((await act(b,'next')).ok,false,'only host starts wave');assert.equal((await act(a,'next')).ok,true);
 await new Promise(r=>setTimeout(r,180));const s1=(await api('state',undefined,a)).data,s2=(await api('state',undefined,b)).data;
 assert.equal(s1.room.raid.id,s2.room.raid.id);assert.ok(s1.room.raid.battle.tick>0);assert.ok(Math.abs(s1.room.raid.battle.tick-s2.room.raid.battle.tick)<=3);
 assert.deepEqual(s1.room.raid.battle.units.map(u=>u.id),s2.room.raid.battle.units.map(u=>u.id));
 assert.equal((await act(b,'abandon')).ok,false);assert.equal((await act(a,'leave')).ok,false,'leaving must not silently discard shared combat');
 await act(a,'abandon');const ended=(await api('state',undefined,a)).data;assert.equal(ended.mail.length,1);assert.deepEqual(ended.mail[0].petIds,profile('x').roster.map(t=>t.id));
 const remoteMail=(await api('state',undefined,b)).data.mail[0];assert.notEqual(ended.mail[0].id,remoteMail.id);
 assert.equal((await api('ack',{id:remoteMail.id},a)).ok,false,'cannot acknowledge another player reward');
 const mailed=ended.mail[0];await api('ack',{id:mailed.id},a);assert.equal((await api('state',undefined,a)).data.mail.length,0);
 // Restart real service using persisted room, accounts and delivery receipts.
 await new Promise(r=>app.server.close(r));app=createLobbyServer({dataFile,adminToken:'test-admin'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
 const restored=(await api('state',undefined,b)).data;assert.equal(restored.room.id,id);assert.equal(restored.mail[0].id,remoteMail.id);assert.equal((await api('state',undefined,a)).data.mail.length,0);
 assert.equal((await api('admin/mail',{id:'gift',all:true,title:'测试系统信',body:'附件测试',grants:[{kind:'gold',amount:100}]} ,a)).ok,false);
 for(let i=0;i<2;i++)assert.equal((await api('admin/mail',{id:'gift',all:true,title:'测试系统信',body:'附件测试',grants:[{kind:'gold',amount:100}]},{token:'test-admin'})).ok,true);
 assert.equal((await api('state',undefined,a)).data.mail.filter(m=>m.id.startsWith('system:gift')).length,1,'unique mail ID prevents duplicate grants');
 await act(a,'leave');assert.equal((await api('state',undefined,b)).data.room.host,b.id,'remaining human becomes host');
});

test('successful shared settlement keeps the star chest separate from mailed base rewards',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gowaygui-room-chest-')),app=createLobbyServer({dataFile:path.join(dir,'rooms.json')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 t.after(async()=>{await new Promise(r=>app.server.close(r));for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);});
 let seq=0;async function api(route,body,token){const res=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify({...body,requestId:'chest-'+(++seq)}):undefined});const result=await res.json();assert.equal(result.ok,true,result.error);return result.data;}
 const owner=await api('register',profile('结算测试')),room=await api('create',{tier:0},owner.token),action=(action,fields={})=>api('action',{roomId:room.id,action,...fields},owner.token);
 for(let i=0;i<4;i++)await action('ai');await action('ready',{enabled:true});await action('start');await action('next');
 // Exercise the actual server's final-wave settlement boundary with a deterministic won snapshot.
 const active=app.rooms.get(room.id);active.raid.wave=5;active.raid.phase='between';active.raid.battle=require('../.test-build/core/raids.js').raidBattle(active.raid);active.raid.phase='combat';active.raid.battle.spawns=[];active.raid.battle.spawnCursor=0;active.raid.battle.status='won';
 await new Promise(r=>setTimeout(r,120));const result=await api('state',undefined,owner.token),mail=result.mail[0];
 assert.ok(result.room.raid.settled,active.lastError);assert.ok(mail.chest);assert.ok(mail.chest.stars>=1&&mail.chest.stars<=3);assert.ok(mail.chest.grants.some(g=>g.kind==='bookPack'));assert.deepEqual(mail.grants,result.room.raid.rewards);
});
