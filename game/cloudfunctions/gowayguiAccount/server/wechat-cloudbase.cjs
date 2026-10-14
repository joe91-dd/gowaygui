'use strict';
const structuredClone=require('./clone.cjs');
const crypto=require('node:crypto');
const {createAccountService}=require('./account-service.cjs');
const {VERSION,wechatPrivacy}=require('./wechat-privacy.cjs');
const APPID='wx7280ece46f88b00b',ENV='cloudbase-d7gaq30iobf65f41a';
const COLLECTION='gowaygui_players_v1';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const empty=()=>({accounts:[],sessions:{},ads:{},feedback:[]});
const modeRoutes=new Set(['register','profile','state','create','match','join','action','ack','world-boss/state','world-boss/start','world-boss/claim','world-boss/showcase','world-boss/operationPause','world-boss/operationResume','world-boss/focus','world-boss/settings','world-boss/cast','world-boss/move']);
const allowed=new Set(['wx-login','state','save','save-transfer','claim','ack','logout','withdraw-consent','delete-account','feedback','social/market','social/trade','social/rankings','ad-begin','ad-pending','ad-status','ad-complete','ad-cancel','ad-ack']);
class RequestError extends Error{}
const check=(ok,message)=>{if(!ok)throw new RequestError(message);};
function ownerKey(context){
 check(context?.APPID===APPID&&typeof context.OPENID==='string'&&context.OPENID.length>0,'请从本小游戏的微信环境登录');
 check(!context.ENV||context.ENV===ENV,'云环境与小游戏配置不一致');
 return hash(APPID+':'+context.OPENID);
}
function createCloudbaseStore(db,transactionOptions){
 let presenceFlight,presenceCache,presenceAt=0;
 const readPresence=async()=>{
  if(presenceCache&&Date.now()-presenceAt<2000)return presenceCache;
  if(!presenceFlight)presenceFlight=(async()=>{
   const result=await db.collection(COLLECTION).where({presenceRegion:'island-1'}).limit(32).field({payload:true}).get();
   if(!Array.isArray(result?.data))throw Error('在线名单读取失败');
   presenceCache=Object.assign({},...result.data.map(row=>JSON.parse(row.payload)));presenceAt=Date.now();return presenceCache;
  })().finally(()=>{presenceFlight=undefined;});
  return presenceFlight;
 };
 return {async transact(key,work){
 const replayMemo=new Map(); // Scoped to this request's explicitly rolled-back retries.
 return require('./cloud-transaction.cjs').retryConflict(()=>db.runTransaction(async tx=>{
  const doc=tx.collection(COLLECTION).doc(key);
  // CloudBase's server transaction API returns data:null for an absent document.
  // Other read failures must abort; never treat permission/network errors as new users.
  const result=await doc.get();
  if(!result||!Object.prototype.hasOwnProperty.call(result,'data'))throw Error('Unexpected database read');
  const row=result.data;
  if(row&&(!row.payload||row.schema!==1))throw Error('Unsupported stored player data');
  const stored=row?JSON.parse(row.payload):{state:empty(),rate:{minute:0,count:0}};
  const marketCache=new Map(),marketOriginal=new Map(),marketWrites=new Map();
  const sharedId=/^(?:market-(?:index-v1|listing-[a-f0-9-]{36})|mode-(?:index-island-1|presence-island-1-[01][a-f0-9]|player-[a-f0-9]{32}|room-[a-f0-9-]{36}|world-[0-9]{8}-island-1(?:-shard-[01][a-f0-9])?)|rank-(?:pet|chapter|endless|arena)-[a-f0-9]{64}|cdk-(?:code|claim)-[a-f0-9]{64}|invite-(?:code-[A-F0-9]{10}|(?:total|receipt)-[a-f0-9]{64}))$/;
  const io={async get(id){check(sharedId.test(id),'共享记录编号无效');if(marketCache.has(id))return structuredClone(marketCache.get(id));const r=await tx.collection(COLLECTION).doc(id).get();if(!r||!Object.prototype.hasOwnProperty.call(r,'data'))throw Error('Shared read failed');if(r.data&&r.data.schema!==1)throw Error('Unknown shared schema');const value=r.data?JSON.parse(r.data.payload):null;marketCache.set(id,value);marketOriginal.set(id,JSON.stringify(value));return structuredClone(value);},async put(id,value){check(sharedId.test(id),'共享记录编号无效');marketCache.set(id,structuredClone(value));if(marketOriginal.get(id)===JSON.stringify(value))marketWrites.delete(id);else marketWrites.set(id,structuredClone(value));},async rankings(region,kind,limit){
   const result=await db.collection(COLLECTION).where({rankRegion:region,rankKind:kind,rankVisible:true}).orderBy('rankScore','desc').orderBy('rankSeconds','asc').orderBy('rankAt','asc').orderBy('rankTie','asc').limit(limit).field({payload:true}).get();
   if(!Array.isArray(result?.data))throw Error('排行榜读取失败');return result.data.map(row=>JSON.parse(row.payload));
  }};
  // Online names are advisory UI data; admission and assets still use the
  // transaction. Reading presence outside it avoids a 32-shard read conflict.
  io.presence=readPresence;
  io.replayMemo=replayMemo;
  require('./cloud-world-board.cjs').attachWorldBoards(io,async day=>{
   const result=await db.collection(COLLECTION).where({worldDay:day}).limit(32).field({payload:true}).get();
   if(!Array.isArray(result?.data))throw Error('World ranking read failed');
   return result.data.map(row=>JSON.parse(row.payload));
  });
  const output=await work(stored,io);
  if(output.write){
   const payload=JSON.stringify(stored);
   check(Buffer.byteLength(payload)<=10*1024*1024,'账号资料过大，请联系客服');
   await doc.set({data:{schema:1,payload,updatedAt:Date.now()}});
   if(output.result?.ok)for(const [id,value]of marketWrites){const payload=JSON.stringify(value);check(Buffer.byteLength(payload)<(id.startsWith('mode-')?8:1)*1024*1024,'共享记录过大');const rank=id.startsWith('rank-')?{rankRegion:value.region,rankKind:value.kind,rankVisible:!!value.rows.length,rankScore:value.rows[0]?.score??0,rankSeconds:value.rows[0]?.seconds??0,rankAt:value.rows[0]?.at??0,rankTie:value.rows[0]?.id??value.id}:{};const presence=id.startsWith('mode-presence-')?{presenceRegion:'island-1'}:{};const world=id.includes('-shard-')?{worldDay:value.day}:{};await tx.collection(COLLECTION).doc(id).set({data:{schema:1,payload,updatedAt:Date.now(),...rank,...presence,...world}});}
  }
  return output.result;
 },0),transactionOptions);
}};}
function createCloudbaseHandler({store,core,now=Date.now,releaseConfig=require('./wechat-release-config.json'),observability}){return require('./cloud-observability.cjs').observed(async(event,context)=>{
 try{
  // WeChat authenticates scheduled calls through getWXContext().SOURCE.
  // Event fields are caller-controlled and are not a timer identity. This
  // function's sole scheduled job settles due listings using server time.
  if(context?.SOURCE==='wx_trigger'){
   check(context.ENV===ENV&&(!context.APPID||context.APPID===APPID),'定时任务来源环境不一致');
   return await store.transact('market-maintenance-v1',async(stored,io)=>{
    const result=await require('./market-service.cjs').createMarketService({data:stored.state,core,io,now}).sweep();
    stored.lastTimer={at:now(),source:'wx_trigger',settled:result.settled,revision:'wechat-source-v1'};
    const modes=await require('./cloud-modes-service.cjs').createCloudModesService({core,io,now}).sweepWorld();
    return {write:true,result:{ok:true,data:{...result,modes}}};
   });
  }
  const key=ownerKey(context);
  check(event&&typeof event==='object'&&!Array.isArray(event),'请求格式错误');
  const prefix='/api/account/',path=event.path;
  check(typeof path==='string'&&(path.startsWith(prefix)||modeRoutes.has(path.slice(5))&&path.startsWith('/api/')),'此微信版本暂不支持该功能');
  const modeRoute=!path.startsWith(prefix),route=modeRoute?'modes/'+path.slice(5):path.slice(prefix.length),body=event.body??{};
  check(body&&typeof body==='object'&&!Array.isArray(body),'请求格式错误');
  check(Buffer.byteLength(JSON.stringify(body))<=(route==='save'?4*1024*1024:['save-transfer','transport-check'].includes(route)?64*1024:32768),'请求过大，请先同步进度');
  if(route==='transport-check'){
   let probe;try{probe=require('./cloud-save-wire.cjs').decodeCloudSave(body);}catch{throw new RequestError('测试数据格式无效');}
   check(probe.schema==='gowaygui-transport-probe-v1'&&typeof probe.payload==='string','测试数据格式无效');
   return {ok:true,data:{release:'20261011-replay-v2',receivedBytes:Buffer.byteLength(probe.payload),sha256:hash(probe.payload)}};
  }
  if(route==='privacy')return {ok:true,data:wechatPrivacy()};
  if(route==='release-status')return {ok:true,data:{protocol:4,market:true,combatReplay:true,combatMath:'fixed-arithmetic-v1',transport:'wechat-cloudbase',saveTransport:'zlib-chunks-v1',release:'20261012-endless-balance-v1',roleSurvivalVersion:require(core+'/roleSurvival.js').ROLE_SURVIVAL_VERSION,presence:'sharded-v1',observability:'request-metrics-v1',worldBossUnlockLevel:require(core+'/worldBoss.js').WORLD_BOSS_UNLOCK_LEVEL,testingOnly:true,worldBoss:true,rooms:true,competitive:true,rankings:true,redeem:false,invitations:true,publicNames:'generated',wechatAdUnitId:releaseConfig.wechatAdUnitId||'',wechatAdAvailable:/^adunit-[a-zA-Z0-9]+$/.test(releaseConfig.wechatAdUnitId??''),adVerification:'wechat-sdk-onClose',healthVerified:releaseConfig.healthVerified===true}};
  if(route==='config')return {ok:true,data:{regions:[{id:'island-1',name:'晴湾一区',status:'可进入'}],adAvailable:/^adunit-[a-zA-Z0-9]+$/.test(releaseConfig.wechatAdUnitId??''),support:'284124910@qq.com'}};
  if(route==='redeem')return {ok:false,status:403,error:'微信版不提供兑换码功能'};
  check(modeRoute||allowed.has(route),'此功能尚未在微信云开发版本开放');
  const token=typeof event.token==='string'?event.token:'';
  check(token.length<=128,'登录状态无效');
  return await store.transact(key,async (stored,marketIo)=>{
   const minute=Math.floor(now()/60000);
   const bucket=modeRoute?'modeRate':'rate';if(stored[bucket]?.minute!==minute)stored[bucket]={minute,count:0};
   check(stored[bucket].count<(modeRoute?600:180),'操作太频繁，请稍后再试');stored[bucket].count++;
   // Business rejection commits only the rate counter, never partial assets.
   const data=structuredClone(stored.state);
   const modes=marketIo?require('./cloud-modes-service.cjs').createCloudModesService({core,io:marketIo,now}):undefined;
   const rankings=marketIo?require('./cloud-rankings.cjs').createCloudRankings({core,io:marketIo}):undefined;
   const invites=marketIo?require('./cloud-invites.cjs').createCloudInvites({io:marketIo,ownerKey:key,now}):undefined;
   const wechatAds=require('./wechat-ad-service.cjs').createWechatAdService({data,core,adUnitId:releaseConfig.wechatAdUnitId,now});
   const service=createAccountService({data,core,now,authMode:'wechat',privacyVersion:VERSION,marketIo,modes,rankings,wechatAds,registerInvite:invites?.register,syncInvites:invites?.sync,roomReceipt:(a,region,id)=>a.modeReceipts?.[id]?.region===region?a.modeReceipts[id].mail:undefined,eraseLinkedAccount:async id=>{const account=data.accounts.find(a=>a.id===id);await modes?.erase(account);await rankings?.erase(account);await invites?.erase(account);},support:'284124910@qq.com'});
   try{
    const result=await (route==='wx-login'?service.wechatLogin(body):service.handle(route,modeRoute?{...body,region:event.region}:body,token));
    // Room/world polling changes mode state, not verified personal progression.
    // Ranking projections are refreshed when that progression is saved.
    if(!modeRoute)for(const account of data.accounts)for(const [region,slot]of Object.entries(account.saves??{}))await rankings?.refresh(account,region,slot);
    // Only new clients opt into compressed account responses; existing mobile
    // versions continue receiving their original save/restore schema.
    const response=modeRoute||event.responseWire===1?require('./cloud-save-wire.cjs').encodeCloudResponse(result):result;
    stored.state=data;return {write:true,result:{ok:true,data:response}};
   }catch(error){
    // Account errors are user-facing rules; infrastructure/core failures stay generic.
    if(error instanceof TypeError||error instanceof SyntaxError||error.code)throw error;
    return {write:!!stored.state.accounts.length,result:{ok:false,status:400,error:error.message||'操作未完成'}};
   }
  });
 }catch(error){
  if(error instanceof RequestError)return {ok:false,status:400,error:error.message};
  // Do not log the event, tokens, OpenID, feedback or saved progress.
  return {ok:false,status:503,error:'云存档暂时不可用，请稍后重试；本机进度已保留'};
 }
},observability);}
module.exports={APPID,ENV,COLLECTION,createCloudbaseStore,createCloudbaseHandler,ownerKey};
