'use strict';
const crypto=require('node:crypto');
const check=(v,m)=>{if(!v)throw Error(m);};
function createWechatAdService({data,core,adUnitId,now=Date.now}){
 const {AD_LIMITS,AD_TOTAL_LIMIT}=require(core+'/rewardedAds.js');
 const available=/^adunit-[a-zA-Z0-9]+$/.test(adUnitId??'');
 const today=()=>new Date(now()+8*3600000).toISOString().slice(0,10);
 function handle(route,account,body){
  check(body.region==='island-1'&&account.saves?.[body.region]?.save,'请先同步游戏进度');
  const ads=data.ads??={};
  for(const [id,row]of Object.entries(ads))if((row.claimed||!row.done)&&row.expires<now()-7*86400000)delete ads[id];
  const mine=Object.entries(ads).filter(([,ad])=>ad.account===account.id&&ad.region===body.region);
  if(route==='ad-pending')return mine.filter(([,ad])=>!ad.claimed&&(ad.done||ad.expires>now())).map(([nonce,ad])=>({nonce,done:ad.done,kind:ad.kind,context:ad.context}));
  if(route==='ad-begin'){
   check(available,'激励广告尚未配置，请稍后再试');
   check(Object.prototype.hasOwnProperty.call(AD_LIMITS,body.kind),'广告入口不存在');
   const context=typeof body.context==='string'?body.context:'';check(context.length<=160,'广告参数无效');
   if(body.kind==='raidAttempt')check(/^raid[0-3]$/.test(context),'请选择要补充次数的副本');
   check(!mine.some(([,ad])=>!ad.claimed&&(ad.done||ad.expires>now())),'请先领取或结束上一次广告');
   const complete=mine.filter(([,ad])=>ad.done&&ad.day===today());
   check(complete.length<AD_TOTAL_LIMIT&&complete.filter(([,ad])=>ad.kind===body.kind).length<AD_LIMITS[body.kind],'今日广告奖励次数已用完');
   // Check the actual reward rules before showing an ad (full stamina, locked
   // challenges, absent recruitment or already doubled results must not play).
   const {GameService}=require(core+'/game.js'),{MemoryStorage}=require(core+'/../platform/storage.js'),{SaveRepository,SAVE_KEY,encodeSave}=require(core+'/save.js');
   const storage=new MemoryStorage();storage.setItem(SAVE_KEY,encodeSave(account.saves[body.region].save));
   new GameService(new SaveRepository(storage),{now},1,{skipResume:true}).receiveAdReward(crypto.randomBytes(24).toString('hex'),body.kind,context);
   const nonce=crypto.randomBytes(24).toString('hex');
   ads[nonce]={account:account.id,region:body.region,kind:body.kind,context,day:today(),adUnitId,startedAt:now(),expires:now()+10*60000,done:false,claimed:false};
   return {nonce,adUnitId};
  }
  const ad=ads[body.nonce];check(ad&&ad.account===account.id&&ad.region===body.region,'广告记录不存在或属于其他区服');
  if(route==='ad-cancel'){if(!ad.done)ad.expires=now()-1;return {ok:true};}
  if(route==='ad-complete'){
   if(ad.done)return {done:true};
   check(ad.expires>=now()&&ad.day===today(),'广告已过期，请重新观看');check(body.isEnded===true,'未完整观看广告，不发放奖励');
   const complete=mine.filter(([,row])=>row.done&&row.day===today());
   check(complete.length<AD_TOTAL_LIMIT&&complete.filter(([,row])=>row.kind===ad.kind).length<AD_LIMITS[ad.kind],'今日广告奖励次数已用完');
   // WeChat's documented completion signal is SDK onClose(isEnded), not a
   // cryptographically signed provider callback. Nonces, identity, quotas and
   // exactly-once rewards are enforced here; do not label this provider proof.
   ad.done=true;ad.completedAt=now();ad.verification='wechat-sdk-onClose';account.adCount=(account.adCount??0)+1;return {done:true};
  }
  if(route==='ad-status')return ad.done?{done:true,kind:ad.kind,context:ad.context,receipt:body.nonce,claimed:ad.claimed}:{done:false,expired:ad.expires<now()};
  if(route==='ad-ack'){check(ad.done&&account.saves[ad.region].save.commands?.['verifiedAd:'+body.nonce],'请先保存广告奖励');ad.claimed=true;return {ok:true};}
  throw Error('广告接口不存在');
 }
 return {handle,available};
}
module.exports={createWechatAdService};
