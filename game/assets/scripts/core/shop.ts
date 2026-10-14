import {policyBook} from './bookPolicy';
import {skillUnlocked} from './soloProgress';
import {bookAllowed} from './bookPolicy';
import type {GameSave,SkillId,Turtle,Material} from './types';
import {SKILLS} from './data';
import {random} from './random';
import {initialSkills} from './talents';
import {BOOK_WEIGHTS} from './prototypeConfig';
import {goldAmount} from './economy';
import {requireRule} from './save';

export type ShopPool='turtle'|'book'|'pack';
export type ShopPackId='turtleBasic'|'turtleAdvanced'|'bookRandom'|'bookAttack'|'materialRandom'|'materialFixed';
export interface ShopDraw {turtle?:Turtle;skillId?:SkillId;material?:Material;amount?:number;guarantee:'normal'|'ten'|'hundred'}
export interface ShopReceipt {id:string;pool:ShopPool;packId?:ShopPackId;count:1|10;cost:number;draws:ShopDraw[];at:number}
export interface ShopState {turtleCount:number;bookCount:number;pending?:ShopReceipt;daily?:{day:string;counts:Partial<Record<ShopPackId,number>>}}
export const SHOP_PACKS:{id:ShopPackId;name:string;price:number;description:string}[]=[
  {id:'turtleBasic',name:'1～4技能龟龟包',price:72,description:'获得一只随机造型的龟。1/2/3/4技能概率：54% / 30% / 13% / 3%。天赋和搭配随机。'},
  {id:'turtleAdvanced',name:'4～5技能龟龟包',price:600,description:'获得一只随机造型的龟。4技能90%，5技能10%。天赋和搭配随机，不保证极品。'},
  {id:'bookRandom',name:'随机技能书包',price:32,description:'获得一本随机技能书，使用普通招募的技能权重；包含低概率职业主动；专精与珍贵技能从高级活动获得。'},
  {id:'bookAttack',name:'攻击技能书包',price:120,description:'获得一本攻击类书。98%为攻击被动，按普通权重分配；1%穿甲弹、1%海霜风暴。'},
  {id:'materialRandom',name:'随机培养材料包',price:600,description:'获得20份材料，每份独立抽取：蟹肉30%、蚌肉30%、鱼肉25%、海参15%。'},
  {id:'materialFixed',name:'培养材料组合包',price:1200,description:'固定获得蟹肉、蚌肉、鱼肉、海参各8份，共32份。'},
];
export const SHOP_PACK_LIMIT=20;
const shopDay=(now:number)=>new Date(now+8*3600000).toISOString().slice(0,10);
export function packRemaining(s:GameSave,now:number,id:ShopPackId):number{const daily=s.shop?.daily;return SHOP_PACK_LIMIT-(daily&&daily.day>=shopDay(now)?daily.counts[id]??0:0);}
export const SHOP_CONFIG={turtlePrice:80,bookPrice:35,tenDiscount:.9,hundredEvery:100,turtleSkillWeights:[54,30,13,3],
  activeWeights:{hold:1,greatHeal:1.5,bubbleRing:1.5,piercingShot:.3,crystalCannon:.3} as Partial<Record<SkillId,number>>};
