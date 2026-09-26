import type {SkillId} from './types';
import {ORDINARY_G1,ENEMY_G1_GRADES,enemyG1,RAID_G1_IDS,raidG1} from './enemyG1Catalog';
export const TIER_NAMES=['蓝色','紫色','橙色','红色','金色','领主'];
export const TIER_COLORS=[...ENEMY_G1_GRADES.map(g=>g.color),'#7DDADB'];
export const ABILITIES={
 web:{name:'蛛网束缚',detail:'预警2秒后束缚落点伙伴6秒，禁止主动与换位，并持续受伤。保护治疗、移开预警或主动净化。'},
 fireRain:{name:'锁地火雨',detail:'锁定多个伙伴周边一个身位，红圈预警2秒后造成重伤。落点锁定后立即调位，别把危险带给队友。'},
 beacon:{name:'回潮机关',detail:'召出可破坏的回潮机关，为附近首领持续恢复生命。指定集火先摧毁机关，再击败首领。'},
 breakwater:{name:'裂潮重击',detail:'锁定落点后蓄力1.4秒，造成范围物理伤害并破甲。红圈出现后调离，眩晕可打断。'},
 frost:{name:'霜潮禁锢',detail:'蓄力1.4秒后冻结落点附近伙伴。分散站位、提前转移或保留净化；眩晕可打断蓄力。'},
 mortar:{name:'追岸炮击',detail:'朝最远的输出伙伴发射预警炮弹，造成范围法术伤害。避免输出和治疗扎堆，提前离开落点。'},
 drain:{name:'噬光虹吸',detail:'对近处伙伴蓄力虹吸，造成伤害并恢复首领生命。及时转移到范围外，或用眩晕打断。'},
 rally:{name:'深海战旗',detail:'原地蓄力后召来两名随从。保留控制打断号令，群攻清掉援军，再集中处理首领。'},
 shock:{name:'破盾震荡',detail:'锁定近处伙伴，预警后以冲击消耗护盾并短暂削弱攻击。散开防线、保留治疗，眩晕可打断。'},
} as const;
export type BossAbility=keyof typeof ABILITIES;
export interface BossDefinition {id:string;name:string;color:string;tier:number;hp:number;size:number;trait:'bulwark'|'sprinter'|'mender';skill:string;detail:string;ability?:BossAbility;art?:string;cell?:number;dropBook?:SkillId;assetId?:string}

// Preserve all previous discovery IDs so existing archives remain valid.
const DISCOVERY_IDS=["reef-pirate", "shark-captain", "ink-oracle", "abyss-warden", "lobster-tyrant", "tide-emperor", "green-1", "green-2", "green-3", "green-4", "green-5", "green-6", "green-7", "green-8", "green-9", "blue-1", "blue-2", "blue-3", "blue-4", "blue-5", "blue-6", "blue-7", "blue-8", "blue-9", "purple-1", "purple-2", "purple-3", "purple-4", "purple-5", "purple-6", "purple-7", "yellow-1", "yellow-2", "yellow-3", "yellow-4", "yellow-5", "yellow-6", "yellow-7", "red-1", "red-2", "red-3", "red-4", "red-5", "gold-1", "gold-2", "gold-3", "gold-4", "gold-5", "g1-gold-09", "g1-gold-10"];

const DROPS:SkillId[]=['shredArmor','root','arcane','stoneMastery','counterStorm','spirit','hold','piercingShot','crystalCannon','greatHeal','bubbleRing','spikeMastery','crystalMastery','leafMastery','calm','scatter','taunt','reflect','shredResist'];
const TRAITS:BossDefinition['trait'][]=['bulwark','sprinter','sprinter','mender','mender','bulwark','sprinter','bulwark','sprinter','mender'];
export const BOSSES:BossDefinition[]=Array.from({length:50},(_,index)=>{
 const tier=Math.floor(index/10),species=index%ORDINARY_G1.length,asset=ORDINARY_G1[species],ability=asset.effect as BossAbility,grade=ENEMY_G1_GRADES[tier];
 return {id:DISCOVERY_IDS[index],name:asset.name+' · '+grade.name,color:grade.color,tier,hp:[2.4,3.3,3.8,4.4,5.2][tier]*(1+(species%3)*.025),size:grade.scale,trait:TRAITS[species%TRAITS.length],skill:ABILITIES[ability].name,detail:ABILITIES[ability].detail,ability,assetId:asset.id,dropBook:DROPS[index%DROPS.length]};
});
export const RAID_BOSSES:BossDefinition[]=RAID_G1_IDS.map((id,index)=>{
 const asset=enemyG1(id)!,ability=asset.effect as BossAbility;
 return {id:'raid-'+id.toLowerCase(),name:asset.name,color:['#54C8D8','#AC85DD','#EE9458','#98DCEE'][index],tier:5,hp:[6.1,6.3,6.5,6.8][index],size:1.72,trait:index===1?'mender':'bulwark',skill:ABILITIES[ability].name,detail:ABILITIES[ability].detail,ability,assetId:id,dropBook:DROPS[10+index]};
});
BOSSES.push(...RAID_BOSSES);
export function bossTier(level:number,wave:number):number {
 if(level>=51)return 5;
 return level===50?Math.min(4,Math.floor(Math.max(0,wave-1)/100)):Math.max(0,Math.min(4,Math.floor(level/10)));
}
export function bossFor(level:number,wave:number,ordinal=0):BossDefinition {
 const raid=raidG1(level);
 if(raid)return RAID_BOSSES.find(b=>b.assetId===raid.id)!;
 if(level>=51)return RAID_BOSSES[Math.max(0,ordinal)%4];
 const tier=bossTier(level,wave),species=level===50?Math.max(0,Math.floor(wave/10)-1)%10:Math.max(0,Math.floor(level))%10;
 return BOSSES[tier*10+species];
}
export function bossEncounters(id:string):string[]{
 const list:string[]=[];
 for(let level=0;level<50;level++)if(bossFor(level,1).id===id)list.push('第'+(level+1)+'关 · 五波首领');
 for(const [index,level] of [51,52,53,55].entries())if(bossFor(level,1).id===id)list.push(['碎礁洞穴','深潮遗迹','巨钳王庭','双环潮狱'][index]+' · 终极首领');
 for(let wave=10;wave<=500;wave+=10)if(bossFor(50,wave).id===id)list.push('无尽第'+wave+'波');
 return list;
}
export function bossDropChance(tier:number):number{return .08+Math.max(0,Math.min(5,tier))*.03;}
