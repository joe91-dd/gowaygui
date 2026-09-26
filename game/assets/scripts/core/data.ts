import {expeditionSlots} from './expeditionRules';
import {paintMap,paintLegacyMap} from './paintedMaps';
import { AdKind, EnemyDefinition, EnemyKind, LevelDefinition, Material, Role, RoleDefinition, SkillDefinition, SkillId, Spawn } from './types';
import {campaignLevels,modeMaps} from './campaign';
import {tacticalMaps,clearRoadStations} from './tacticalMaps';
import {expandedStations} from './mapPresentation';
import {approvedCoast} from './approvedCoast';

export const ROLES: Record<Role, RoleDefinition> = {
  stone: { id: 'stone', name: '石头龟', job: '肉盾', gender: 'male', color: '#8b8874', health: 640, attack: 24, interval: 1.2, armor: 40, resist: 20, range: 1.2, starters: ['strong', 'armor'] },
  // Ranged attacks stay just two body lengths beyond the melee baseline (1.2 + 2.0).
  // Keeping the same base range across ranged roles also makes placement previews match combat.
  spike: { id: 'spike', name: '刺刺龟', job: '射手', gender: 'male', color: '#d9942c', health: 300, attack: 54, interval: .9, armor: 10, resist: 10, range: 3.2, starters: ['swift', 'critical'] },
  crystal: { id: 'crystal', name: '水晶龟', job: '法师', gender: 'female', color: '#38afdd', health: 270, attack: 45, interval: 1.5, armor: 5, resist: 20, range: 3.2, starters: ['resist', 'bounce'] },
  leaf: { id: 'leaf', name: '叶子龟', job: '治疗', gender: 'female', color: '#8bac46', health: 360, attack: 40, interval: 1.5, armor: 10, resist: 20, range: 3.2, starters: ['reach', 'doubleHeal'] },
  bubble: { id: 'bubble', name: '泡泡龟', job: '控制', gender: 'male', color: '#83bdcc', health: 280, attack: 28, interval: 1.4, armor: 10, resist: 15, range: 3.2, starters: ['steady', 'shredArmor'] },
};
export const ROLE_IDS = Object.keys(ROLES) as Role[];
export const SKILLS: SkillDefinition[] = [
  {id:'fervor',name:'狂热',precious:true,description:'受到直接攻击时20%概率触发4秒狂热：攻速提高40%，职业主动冷却恢复加快约33%；触发冷却8秒。'},
  {id:'caprice',name:'世事无常',precious:true,description:'每次普攻主目标：5%概率造成10倍暴击伤害，但不超过目标当前生命的一半；25%概率改为回复目标最大生命的20%；其余正常攻击。额外目标和反伤不重复触发。'},
  {id:'polymorph',name:'变羊',precious:true,description:'普攻主目标8%概率变羊2秒：移速降低40%、物理防御降低40%，无法攻击。受首领控制抗性和连续控制递减影响；触发冷却6秒。'},
  {id:'giant',name:'变大',precious:true,description:'受到直接伤害后生命低于30%时，25%概率变大6秒：攻击提高80%、最大生命及当前生命同比提高60%、攻速降低45%。已有物理或法术吸血时，对应吸血率额外提高15个百分点，吸血每秒上限提高至最大生命8%。结束时生命按比例还原；触发冷却18秒。'},
  {id:'scatter',name:'散射',precious:true,description:'普攻额外攻击2个不同敌人，各造成70%普攻伤害；与多重攻击叠加。治疗普攻不额外攻击。'},
  {id:'daze',name:'迷糊',precious:true,description:'自己嘲讽的敌人移动速度降低30%，持续3秒。同类减速取最高值。'},
  {id:'arcane',name:'法术奥义',precious:true,description:'法术技能伤害提高20%，命中减速20%持续2秒；每次命中1%概率晕眩0.5秒，触发后冷却3秒。'},
  {id:'holyLight',name:'圣光',precious:true,description:'自己获得有效治疗或恢复生命时25%概率获得3秒圣光：受到伤害降低10%、造成伤害提高10%；触发冷却6秒。'},
  {id:'calm',name:'冷静',precious:true,description:'普攻命中主目标时20%概率使正在冷却的职业主动缩短2秒；每2秒最多触发一次。额外目标、持续伤害不重复触发。'},
  {id:'stoneMastery',name:'碎岩天灾',role:'stone',specialization:true,requires:'hold',description:'岩盾专精：岩石风暴期间每秒向周围分裂3道小风暴，各造成50%攻击的范围伤害并减速30%，持续1.5秒。同一次分裂对同一敌人只命中一次。需拥有岩石风暴。'},
  {id:'spikeMastery',name:'箭雨风暴',role:'spike',specialization:true,requires:'piercingShot',description:'叶灵专精：穿甲弹命中处同时降下3秒箭雨，每秒对半径2格的敌人造成75%攻击的物理伤害，忽略30%护甲。需拥有穿甲弹。'},
  {id:'crystalMastery',name:'极寒回响',role:'crystal',specialization:true,requires:'crystalCannon',description:'珊歌专精：海霜风暴延长至5秒。首轮命中冻结1.2秒并造成80%攻击伤害，1.2秒后追加120%攻击的碎冰伤害；受首领控制抗性影响。需拥有海霜风暴。'},
  {id:'leafMastery',name:'曙光归来',role:'leaf',specialization:true,requires:'greatHeal',cooldown:60,description:'阳光专精：大治疗净化提高为2名伙伴各1个状态；仅1名受影响伙伴时额外清除1个普通减益。并额外复活射程内一名倒下的友军，恢复40%生命，保留其技能冷却。复活独立冷却60秒，倒下的友军也可触发自动施法。需拥有大治疗。'},
  {id:'spirit',name:'通灵',role:'bubble',specialization:true,requires:'bubbleRing',description:'潮行专精：潮灵召唤改为2只异时空石头人，从天而降，对落点周围造成继承攻击100%的伤害并晕眩0.8秒。免疫伤害，单体攻击并灼烧周围敌人，最多2只、持续5秒。需拥有潮灵召唤。'},
  {id:'counterStorm',name:'反击风暴',precious:true,description:'受到直接攻击时20%概率对周围敌人发动1～3次风暴；每次伤害为最大生命3%＋护甲与法抗之和的20%，触发冷却3秒。'},
  {id:'pursuit',name:'追击',description:'攻击被减速或定身的敌人时伤害提高18%；反伤不触发。通用被动'},
  {id:'rebirth',name:'重生',description:'每波首次生命归零时，20%概率立即恢复40%最大生命；未触发则倒下'},
  {id:'sleep',name:'沉睡',description:'倒下后沉睡；第3波25%概率满血醒来，未醒则第4波50%，第5波必醒。重生成功时不沉睡'},
  {id:'extraTarget',name:'多重攻击',description:'普攻额外命中一个不同目标，造成100%普攻伤害；治疗普攻则额外治疗一位伤者，不递归触发'},
  { id: 'strong', name: '强壮', description: '最大生命增加12%' },
  { id: 'armor', name: '硬壳', description: '护甲增加15' },
  { id: 'resist', name: '抗魔', description: '法抗增加15' },
  { id: 'swift', name: '快手', description: '普攻或普攻治疗速度增加12%' },
  { id: 'reach', name: '远望', description: '攻击或治疗射程增加0.3格' },
  { id: 'steady', name: '稳定', description: '受到的控制时长减少20%' },
  { id: 'regen', name: '自愈', description: '五秒未受伤后，每秒恢复最大生命1%；受伤中断' },
  { id: 'openingShield', name: '开场盾', description: '每波开始获得最大生命10%的护盾，持续六秒' },
  { id: 'lastShield', name: '自保', description: '每波首次低于30%生命时获得最大生命15%的护盾，持续四秒' },
  { id: 'encourage', name: '鼓劲', description: '4.5格内最近友军的伤害或治疗增加8%；同名不叠加' },
  { id: 'block', role: 'stone', name: '格挡', description: '15%概率使本次直接伤害降低30%' },
  { id: 'reflect', role: 'stone', name: '反伤', description: '反弹近战直伤的15%；同一攻击者每0.5秒最多一次' },
  { id: 'share', role: 'stone', name: '分担', description: '承担4.5格内最近友军所受直伤的10%，不循环转移' },
  { id: 'hold', role: 'stone', name: '岩石风暴', description: '原地卷起4秒岩石风暴，每0.5秒对半径2.3格敌人造成55%攻击的物理伤害，期间护甲提高30；不能调位或普攻。', active: true, cooldown: 24 },
  { id: 'critical', role: 'spike', name: '暴击', description: '暴击率增加八个百分点' },
  { id: 'lifesteal', role: 'spike', name: '吸血', description: '物理直伤吸血5%，每秒最多恢复自身最大生命2%' },
  { id: 'combo', role: 'spike', name: '连击', description: '每第五次普攻追加一发60%伤害弹，不推进计数' },
  { id: 'piercingShot', role: 'spike', name: '穿甲弹', description: '240%物理攻击，忽略70%护甲', active: true, cooldown: 22 },
  { id: 'bounce', role: 'crystal', name: '弹射', description: '普攻额外命中一个不同敌人，造成30%法术攻击' },
  { id: 'spellDrain', role: 'crystal', name: '吸魔', description: '法术直伤吸血3%，每秒最多恢复自身最大生命2%' },
  { id: 'shredResist', role: 'crystal', name: '破魔', description: '法术直伤使命中目标法抗减少五，持续三秒' },
  { id: 'crystalCannon', role: 'crystal', name: '海霜风暴', description: '在射程内指定区域降下3秒暴风雪，每秒造成80%法术攻击并减速25%；半径1.8格', active: true, cooldown: 20 },
  { id: 'doubleHeal', role: 'leaf', name: '双重治疗', description: '普攻治疗额外一个不同伤者，效果为本次的35%' },
  { id: 'healShield', role: 'leaf', name: '治疗盾', description: '有效治疗量的15%转成四秒护盾' },
  { id: 'cleanse', role: 'leaf', name: '净化', description: '每八秒，下一次治疗清除一个负面状态，优先控制' },
  { id: 'greatHeal', role: 'leaf', name: '大治疗', description: '为治疗覆盖范围内伙伴恢复攻击220%的生命，并净化1名伙伴的1个负面状态；手动选中的伙伴优先。' , active: true, cooldown: 28 },
  { id: 'shredArmor', role: 'bubble', name: '破甲', description: '普攻使目标护甲减少八，持续三秒' },
  { id: 'root', role: 'bubble', name: '定身', description: '每第六次普攻定身0.6秒，受控制递减' },
  { id: 'weaken', role: 'bubble', name: '虚弱', description: '普攻使目标攻击降低8%，持续三秒' },
  { id: 'bubbleRing', role: 'bubble', name: '潮灵召唤', description: '在射程内召唤2只小龟，继承自身40%攻击、35%生命和50%双抗，可攻击也可被攻击，持续12秒', active: true, cooldown: 24 },
  {id:'taunt',name:'挑衅',description:'每8秒吸引附近1只能够攻击到自己的敌人，令其普攻优先攻击自己3秒；肉盾触发期间最多短暂阻挡2只敌人。通用被动'},
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s])) as Record<SkillId, SkillDefinition>;
export function skillsForRole(role: Role,legacy=false): SkillId[] { return SKILLS.filter(s => (!s.active&&!s.specialization) || s.role === role || legacy&&s.id==='spirit').map(s => s.id); }
export function skillCategory(s:SkillDefinition):string{return s.specialization?'职业专精':s.active?'职业主动':s.precious?'珍贵技能':'通用技能';}
export const ECONOMY = {
  staminaCap: 30, staminaCost: 5, staminaIntervalMs: 600000, waveGold: 8, clearGold: 20,
  firstClearGold: 100, capacity: 100, dailyAdCap: 6, adKindCap: 3,
  aptitudeCost: 100, growthCost: 300,
};
export const AD_NAMES: Record<AdKind, string> = { stamina: '补充体力', doubleGold: '金币翻倍', refresh: '更换候选' };
export const MATERIAL_NAMES: Record<Material,string>={attack:'蟹肉',health:'蚌肉',defense:'鱼肉',growth:'海参'};
export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  ink: { id: 'ink', name: '小墨团', health: 120, armor: 0, resist: 0, speed: 1, attack: 14, interval: 1.2, range: .8, leak: 1 },
  runner: { id: 'runner', name: '快跑蟹', health: 80, armor: 0, resist: 0, speed: 1.6, attack: 10, interval: 1, range: .8, leak: 1 },
  armored: { id: 'armored', name: '铁壳蟹', health: 240, armor: 60, resist: 0, speed: .7, attack: 24, interval: 1.5, range: .8, leak: 1 },
  mist: { id: 'mist', name: '雾泡怪', health: 180, armor: 0, resist: 60, speed: .9, attack: 20, interval: 1.4, range: .8, leak: 1 },
  snail: { id: 'snail', name: '吐墨螺', health: 150, armor: 0, resist: 0, speed: .8, attack: 18, interval: 2, range: 3.2, leak: 1 },
  elite: { id: 'elite', name: '搬壳大蟹', health: 900, armor: 25, resist: 25, speed: .6, attack: 40, interval: 1.5, range: .9, leak: 3 },
  boss: { id: 'boss', name: '巨钳蟹', health: 2400, armor: 20, resist: 20, speed: .45, attack: 60, interval: 1.8, range: 3, leak: 10 },
};
const slots = [ { x:-5,z:1 }, { x:-1,z:1 }, { x:3,z:1 }, { x:1,z:-3 }, { x:6,z:-1 } ];
// Independent geometry for the two islands whose platforms moved; never mutate shared stations.
const coralSlots = [ { x:-5,z:1 }, { x:-1,z:1 }, { x:3.395,z:1.099 }, { x:1,z:-3 }, { x:5.832,z:-.748 } ];
const bossSlots = [ { x:-5,z:1 }, { x:-1,z:1 }, { x:3,z:1 }, { x:1,z:-3 }, { x:6.62,z:-1.31 } ];
const ORIGINAL_LEVELS: LevelDefinition[] = [
  { id:0,name:'初晴海湾1',subtitle:'单湾入门 · 熟悉一条清晰路线',waves:5,targetSeconds:[120,180],spawnDuration:19,preparationSeconds:6,mergeWaves:[2],difficulty:.65,slots,route:[{x:-9,z:-2.1},{x:-6.3,z:-2.1},{x:-3.6,z:-1.1},{x:-.7,z:.25},{x:2.2,z:.25},{x:4.9,z:-.55},{x:7.1,z:.65},{x:9,z:.65}] },
  { id:1,name:'初晴海湾2',subtitle:'折风小径 · 学会覆盖两个弯道',waves:10,targetSeconds:[240,360],spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8],difficulty:.85,slots,route:[{x:-9,z:-2.4},{x:-6.4,z:-2.4},{x:-4.3,z:-1.0},{x:-1.0,z:-1.0},{x:1.4,z:1.55},{x:4.2,z:1.55},{x:6.2,z:.15},{x:9,z:.15}] },
  { id:2,name:'初晴海湾3',subtitle:'双潮汇流 · 两路夹击后汇合',waves:10,targetSeconds:[240,360],spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8],difficulty:1,slots:coralSlots,route:[{x:-9,z:-2.25},{x:-6.2,z:-2.25},{x:-3.2,z:-1.05},{x:-.3,z:-1.05},{x:2.8,z:.1},{x:5.8,z:.1},{x:9,z:.1}],routes:[[{x:-9,z:-2.25},{x:-6.2,z:-2.25},{x:-3.2,z:-1.05},{x:-.3,z:-1.05},{x:2.8,z:.1},{x:5.8,z:.1},{x:9,z:.1}],[{x:-9,z:2.25},{x:-6.2,z:2.25},{x:-3.2,z:1.15},{x:-.3,z:1.15},{x:2.8,z:.1},{x:5.8,z:.1},{x:9,z:.1}]],routeLabels:['上潮线','下潮线'] },
  { id:3,name:'初晴海湾4',subtitle:'环湾回流 · 练习环路内外的调度',waves:10,targetSeconds:[240,360],spawnDuration:22,preparationSeconds:6,mergeWaves:[4,8],difficulty:1.12,slots,route:[{x:-9,z:0},{x:-7.0,z:-1.55},{x:-4.2,z:-2.45},{x:-.4,z:-2.45},{x:3.5,z:-2.25},{x:5.8,z:-.9},{x:5.8,z:1.35},{x:3.6,z:2.45},{x:-.2,z:2.55},{x:-4.0,z:2.3},{x:-5.7,z:1.0},{x:-4.5,z:-.05},{x:-1.8,z:-.15},{x:1.3,z:-.1},{x:4.1,z:.05},{x:6.7,z:.05},{x:9,z:.05}] },
  { id:4,name:'初晴海湾5',subtitle:'潮汐交错 · 双路压轴汇入守护点',waves:12,targetSeconds:[360,480],spawnDuration:18,preparationSeconds:5,mergeWaves:[4,8,10],difficulty:1.12,slots:bossSlots,route:[{x:-9,z:-2.35},{x:-7.2,z:-2.35},{x:-5.0,z:-.95},{x:-2.8,z:1.0},{x:.1,z:1.0},{x:2.2,z:.05},{x:4.4,z:1.15},{x:6.1,z:.05},{x:9,z:.05}],routes:[[{x:-9,z:-2.35},{x:-7.2,z:-2.35},{x:-5.0,z:-.95},{x:-2.8,z:1.0},{x:.1,z:1.0},{x:2.2,z:.05},{x:4.4,z:1.15},{x:6.1,z:.05},{x:9,z:.05}],[{x:-9,z:2.25},{x:-7.2,z:2.25},{x:-5.0,z:1.0},{x:-2.8,z:-.95},{x:.1,z:-.95},{x:2.2,z:-1.75},{x:4.4,z:-.95},{x:6.1,z:.05},{x:9,z:.05}]],routeLabels:['晴湾北线','晴湾南线'] },
];
export const LEGACY_BATTLE_MAPS:LevelDefinition[]=campaignLevels(ORIGINAL_LEVELS).concat(modeMaps());
export const LEGACY_TACTICAL_MAPS:LevelDefinition[]=tacticalMaps(LEGACY_BATTLE_MAPS);
export const LEGACY_CLEAR_MAPS:LevelDefinition[]=clearRoadStations(LEGACY_TACTICAL_MAPS);
export const LEGACY_APPROVED_MAPS:LevelDefinition[]=approvedCoast(LEGACY_CLEAR_MAPS);
const MODE_MAPS:LevelDefinition[]=[{id:55,name:'双环潮狱',subtitle:'三分钟潮汐围城',waves:1,targetSeconds:[180,180],spawnDuration:174,preparationSeconds:0,mergeWaves:[],difficulty:3,
 route:[{x:-8,z:-3},{x:-1.5,z:-3},{x:-1.5,z:3},{x:-8,z:3},{x:-8,z:-3},{x:1.5,z:-3},{x:8,z:-3},{x:8,z:3},{x:1.5,z:3},{x:1.5,z:-3},{x:-8,z:-3}],
 slots:[{x:-5,z:-1.5},{x:-5,z:1.5},{x:4,z:-1.5},{x:4,z:1.5},{x:0,z:0},{x:-9.3,z:0},{x:9.3,z:0},{x:-4,z:4.3},{x:4,z:4.3},{x:-4,z:-4.3},{x:4,z:-4.3},{x:-2.9,z:0},{x:2.9,z:0},{x:-6.5,z:0},{x:6.5,z:0},{x:0,z:4.3}]},
 {id:56,name:'世界首领 · 潮汐长堤',subtitle:'九十秒伤害挑战',waves:1,targetSeconds:[90,90],spawnDuration:90,preparationSeconds:0,mergeWaves:[],difficulty:1,route:[{x:-7,z:0},{x:7,z:0}],slots:[{x:-4.6,z:1.25},{x:-3.1,z:-1.6},{x:-1.3,z:1.55},{x:-3,z:1.8},{x:.6,z:-1.55},{x:2.8,z:1.5},{x:4.8,z:-1.4},{x:4.8,z:1.5}]}];
