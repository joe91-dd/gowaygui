'use strict';
const crypto=require('node:crypto'),copy=require('./clone.cjs');
const {publicName,publicPet}=require('./public-profile.cjs');
const check=(v,m)=>{if(!v)throw Error(m);};
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const INDEX='market-index-v1',doc=id=>'market-listing-'+id;
const hour=3600000,day=at=>new Date(at+8*hour).toISOString().slice(0,10);
const MAX_LISTINGS=500,MAX_BIDS=500;
/** Invoked inside the same database transaction as the authenticated player's record.
 * Listing escrow is shared. Settlement writes a durable winner; each account's
 * claim flag is atomically changed with its own parcel. No cross-account save replacement.
 */
function createMarketService({data,core,io,now=Date.now}){
 const {checkMarketPrice}=require(core+'/marketPolicy.js'),{validateSave}=require(core+'/save.js');
 const {ensureCommunityHome,assertAssetMovable,initCommunity}=require(core+'/community.js');
 const tax=n=>Math.ceil(n/5);
 async function get(id){check(typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id),'商品编号无效');const l=await io.get(doc(id));check(l,'商品不存在');return l;}
 async function many(ids){const rows=[];for(let i=0;i<ids.length;i+=20)rows.push(...await Promise.all(ids.slice(i,i+20).map(get)));return rows;}
 async function settle(l){
  if(l.status==='listed'&&l.publicUntil&&now()>=l.publicUntil){
   if(l.bids.length){
    // A secret fixed at listing creation yields a stable unbiased ordering of
    // distinct authenticated bidders, even if a transaction is retried.
    const ranked=l.bids.map(b=>({id:b.id,score:crypto.createHmac('sha256',l.secret).update(b.id).digest('hex')})).sort((a,b)=>a.score.localeCompare(b.score)||a.id.localeCompare(b.id));
    l.winner=ranked[0].id;l.status='sold';l.soldAt=l.publicUntil;l.tax=tax(l.price);
   }else l.publicUntil=0;
   await io.put(doc(l.id),l);
  }
  return l;
 }
 function makeParcel(a,l,suffix,grants,pets=[]){
  const id='account:market:'+l.id+':'+suffix;
  if(!(a.parcels??=[]).some(p=>p.id===id))a.parcels.push({id,key:id,region:l.region,title:'市场结算',body:suffix==='refund'?'本次预购未中选，冻结金币全额退还。':suffix==='winner'?'预购已中选，物品已由服务器托管，可随时领取。':'交易已完成，到账金额已扣除20%交易税。',at:now(),grants,pets,ack:false});
 }
 async function claim(a,l){
  await settle(l);l.claimed??={};
  if(l.kind==='rental'&&l.ownerId===a.id&&(l.rentalIncome??0)>(l.claimedIncome??0)){makeParcel(a,l,'rent-'+l.rentalIncome,[{kind:'gold',amount:l.rentalIncome-(l.claimedIncome??0)}]);l.claimedIncome=l.rentalIncome;await io.put(doc(l.id),l);}
  if(l.status==='sold'){
   if(l.ownerId===a.id&&!l.claimed.seller){makeParcel(a,l,'seller',l.price>l.tax?[{kind:'gold',amount:l.price-l.tax}]:[]);l.claimed.seller=true;}
   if(l.bids.some(b=>b.id===a.id)&&!l.claimed[a.id]){
    if(l.winner===a.id){const pet=l.pet?{...copy(l.pet),id:'market-'+l.id,locked:false}:undefined;makeParcel(a,l,'winner',pet?[]:[{kind:'book',skillId:l.skillId,amount:1}],pet?[pet]:[]);}
    else makeParcel(a,l,'refund',[{kind:'gold',amount:l.price}]);
    l.claimed[a.id]=true;
   }
   await io.put(doc(l.id),l);
  }
 }
 function addRef(a,id){a.marketRefs??=[];if(!a.marketRefs.includes(id)){check(a.marketRefs.length<200,'待结算商品较多，请先领取市场所得');a.marketRefs.push(id);}}
 function bump(slot){slot.save.revision++;validateSave(slot.save);slot.version++;slot.at=now();}
 async function collect(a){for(const l of await many([...(a.marketRefs??[])])){const id=l.id;await claim(a,l);if(l.status==='cancelled'||l.status==='sold'&&(l.ownerId!==a.id||l.claimed.seller)&&(!l.bids.some(b=>b.id===a.id)||l.claimed[a.id]))a.marketRefs=a.marketRefs.filter(x=>x!==id);}
 }
 async function sweep(){const index=await io.get(INDEX)??{ids:[]};const due=index.ids.filter(id=>index.deadlines?.[id]&&index.deadlines[id]<=now()).slice(0,50);for(const id of due){await settle(await get(id));delete index.deadlines[id];}if(due.length)await io.put(INDEX,index);return {settled:due.length};}
 async function handle(route,a,body){
  check(io,'服务器市场尚未部署');check(body.region==='island-1','区服不存在');
  const slot=a.saves?.[body.region];check(slot?.save,'请先同步进度');
  check(slot.protocol>=4&&slot.competitiveVerified===true,'当前存档尚未完成资产来源校验，市场暂不能使用；原有进度已保留');
  if(route==='market'){
   await collect(a);

   const index=await io.get(INDEX)??{ids:[]},rows=[];
   for(const row of await many(index.ids)){const l=await settle(row);if(l.status!=='listed'||l.region!==body.region||!!body.rental!==(l.kind==='rental')||body.mine&&l.ownerId!==a.id)continue;
    rows.push({id:l.id,ownerId:l.ownerId,ownerName:publicName(l.ownerId),kind:l.kind,pet:l.pet?publicPet(l.pet):undefined,skillId:l.skillId,price:l.price,createdAt:l.createdAt,publicUntil:l.publicUntil,preorders:l.bids.length,preordered:l.bids.some(b=>b.id===a.id)});
   }
   return {rows:rows.reverse(),serverNow:now(),pending:(a.parcels??[]).filter(p=>!p.ack&&p.region===body.region&&p.id.startsWith('account:market:'))};
  }
  check(route==='trade','接口不存在');check(typeof body.requestId==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId),'交易编号无效');
  a.marketReceipts??={};const fingerprint=digest(JSON.stringify([body.region,body.action,body.asset,body.id,body.price]));
  const old=a.marketReceipts[body.requestId];if(old){check(old.fingerprint===fingerprint,'交易编号已用于其他操作');return {version:slot.version,save:copy(slot.save)};}
  check(Object.keys(a.marketReceipts).length<10000,'市场操作记录已达上限，请联系客服');
  check(body.version===slot.version,'进度已更新，请重新登录后继续');
  const s=slot.save;ensureCommunityHome(s);initCommunity(s,now());s.skillBooks??={};
  if(body.action==='list'){
   check(['pet','book','rental'].includes(body.asset),'商品类型不存在');
   const index=await io.get(INDEX)??{ids:[]};const active=[];
   for(const row of await many(index.ids)){const l=await settle(row);if(l.status==='listed')active.push(l);}
   check(active.length<MAX_LISTINGS,'市场当前已满，请稍后上架');check(active.filter(l=>l.ownerId===a.id).length<20,'最多同时上架20件商品');
   const pet=body.asset==='book'?undefined:s.collection[body.id];
   const rule=checkMarketPrice(body.asset,body.price,pet,body.asset==='book'?body.id:undefined);
   const l={id:crypto.randomUUID(),region:body.region,ownerId:a.id,kind:body.asset,price:body.price,status:'listed',createdAt:now(),publicUntil:rule.publicity?now()+rule.publicity:0,bids:[],secret:crypto.randomBytes(32).toString('hex'),claimed:{}};
   if(pet){
    check(!pet.locked,'请先解锁伙伴');assertAssetMovable(s,pet.id);check(!active.some(l=>l.ownerId===a.id&&l.pet?.id===pet.id),'这只伙伴已经上架');
    l.pet=copy(pet);
    if(body.asset==='pet'){
     check(!(s.homeTeam??[]).includes(pet.id)&&!s.community.arenaDefense.includes(pet.id)&&!s.community.arenaAttack.includes(pet.id),'请先将伙伴移出出战和竞技场阵容');
     check(Object.keys(s.collection).length>1,'至少保留一只自有伙伴');delete s.collection[pet.id];if(s.collectionOrder)s.collectionOrder=s.collectionOrder.filter(x=>x!==pet.id);
     s.community.assists=s.community.assists.filter(x=>x!==pet.id);if(s.community.showcase)s.community.showcase.ids=s.community.showcase.ids.filter(x=>x!==pet.id);
    }else{
     const d=day(now());if(a.rentalDay?.day!==d)a.rentalDay={day:d,listed:0};check(a.rentalDay.listed<5,'每天最多上架出租五只');a.rentalDay.listed++;
     // Locks only disposal/fusion; the owner can still use its own turtle.
     s.community.listings.push({id:l.id,ownerId:'local-player',kind:'rental',pet:copy(pet),price:l.price,createdAt:now(),status:'listed'});
    }
   }else{check((s.skillBooks?.[body.id]??0)>0,'技能书不足');l.skillId=body.id;s.skillBooks[body.id]--;}
   addRef(a,l.id);index.ids=active.map(l=>l.id).concat(l.id);await io.put(doc(l.id),l);index.deadlines??={};index.deadlines[l.id]=l.publicUntil;await io.put(INDEX,index);
  }else{
   const l=await settle(await get(body.id));check(l.region===body.region,'商品属于其他区服');
   check(l.status==='listed','商品已成交或已下架，请刷新并领取结算');
   if(body.action==='cancel'){
    check(l.ownerId===a.id,'只能下架自己的商品');check(!l.bids.length,'已有玩家预购，公示期间不能下架');
    if(l.kind==='pet'){check(Object.keys(s.collection).length<s.capacity,'背包已满，请先整理');check(!s.collection[l.pet.id],'伙伴编号冲突');s.collection[l.pet.id]=copy(l.pet);}
    else if(l.kind==='book')s.skillBooks[l.skillId]=(s.skillBooks[l.skillId]??0)+1;
    else {const lock=s.community.listings.find(x=>x.id===l.id);if(lock)lock.status='cancelled';}
    l.status='cancelled';
   }else{
    check(l.ownerId!==a.id,'不能购买或租用自己的商品');check(s.gold>=l.price,'金币不足');
    if(body.action==='preorder'){
     check(l.kind!=='rental'&&l.publicUntil>now(),'公示期已结束，请刷新商品');check(!l.bids.some(b=>b.id===a.id),'已预购，无需重复支付');check(l.bids.length<MAX_BIDS,'本商品预购人数已满');
     s.gold-=l.price;l.bids.push({id:a.id,at:now()});addRef(a,l.id);
    }else if(body.action==='rent'){
     check(l.kind==='rental','请选择租赁伙伴');checkMarketPrice('rental',l.price,l.pet);
     const d=day(now());if(l.rentalDay?.day!==d)l.rentalDay={day:d,count:0};if(a.borrowDay?.day!==d)a.borrowDay={day:d,count:0};
     check(l.rentalDay.count<5&&a.borrowDay.count<5,'今日租赁次数已用完');
     check(!s.community.loans.some(v=>v.ownerId===l.ownerId&&v.originalId===l.pet.id&&!v.finished&&(v.usedBy||v.expiresAt>now())),'已经租借同一只伙伴');
     const id='rental-'+crypto.randomUUID();s.community.loans.push({id,serverListingId:l.id,ownerId:l.ownerId,originalId:l.pet.id,turtle:{...copy(l.pet),id,locked:true},kind:'rental',createdAt:now(),expiresAt:now()+hour,finished:false});
     s.gold-=l.price;l.rentalDay.count++;a.borrowDay.count++;l.rentalIncome=(l.rentalIncome??0)+l.price-tax(l.price);
    }else{
     check(body.action==='buy'&&l.kind!=='rental','交易操作无效');check(!l.publicUntil,'公示期内只能预购');
     if(l.pet){check(Object.keys(s.collection).length<s.capacity,'背包已满，请先整理');const id='market-'+l.id;check(!s.collection[id],'物品已领取');s.collection[id]={...copy(l.pet),id,locked:false};}
     else s.skillBooks[l.skillId]=(s.skillBooks[l.skillId]??0)+1;
     s.gold-=l.price;l.winner=a.id;l.status='sold';l.soldAt=now();l.tax=tax(l.price);
    }
   }
   await io.put(doc(l.id),l);
  }
  bump(slot);a.marketReceipts[body.requestId]={fingerprint,at:now()};return {version:slot.version,save:copy(s)};
 }
 return {handle,claim,settle,collect,sweep};
}
module.exports={createMarketService};
