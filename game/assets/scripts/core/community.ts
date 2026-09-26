import {goldAmount} from './economy';
import type {GameSave,Turtle,SkillId} from './types';
import type {CommunityAction,CommunityState,IslandPlayer,Listing,PetChoice,Loan} from './communityTypes';
import {ROLES,ROLE_IDS,SKILL_BY_ID,SKILLS} from './data';
import {initialTalents,initialSkills} from './talents';
import {turtleQuality} from './prototypeConfig';
import {copy,requireRule} from './save';
import {random} from './random';

export const LOCAL_PLAYER='local-player';
export const TRADE_TAX=.2;
export const chinaDate=(now:number)=>new Date(now+8*3600000).toISOString().slice(0,10);
const id=(s:GameSave,prefix:string)=>`${prefix}-${++s.idCounter}`;
export const taxFor=(gold:number):number=>Math.ceil(gold*TRADE_TAX);
export function communityOf(s:GameSave):CommunityState{requireRule(s.community,'请先进入海岛广场');return s.community;}
export function communityBusy(s:GameSave):boolean{return !!s.community?.raid&&!s.community.raid.settled||!!s.community?.arena&&!s.community.arena.settled;}
export function ensureCommunityHome(s:GameSave):void{
  requireRule(!s.shop?.pending,'请先查看商城结果');
  requireRule(!s.run||s.run.phase==='result','请先结束当前冒险');
  requireRule(!s.outsideFusion&&!s.bookReveal,'请先完成合成或技能学习');
  requireRule(!communityBusy(s),'请先结束副本或竞技场战斗');
}
export function playerName(s:GameSave,playerId:string):string{return playerId===LOCAL_PLAYER?communityOf(s).name:communityOf(s).aiPlayers[playerId]?.name??'未知岛主';}
export function initCommunity(s:GameSave,now:number):CommunityState{
  if(s.community)return s.community;
  const c:CommunityState={version:1,playerId:LOCAL_PLAYER,name:'小岛主',aiPlayers:{},friends:[],blocked:[],assists:[],messages:[],listings:[],loans:[],receipts:[],
    daily:{day:chinaDate(now),borrowed:0,listed:0,petRentals:{}},hideRankings:false,hiddenPets:[],scoreArrivals:{},scoreCounter:0,arenaOrder:[],arenaDefense:[],arenaAttack:[]};
  s.community=c;
  const names=['潮汐','小贝','珊瑚','阿浪','海盐','团团','晚风','椰椰'];
  for(let i=0;i<names.length;i++){
    const ownerId=`ai-islander-${i+1}`,a:IslandPlayer={id:ownerId,name:`${names[i]}·AI`,ai:true,gold:goldAmount(s,3000),pets:{},books:{},assists:[],chapter:Math.min(4,1+Math.floor(i/2)),chapterSeconds:300+i*9,endless:8+i*4,endlessSeconds:240+i*95};
    for(const role of ROLE_IDS){
      const petId=id(s,'ai-t'),t:Turtle={id:petId,role,name:'',innate:initialTalents(s,role),training:{attack:0,health:0,defense:0,growth:0},skills:initialSkills(s,role,Math.min(8,4+Math.floor(i/2))),generation:1,bornAt:now-i*60000,parentIds:[],locked:false};
      // The four local raid teammates use competent eight-skill builds. These are AI test rosters, not player drops.
      if(i<4){const builds:Record<typeof role,SkillId[]>={
        stone:['strong','armor','resist','regen','block','share','reflect','hold'],
        spike:['swift','reach','critical','lifesteal','combo','extraTarget','regen','piercingShot'],
        crystal:['swift','reach','bounce','shredResist','spellDrain','extraTarget','resist','crystalCannon'],
        leaf:['swift','reach','strong','doubleHeal','healShield','cleanse','extraTarget','greatHeal'],
        bubble:['swift','reach','root','weaken','shredArmor','extraTarget','resist','bubbleRing']};
        t.skills=builds[role];t.innate={attack:90,health:90,defense:90,growth:105};
      }
      a.pets[petId]=t;
    }
    a.assists=Object.keys(a.pets).slice(0,3);
    for(const skill of SKILLS)a.books[skill.id]=2;
    c.aiPlayers[ownerId]=a;c.arenaOrder.push(ownerId);
    // AI stock is explicit, finite test inventory. Listing escrow removes ownership from its usable roster.
    const stock=id(s,'ai-stock'),source=Object.values(a.pets)[i%5];
    const t=copy(source);t.id=stock;t.bornAt=now;t.parentIds=[];
    c.listings.push({id:id(s,'market'),ownerId,kind:'pet',pet:t,price:goldAmount(s,100+i*45),createdAt:now,status:'listed'});
    const book=SKILLS[(i*4)%SKILLS.length].id;a.books[book]!--;
    c.listings.push({id:id(s,'market'),ownerId,kind:'book',skillId:book,price:goldAmount(s,30+i*5),createdAt:now,status:'listed'});
    c.listings.push({id:id(s,'market'),ownerId,kind:'rental',pet:copy(source),price:goldAmount(s,15+i*5),createdAt:now,status:'listed'});
  }
  c.arenaOrder.push(LOCAL_PLAYER);c.friends=Object.keys(c.aiPlayers).slice(0,2);
  c.arenaDefense=Object.keys(s.collection).slice(0,5);c.arenaAttack=[...c.arenaDefense];
  refreshCommunity(s,now);return c;
}
export function refreshCommunity(s:GameSave,now:number):void{
  const c=communityOf(s),day=chinaDate(now);if(day>c.daily.day)c.daily={day,borrowed:0,listed:0,petRentals:{}};
  for(const loan of c.loans)if(!loan.usedBy&&now>=loan.expiresAt)loan.finished=true;
  c.assists=c.assists.filter(id=>!!s.collection[id]);c.arenaDefense=c.arenaDefense.filter(id=>!!s.collection[id]);c.arenaAttack=c.arenaAttack.filter(id=>!!s.collection[id]);
  for(const listing of c.listings)if(listing.kind==='rental'&&listing.status==='listed'&&listing.pet){const body=listing.ownerId===LOCAL_PLAYER?s.collection[listing.pet.id]:c.aiPlayers[listing.ownerId]?.pets[listing.pet.id];if(body)listing.pet=copy(body);}
  for(const row of ownedPetRows(s)){
    const score=turtleQuality(row.turtle).score,old=c.scoreArrivals[row.turtle.id];
    if(!old||old.score!==score)c.scoreArrivals[row.turtle.id]={score,order:++c.scoreCounter,at:now};
  }
}
export function ownedPetRows(s:GameSave):{ownerId:string;turtle:Turtle}[]{
  const c=communityOf(s),rows=Object.values(s.collection).map(turtle=>({ownerId:LOCAL_PLAYER,turtle}));
  for(const a of Object.values(c.aiPlayers))rows.push(...Object.values(a.pets).map(turtle=>({ownerId:a.id,turtle})));
  for(const listing of c.listings)if(listing.kind==='pet'&&listing.status==='listed'&&listing.pet)rows.push({ownerId:listing.ownerId,turtle:listing.pet});
  return rows;
}
export function petRanking(s:GameSave){
  const c=communityOf(s);return ownedPetRows(s).filter(row=>row.ownerId!==LOCAL_PLAYER||!c.hideRankings&&!c.hiddenPets.includes(row.turtle.id))
    .map(row=>({...row,ownerName:playerName(s,row.ownerId),score:turtleQuality(row.turtle).score,order:c.scoreArrivals[row.turtle.id]?.order??Number.MAX_SAFE_INTEGER}))
    .sort((a,b)=>b.score-a.score||a.order-b.order||a.turtle.id.localeCompare(b.turtle.id));
}
export function progressRanking(s:GameSave,kind:'chapter'|'endless'){
  const c=communityOf(s),rows=Object.values(c.aiPlayers).map(a=>({id:a.id,name:a.name,progress:kind==='chapter'?a.chapter:a.endless,seconds:kind==='chapter'?a.chapterSeconds:a.endlessSeconds,at:0}));
  if(!c.hideRankings){
    const candidates=Object.values(s.results).filter(r=>kind==='chapter'?r.mode!=='endless'&&r.victory:r.mode==='endless')
      .sort((a,b)=>(kind==='chapter'?b.levelId-a.levelId:b.waves-a.waves)||a.combatSeconds-b.combatSeconds||a.at-b.at);
    const best=candidates[0];if(best)rows.push({id:LOCAL_PLAYER,name:c.name,progress:kind==='chapter'?best.levelId:best.waves,seconds:best.combatSeconds,at:best.at});
  }
  return rows.sort((a,b)=>b.progress-a.progress||a.seconds-b.seconds||a.at-b.at||a.id.localeCompare(b.id));
}
export function usableLoans(s:GameSave,now=s.clockHighWater):Loan[]{return s.community?.loans.filter(l=>!l.finished&&!l.usedBy&&l.expiresAt>now)??[];}
export function availablePets(s:GameSave,now=s.clockHighWater):PetChoice[]{
  const owned=Object.values(s.collection).map(turtle=>({id:turtle.id,ownerId:LOCAL_PLAYER,originalId:turtle.id,turtle} as PetChoice));
  return owned.concat(usableLoans(s,now).map(l=>({id:l.id,ownerId:l.ownerId,originalId:l.originalId,turtle:copy(l.turtle),loanId:l.id})));
}
export function choosePets(s:GameSave,ids:string[],now:number):PetChoice[]{
  requireRule(ids.length>=1&&ids.length<=5&&new Set(ids).size===ids.length,'请选择一至五只不同伙伴');
  const available=availablePets(s,now),pets=ids.map(id=>available.find(t=>t.id===id));
  requireRule(pets.every(Boolean),'所选伙伴已到期、消耗或正在其他战斗中');
  const list=pets as PetChoice[];requireRule(new Set(list.map(t=>`${t.ownerId}:${t.originalId}`)).size===list.length,'同一本体和借来的副本只能选一只');return copy(list);
}
export function reserveLoans(s:GameSave,pets:PetChoice[],runId:string):void{for(const pet of pets)if(pet.loanId){const loan=communityOf(s).loans.find(l=>l.id===pet.loanId)!;requireRule(!loan.usedBy&&!loan.finished,'借用已使用');loan.usedBy=runId;}}
export function finishLoans(s:GameSave,runId:string):void{for(const loan of s.community?.loans??[])if(loan.usedBy===runId)loan.finished=true;}
export function assertAssetMovable(s:GameSave,petId:string):void{
  const c=s.community;if(!c)return;
  requireRule(!c.listings.some(l=>l.ownerId===LOCAL_PLAYER&&l.kind==='rental'&&l.status==='listed'&&l.pet?.id===petId),'请先下架这只龟的出租信息');
  requireRule(!c.loans.some(l=>l.ownerId===LOCAL_PLAYER&&l.originalId===petId&&!l.finished&&l.expiresAt>s.clockHighWater),'这只龟正在被借用，请等借用结束');
}
function newLoan(s:GameSave,ownerId:string,turtle:Turtle,kind:Loan['kind'],now:number):Loan{
  const c=communityOf(s);requireRule(!c.loans.some(l=>l.ownerId===ownerId&&l.originalId===turtle.id&&!l.finished&&(!l.usedBy&&l.expiresAt>now||!!l.usedBy)),'已经借到了同一本体');
  const loanId=id(s,'loan'),t=copy(turtle);t.id=loanId;t.locked=true;
  const loan:Loan={id:loanId,ownerId,originalId:turtle.id,turtle:t,kind,createdAt:now,expiresAt:now+3600000,finished:false};c.loans.push(loan);return loan;
}
function listingOf(s:GameSave,listingId:string):Listing{const l=communityOf(s).listings.find(x=>x.id===listingId);requireRule(l&&l.status==='listed','该商品已成交或下架');return l;}
function validPrice(s:GameSave,price:number):void{requireRule(Number.isSafeInteger(price)&&price>=1&&price<=goldAmount(s,100000000),'价格须为允许范围内的整数金币');}
function validOwnPet(s:GameSave,petId:string):Turtle{const t=s.collection[petId];requireRule(t&&!t.locked,'请选择已解锁的自有龟龟');return t;}
function giveOwnerGold(s:GameSave,ownerId:string,amount:number):void{if(ownerId===LOCAL_PLAYER)s.gold+=amount;else communityOf(s).aiPlayers[ownerId].gold+=amount;}
export function dispatchCommunity(s:GameSave,now:number,action:CommunityAction):unknown{
  const c=initCommunity(s,now);refreshCommunity(s,now);
  if(action.kind==='init'||action.kind==='refresh')return null;
  if(action.kind==='showcase'){
    requireRule(Array.isArray(action.ids)&&action.ids.length>=1&&action.ids.length<=5&&new Set(action.ids).size===action.ids.length,'请选择1至5只不同的展示伙伴');
    requireRule(action.ids.every(id=>!!s.collection[id]&&!c.hiddenPets.includes(id)),'仅可展示自己的公开伙伴，请重新选择');
    c.showcase={ids:[...action.ids],rotate:!!action.rotate};return null;
  }
  if(action.kind==='renamePlayer'){const name=action.name.trim();requireRule(name.length>=1&&name.length<=16&&!/[\x00-\x1f]/.test(name),'岛主名为1～16字');c.name=name;return null;}
  if(action.kind==='rankVisibility'){
    if(action.petId){requireRule(s.collection[action.petId],'只能设置自己的龟');c.hiddenPets=c.hiddenPets.filter(id=>id!==action.petId);if(action.hidden)c.hiddenPets.push(action.petId);}else c.hideRankings=action.hidden;return null;
  }
  if(action.kind==='friend'){
    requireRule(c.aiPlayers[action.id],'找不到这位岛主');c.friends=c.friends.filter(x=>x!==action.id);
    if(action.action==='add'){requireRule(!c.blocked.includes(action.id),'请先解除屏蔽');c.friends.push(action.id);}
    if(action.action==='block'&&!c.blocked.includes(action.id))c.blocked.push(action.id);
    if(action.action==='unblock')c.blocked=c.blocked.filter(x=>x!==action.id);return null;
  }
  if(action.kind==='chat'){
    requireRule(action.to==='world'||c.friends.includes(action.to)&&!c.blocked.includes(action.to),'请先添加好友或解除屏蔽');
    const message=action.text.trim();requireRule(message.length>=1&&message.length<=120&&!/[\x00-\x1f]/.test(message),'聊天消息为1～120字');
    c.messages.push({id:id(s,'chat'),from:LOCAL_PLAYER,to:action.to,text:message,at:now});
    const responder=action.to==='world'?Object.keys(c.aiPlayers).filter(x=>!c.blocked.includes(x))[Math.floor(random(s)*Object.keys(c.aiPlayers).filter(x=>!c.blocked.includes(x)).length)]:action.to;
    if(responder){const reply=/借|援助|租/.test(message)?'我的援助栏里有伙伴，可以借去打一次关卡或无尽，记得一小时内出发。':/副本|组队/.test(message)?'一起去试试副本吧！我会照顾自己的站位和替补。':/合|天赋|技能/.test(message)?'先比较技能搭配和天赋，再决定主龟和副龟。祝你合出好伙伴！':'收到啦！我在海岛上等你，一起把伙伴养得更厉害。';
      c.messages.push({id:id(s,'chat'),from:responder,to:action.to==='world'?'world':LOCAL_PLAYER,text:reply,at:now+1});}
    c.messages=c.messages.slice(-200);return null;
  }
  ensureCommunityHome(s);
  if(action.kind==='assists'){requireRule(action.ids.length<=3&&new Set(action.ids).size===action.ids.length&&action.ids.every(id=>!!s.collection[id]),'援助栏最多三只自有龟');c.assists=[...action.ids];return null;}
  if(action.kind==='arenaDefense'||action.kind==='arenaAttack'){
    requireRule(action.ids.length===5&&new Set(action.ids).size===5,'竞技场需要五只不同的龟');
    if(action.kind==='arenaDefense'){requireRule(action.ids.every(id=>!!s.collection[id]),'防守仅可设置自有龟');c.arenaDefense=[...action.ids];}
    else{const pets=choosePets(s,action.ids,now);requireRule(pets.every(p=>!p.loanId),'竞技场只能设置自有龟；借用和租赁仅限关卡、无尽');c.arenaAttack=[...action.ids];}return null;
  }
  if(action.kind==='borrow'){
    requireRule(c.friends.includes(action.ownerId)&&!c.blocked.includes(action.ownerId),'只有好友之间可以援助');const a=c.aiPlayers[action.ownerId],t=a?.pets[action.petId];
    requireRule(a&&t&&a.assists.includes(action.petId),'这只伙伴不在好友援助栏');return newLoan(s,a.id,t,'friend',now);
  }
  if(action.kind==='list'){
    validPrice(s,action.price);let pet:Turtle|undefined,skillId:SkillId|undefined;
    if(action.asset==='book'){skillId=action.id as SkillId;requireRule(SKILL_BY_ID[skillId]&&(s.skillBooks?.[skillId]??0)>0,'技能书不足');s.skillBooks![skillId]!--;}
    else{
      pet=copy(validOwnPet(s,action.id));assertAssetMovable(s,action.id);
      if(action.asset==='pet'){requireRule(Object.keys(s.collection).length>1,'至少留一只自有龟');delete s.collection[action.id];c.assists=c.assists.filter(x=>x!==action.id);c.arenaDefense=c.arenaDefense.filter(x=>x!==action.id);}
      else{requireRule(c.daily.listed<5,'今天最多上架出租五只');c.daily.listed++;}
    }
    const row:Listing={id:id(s,'market'),ownerId:LOCAL_PLAYER,kind:action.asset,price:action.price,createdAt:now,status:'listed',...(pet?{pet}:{}),...(skillId?{skillId}:{})};c.listings.push(row);return row;
  }
  if(action.kind==='cancelListing'){
    const l=listingOf(s,action.id);requireRule(l.ownerId===LOCAL_PLAYER,'只能下架自己的商品');
    if(l.kind==='pet'){requireRule(Object.keys(s.collection).length<s.capacity,'收藏已满，先腾出位置再取回');s.collection[l.pet!.id]=copy(l.pet!);}
    if(l.kind==='book'){s.skillBooks??={};s.skillBooks[l.skillId!]=(s.skillBooks[l.skillId!]??0)+1;}l.status='cancelled';return null;
  }
  if(action.kind==='buy'){
    const l=listingOf(s,action.id);requireRule(l.ownerId!==LOCAL_PLAYER&&l.kind!=='rental','不能购买自己的商品');requireRule(s.gold>=l.price,'金币不足');
    if(l.kind==='pet'){requireRule(Object.keys(s.collection).length<s.capacity,'收藏已满');requireRule(!s.collection[l.pet!.id],'该宠物已在收藏');s.collection[l.pet!.id]=copy(l.pet!);}
    else{s.skillBooks??={};s.skillBooks[l.skillId!]=(s.skillBooks[l.skillId!]??0)+1;}
    const tax=taxFor(l.price);s.gold-=l.price;giveOwnerGold(s,l.ownerId,l.price-tax);l.status='sold';l.buyerId=LOCAL_PLAYER;l.tax=tax;
    c.receipts.push({id:id(s,'receipt'),kind:'buy',listingId:l.id,gross:l.price,tax,net:l.price-tax,at:now,otherId:l.ownerId});refreshCommunity(s,now);return copy(l);
  }
  if(action.kind==='rent'){
    const l=listingOf(s,action.id);requireRule(l.kind==='rental'&&l.ownerId!==LOCAL_PLAYER,'请选择其他岛主的出租伙伴');
    const key=`${l.ownerId}:${l.pet!.id}`;requireRule(c.daily.borrowed<5,'今天最多租赁五只');requireRule((c.daily.petRentals[key]??0)<5,'这只龟今天已被租赁五次');requireRule(s.gold>=l.price,'金币不足');
    const original=c.aiPlayers[l.ownerId]?.pets[l.pet!.id];requireRule(original,'出租本体已经不在');const loan=newLoan(s,l.ownerId,original,'rental',now),tax=taxFor(l.price);
    s.gold-=l.price;giveOwnerGold(s,l.ownerId,l.price-tax);c.daily.borrowed++;c.daily.petRentals[key]=(c.daily.petRentals[key]??0)+1;
    c.receipts.push({id:id(s,'receipt'),kind:'rent',listingId:l.id,gross:l.price,tax,net:l.price-tax,at:now,otherId:l.ownerId});return loan;
  }
  if(action.kind==='aiPurchase'){
    const l=listingOf(s,action.id);requireRule(l.ownerId===LOCAL_PLAYER,'只能为自己的上架商品寻找AI买家');
    const buyer=Object.values(c.aiPlayers).find(a=>a.gold>=l.price);requireRule(buyer,'暂时没有金币足够的AI买家');const tax=taxFor(l.price);
    if(l.kind==='rental'){
      requireRule(s.collection[l.pet!.id],'出租本体已经不在');const key=`${LOCAL_PLAYER}:${l.pet!.id}`;requireRule((c.daily.petRentals[key]??0)<5,'这只龟今天已出租五次');c.daily.petRentals[key]=(c.daily.petRentals[key]??0)+1;
      // AI's one battle is simulated immediately; the owner remains able to use the body.
    }else{
      l.status='sold';l.buyerId=buyer.id;l.tax=tax;
      if(l.kind==='pet')buyer.pets[l.pet!.id]=copy(l.pet!);else buyer.books[l.skillId!]=(buyer.books[l.skillId!]??0)+1;
    }
    buyer.gold-=l.price;s.gold+=l.price-tax;c.receipts.push({id:id(s,'receipt'),kind:l.kind==='rental'?'rentalIncome':'sell',listingId:l.id,gross:l.price,tax,net:l.price-tax,at:now,otherId:buyer.id});return copy(l);
  }
  throw new Error('未知海岛操作');
}
