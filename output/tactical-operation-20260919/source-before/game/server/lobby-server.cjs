'use strict';
// Authoritative local/LAN companion service. No human slot is filled without an explicit join.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const core=process.env.GOWAYGUI_ROOM_CORE||path.resolve(__dirname,'../.server-build/core');
const {makeInitialSave}=require(core+'/game.js'),{enablePrototype}=require(core+'/prototype.js'),{enableLiving}=require(core+'/living.js');
const {validateTurtle}=require(core+'/save.js'),{initCommunity}=require(core+'/community.js');
const {startRaid,raidBattle,stepRaid,finishRaid,swapRaidPet,moveRaidStation,swapRaidPositions,RAIDS}=require(core+'/raids.js');
const {initDevelopment}=require(core+'/development.js');
const {commandBattle}=require(core+'/battle.js'),{validReward}=require(core+'/rewardPacks.js');
const clone=x=>structuredClone(x),uid=()=>crypto.randomUUID(),check=(v,msg)=>{if(!v)throw Error(msg);};
const label=(v,n=16)=>String(v??'').trim().replace(/[\x00-\x1f<>]/g,'').slice(0,n);
function createLobbyServer(options={}){
 const accountService=require('./account-service.cjs').createAccountService({core,file:(options.dataFile??path.join(__dirname,'data/rooms.json'))+'.accounts.json',adURL:process.env.REWARDED_AD_URL,adSecret:process.env.REWARDED_AD_SECRET,support:process.env.GAME_SUPPORT});
 const root=path.resolve(options.root??path.join(__dirname,'../build/living-expedition')),dataFile=options.dataFile??path.join(__dirname,'data/rooms.json'),clients=new Map(),rooms=new Map(),receipts=new Map();let dirty=false;
 const worldBoss=require('./world-boss-service.cjs').createWorldBossService({core,file:dataFile+'.world-boss.json',now:options.now});
 if(fs.existsSync(dataFile)){const saved=JSON.parse(fs.readFileSync(dataFile,'utf8'));for(const p of saved.clients??[])clients.set(p.token,p);for(const r of saved.rooms??[])rooms.set(r.id,r);for(const pair of saved.receipts??[])receipts.set(pair[0],pair[1]);}
 function persist(){if(!dirty)return;fs.mkdirSync(path.dirname(dataFile),{recursive:true});const temp=dataFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({clients:[...clients.values()],rooms:[...rooms.values()],receipts:[...receipts]}));fs.renameSync(temp,dataFile);dirty=false;}
 function profile(body){check(Array.isArray(body.roster)&&body.roster.length===5,'请先选择五只自有伙伴');const ids=new Set();for(const t of body.roster){validateTurtle(t);check(!ids.has(t.id),'备战伙伴不能重复');ids.add(t.id);}return {name:label(body.name)||'小岛主',roster:clone(body.roster)};}
 function member(client){return {clientId:client.id,name:client.name,ai:false,ready:false,online:true,roster:clone(client.roster),auto:false,held:[]};}
 const findRoom=client=>[...rooms.values()].find(r=>r.members.some(m=>m.clientId===client.id)&&!r.closed);
 function view(r,client){return {id:r.id,code:r.code,tier:r.tier,host:r.host,matching:r.matching,phase:r.raid?.phase??'lobby',revision:r.revision,createdAt:r.createdAt,me:client.id,members:r.members.map(m=>({...m,online:m.ai||Date.now()-(clientsById(m.clientId)?.seen??0)<15000})),raid:r.raid?clone(r.raid):undefined};}
 const clientsById=id=>[...clients.values()].find(p=>p.id===id);
 function update(r){r.revision++;dirty=true;}
 function add(r,p){check(!r.raid&&!r.closed,'房间已经开始或关闭');check(r.members.length<5,'房间已满');check(!r.members.some(m=>m.clientId===p.id),'你已在该房间');r.members.push(member(p));update(r);return view(r,p);}
 function create(client,tier){check(Number.isInteger(tier)&&RAIDS[tier],'副本不存在');check(!findRoom(client),'请先离开当前房间');const r={id:uid(),code:crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase(),tier,host:client.id,members:[member(client)],matching:false,createdAt:Date.now(),revision:1};rooms.set(r.id,r);dirty=true;return r;}
 function start(r){check(!r.raid,'副本已经开始');check(r.members.length===5,'队伍需要五位成员，可以手动补充 AI');check(r.members.every(m=>m.ready||m.ai),'还有队友没有准备');
  const now=Date.now(),save=makeInitialSave(now,crypto.randomInt(1,2147483647));enablePrototype(save);enableLiving(save);initCommunity(save,now);save.collection=Object.fromEntries(r.members[0].roster.map(t=>[t.id,clone(t)]));
  const raid=startRaid(save,now,r.tier,Object.keys(save.collection));raid.id='online:'+r.id;
  raid.members=r.members.map((m,i)=>{const roster=m.roster.map(t=>({id:m.clientId+':'+t.id,ownerId:m.clientId,originalId:t.id,turtle:{...clone(t),id:m.clientId+':'+t.id}}));return {ownerId:m.clientId,name:m.name,ai:m.ai,roster,activeId:roster[0].id,station:i,moveReadyTick:0};});
  save.community.raid=raid;r.save=save;r.raid=raid;r.matching=false;r.startedAt=now;update(r);
 }
 function next(r){check(r.raid&&['prep','between'].includes(r.raid.phase),'当前不能开始下一波');r.raid.battle=raidBattle(r.raid);r.raid.phase='combat';r.raid.members.forEach(m=>m.moveReadyTick=0);settings(r);update(r);}
 function settings(r){const b=r.raid?.battle;if(!b)return;b.autoSkills=true;b.controlledUnitIds=undefined;b.manualSkillTurtles=r.members.filter(m=>!m.ai).flatMap(m=>r.raid.members.find(p=>p.ownerId===m.clientId).roster.filter(p=>!m.auto||m.held.includes(p.originalId)).map(p=>p.turtle.id));}
 function settle(r){const raid=finishRaid(r.save,r.raid);r.raid=r.save.community.raid;
  if(raid.settled){for(const m of r.members.filter(m=>!m.ai)){const p=clientsById(m.clientId);if(!p)continue;const chest=r.save.progression?.chests.find(c=>c.id===raid.chestId),id='room:'+r.id+':'+m.clientId;receipts.set(id,{id,clientId:m.clientId,title:RAIDS[r.tier].name+' · '+(raid.victory?'副本通关':'挑战结束'),body:`完成 ${raid.wave} 波${raid.stars?' · '+raid.stars+' 星宝箱':''}。基础奖励见附件，星级宝箱已存入副本的“我的宝箱”。`,grants:raid.rewards??[],...(chest?{chest:{title:chest.title,stars:chest.stars,grants:chest.grants}}:{}),xp:raid.wave*(16+r.tier*8)+(raid.victory?60:0),petIds:m.roster.map(t=>t.id),at:Date.now(),acknowledged:false});}r.completedAt=Date.now();}
  update(r);
 }
 function action(client,body){const r=rooms.get(body.roomId);check(r&&!r.closed,'房间已关闭');const m=r.members.find(m=>m.clientId===client.id);check(m,'你不在这个房间');const host=r.host===client.id;
  switch(body.action){
   case 'leave':check(!r.raid||r.raid.settled,'副本进行中，可返回海岛后继续；结束挑战需由队长操作');r.members=r.members.filter(p=>p!==m);if(!r.members.some(p=>!p.ai))r.closed=true;else if(host)r.host=r.members.find(p=>!p.ai).clientId;break;
   case 'matching':check(host&&!r.raid,'只有队长可设置匹配');r.matching=!!body.enabled;break;
   case 'ready':check(!r.raid,'副本已经开始');m.ready=!!body.enabled;break;
   case 'roster':check(!r.raid,'战斗开始后不能更改备战阵容');m.roster=profile(body).roster;m.ready=false;break;
   case 'kick':check(host&&!r.raid,'只有队长可在准备阶段移出成员');check(body.target!==client.id,'请使用离开队伍');check(r.members.some(p=>p.clientId===body.target),'成员已经离开');r.members=r.members.filter(p=>p.clientId!==body.target);break;
   case 'ai':{check(host&&!r.raid,'只有队长可以补充 AI');check(r.members.length<5,'房间已满');const seed=makeInitialSave(Date.now(),crypto.randomInt(1,2147483647));enablePrototype(seed);enableLiving(seed);initCommunity(seed,Date.now());const ai=Object.values(seed.community.aiPlayers)[r.members.length%4],role=['stone','spike','crystal','leaf','bubble'][r.members.length%5],roster=Object.values(ai.pets).slice(0,5).sort((a,b)=>(a.role===role?-1:0)-(b.role===role?-1:0));for(const t of roster){initDevelopment(t);t.skills=[...new Set([...t.skills,'strong','armor','resist','regen','rebirth'])].slice(0,10);t.innate={attack:98,health:98,defense:98,growth:110};}r.members.push({clientId:'ai:'+uid(),name:ai.name,ai:true,ready:true,roster,auto:true,held:[]});break;}
   case 'invite':{check(!r.raid,'已经开始');const p=clientsById(body.target);check(p&&p.id!==client.id,'找不到这个玩家 ID');p.invitations??=[];p.invitations=p.invitations.filter(i=>i.roomId!==r.id).concat({roomId:r.id,code:r.code,name:client.name,tier:r.tier,at:Date.now()}).slice(-20);break;}
   case 'start':check(host,'只有队长可以出发');start(r);break;
   case 'next':check(host,'只有队长可以开始下一波');next(r);break;
   case 'abandon':check(host&&r.raid&&!r.raid.settled,'只有队长可以结束进行中的副本');finishRaid(r.save,r.raid,true);r.raid=r.save.community.raid;settleAbandon(r);break;
   case 'swap':case 'move':case 'cast':case 'settings':{
    check(r.raid&&!r.raid.settled,'副本尚未开始或已经结束');const index=r.raid.members.findIndex(x=>x.ownerId===client.id);check(index>=0,'队员状态无效');
    if(body.action==='swap'){const choice=r.raid.members[index].roster.find(p=>p.originalId===body.petId);check(choice,'只能操作自己的备战伙伴');swapRaidPet(r.raid,index,choice.id);}
    if(body.action==='move'){const p=body.point;check(p&&Number.isFinite(p.x)&&Number.isFinite(p.z),'落点无效');const target=r.raid.members.findIndex((o,i)=>i!==index&&o.placement&&Math.hypot(o.placement.x-p.x,o.placement.z-p.z)<.68);if(target>=0)swapRaidPositions(r.raid,index,target);else moveRaidStation(r.raid,index,r.raid.members[index].station??index,p);}
    if(body.action==='settings'){m.auto=!!body.auto;m.held=Array.isArray(body.held)?body.held.filter(id=>m.roster.some(t=>t.id===id)):[];settings(r);}
    if(body.action==='cast'){const b=r.raid.battle;check(b&&r.raid.phase==='combat','当前没有战斗');const u=b.units.find(u=>u.id===r.raid.members[index].activeId);check(u,'当前伙伴不在场');b.controlledUnitIds=[u.id];try{check(commandBattle(b,{type:'cast',unitId:u.id,skillId:body.skillId,targetId:body.targetId,point:body.point}),'技能尚未就绪，或目标不在有效范围');}finally{b.controlledUnitIds=undefined;}}
    break;
   }
   default:throw Error('不支持的房间操作');
  }update(r);return r.closed||!r.members.some(x=>x.clientId===client.id)?null:view(r,client);
 }
 function settleAbandon(r){r.completedAt=Date.now();for(const m of r.members.filter(m=>!m.ai)){const id='room:'+r.id+':'+m.clientId;receipts.set(id,{id,clientId:m.clientId,title:'副本挑战结束',body:'队长结束了本次挑战，已完成波次的奖励如下。',grants:r.raid.rewards??[],xp:r.raid.wave*(16+r.tier*8),petIds:m.roster.map(t=>t.id),at:Date.now(),acknowledged:false});}update(r);}
 const requests=new Map();
 async function api(req,res,url){
  let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;check(raw.length<=(url.pathname==='/api/account/save'?12582912:256000),'请求过大');}body=raw?JSON.parse(raw):{};}
  if(url.pathname.startsWith('/api/account/')){const route=url.pathname.slice('/api/account/'.length);check(req.method==='POST'||route==='config','请求方式错误');return accountService.handle(route,body,String(req.headers.authorization??'').replace(/^Bearer /,''),req.socket.remoteAddress);}
  if(url.pathname==='/api/health')return {ok:true,service:'gowaygui-rooms',protocol:1,rooms:[...rooms.values()].filter(r=>!r.closed).length};
  if(url.pathname==='/api/register'){check(req.method==='POST','请求方式错误');check(clients.size<10000,'本地服务注册人数已满');const p={id:crypto.randomBytes(4).toString('hex').toUpperCase(),token:crypto.randomBytes(32).toString('hex'),...profile(body),seen:Date.now(),invitations:[]};clients.set(p.token,p);dirty=true;return {id:p.id,token:p.token};}
  if(url.pathname==='/api/admin/mail'){check(options.adminToken&&req.headers.authorization==='Bearer '+options.adminToken,'需要系统管理员凭证');check(req.method==='POST'&&Array.isArray(body.grants)&&body.grants.length<=20&&body.grants.every(validReward),'邮件附件无效');const targets=body.all?[...clients.values()]:[clientsById(body.clientId)].filter(Boolean);check(targets.length,'没有对应玩家');check(typeof body.id==='string'&&body.id.length<100,'需要唯一邮件编号');for(const p of targets){const id='system:'+body.id+':'+p.id;if(!receipts.has(id))receipts.set(id,{id,clientId:p.id,title:label(body.title,50),body:label(body.body,600),grants:clone(body.grants),xp:0,petIds:[],at:Date.now(),acknowledged:false});}dirty=true;return {sent:targets.length};}
  const token=String(req.headers.authorization??'').replace(/^Bearer /,''),client=clients.get(token);check(client,'身份已失效，请重新连接房间服务');client.seen=Date.now();
  let worldIdentity={...client,region:'island-1'};
  if(req.headers['x-game-account']){const a=await accountService.handle('state',{},String(req.headers['x-game-account'])),region=String(req.headers['x-game-region']??'island-1');check(a.regions.some(r=>r.id===region),'区服不存在');worldIdentity={...client,id:a.id+':'+region,region};}
  if(url.pathname.startsWith('/api/world-boss/')){check(req.method==='POST','请求方式错误');const action=url.pathname.slice('/api/world-boss/'.length);if((action==='start'||action==='showcase')&&req.headers['x-game-account']){const slot=await accountService.handle('save',{region:worldIdentity.region},String(req.headers['x-game-account']));check(slot.save,'请先保存账号进度');if(action==='showcase'){check(Array.isArray(body.pets)&&body.pets.length>=1&&body.pets.length<=5,'请选择1至5只展示伙伴');body.pets=body.pets.map(t=>{const owned=slot.save.collection?.[t.id];check(owned,'展示伙伴不属于当前账号');check(!slot.save.community?.hiddenPets?.includes(t.id),'该伙伴已设为隐藏');return clone(owned);});}else worldIdentity.roster=client.roster.map(t=>{const owned=slot.save.collection?.[t.id];check(owned,'出战阵容中有不属于当前账号的伙伴');return clone(owned);});}return worldBoss.handle(action,worldIdentity,body);}
  if(url.pathname==='/api/state')return {playerId:client.id,room:findRoom(client)?view(findRoom(client),client):null,invitations:(client.invitations??[]).filter(i=>rooms.get(i.roomId)&&!rooms.get(i.roomId).closed&&!rooms.get(i.roomId).raid),mail:[...[...receipts.values()].filter(x=>x.clientId===client.id&&!x.acknowledged),...worldBoss.pending(worldIdentity)],online:[...clients.values()].filter(p=>p.id!==client.id&&Date.now()-p.seen<20000).map(p=>({id:p.id,name:p.name,inRoom:!!findRoom(p)}))};
  check(req.method==='POST','请求方式错误');check(typeof body.requestId==='string'&&body.requestId.length<100,'缺少操作编号');const key=client.id+':'+body.requestId;if(requests.has(key))return requests.get(key);
  let result;
  if(url.pathname==='/api/profile'){Object.assign(client,profile(body));dirty=true;result={id:client.id};}
  else if(url.pathname==='/api/create')result=view(create(client,body.tier),client);
  else if(url.pathname==='/api/match'){const own=findRoom(client);if(own)result=view(own,client);else{const r=[...rooms.values()].filter(r=>!r.closed&&!r.raid&&r.matching&&r.tier===body.tier&&r.members.length<5).sort((a,b)=>a.createdAt-b.createdAt)[0];result=r?add(r,client):null;}}
  else if(url.pathname==='/api/join'){check(!findRoom(client),'请先离开当前房间');const r=[...rooms.values()].find(r=>r.code===String(body.code??'').toUpperCase()&&!r.closed);check(r,'邀请房间不存在或已关闭');result=add(r,client);}
  else if(url.pathname==='/api/action')result=action(client,body);
  else if(url.pathname==='/api/ack'){if(String(body.id).startsWith('world:')){if(req.headers['x-game-account']){const slot=await accountService.handle('save',{region:worldIdentity.region},String(req.headers['x-game-account'])),receipt='received:'+body.id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,144);check(slot.save?.commands?.[receipt]?.kind==='roomMail','请先将奖励邮件保存到账号');}worldBoss.ack(worldIdentity,body.id);}else{const item=receipts.get(body.id);check(item&&item.clientId===client.id,'邮件不存在');item.acknowledged=true;dirty=true;}result={ok:true};}
  else throw Error('接口不存在');requests.set(key,result);if(requests.size>3000)requests.delete(requests.keys().next().value);persist();return result;
 }
 const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');try{
  if(url.pathname.startsWith('/api/')){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');const origin=req.headers.origin;if(origin){const originUrl=new URL(origin);check(originUrl.host===req.headers.host,'请从房间服务的游戏地址连接');}const result=await api(req,res,url);res.end(JSON.stringify({ok:true,data:result}));return;}
  check(req.method==='GET'||req.method==='HEAD','请求方式错误');let target=path.resolve(root,'.'+decodeURIComponent(url.pathname));check(target===root||target.startsWith(root+path.sep),'路径无效');if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');if(!fs.existsSync(target)){res.statusCode=404;res.end('Not found');return;}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.css':'text/css','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.bin':'application/octet-stream'};res.setHeader('Content-Type',mime[path.extname(target)]??'application/octet-stream');res.setHeader('Cache-Control','no-cache');if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
 }catch(e){res.statusCode=400;res.end(JSON.stringify({ok:false,error:e.message||'操作失败，请重试'}));}});
 const tick=setInterval(()=>{for(const r of rooms.values()){if(r.raid?.phase!=='combat'||r.raid.settled)continue;try{stepRaid(r.raid,.05);if(r.raid.battle.events.length>120)r.raid.battle.events=r.raid.battle.events.slice(-120);update(r);if(r.raid.battle.status!=='fighting')settle(r);}catch(e){r.lastError=e.message;r.raid.phase='between';delete r.raid.battle;update(r);}}},50);
 const worldTick=setInterval(()=>{try{worldBoss.tick();}catch(e){console.error('World boss update failed:',e.message);}},50);worldTick.unref();
 const saveTimer=setInterval(()=>{persist();worldBoss.persist();},2000);tick.unref();saveTimer.unref();server.on('close',()=>{clearInterval(tick);clearInterval(worldTick);clearInterval(saveTimer);persist();worldBoss.persist();});
 return {server,rooms,clients,receipts,persist};
}
module.exports={createLobbyServer};
if(require.main===module){const app=createLobbyServer({root:process.env.GAME_ROOT,dataFile:process.env.ROOM_DATA,adminToken:process.env.ROOM_ADMIN_TOKEN});app.server.listen(Number(process.env.PORT??7464),process.env.HOST??'127.0.0.1',()=>console.log('Room service ready on port '+(process.env.PORT??7464)));process.on('SIGINT',()=>app.server.close(()=>process.exit(0)));}
