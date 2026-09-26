import type {GameSave,RewardGrant} from './types';

/** Version 2 changes denominations, never purchasing power. Legacy saves remain decodable. */
export const GOLD_SCALE=1000;
export function goldAmount(s:Pick<GameSave,'economyVersion'>,base:number):number{
  const value=base*(s.economyVersion===3?100:s.economyVersion===2?GOLD_SCALE:1);
  if(!Number.isSafeInteger(value)||value<0)throw new Error('金币数值超出安全范围');return value;
}
export function goldGrants(s:Pick<GameSave,'economyVersion'>,grants:RewardGrant[]):RewardGrant[]{return grants.map(g=>g.kind==='gold'?{...g,amount:goldAmount(s,g.amount)}:g);}
export function migrateEconomy(s:GameSave):void{
  if(s.economyVersion)return;
  const fields=new Set(['gold','goldEarned','baseGold','firstClearGold','spentGold','price','gross','tax','net']);
  const scale=(n:number)=>{const next=n*GOLD_SCALE;if(!Number.isSafeInteger(next)||next<0)throw new Error('旧金币资料超出可迁移范围');return next;};
  // Explicit monetary keys also cover saved transaction receipts and pending rewards.
  const visited=new Set<object>();
  const walk=(value:unknown):void=>{
    if(!value||typeof value!=='object'||visited.has(value))return;visited.add(value);
    const obj=value as Record<string,unknown>;
    for(const key of Object.keys(obj)){
      const v=obj[key];if(typeof v==='number'&&(fields.has(key)||key==='amount'&&obj.kind==='gold'))obj[key]=scale(v);else walk(v);
    }
    if(obj.kind==='ad:doubleGold'&&typeof obj.result==='number')obj.result=scale(obj.result);
    if(typeof obj.gross==='number'&&typeof obj.tax==='number'&&typeof obj.net==='number')obj.taxDenomination=GOLD_SCALE;
    if((obj.pool==='turtle'||obj.pool==='book'||obj.pool==='pack')&&typeof obj.cost==='number')obj.cost=scale(obj.cost);
  };
  walk(s);s.economyVersion=2;s.settings.autoSkills??=false;s.shop??={turtleCount:0,bookCount:0};
}
export function displayGold(amount:number):string{return amount.toLocaleString('zh-CN',{maximumFractionDigits:0});}

/** Denomination-only migration: balances, prices and unclaimed receipts move together. */
export function migrateGoldV3(s:GameSave):void{
 if(s.economyVersion===3)return;if(!s.economyVersion)migrateEconomy(s);
 const fields=new Set(['gold','goldEarned','baseGold','firstClearGold','spentGold','price','gross','tax','net']);
 const visited=new Set<object>();
 const walk=(value:unknown):void=>{if(!value||typeof value!=='object'||visited.has(value))return;visited.add(value);const o=value as Record<string,unknown>;
  for(const k of Object.keys(o)){const v=o[k];if(typeof v==='number'&&(fields.has(k)||k==='amount'&&o.kind==='gold'))o[k]=Math.round(v/10);else walk(v);}
  if((o.pool==='turtle'||o.pool==='book'||o.pool==='pack')&&typeof o.cost==='number')o.cost=Math.round(o.cost/10);
  if(o.kind==='ad:doubleGold'&&typeof o.result==='number')o.result=Math.round(o.result/10);
  if(typeof o.gross==='number'&&typeof o.tax==='number'&&typeof o.net==='number'){o.taxDenomination=o.taxDenomination===1000?100:1;o.tax=Math.ceil(o.gross/(o.taxDenomination as number)*.2)*(o.taxDenomination as number);o.net=o.gross-(o.tax as number);}
 };
 walk(s);s.economyVersion=3;
}
