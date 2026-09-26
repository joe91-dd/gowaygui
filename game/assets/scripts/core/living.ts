import type {GameSave} from './types';
import {migrateGoldV3} from './economy';
import {initDevelopment} from './development';
import {sendSystemMail} from './mail';
export function enableLiving(s:GameSave):void{
 if(s.livingVersion)return;migrateGoldV3(s);s.livingVersion=1;
 // Include pending reveals and receipts so snapshot equality and recovery survive migration.
 const visit=(value:any):void=>{if(!value||typeof value!=='object')return;if(value.role&&value.innate&&value.training&&Array.isArray(value.skills)&&value.id)initDevelopment(value);for(const child of Object.values(value))visit(child);};visit(s);
 sendSystemMail(s,'system:living-expedition','海岛来信 · 新的成长旅程','伙伴现在可以通过战斗积累经验。每次升级获得3个自由属性点，最高50级。金币余额、价格与待领取奖励已统一缩小十倍，购买力保持一致。每周竞技场结算奖励将投递到这里。',[]);
}
