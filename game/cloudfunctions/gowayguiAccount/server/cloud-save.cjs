'use strict';
const structuredClone=require('./clone.cjs');
const crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const check=(v,m)=>{if(!v)throw Error(m);};
function initialSlot(core,now){
 const {makeInitialSave}=require(core+'/game.js');
 return {version:1,save:makeInitialSave(now,crypto.randomInt(1,2147483647)),at:now,protocol:4,competitiveVerified:true,combatBudget:{at:now,credit:0}};
}
/** Narrow migration: protocol 3 was already replayed, but its battle/AI economy
 * was not authoritative. Only never-fought bootstrap/settings archives qualify.
 * Any other history is preserved but remains outside cross-account trading. */
function verifiedLegacy(slot){
 if(slot.protocol!==3)return false;const s=slot.save;
 if(s.run||s.community?.raid||s.community?.arena||Object.keys(s.results??{}).length||s.cleared?.length)return false;
 const safe=new Set(['enableV06','economyV2','livingV1','enablePatrol','settings','homeTeam','community:init','community:refresh','petOrder']);
 return Object.values(s.commands??{}).every(c=>safe.has(c.kind));
}
function replaySave({core,data,account,region,slot,body,now,roomReceipt}){
 const {createCombatVerifier}=require('./combat-verifier.cjs');
 const verifier=createCombatVerifier(core,slot,now);
 const {GameService}=require(core+'/game.js'),{SaveRepository,SAVE_KEY,encodeSave}=require(core+'/save.js'),{MemoryStorage}=require(core+'/../platform/storage.js');
 const allowed=new Set(require(core+'/cloudOperations.js').CLOUD_METHODS);
 const operations=body.save?.cloudJournal;
 check(Array.isArray(operations)&&operations.length<=512,'请更新游戏并重新读取云端进度，不能直接上传本机存档');
 const base=structuredClone(slot.save);delete base.cloudJournal;
 let at=Math.min(now,base.clockHighWater);const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(base));
 const game=new GameService(new SaveRepository(storage),{now:()=>at},1,{skipResume:true,verifyCombat:true});
 for(const op of operations){
  check(op&&allowed.has(op.method)&&Array.isArray(op.args)&&op.args.length<=8,'云端操作无效');
  check(Number.isSafeInteger(op.at)&&op.at>=at&&op.at<=now+5000,'设备时间与服务器不一致，请校准时间后重试');at=op.at;
   const args=structuredClone(op.args).map(v=>v&&typeof v==='object'&&v.$cloudUndefined===true&&Object.keys(v).length===1?undefined:v);
  if(op.method==='receiveAccountParcel'){
   const p=account.parcels?.find(p=>p.id===args[0]?.id&&p.region===region);check(p,'奖励未经服务器签发');args[0]=structuredClone(p);
  }
  if(op.method==='receiveAdReward'){
   const ad=data.ads?.[args[0]];check(ad&&ad.account===account.id&&ad.region===region&&ad.done,'广告奖励未经验证');args[1]=ad.kind;args[2]=ad.context;
  }
  if(op.method==='receiveRoomMail'){
   const receipt=roomReceipt?.(account,region,args[1]?.id);check(receipt,'房间奖励未经服务器确认');args[1]=structuredClone(receipt);
  }
  if(op.method==='purchaseShopPack')check(!['gold1','gold2','gold3','monthCard'].includes(args[1]),'此版本未开放付费购买');
  // Local AI friend assistance is replayed from the server's deterministic AI
  // roster, including ownership, friendship and loan limits. Paid market actions
  // still require the cross-account transactional marketplace.
  if(op.method==='communityAction')check(!['list','buy','rent','aiPurchase','cancelListing'].includes(args[1]?.kind),'租赁和交易必须通过服务器市场办理');
  verifier.verify(game,op.method,args);
  game[op.method](...args);
 }
 const verified=game.snapshot;
 // Only the server replay becomes authoritative. All fields are compared, apart
 // from client-local revision/outbox. Never trust a checksum as proof of earning.
 const normalize=s=>{const c=JSON.parse(JSON.stringify(s));delete c.revision;delete c.cloudJournal;delete c.cloudAcknowledged;return c;};
 check(isDeepStrictEqual(normalize(verified),normalize(body.save)),'存档与服务器操作记录不一致，未保存；请重新读取云端进度');
 return {save:verified,protocol:4,competitiveVerified:slot.competitiveVerified===true||verifiedLegacy(slot),combatBudget:verifier.budget(verified)};
}
module.exports={initialSlot,replaySave};
