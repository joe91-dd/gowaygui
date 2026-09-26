const fs=require('node:fs'),path=require('node:path');
const out='output/coral-expansion-20260914';fs.mkdirSync(out,{recursive:true});
const names=[['藤壳猪鱼猎手','铁螺重拳','海胆巫医','蝠翼劫掠者','桶炮寄居王','星砂鸣钟者','裂牙海鳗','荆刺河豚卫','铁蹄鲎骑士'],['锯鳍决斗家','冰冠水母','霜锤海象','毒棘枪卫','蛇海炼毒师','双斧锤鲨','螺炮总管','蓝旗海马督军','剑吻神枪手'],['玄珠女祭司','狮鳍禁卫长','蓝环夜刃','雷鳗武僧','深海蛛剑圣','幽墨灯巫','霜牙海豹领主'],['珊角大祭司','噬浪龟督','白鲨黄金王','金拳螳虾','幽灯锚刑官','鲸锤圣卫','深渊御潮师'],['熔脊海龙将','猩红章鱼主教','黑曜血鲨骑士','赤珊堡垒王','焚潮狮鳍刽子手'],['弑月深海帝','圣珠龙后','星鲸天罚者','远古珊瑚泰坦','流光海凰君']];
const colors=['green','blue','purple','yellow','red','gold'];
const files=['exec-1a78ee82-6b3c-4e89-a1a0-ac343dec8e5b.png','exec-b6241d58-10e0-4abd-8042-4c702829859b.png','exec-a6963a41-d5d3-4594-a00e-cda19d28bf3d.png','exec-270e62d1-b0d0-4f85-8fcc-007577a6c633.png','exec-a9976a71-fa81-4088-a6d5-e802f9634e5b.png','exec-16446162-41de-4425-a3bf-673ee38b36e2.png'];
files.forEach((f,i)=>fs.copyFileSync(path.join('C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14',f),`game/assets/resources/art-modern/boss-${colors[i]}-roster.png`));
const file='game/assets/scripts/core/bossCatalog.ts';let s=fs.readFileSync(file,'utf8');const old=s.slice(s.indexOf('[')+1,s.indexOf('] as const'));
const abilities=['breakwater','frost','mortar','drain','rally','shock'];
const books=['hold','piercingShot','crystalCannon','greatHeal','bubbleRing','stoneMastery','spikeMastery','crystalMastery','leafMastery','spirit','calm','scatter','taunt','reflect','root','shredArmor','shredResist','counterStorm','holyLight','fervor','giant','polymorph','caprice','spellMystery'];
const rows=[];let n=0;names.forEach((group,tier)=>group.forEach((name,j)=>{rows.push(` {id:'${colors[tier]}-${j+1}',name:'${name}',color:TIER_COLORS[${tier}],tier:${tier},hp:${[2.4,2.9,3.3,3.8,4.4,5.2][tier]}*(1+${j%3}*.045),size:${(1+tier*.085+(j%3)*.023).toFixed(3)},trait:'${['bulwark','sprinter','mender'][j%3]}',skill:ABILITIES['${abilities[(n+tier)%6]}'].name,detail:ABILITIES['${abilities[(n+tier)%6]}'].detail,ability:'${abilities[(n+tier)%6]}',art:'boss-${colors[tier]}-roster',cell:${j},dropBook:'${books[n%books.length]}'}`);n++;}));
const header=`import type {SkillId} from './types';
export const TIER_NAMES=['绿色','蓝色','紫色','黄色','红色','金色'];
export const TIER_COLORS=['#49AF77','#429FD9','#A26AD8','#EDD04C','#E05850','#D6A321'];
export const ABILITIES={
 breakwater:{name:'裂潮重击',detail:'锁定落点后蓄力1.4秒，造成范围物理伤害并破甲。红圈出现后调离，眩晕可打断。'},
 frost:{name:'霜潮禁锢',detail:'蓄力1.4秒后冻结落点附近伙伴。分散站位、提前转移或保留净化；眩晕可打断蓄力。'},
 mortar:{name:'追岸炮击',detail:'朝最远的输出伙伴发射预警炮弹，造成范围法术伤害。避免输出和治疗扎堆，提前离开落点。'},
 drain:{name:'噬光虹吸',detail:'对近处伙伴蓄力虹吸，造成伤害并恢复首领生命。及时转移到范围外，或用眩晕打断。'},
 rally:{name:'深海战旗',detail:'原地蓄力后召来两名随从。保留控制打断号令，群攻清掉援军，再集中处理首领。'},
 shock:{name:'破盾震荡',detail:'锁定近处伙伴，预警后以冲击消耗护盾并短暂削弱攻击。散开防线、保留治疗，眩晕可打断。'},
} as const;
export type BossAbility=keyof typeof ABILITIES;
export interface BossDefinition {id:string;name:string;color:string;tier:number;hp:number;size:number;trait:'bulwark'|'sprinter'|'mender';skill:string;detail:string;ability?:BossAbility;art?:string;cell?:number;dropBook?:SkillId}
`;
s=header+'export const BOSSES:BossDefinition[]=[\n'+old+',\n'+rows.join(',\n')+'\n];\n';
s=s.replace(/},\s*,/g,'},');
s+=`BOSSES.slice(0,6).forEach((b,i)=>{b.ability=(['breakwater','frost','drain','shock','mortar','rally'] as BossAbility[])[i];b.dropBook=(['shredArmor','root','spellMystery','stoneMastery','counterStorm','spirit'] as SkillId[])[i];});
export function bossTier(level:number,wave:number):number{return level===55?5:level>=51?Math.min(5,level-49):level===50?Math.min(5,Math.floor((wave-1)/10)):level<9?0:level<18?1:level<26?2:level<34?3:level<42?4:5;}
export function bossFor(level:number,wave:number,ordinal=0):BossDefinition{const tier=bossTier(level,wave),list=BOSSES.filter(b=>b.tier===tier),start=[0,9,18,26,34,42][tier],index=level<50?(level-start)*5+wave-1:level===50?Math.floor((wave-1)/5):wave-1+ordinal;return list[((index%list.length)+list.length)%list.length];}
export function bossEncounters(id:string):string[]{const list:string[]=[];for(let l=0;l<50;l++){const waves=[1,2,3,4,5].filter(w=>bossFor(l,w).id===id);if(waves.length)list.push('第'+(l+1)+'关 · 第'+waves.join('/')+'波');}for(let l=51;l<=53;l++)for(let w=1;w<=3;w++)if(bossFor(l,w).id===id)list.push('副本难度'+(l-50)+' · 第'+w+'波');for(let n=0;n<4;n++)if(bossFor(55,1,n).id===id)list.push('深渊回廊 · 第'+(n+1)+'名首领');for(let w=5;w<=120;w+=5)if(bossFor(50,w).id===id)list.push('无尽第'+w+'波');return list;}
export function bossDropChance(tier:number):number{return .08+tier*.03;}
`;
fs.writeFileSync(file,s);fs.writeFileSync(out+'/boss-rosters.json',JSON.stringify({names,files,colors},null,2));
console.log('48 bosses, 6 original IDs preserved, 42 new raster designs copied.');
