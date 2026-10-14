'use strict';
const structuredClone=require('./clone.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),hash=v=>crypto.createHash('sha256').update(v).digest('hex'),copy=v=>structuredClone(v);
const check=(v,m)=>{if(!v)throw Error(m);},safe=v=>String(v??'').trim(),DAY=86400000;
const {privacyPolicy,VERSION:DEFAULT_PRIVACY_VERSION}=require('./privacy-policy.cjs');
const {initialSlot,replaySave}=require('./cloud-save.cjs');
const {eraseAccount}=require('./account-erasure.cjs');
const {decodeCloudSave,acceptSavePart}=require('./cloud-save-wire.cjs');
function createAccountService(options){
 const PRIVACY_VERSION=options.privacyVersion??DEFAULT_PRIVACY_VERSION;
 const core=options.core,policy=require(core+'/taskPolicy.js'),{makeInitialSave}=require(core+'/game.js'),{initialSkills}=require(core+'/talents.js'),{initDevelopment}=require(core+'/development.js'),{validateSave}=require(core+'/save.js');
 const file=options.file,now=options.now??Date.now,data=options.data??(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{accounts:[],sessions:{},ads:{},feedback:[]});
 const attempts=new Map(),regions=options.regions??[{id:'island-1',name:'晴湾一区',status:'可进入'}];
 const persist=()=>{if(options.data)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(file+'.tmp',file);};
 const day=()=>policy.taskDay(now()),week=()=>{const d=new Date(day()+'T00:00:00Z'),n=(d.getUTCDay()+6)%7;return new Date(d.getTime()-n*DAY).toISOString().slice(0,10);};
 const auth=token=>{const session=data.sessions[hash(token??'')];check(session&&session.expires>now(),'请先登录账号');const a=data.accounts.find(x=>x.id===session.id);check(a,'账号不存在');return a;};
 const tokenFor=a=>{const token=crypto.randomBytes(32).toString('hex');data.sessions[hash(token)]={id:a.id,expires:now()+30*DAY};return token;};
 const loggedIn=a=>{a.days??=[];if(!a.days.includes(day()))a.days.push(day());a.lastLogin=now();if(a.inviter&&!a.inviteCounted){const inviter=data.accounts.find(x=>x.code===a.inviter);if(inviter&&inviter.id!==a.id){inviter.invitees??=[];if(!inviter.invitees.includes(a.id))inviter.invitees.push(a.id);a.inviteCounted=true;}}};
 const view=a=>({id:a.id,username:a.username,code:a.code,invites:a.inviteCount??a.invitees?.length??0,ads:a.adCount??0,days:a.days?.length??0,claims:a.claims??[],dailyPoints:a.activity?.[day()]??10,weeklyPoints:Object.entries(a.activity??{}).reduce((n,[d,p])=>n+(d>=week()&&d<=day()?p:0),0),pending:(a.parcels??[]).filter(p=>!p.ack).map(p=>copy(p)),regions,adAvailable:!!(options.wechatAds?.available||options.adURL&&options.adSecret),support:options.support??'游戏内反馈工单',serverDay:day(),serverWeek:week()});
 function activity(a,save){const j=save?.taskJournal;if(!j)return;a.activity??={};if(j.day===day())a.activity[day()]=Math.max(a.activity[day()]??10,policy.activityPoints(j.counts));for(const row of j.history??[])if(row.day>=week()&&row.day<day()&&row.points>=0&&row.points<=100)a.activity[row.day]=Math.max(a.activity[row.day]??0,row.points);}
 function parcel(a,key,gift,region){const existing=(a.parcels??[]).find(p=>p.key===key);if(existing)return copy(existing);const grants=[],pets=[];
  if(gift.gold)grants.push({kind:'gold',amount:gift.gold});const amount=gift.material??gift.materials??0;if(amount)for(const m of ['attack','health','defense','growth'])grants.push({kind:'material',material:m,amount});if(gift.pack)grants.push({kind:'bookPack',grade:gift.pack,amount:1});
  if(gift.skills){const seed=makeInitialSave(now(),crypto.randomInt(1,2147483647)),pool=Object.values(seed.collection);for(let i=0;i<gift.count;i++){const t=copy(pool[crypto.randomInt(pool.length)]);t.id='reward-'+crypto.randomUUID();t.skills=initialSkills(seed,t.role,gift.skills);initDevelopment(t);pets.push(t);}}
  const result={id:'account:'+crypto.randomUUID(),key,region,title:gift.title??'海岛任务奖励',body:'奖励已由账号服务记录。宠物造型、天赋及技能搭配随机；不会保证满天赋。',at:now(),grants,pets,ack:false};(a.parcels??=[]).push(result);(a.claims??=[]).push(key);persist();return copy(result);
 }
 async function handle(route,body,token,ip='local'){
  if(route==='privacy')return privacyPolicy(options.privacy);
  if(route==='release-status')return {protocol:3,publicNames:'generated',competitive:false,wechatAdUnitId:options.wechatAdUnitId||'',wechatAdAvailable:false,healthVerified:false};
  if(route==='config')return {regions,adAvailable:!!(options.wechatAds?.available||options.adURL&&options.adSecret),support:options.support??'游戏内反馈工单'};
  if(route==='register'||route==='login'){
   check(body.privacyVersion===PRIVACY_VERSION&&body.consent===true,'请阅读并同意当前版本的隐私政策');
   const n=safe(body.username).toLowerCase(),password=String(body.password??''),rate=attempts.get(ip)??{count:0,until:0};if(rate.until<now()){rate.count=0;rate.until=now()+60000;}check(++rate.count<=15,'尝试太频繁，请一分钟后再试');attempts.set(ip,rate);
   check(/^[a-z0-9_]{4,24}$/.test(n),'账号使用4～24位字母、数字或下划线');check(password.length>=10&&password.length<=128,'密码需要10～128个字符');let a=data.accounts.find(x=>x.username===n);
   if(route==='register'){check(!a,'该账号已注册，请登录');check(data.accounts.length<10000,'服务人数已满');const salt=crypto.randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64);a={id:crypto.randomUUID(),username:n,password:derived.toString('hex'),salt,code:crypto.randomBytes(5).toString('hex').toUpperCase(),createdAt:now(),privacyConsent:{version:PRIVACY_VERSION,at:now()},days:[],claims:[],parcels:[],activity:{},saves:{}};const code=safe(body.inviter).toUpperCase();if(code){check(data.accounts.some(x=>x.code===code),'邀请码无效');a.inviter=code;}check(!data.accounts.some(x=>x.username===n),'该账号已注册，请登录');data.accounts.push(a);persist();return {registered:true};}
   const salt=a?.salt??'00000000000000000000000000000000',derived=await scrypt(password,salt,64),expected=Buffer.from(a?.password??'00'.repeat(64),'hex');check(a&&crypto.timingSafeEqual(derived,expected),'账号或密码不正确');a.privacyConsent={version:PRIVACY_VERSION,at:now()};loggedIn(a);a.activity[day()]=Math.max(10,a.activity[day()]??0);const session=tokenFor(a);persist();return {token:session,account:view(a)};
  }
  if(route==='ad-callback'){
   check(options.adSecret,'广告验证尚未配置');const signature=crypto.createHmac('sha256',options.adSecret).update(String(body.nonce)+':'+String(body.transactionId)).digest('hex');check(typeof body.signature==='string'&&/^[a-f0-9]{64}$/.test(body.signature)&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(body.signature)),'广告验证失败');
   const ad=data.ads[body.nonce];check(ad&&ad.expires>=now(),'广告凭证已过期');check(/^[a-zA-Z0-9:_-]{1,150}$/.test(body.transactionId),'广告流水号无效');check(!Object.values(data.ads).some(other=>other!==ad&&other.transactionId===body.transactionId),'广告流水号已使用');if(ad.done)return {ok:true};
   const a=data.accounts.find(a=>a.id===ad.account);check(a,'账号已注销');ad.done=true;ad.transactionId=body.transactionId;a.adCount=(a.adCount??0)+1;persist();return {ok:true};
  }
  const a=auth(token);await options.syncInvites?.(a);
  if(route==='delete-account'){
   check(body.confirm==='注销哥喂龟账号','请确认永久注销账号');
   check(!(a.marketRefs?.length),'请先在市场下架物品并领取预购结算，再注销账号');
   if(options.authMode==='wechat'){check(a.authType==='wechat','账号身份不匹配');}
   else {const password=String(body.password??'');check(password.length>=10&&password.length<=128,'密码不正确');
    const actual=await scrypt(password,a.salt,64);check(crypto.timingSafeEqual(actual,Buffer.from(a.password,'hex')),'密码不正确');}
   const ownedRegions=Object.keys(a.saves??{});await options.eraseLinkedAccount?.(a.id);eraseAccount(data,a,now());persist();return {deleted:true,regions:ownedRegions};
  }
  if(route==='withdraw-consent'){
   a.privacyConsent={version:PRIVACY_VERSION,withdrawnAt:now()};
   for(const [key,s]of Object.entries(data.sessions))if(s.id===a.id)delete data.sessions[key];persist();return {withdrawn:true,regions:Object.keys(a.saves??{})};
  }
  if(route==='consent'){check(body.version===PRIVACY_VERSION&&body.accept===true,'请阅读并同意当前版本的隐私政策');a.privacyConsent={version:PRIVACY_VERSION,at:now()};persist();return {ok:true};}
  if(route!=='logout')check(a.privacyConsent?.version===PRIVACY_VERSION&&!a.privacyConsent?.withdrawnAt,'隐私政策已更新，请重新登录并确认');
  if(route.startsWith('modes/')){check(options.modes,'房间云服务尚未配置');const slot=a.saves?.[body.region];return options.modes.handle(route.slice(6),body,a,body.region,slot);}
  if(route==='redeem'&&options.authMode==='wechat')throw Error('微信版不提供兑换码功能');
  if(route==='redeem'){check(regions.some(r=>r.id===body.region),'区服不存在');const result=options.cloudCdk?await options.cloudCdk.redeem(a,body):require('./cdk-service.cjs').createCdkService({data,core,now}).redeem(a,body);persist();return result;}
  if(route==='social/rankings'&&options.rankings)return options.rankings.list(a,body);
  if(['social/market','social/trade'].includes(route)&&options.marketIo){const result=await require('./market-service.cjs').createMarketService({data,core,io:options.marketIo,now}).handle(route.slice(7),a,body);for(const [region,slot]of Object.entries(a.saves??{}))await options.modes?.refreshOwned(a,region,slot);persist();return result;}
  if(route.startsWith('social/')){const result=require('./friends-social.cjs').createFriendsSocial({data,core,now}).handle(route.slice(7),a,body);persist();return result;}
  if(route==='state'){if(options.marketIo&&a.marketRefs?.length)await require('./market-service.cjs').createMarketService({data,core,io:options.marketIo,now}).collect(a);loggedIn(a);a.activity[day()]=Math.max(10,a.activity[day()]??0);persist();return view(a);}
  if(route==='logout'){delete data.sessions[hash(token)];persist();return {ok:true};}
  if(route==='password'){const old=String(body.oldPassword??'');check(old.length>=10&&old.length<=128,'原密码不正确');const current=await scrypt(old,a.salt,64);check(crypto.timingSafeEqual(current,Buffer.from(a.password,'hex')),'原密码不正确');const next=String(body.password??'');check(next.length>=10&&next.length<=128,'新密码需要10～128个字符');a.salt=crypto.randomBytes(16).toString('hex');a.password=(await scrypt(next,a.salt,64)).toString('hex');for(const [k,v]of Object.entries(data.sessions))if(v.id===a.id)delete data.sessions[k];const session=tokenFor(a);persist();return {token:session};}
  if(route==='save-transfer'){
   const decoded=acceptSavePart(a,body,now());
   if(!decoded){persist();return {requestId:body.requestId,index:body.index,complete:false};}
   const result=await handle('save',decoded,token,ip);delete a.saveTransfer;persist();
   return {...result,requestId:body.requestId,index:body.index,complete:true};
  }
  if(route==='save'){
   body=decodeCloudSave(body);
   const region=regions.find(r=>r.id===body.region);check(region,'区服不存在');a.saves??={};
   if(!a.saves[region.id]){check(!body.save,'请先读取服务器初始化存档，不能导入未验证的游客资产');a.saves[region.id]=initialSlot(core,now());persist();}
   const slot=a.saves[region.id];if(!body.save)return copy(slot);
   check(typeof body.requestId==='string'&&/^[a-zA-Z0-9:_-]{8,160}$/.test(body.requestId),'缺少有效的保存编号');
   const digest=hash(JSON.stringify(body.save));
   if(slot.lastRequest===body.requestId){check(slot.lastDigest===digest,'保存编号已用于其他进度');return {version:slot.version};}
   check(slot.version===body.version,'其他设备更新了此账号，请重新登录后继续');
   validateSave(body.save);check(JSON.stringify(body.save).length<=12*1024*1024,'存档过大，请联系客服');
   const replay=replaySave({core,data,account:a,region:region.id,slot,body,now:now(),roomReceipt:options.roomReceipt});
   const result={...slot,...replay,version:slot.version+1,at:now(),lastRequest:body.requestId,lastDigest:digest};
   a.saves[region.id]=result;await options.modes?.refreshOwned(a,region.id,result);activity(a,result.save);persist();return {version:result.version};
  }
  if(route==='claim'){
   const region=regions.find(r=>r.id===body.region);check(region,'请先选择领取区服');
   const key=safe(body.key),existing=(a.parcels??[]).find(p=>p.key===key);if(existing){check(existing.region===region.id,'这份奖励已在其他区服生成，请回到原区服领取');return copy(existing);}
   let gift;
   if(key.startsWith('invite:')){gift=policy.INVITE_MILESTONES.find(x=>key==='invite:'+x.at);check(gift&&(a.inviteCount??a.invitees?.length??0)>=gift.at,'有效邀请人数不足');}
   else if(key.startsWith('ads:')){gift=policy.AD_MILESTONES.find(x=>key==='ads:'+x.at);check(gift&&(a.adCount??0)>=gift.at,'已完成的广告次数不足');}
   else if(key.startsWith('login:')){const d=Number(key.slice(6));check(Number.isInteger(d)&&d>=1&&d<=7&&(a.days?.length??0)>=d,'尚未到达对应登录天数');gift=policy.LOGIN_GIFTS[d-1];}
   else if(key.startsWith('daily:')){gift=policy.DAILY_ACTIVITY.find(x=>key==='daily:'+day()+':'+x.at);check(gift&&(a.activity?.[day()]??0)>=gift.at,'今日活跃度不足');}
   else if(key.startsWith('weekly:')){gift=policy.WEEKLY_ACTIVITY.find(x=>key==='weekly:'+week()+':'+x.at);check(gift&&view(a).weeklyPoints>=gift.at,'本周活跃度不足');}
   check(gift,'奖励不存在');return parcel(a,key,gift,region.id);
  }
  if(route==='ack'){const p=(a.parcels??[]).find(p=>p.id===body.id);check(p,'奖励不存在');check(p.region===body.region,'奖励属于其他区服');const stored=a.saves[p.region]?.save;check(stored?.commands?.[p.id]?.kind==='accountReward','请先成功保存奖励，再确认领取');p.ack=true;persist();return {ok:true};}
  if(route==='feedback'){const text=safe(body.text),contact=safe(body.contact);check(text.length>=5&&text.length<=2000&&contact.length<=120,'请填写5～2000字的问题描述');check(!data.feedback.some(f=>f.account===a.id&&now()-f.at<60000),'反馈已收到，请稍后再提交');const ticket={id:'GW-'+crypto.randomBytes(4).toString('hex').toUpperCase(),account:a.id,text,contact,at:now(),status:'open'};data.feedback.push(ticket);persist();return {ticket:ticket.id};}
  if(options.wechatAds&&['ad-begin','ad-pending','ad-status','ad-complete','ad-cancel','ad-ack'].includes(route))return options.wechatAds.handle(route,a,body);
  if(route==='ad-begin'){check(options.adURL&&options.adSecret,'真实广告尚未接入，暂时没有可播放的广告');const {AD_LIMITS,AD_TOTAL_LIMIT}=require(core+'/rewardedAds.js');check(Object.prototype.hasOwnProperty.call(AD_LIMITS,body.kind),'广告入口不存在');if(body.kind==='raidAttempt')check(/^raid[0-3]$/.test(body.context??''),'请选择要补充次数的副本');check(regions.some(r=>r.id===body.region),'请先选择区服');const ads=Object.values(data.ads).filter(x=>x.account===a.id&&x.day===day());check(ads.filter(x=>x.done).length<AD_TOTAL_LIMIT&&ads.filter(x=>x.done&&x.kind===body.kind).length<AD_LIMITS[body.kind],'今日广告奖励次数已用完');check(!ads.some(x=>!x.done&&x.expires>now()),'已有广告播放中');const nonce=crypto.randomBytes(24).toString('hex');data.ads[nonce]={account:a.id,region:body.region,kind:body.kind,context:safe(body.context),day:day(),expires:now()+10*60000,done:false,claimed:false};persist();return {nonce,url:options.adURL+(options.adURL.includes('?')?'&':'?')+'nonce='+nonce};}
  if(route==='ad-pending')return Object.entries(data.ads).filter(([,ad])=>ad.account===a.id&&ad.region===body.region&&!ad.claimed&&(ad.done||ad.expires>now())).map(([nonce,ad])=>({nonce,done:ad.done,kind:ad.kind,context:ad.context}));
  if(route==='ad-status'){const ad=data.ads[body.nonce];check(ad&&ad.account===a.id&&ad.region===body.region,'广告记录不存在或属于其他区服');if(!ad.done)return {done:false,expired:ad.expires<now()};return {done:true,kind:ad.kind,context:ad.context,receipt:body.nonce,claimed:ad.claimed};}
  if(route==='ad-ack'){const ad=data.ads[body.nonce];check(ad&&ad.account===a.id&&ad.region===body.region&&ad.done,'广告尚未验证完成');check(a.saves[ad.region]?.save?.commands?.['verifiedAd:'+body.nonce],'请先保存广告奖励');ad.claimed=true;persist();return {ok:true};}
  throw Error('账号接口不存在');
 }
 // This method is never routed by the HTTP server. The CloudBase gateway has
 // already selected a private record using getWXContext(), not client input.
 async function wechatLogin(body){
  check(options.authMode==='wechat','微信身份验证不可用');
  check(body.privacyVersion===PRIVACY_VERSION&&body.consent===true,'请阅读并同意当前版本的隐私政策');
  check(data.accounts.length<=1,'微信账号资料异常，请联系客服');
  let a=data.accounts[0];const newAccount=!a;
  if(!a){const id=crypto.randomUUID();a={id,authType:'wechat',username:'海岛玩家'+id.replace(/-/g,'').slice(0,8).toUpperCase(),code:crypto.randomBytes(5).toString('hex').toUpperCase(),createdAt:now(),days:[],claims:[],parcels:[],activity:{},saves:{}};data.accounts.push(a);}
  check(a.authType==='wechat','账号身份不匹配');
  a.privacyConsent={version:PRIVACY_VERSION,at:now()};loggedIn(a);a.activity[day()]=Math.max(10,a.activity[day()]??0);await options.registerInvite?.(a,body.inviter,newAccount);
  for(const [k,s]of Object.entries(data.sessions))if(s.expires<=now())delete data.sessions[k];
  const sessions=Object.entries(data.sessions).sort(([,a],[,b])=>a.expires-b.expires);
  while(sessions.length>=8)delete data.sessions[sessions.shift()[0]];
  const token=tokenFor(a);persist();return {token,account:view(a)};
 }
 return {handle,persist,data,wechatLogin};
}
module.exports={createAccountService};