export const ATTACK_BOOKS:SkillId[]=['fervor','caprice','polymorph','giant','scatter','arcane','counterStorm','calm','swift','reach','critical','combo','lifesteal','bounce','shredResist','spellDrain','shredArmor','extraTarget','piercingShot','crystalCannon'];
export function packBookOdds(id:ShopPackId,save?:GameSave):{skillId:SkillId;chance:number}[]{
  const skills=SKILLS.filter(s=>(!save||skillUnlocked(save,s.id))&&bookAllowed(s.id,'shop')&&(id==='bookRandom'||ATTACK_BOOKS.includes(s.id)));
  if(id==='bookRandom'){const common=skills.filter(s=>!s.active).length,active=skills.filter(s=>s.active).length;return skills.map(s=>({skillId:s.id,chance:s.active?.1/active:.9/common}));}
  const total=skills.filter(s=>!s.active).reduce((sum,s)=>sum+BOOK_WEIGHTS[s.id].normal,0);
  return skills.map(s=>({skillId:s.id,chance:s.active?.01:BOOK_WEIGHTS[s.id].normal/total*.98}));
}
function weighted<T>(s:GameSave,items:{value:T;weight:number}[]):T{
  const sum=items.reduce((n,i)=>n+i.weight,0);let roll=random(s)*sum;
  for(const item of items){roll-=item.weight;if(roll<0)return item.value;}return items[items.length-1].value;
}
export function shopPrice(s:GameSave,pool:ShopPool,count:1|10):number{return goldAmount(s,(pool==='turtle'?SHOP_CONFIG.turtlePrice:SHOP_CONFIG.bookPrice)*count*(count===10?SHOP_CONFIG.tenDiscount:1));}
export function purchaseShop(s:GameSave,now:number,commandId:string,pool:ShopPool,count:1|10,generate:(s:GameSave,now:number)=>Turtle):ShopReceipt{
  requireRule(pool==='turtle'||pool==='book','商城分类不存在');requireRule(count===1||count===10,'只能单次或十次招募');
  requireRule(!s.shop?.pending&&!s.outsideFusion&&!s.bookReveal,'请先完成当前揭晓');requireRule(!s.run||s.run.phase==='result','请先结束当前冒险');
  const cost=shopPrice(s,pool,count);requireRule(s.gold>=cost,'金币不足');
  requireRule(pool!=='turtle'||Object.keys(s.collection).length+count<=s.capacity,'收藏空间不足，请先整理伙伴');
  const shop=s.shop??={turtleCount:0,bookCount:0},draws:ShopDraw[]=[];
  for(let i=0;i<count;i++){
    const index=pool==='turtle'?++shop.turtleCount:++shop.bookCount,hundred=index%SHOP_CONFIG.hundredEvery===0;
    let guarantee:ShopDraw['guarantee']=hundred?'hundred':'normal';
    if(pool==='turtle'){
      let skills=hundred?6:weighted(s,SHOP_CONFIG.turtleSkillWeights.map((weight,n)=>({value:n+1,weight})));
      if(i===9&&!draws.some(d=>d.turtle!.skills.length>=4)&&skills<4){skills=4;guarantee='ten';}
      const turtle=generate(s,now);turtle.skills=initialSkills(s,turtle.role,skills);s.collection[turtle.id]=turtle;draws.push({turtle,guarantee});
    }else{
      let ids=SKILLS.filter(skill=>skillUnlocked(s,skill.id)&&bookAllowed(skill.id,'shop')&&(!hundred||skill.active)).map(skill=>skill.id);
      const attackGuarantee=i===9&&!draws.some(d=>ATTACK_BOOKS.includes(d.skillId!));
      // If the hundredth book is defensive, an earlier draw carries the ten-draw attack guarantee.
      if(attackGuarantee&&!hundred){ids=ids.filter(id=>ATTACK_BOOKS.includes(id));guarantee='ten';}
      const skillId=hundred||attackGuarantee?weighted(s,ids.map(id=>({value:id,weight:1}))):policyBook(s,'activity');
      s.skillBooks??={};s.skillBooks[skillId]=(s.skillBooks[skillId]??0)+1;draws.push({skillId,guarantee});
      if(attackGuarantee&&hundred&&!ATTACK_BOOKS.includes(skillId)){
        const prior=draws[0],old=prior.skillId!,replacement=weighted(s,ATTACK_BOOKS.filter(id=>skillUnlocked(s,id)&&bookAllowed(id,'shop')&&!SKILLS.find(x=>x.id===id)!.active).map(id=>({value:id,weight:BOOK_WEIGHTS[id].normal})));
        s.skillBooks[old]!--;s.skillBooks[replacement]=(s.skillBooks[replacement]??0)+1;prior.skillId=replacement;prior.guarantee='ten';
      }
    }
  }
  s.gold-=cost;const receipt:ShopReceipt={id:commandId,pool,count,cost,draws,at:now};shop.pending=receipt;return receipt;
}
export function purchaseShopPack(s:GameSave,now:number,commandId:string,id:ShopPackId,generate:(s:GameSave,now:number)=>Turtle):ShopReceipt{
  const config=SHOP_PACKS.find(p=>p.id===id);requireRule(config,'礼包不存在');
  requireRule(!s.shop?.pending&&!s.outsideFusion&&!s.bookReveal,'请先完成当前揭晓');requireRule(!s.run||s.run.phase==='result','请先结束当前冒险');
  requireRule(packRemaining(s,now,id)>0,'今天该礼包已购买20次');
  const cost=goldAmount(s,config.price),turtlePack=id==='turtleBasic'||id==='turtleAdvanced';requireRule(s.gold>=cost,'金币不足');requireRule(!turtlePack||Object.keys(s.collection).length<s.capacity,'收藏空间不足，请先整理伙伴');
  const shop=s.shop??={turtleCount:0,bookCount:0},draws:ShopDraw[]=[];
  if(turtlePack){const count=id==='turtleBasic'?weighted(s,SHOP_CONFIG.turtleSkillWeights.map((weight,n)=>({value:n+1,weight}))):random(s)<.9?4:5;
    const turtle=generate(s,now);turtle.skills=initialSkills(s,turtle.role,count);s.collection[turtle.id]=turtle;draws.push({turtle,guarantee:'normal'});
  }else if(id==='bookRandom'||id==='bookAttack'){
    let skillId:SkillId;
    if(id==='bookRandom')skillId=policyBook(s,'activity');
    else{const roll=random(s);skillId=roll<.01?'piercingShot':roll<.02?'crystalCannon':weighted(s,ATTACK_BOOKS.filter(id=>skillUnlocked(s,id)&&bookAllowed(id,'shop')&&!SKILLS.find(s=>s.id===id)!.active).map(id=>({value:id,weight:BOOK_WEIGHTS[id].normal})));}
    s.skillBooks??={};s.skillBooks[skillId]=(s.skillBooks[skillId]??0)+1;draws.push({skillId,guarantee:'normal'});
  }else{
    const materials:Material[]=['attack','health','defense','growth'],amounts:Partial<Record<Material,number>>={};
    if(id==='materialFixed')materials.forEach(m=>amounts[m]=8);
    else for(let i=0;i<20;i++){const m=weighted(s,materials.map((value,j)=>({value,weight:[30,30,25,15][j]})));amounts[m]=(amounts[m]??0)+1;}
    for(const material of materials){const amount=amounts[material]??0;if(!amount)continue;s.materials[material]+=amount;draws.push({material,amount,guarantee:'normal'});}
  }
  const day=shopDay(now);if(!shop.daily||day>shop.daily.day)shop.daily={day,counts:{}};
  shop.daily.counts[id]=(shop.daily.counts[id]??0)+1;
  s.gold-=cost;const receipt:ShopReceipt={id:commandId,pool:'pack',packId:id,count:1,cost,draws,at:now};shop.pending=receipt;return receipt;
}
