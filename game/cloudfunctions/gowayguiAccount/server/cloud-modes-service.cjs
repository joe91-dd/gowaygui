'use strict';
// All durable objects are read and committed in the caller's CloudBase transaction.
// Identity, pet stats, unlocks and attempts come from verified server saves only.
const crypto=require('node:crypto'),copy=value=>require('./clone.cjs')(value);
const {publicName,publicPet}=require('./public-profile.cjs');
const check=(value,message)=>{if(!value)throw Error(message);};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const profileId=(account,region)=>hash(account+':'+region).slice(0,32);
const profileKey=id=>'mode-player-'+id,roomKey=id=>'mode-room-'+id,indexKey='mode-index-island-1';
const dayKey=day=>'mode-world-'+day.replace(/-/g,'')+'-island-1';
const emptyIndex=()=>({rooms:{},online:{},worldActive:{}});
const presenceKey=id=>'mode-presence-island-1-'+(parseInt(id.slice(0,8),16)%32).toString(16).padStart(2,'0');
const receiptCommand=id=>'received:'+id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,144);
function ownedRoster(slot,ids){
 check(Array.isArray(ids)&&ids.length===5&&new Set(ids).size===5,'请选择五只不同的自有伙伴');
 return ids.map(id=>{const pet=slot.save.collection[id];check(pet,'阵容中的伙伴不属于当前账号，请重新选择');return publicPet(pet);});
}
function createCloudModesService({core,io,now=Date.now}){
 const {worldBossDay,worldRankGrants,WORLD_BOSSES,WORLD_BOSS_UNLOCK_LEVEL,worldBossUnlocked}=require(core+'/worldBoss.js');
 async function loadProfile(account,region,slot){
  const id=profileId(account.id,region),existing=await io.get(profileKey(id));
  if(existing){check(existing.account===account.id&&existing.region===region,'房间身份不一致');return existing;}
  return {id,account:account.id,region,token:crypto.randomBytes(32).toString('hex'),name:publicName(account.id),roster:[],access:{cleared:[],dailyAccess:undefined},seen:now(),invitations:[],world:{fights:{},mail:{},requests:{},days:[]}};
 }
 const putProfile=p=>io.put(profileKey(p.id),p);
 async function refreshOwned(account,region,slot){
  const profile=await io.get(profileKey(profileId(account.id,region)));if(!profile||profile.deleted)return;
  profile.roster=profile.roster.map(p=>slot.save.collection[p.id]).filter(Boolean).map(publicPet);
  profile.access={cleared:copy(slot.save.cleared),dailyAccess:copy(slot.save.dailyAccess)};
  await putProfile(profile);
 }
 async function indexClean(index){
  for(const [id,row]of Object.entries(index.online))if(now()-row.seen>60000)delete index.online[id];
  // Closed rooms must not consume admission capacity until the minute sweep.
  // Bound the writes per request and retain all waiting/active rooms.
  for(const row of Object.values(index.rooms).filter(r=>r.closed&&!r.active).slice(0,4)){
   await io.put(roomKey(row.id),{id:row.id,closed:true});delete index.rooms[row.id];
  }
 }
 function acceptReceipts(account,profile){
  account.modeReceipts??={};for(const mail of Object.values(profile.world?.mail??{}))if(!mail.acknowledged)account.modeReceipts[mail.id]={region:profile.region,mail:copy(mail)};
  for(const mail of Object.values(profile.mail??{}))if(!mail.acknowledged)account.modeReceipts[mail.id]={region:profile.region,mail:copy(mail)};
 }
 async function world(profile,index,route,body,slot){
  const day=worldBossDay(now()),w=profile.world??={fights:{},mail:{},requests:{},days:[]};
  const dayNames=[...new Set([day.key,...w.days,Object.values(w.fights).map(f=>f.day)].flat())];
  const days={};for(const name of dayNames){const value=io.worldBoard?await io.worldBoard(name,profile.id,now()):await io.get(dayKey(name));if(value)days[name+':island-1']=value;}
  const data={days,fights:w.fights,mail:w.mail,requests:w.requests};
  const server=require('./world-boss-service.cjs').createWorldBossService({core,data,deferRankMail:true,replayMemo:io.replayMemo,now});
  if(route==='start'){
   check(slot?.save&&worldBossUnlocked(slot.save.cleared),`通关第 ${WORLD_BOSS_UNLOCK_LEVEL} 关后开启世界挑战`);
   profile.roster=ownedRoster(slot,profile.roster.map(p=>p.id));
   // Admission is bounded; active fights are advanced by the minute trigger as well as reads.
   check(index.worldActive[profile.id]||Object.values(index.worldActive).filter(until=>until===true||until>now()).length<128,'挑战人数较多，请稍后再试');
  }
  if(route==='showcase'){
   check(Array.isArray(body.pets)&&body.pets.length>=1&&body.pets.length<=5,'请选择1至5只展示伙伴');
   body={...body,pets:body.pets.map(p=>{const owned=slot?.save.collection[p.id];check(owned&&!slot.save.community?.hiddenPets?.includes(p.id),'展示伙伴不可用');return publicPet(owned);})};
  }
  const identity={id:profile.id,region:profile.region,name:profile.name,roster:profile.roster};
  let result;if(route==='ack')server.ack(identity,body.id);else result=server.handle(route,identity,body);
  const active=Object.values(data.fights).find(f=>f.phase==='combat');
  // The minute sweep retires completed entries. Avoid making every simultaneous
  // settlement rewrite the shared admission index; starts still check it atomically.
  if(active){if(['start','operationPause','operationResume'].includes(route))index.worldActive[profile.id]=active.endsAt+30000;else index.worldActive[profile.id]??=true;}
  else if(!io.worldBoard)delete index.worldActive[profile.id];
  for(const [key,board]of Object.entries(data.days)){
   board.active??={};if(active?.board===key)board.active[profile.id]=true;else delete board.active[profile.id];
  }
  // A board closes only after every admitted fight has been advanced to its final result.
  server.tick();
  for(const [key,board]of Object.entries(data.days)){
   if(board.players[profile.id]){
    if(!w.days.includes(board.day))w.days.push(board.day);
    // Retain every participation reference for complete account erasure, including
    // days whose rewards have already been acknowledged.
    w.history??=[];if(!w.history.includes(board.day))w.history.push(board.day);
    if(board.settled&&board.players[profile.id].best>0){
     const rank=board.players[profile.id].finalRank??(Object.entries(board.players).filter(([,p])=>p.best>0).sort((a,b)=>b[1].best-a[1].best||a[1].bestAt-b[1].bestAt||a[0].localeCompare(b[0])).findIndex(([id])=>id===profile.id)+1);
     const id='world:rank:'+key+':'+profile.id;
     data.mail[id]??={id,clientId:profile.id,title:board.day+' 世界首领 · 第 '+rank+' 名',body:WORLD_BOSSES[board.bossIndex].name+' · 今日排名奖励。',grants:worldRankGrants(rank),xp:0,petIds:[],at:board.closes,acknowledged:false};
    }
   }
   // A spectator is not a leaderboard participant. Store a single default showcase,
   // not another duplicate of every fighter's five-pet roster on the shared board.
   for(const [id,p]of Object.entries(board.players)){
    if(!p.attempts&&!p.best&&!p.showcase)delete board.players[id];
    else if(p.roster)p.roster=p.roster.slice(0,1);
   }
   if(io.putWorldBoard)await io.putWorldBoard(board,profile.id);else await io.put(dayKey(board.day),board);
  }
  w.days=w.days.filter(name=>name===day.key||Object.values(data.mail).some(m=>!m.acknowledged&&m.id.includes(name))||Object.values(data.fights).some(f=>f.day===name)).slice(-31);
  return result;
 }
 async function handle(route,body,account,region,slot){
  check(io,'房间云服务尚未配置');check(region==='island-1','区服不存在');
  check(slot?.protocol>=4&&slot.competitiveVerified===true,'请先同步已验证的云端进度');
  const profile=await loadProfile(account,region,slot),index=await io.get(indexKey)??emptyIndex();await indexClean(index);
  // Spread presence writes across players instead of making every battle poll
  // rewrite the shared lobby index on the same ten-second boundary. The 45s
  // heartbeat remains inside indexClean's 60s liveness window.
  const offset=parseInt(profile.id.slice(0,8),16)%45000;
  profile.seen=Math.floor((now()+offset)/45000)*45000-offset;profile.name=publicName(account.id);
  if(io.presence){
   // Presence is informational. Separate its heartbeat from room admission and
   // rewards, and shard writes so unrelated players do not share one hot row.
   const key=presenceKey(profile.id),rows=await io.get(key)??{};
   for(const [id,row]of Object.entries(rows))if(now()-row.seen>60000)delete rows[id];
   rows[profile.id]={name:profile.name,seen:profile.seen};await io.put(key,rows);
   delete index.online[profile.id]; // migrate legacy presence without dropping rooms
  }else index.online[profile.id]={name:profile.name,seen:profile.seen};
  const ids=Array.isArray(body.roster)?body.roster.map(p=>p?.id):undefined;
  if(route==='register'||route==='profile'){
   const choices=ids??[...new Set([...(slot.save.homeTeam??[]),...Object.keys(slot.save.collection)])].slice(0,5);
   profile.roster=route==='register'&&choices.length<5?choices.map(id=>{check(slot.save.collection[id],'伙伴不存在');return publicPet(slot.save.collection[id]);}):ownedRoster(slot,choices);profile.access={cleared:copy(slot.save.cleared),dailyAccess:copy(slot.save.dailyAccess)};
   await putProfile(profile);await io.put(indexKey,index);return route==='register'?{id:profile.id,token:profile.token}:{id:profile.id};
  }
  if(!route.startsWith('world-boss/')&&route!=='state'&&route!=='ack')check(profile.roster.length===5,'请先选择五只伙伴并重新连接');
  const mutating=!['state','world-boss/state','profile','register'].includes(route);
  if(mutating){check(typeof body.requestId==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(body.requestId),'缺少有效操作编号');const digest=hash(JSON.stringify([route,body]));profile.fingerprints??={};check(!profile.fingerprints[body.requestId]||profile.fingerprints[body.requestId]===digest,'操作编号已用于其他请求');profile.fingerprints[body.requestId]=digest;const keys=Object.keys(profile.fingerprints);for(const key of keys.slice(0,Math.max(0,keys.length-100)))delete profile.fingerprints[key];}
  if(route.startsWith('world-boss/')){
   const action=route.slice('world-boss/'.length),allowed=new Set(['state','start','claim','showcase','operationPause','operationResume','focus','settings','cast','move']);
   check(allowed.has(action),'挑战操作不存在');
   const result=await world(profile,index,action,body,slot);if(body.includeRanking===false){result.ranking=[];}else result.ranking=result.ranking.map(p=>({...p,roster:[],showcase:(p.showcase??[]).slice(0,p.rotate?5:1)}));acceptReceipts(account,profile);await putProfile(profile);await io.put(indexKey,index);return result;
  }
  if(route==='ack'&&String(body.id).startsWith('world:')){
   check(slot.save.commands?.[receiptCommand(body.id)]?.kind==='roomMail','请先保存奖励邮件，再确认领取');
   await world(profile,index,'ack',body,slot);delete account.modeReceipts?.[body.id];await putProfile(profile);await io.put(indexKey,index);return {ok:true};
  }
  const own=index.rooms[profile.roomId],target=route==='join'?Object.values(index.rooms).find(r=>r.code===String(body.code??'').toUpperCase()&&!r.closed):route==='match'&&!own?Object.values(index.rooms).filter(r=>r.matching&&!r.active&&r.members.length<2&&r.tier===body.tier).sort((a,b)=>a.at-b.at)[0]:undefined;
  const roomIds=[...new Set([own?.id,target?.id].filter(Boolean))],rooms=[];
  for(const id of roomIds){const room=await io.get(roomKey(id));if(room&&!room.closed)rooms.push(room);}
  if(route==='action')check(rooms.some(r=>r.id===body.roomId&&r.members.some(m=>m.clientId===profile.id)),'你不在这个房间');
  const peers=new Map([[profile.id,profile]]);
  for(const room of rooms)for(const m of room.members.filter(m=>!m.ai))if(!peers.has(m.clientId)){const peer=await io.get(profileKey(m.clientId));check(peer&&!peer.deleted,'队友身份已失效，请重新组队');peers.set(peer.id,peer);}
  // A waiting member may have sold/merged a selected pet since joining. Profiles
  // are refreshed in the same transaction as authoritative saves and trades.
  for(const room of rooms)if(!room.raid)for(const m of room.members.filter(m=>!m.ai)){
   m.roster=copy(peers.get(m.clientId).roster);
   if(m.roster.length!==5)m.ready=false;
  }
  if(route==='action'&&body.action==='invite'){
   check(/^[a-f0-9]{32}$/.test(body.target??''),'玩家 ID 无效');const target=await io.get(profileKey(body.target));check(target&&!target.deleted&&target.region===region,'找不到这位玩家');peers.set(target.id,target);
  }
  if(route==='action'&&body.action==='roster'){profile.roster=ownedRoster(slot,ids);body={...body,roster:profile.roster};}
  if(route==='ack')check(slot.save.commands?.[receiptCommand(body.id)]?.kind==='roomMail','请先保存奖励邮件，再确认领取');
  const snapshot={clients:[...peers.values()],rooms,receipts:[...peers.values()].flatMap(p=>Object.entries(p.mail??{})),requests:profile.requests??[],worldBoss:{days:{},fights:{},mail:{},requests:{}}};
  const runtime=require('./lobby-server.cjs').createLobbyServer({core,snapshot,now,accountService:{handle(){throw Error('Unexpected account route');}}});
  runtime.advance();
  const result=await runtime.handle(route,body,profile.token);
  const saved=runtime.snapshot();
  for(const room of saved.rooms){
   room.clockAt??=now();const previous=index.rooms[room.id];index.rooms[room.id]={id:room.id,code:room.code,tier:room.tier,members:room.members.filter(m=>!m.ai).map(m=>m.clientId),host:room.host,matching:room.matching,active:!!room.raid&&!room.raid.settled,closed:!!room.closed,at:previous&&now()-previous.at<60000?previous.at:now()};
   check(Object.keys(index.rooms).length<=256,'当前队伍较多，请稍后重试');await io.put(roomKey(room.id),room);
  }
  for(const p of saved.clients){
   const room=saved.rooms.find(r=>!r.closed&&r.members.some(m=>m.clientId===p.id));
   if(room)p.roomId=room.id;else if(roomIds.includes(p.roomId))delete p.roomId;
   p.mail=Object.fromEntries(saved.receipts.filter(([,m])=>m.clientId===p.id));
   if(p.id===profile.id){p.requests=saved.requests;acceptReceipts(account,p);if(route==='ack')delete account.modeReceipts?.[body.id];}
   await putProfile(p);
  }
  await io.put(indexKey,index);
  if(route==='state'){
   // The full roster stays private except to current teammates / world showcases.
   const online=io.presence?{...index.online,...await io.presence()}:index.online;
   result.online=Object.entries(online).filter(([id,row])=>id!==profile.id&&now()-row.seen<=60000).slice(0,60).map(([id,row])=>({id,name:row.name,inRoom:Object.values(index.rooms).some(r=>!r.closed&&r.members.includes(id))}));
   result.invitations=(profile.invitations??[]).filter(v=>index.rooms[v.roomId]&&!index.rooms[v.roomId].active&&!index.rooms[v.roomId].closed);
   if(!profile.worldSyncedAt||now()-profile.worldSyncedAt>=60000){await world(profile,index,'state',{},slot);profile.worldSyncedAt=now();}acceptReceipts(account,profile);
   result.mail.push(...Object.values(profile.world.mail).filter(m=>!m.acknowledged).map(copy));await putProfile(profile);await io.put(indexKey,index);
  }
  return result;
 }
 async function sweepWorld(){
  const index=await io.get(indexKey)??emptyIndex(),ids=Object.keys(index.worldActive);
  // Each call processes a small deterministic batch; stale fights cannot affect a closed board.
  for(const id of ids.slice(0,4)){const profile=await io.get(profileKey(id));if(!profile||profile.deleted){delete index.worldActive[id];continue;}await world(profile,index,'state',{},undefined);await putProfile(profile);delete index.worldActive[id];if(Object.values(profile.world.fights).some(f=>f.phase==='combat'))index.worldActive[id]=true;}
  let roomsChecked=0;
  for(const row of Object.values(index.rooms).filter(row=>row.active||row.closed||now()-row.at>24*3600000).sort((a,b)=>a.at-b.at).slice(0,4)){
   if(row.closed||(!row.active&&now()-row.at>24*3600000)){await io.put(roomKey(row.id),{id:row.id,closed:true});delete index.rooms[row.id];continue;}
   if(!row.active)continue;const room=await io.get(roomKey(row.id));if(!room)continue;
   const peers=[];for(const id of row.members){const p=await io.get(profileKey(id));if(p&&!p.deleted)peers.push(p);}
   if(peers.length!==row.members.length)continue;
   const runtime=require('./lobby-server.cjs').createLobbyServer({core,now,snapshot:{clients:peers,rooms:[room],receipts:peers.flatMap(p=>Object.entries(p.mail??{})),worldBoss:{days:{},fights:{},mail:{},requests:{}}},accountService:{handle(){throw Error('Unexpected account route');}}});
   runtime.advance();const saved=runtime.snapshot(),next=saved.rooms[0];await io.put(roomKey(row.id),next);
   row.active=!!next.raid&&!next.raid.settled;row.at=now();for(const p of saved.clients){p.mail=Object.fromEntries(saved.receipts.filter(([,m])=>m.clientId===p.id));await putProfile(p);}roomsChecked++;
  }
  await io.put(indexKey,index);return {checked:Math.min(ids.length,4),roomsChecked,remaining:Object.keys(index.worldActive).length};
 }
 async function erase(account){
  const id=profileId(account.id,'island-1'),profile=await io.get(profileKey(id));if(!profile)return;
  const index=await io.get(indexKey)??emptyIndex();
  for(const row of Object.values(index.rooms).filter(r=>r.members.includes(id))){const room=await io.get(roomKey(row.id));if(room&&!room.closed)check(!room.raid||room.raid.settled,'请先结束进行中的副本再注销账号');await io.put(roomKey(row.id),{id:row.id,closed:true});delete index.rooms[row.id];}
  delete index.online[id];delete index.worldActive[id];
  if(io.presence){const key=presenceKey(id),rows=await io.get(key);if(rows){delete rows[id];await io.put(key,rows);}}
  for(const day of new Set([...(profile.world?.days??[]),...(profile.world?.history??[])])){const board=io.worldBoard?await io.worldBoard(day,id,now()):await io.get(dayKey(day));if(board){delete board.players[id];delete board.active?.[id];if(io.putWorldBoard)await io.putWorldBoard(board,id,true);else await io.put(dayKey(day),board);}}
  await io.put(profileKey(id),{id,deleted:true});await io.put(indexKey,index);
 }
 return {handle,sweepWorld,erase,refreshOwned};
}
module.exports={createCloudModesService,profileId};