// Keep the original battle definitions as the single source of truth. The
// art pass decorates copies without changing route, lane or station data.
// Restore the previously shipped topology: campaign maps come from the
// tactical/approved definitions (single, double and loop routes), while the
// art pass below remains a presentation-only copy.
export const LEGACY_EXPANDED_MAPS=expandedStations(LEGACY_APPROVED_MAPS).concat(MODE_MAPS).map(m=>JSON.parse(JSON.stringify(m)) as LevelDefinition);
export const LEGACY_PAINTED_MAPS=LEGACY_EXPANDED_MAPS.map(paintLegacyMap);
export const BATTLE_MAPS:LevelDefinition[]=LEGACY_EXPANDED_MAPS.map(paintMap);
export function battleMap(state:{levelId:number;layoutVersion?:number;stationVersion?:number;formationVersion?:2}):LevelDefinition{if(state.formationVersion===2)return {...BATTLE_MAPS[state.levelId],slots:expeditionSlots(state.levelId)};return (state.layoutVersion!==2?LEGACY_BATTLE_MAPS:state.stationVersion===6?BATTLE_MAPS:state.stationVersion===5?LEGACY_PAINTED_MAPS:state.stationVersion===4?LEGACY_EXPANDED_MAPS:state.stationVersion===3?LEGACY_APPROVED_MAPS:state.stationVersion===2?LEGACY_CLEAR_MAPS:LEGACY_TACTICAL_MAPS)[state.levelId];}
export const LEVELS:LevelDefinition[]=BATTLE_MAPS.slice(0,50);
/** Versioned wave compositions; balance changes require a new report. */
export function spawnsForWave(levelId: number, wave: number): Spawn[] {
  const level = LEGACY_BATTLE_MAPS[levelId];
  if (!level || wave < 1 || wave > level.waves) throw new Error('无效波次');
  const count = (levelId === 0 ? 3 : 4) + Math.floor(wave * .75);
  const pool: EnemyKind[] = ['ink', 'ink', 'runner'];
  if (levelId >= 2 || wave >= 6) pool.push('armored', 'mist');
  if (levelId >= 3 && wave >= 3) pool.push('snail');
  const scale = level.difficulty * Math.pow(1.07, wave - 1);
  const result: Spawn[] = Array.from({length:count}, (_,i) => ({ kind:pool[(i + wave) % pool.length], time:i * level.spawnDuration / Math.max(1,count-1), hpScale:scale, attackScale:Math.sqrt(scale) }));
  if (wave % 5 === 0 && levelId > 0) result.push({kind:'elite',time:level.spawnDuration*.6,hpScale:scale*.7,attackScale:Math.sqrt(scale)});
  if (levelId === 4 && wave === level.waves) result.push({kind:'boss',time:level.spawnDuration,hpScale:1,attackScale:1.2});
  return result;
}
