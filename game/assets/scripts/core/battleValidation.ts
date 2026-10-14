import {recruitmentSpent} from './expeditionEconomy';
import {BUFFS,chapterWaves,recruitCost,legacyRecruitCost,isCoastTrial} from './expeditionRules';
import {groundIssue,placementIssue,fieldIssue} from './placement';
import {BOSSES} from './bossCatalog';
import type { BattleState } from './battle';
import { ENEMIES, battleMap, BATTLE_MAPS,LEGACY_BATTLE_MAPS, ROLES, SKILL_BY_ID } from './data';
import type { Point, SkillId } from './types';

type RecordValue = Record<string, unknown>;
const MAX = Number.MAX_SAFE_INTEGER;
// Version 1 serializes 50 ms ticks. Keep this schema constant separate from battle.ts
// so importing save validation cannot create a runtime dependency cycle.
const TICK_SECONDS_V1 = .05;
const CORE_HEALTH_V1 = 20;
const STATUS_KINDS = new Set(['web', 'stun', 'root', 'slow', 'weaken', 'armorDown', 'resistDown', 'hold','taunt','fervor','giant','sheep']);
const EVENT_KINDS = new Set(['attack', 'heal', 'skill', 'damage', 'spawn', 'defeat', 'leak', 'waveEnd', 'shield', 'control']);
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
// Only these two known island layouts are accepted while decoding historical saves.
// Keep this even after a device has completed the level: an older backup may reappear.
const LEGACY_LAYOUTS: Readonly<Partial<Record<number, {
  slots: Readonly<Record<number, Point>>; route: readonly Point[];
}>>> = {
  2:{slots:{2:{x:3,z:1},4:{x:6,z:-1}},route:[
    {x:-9,z:0},{x:-4,z:0},{x:-2,z:2},{x:2,z:2},{x:3,z:-2},{x:6,z:-2},{x:9,z:0},
  ]},
  4:{slots:{4:{x:6,z:-1}},route:[
    {x:-9,z:0},{x:-4,z:0},{x:0,z:0},{x:2,z:-2},{x:5,z:-2},{x:6,z:0},{x:9,z:0},
  ]},
};

function check(condition: unknown, field: string, reason: string): asserts condition {
  if (!condition) throw new Error(`战斗存档损坏：${field}${reason}`);
}
function object(value: unknown, field: string): RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), field, '必须是对象');
  const prototype = Object.getPrototypeOf(value);
  check(prototype === Object.prototype || prototype === null, field, '不是可保存的数据对象');
  return value as RecordValue;
}
function array(value: unknown, field: string, max = MAX): unknown[] {
  check(Array.isArray(value) && value.length <= max, field, '必须是长度合法的数组');
  return value;
}
function number(value: unknown, field: string, min = 0, max = MAX): number {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, field, '数值不合法');
  return value;
}
function integer(value: unknown, field: string, min = 0, max = MAX): number {
  const result = number(value, field, min, max);
  check(Number.isSafeInteger(result), field, '必须是安全整数');
  return result;
}
function bool(value: unknown, field: string): boolean {
  check(typeof value === 'boolean', field, '必须是布尔值');
  return value;
}
function text(value: unknown, field: string, allowEmpty = false): string {
  check(typeof value === 'string' && (allowEmpty || value.length > 0) && value.length <= 512 && !/[\x00-\x1f]/.test(value), field, '文字或编号不合法');
  return value;
}
function skill(value: unknown, field: string): SkillId {
  const id = text(value, field);
  check(own(SKILL_BY_ID, id), field, '包含未知技能');
  return id as SkillId;
}
const tolerance = (value: number): number => 1e-8 * Math.max(1, Math.abs(value));
function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x-b.x)<=tolerance(Math.max(Math.abs(a.x),Math.abs(b.x)))
    &&Math.abs(a.z-b.z)<=tolerance(Math.max(Math.abs(a.z),Math.abs(b.z)));
}
function close(a: number, b: number, field: string): void {
  check(Math.abs(a - b) <= tolerance(Math.max(Math.abs(a), Math.abs(b))), field, '与关联数据不一致');
}
function point(value: unknown, field: string): { x: number; z: number } {
  const p = object(value, field);
  return { x: number(p.x, `${field}.x`, -MAX), z: number(p.z, `${field}.z`, -MAX) };
}

/** Reject values that JSON would silently corrupt, including unknown extension fields. */
function checkSerializable(value: unknown, field: string, visiting = new Set<object>(), depth = 0): void {
  check(depth <= 64, field, '嵌套过深');
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { check(Number.isFinite(value), field, '包含非有限数字'); return; }
  check(typeof value === 'object', field, '包含无法保存的值');
  check(!visiting.has(value), field, '包含循环引用');
  visiting.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      check(own(value, String(i)) && value[i] !== undefined, `${field}[${i}]`, '缺少数组元素');
      checkSerializable(value[i], `${field}[${i}]`, visiting, depth + 1);
    }
  } else {
    const record = object(value, field);
    for (const [key, child] of Object.entries(record)) checkSerializable(child, `${field}.${key}`, visiting, depth + 1);
  }
  visiting.delete(value);
}

interface References {
  entities: Set<string>;
  units: Map<string, RecordValue>;
  enemies: Set<string>;
  unitSkills: Map<string, Set<SkillId>>;
}
function reference(value: unknown, field: string, ids: Set<string>): string {
  const id = text(value, field);
  check(ids.has(id), field, '指向不存在的战斗个体');
  return id;
}
function statuses(value: unknown, field: string, refs: References): void {
  const kinds = new Set<string>();
  for (const [index, item] of Array.from(array(value, field, STATUS_KINDS.size).entries())) {
    const name = `${field}[${index}]`, status = object(item, name);
    const kind = text(status.kind, `${name}.kind`);
    check(STATUS_KINDS.has(kind) && !kinds.has(kind), name, '状态类型未知或重复');
    kinds.add(kind);
    // Expired states may remain in a snapshot until the next simulation tick.
    number(status.amount, `${name}.amount`, 0, ['slow', 'weaken', 'root', 'stun'].includes(kind) ? 1 : MAX);
    integer(status.untilTick, `${name}.untilTick`);
    reference(status.sourceId, `${name}.sourceId`, refs.entities);
  }
}
function skillMap(value: unknown, field: string, owned: Set<SkillId>, maxTick?: number): void {
  const entries = object(value, field);
  for (const [key, count] of Object.entries(entries)) {
    const id = skill(key, `${field}.${key}`);
    check(owned.has(id), field, '记录了个体未拥有的技能');
    integer(count, `${field}.${key}`, 0, maxTick ?? MAX);
  }
}
function health(value: RecordValue, field: string): { hp: number; maxHp: number; alive: boolean } {
  const maxHp = number(value.maxHp, `${field}.maxHp`, Number.MIN_VALUE);
  const hp = number(value.hp, `${field}.hp`, 0, maxHp + tolerance(maxHp));
  const alive = bool(value.alive, `${field}.alive`);
  check(!alive || hp > 0, field, '存活个体没有生命');
  return { hp, maxHp, alive };
}

/** Structural and simulation-invariant validation. This is not a client anti-cheat proof. */
export function validateBattle(state: unknown): asserts state is BattleState {
  validateBattleState(state,false);
}

/** Save decoding only: all checks remain active, with the selected island's known old pairs allowed. */
export function validateBattleForSaveDecode(state: unknown): asserts state is BattleState {
  validateBattleState(state,true);
}

/** Called only after the entire decoded save passes validation, including its run/roster bindings. */
export function migrateLegacyLayoutCoordinates(state: BattleState): void {
  if(state.layoutVersion===2)return;
  const layout=LEGACY_LAYOUTS[state.levelId];
  if(!layout)return;
  for(const unit of state.units){
    const legacy=layout.slots[unit.slot];
    if(legacy&&samePoint(unit,legacy)){
      const current=LEGACY_BATTLE_MAPS[state.levelId].slots[unit.slot];unit.x=current.x;unit.z=current.z;
    }
  }
}

function validateBattleState(state: unknown, allowLegacyLayoutSlots: boolean): asserts state is BattleState {
  checkSerializable(state, '战斗');
  const s = object(state, '战斗');
  if(s.autoSkills!==undefined)bool(s.autoSkills,'自动施法');
  if(s.tacticsVersion!==undefined)check(s.tacticsVersion===1,'战术机制版本','不支持');
  if(s.faunaVersion!==undefined)check(s.faunaVersion===1,'首领机制版本','不支持');
  if(s.encounterVersion!==undefined)check(s.encounterVersion===1,'敌人机制版本','不支持');
  if(s.layoutVersion!==undefined)check(s.layoutVersion===2,'地图版本','不支持');
  if(s.manualSkillTurtles!==undefined)array(s.manualSkillTurtles,'保留主动',100).forEach(id=>text(id,'保留主动编号'));
  if(s.contributions!==undefined)for(const [id,raw] of Object.entries(object(s.contributions,'战斗贡献'))){text(id,'贡献编号');const row=object(raw,'贡献');text(row.name,'贡献名称');for(const key of ['damage','healing','shield','reflected','rebirths'])number(row[key],'贡献.'+key);}
  if(s.controlledUnitIds!==undefined){const ids=array(s.controlledUnitIds,'玩家控制伙伴',25).map(id=>text(id,'玩家控制伙伴编号'));check(new Set(ids).size===ids.length,'玩家控制伙伴','编号重复');}
  check(s.version === 1, '版本', '不受支持');
  if(s.encounter!==undefined)check(s.encounter==='raid','副本标记','不支持');
  check(s.duelUnits===undefined&&s.duelTeamA===undefined,'临时竞技场上下文','不可持久化');
  if(s.mechanicsVersion!==undefined)check(s.mechanicsVersion===7,'战斗机制版本','不受支持');
  check(s.balanceVersion === undefined || s.balanceVersion === 2, '平衡版本', '不受支持');
  const levelId = integer(s.levelId, '关卡', 0, BATTLE_MAPS.length - 1), level = battleMap({levelId,layoutVersion:s.layoutVersion as number|undefined,stationVersion:s.stationVersion as number|undefined,formationVersion:s.formationVersion as 2|undefined});
  if(s.formationVersion!==undefined)check(s.formationVersion===2,'固定站位版本','不支持');
  if(s.stationVersion!==undefined)check(s.stationVersion===2||s.stationVersion===3||s.stationVersion===4||s.stationVersion===5||s.stationVersion===6,'站位版本','不支持');
  check(s.rulesVersion===undefined||s.rulesVersion==='0.6','玩法版本','不受支持');
  if(s.rulesVersion==='0.6')check(s.mode==='chapter'||s.mode==='endless','挑战模式','不受支持');
  integer(s.wave, '波次', 1, s.expedition||s.rulesVersion==='0.6'&&s.mode==='endless'?Number.MAX_SAFE_INTEGER:level.waves);
  const status = text(s.status, '战斗状态');
  check(['fighting', 'won', 'lost'].includes(status), '战斗状态', '未知');
  const tick = integer(s.tick, 'tick');
  const elapsed = number(s.elapsed, 'elapsed');
  close(elapsed, tick * TICK_SECONDS_V1, 'elapsed');
  const pending = number(s.pendingSeconds, 'pendingSeconds', 0, TICK_SECONDS_V1);
  check(pending < TICK_SECONDS_V1, 'pendingSeconds', '存在未处理的完整时间步');
  if (status !== 'fighting') check(pending === 0, 'pendingSeconds', '结束后仍有待处理时间');
  integer(s.rng, '随机状态', 0, 4294967295);
  const coreHealth = number(s.coreHealth, '核心耐久', 0, CORE_HEALTH_V1);
  check(status === 'lost' ? (s.levelId===55&&!s.expedition?s.tick===3600:coreHealth===0) : coreHealth > 0, '核心耐久', '与胜负状态不一致');

  const route = array(s.route, '路线').map((p, i) => point(p, `路线[${i}]`));
  check(route.length >= 2, '路线', '至少需要两个不同点');
  let routeLength = 0;
  for (let i = 1; i < route.length; i++) {
    const length = Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    check(Number.isFinite(length) && length > 0, `路线[${i}]`, '与前一点重合或距离无效');
    routeLength += length;
  }
  close(number(s.routeLength, '路线长度', Number.MIN_VALUE), routeLength, '路线长度');
  if(s.routes!==undefined){
    const routes=array(s.routes,'多路地图',4),lengths=array(s.routeLengths,'多路长度',4);
    check(!!level.routes&&routes.length===level.routes.length&&lengths.length===routes.length,'多路地图','路线数量不一致');
    routes.forEach((raw,i)=>{const path=array(raw,'分路').map(p=>point(p,'分路坐标')),expected=level.routes![i];check(path.length===expected.length&&path.every((p,j)=>samePoint(p,expected[j])),'分路','与地图不一致');close(number(lengths[i],'分路长度',Number.MIN_VALUE),path.slice(1).reduce((sum,p,j)=>sum+Math.hypot(p.x-path[j].x,p.z-path[j].z),0),'分路长度');});
  }else check(s.routeLengths===undefined,'多路长度','没有对应路线');
  const checkRouteId=(entry:RecordValue,name:string):void=>{if(s.routes!==undefined)integer(entry.routeId,`${name}.routeId`,0,(s.routes as unknown[]).length-1);else check(entry.routeId===undefined,name,'单路战斗不能引用其他路线');};
  const legacyLayout=s.layoutVersion===2?undefined:LEGACY_LAYOUTS[levelId];
  if(legacyLayout){
    check(route.length===level.route.length&&route.every((p,i)=>samePoint(p,level.route[i])),'路线','与当前关卡不一致');
    if(allowLegacyLayoutSlots)check(route.length===legacyLayout.route.length&&route.every((p,i)=>samePoint(p,legacyLayout.route[i])),'路线','不是受支持的旧布局');
  }
  if(s.expedition!==undefined)validateExpeditionState(s,level.slots);
  const units = array(s.units, '伙伴', s.expedition?level.slots.length:5), enemies = array(s.enemies, '敌人');
  check(!fieldIssue(level,units as {slot:number;placement?:Point}[]),'布阵','自由落点重叠或非法');
  const bench=s.benchUnits===undefined?[]:array(s.benchUnits,'备战快照',s.encounter==='raid'?25:5),allUnits=units.concat(bench);
  if(s.encounter==='raid')check(allUnits.length<=25,'副本伙伴','超过全队二十五只');
  if(bench.length)check(s.rulesVersion==='0.6','备战快照','只适用于新版对局');
  const refs: References = { entities: new Set(), units: new Map(), enemies: new Set(), unitSkills: new Map() };
  if(s.retiredUnits!==undefined){
    check(s.rulesVersion==='0.6','离场记录','只适用于新版对局');
    for(const raw of array(s.retiredUnits,'离场记录')){
      const entry=object(raw,'离场伙伴'),id=text(entry.id,'离场伙伴.id');check(!refs.entities.has(id),'离场伙伴','编号重复');
      const skills=array(entry.skills,'离场伙伴.skills',12).map(value=>skill(value,'离场伙伴.skills'));
      check(skills.length>0&&new Set(skills).size===skills.length,'离场伙伴','技能重复或缺失');
      refs.entities.add(id);refs.units.set(id,entry);refs.unitSkills.set(id,new Set(skills));
    }
  }
  const slots = new Set<number>(), turtleIds = new Set<string>();
  for (const [i, raw] of Array.from(allUnits.entries())) {
    const name = `伙伴[${i}]`, unit = object(raw, name), id = text(unit.id, `${name}.id`);
    check(!refs.entities.has(id), name, '战斗个体编号重复');
    refs.entities.add(id); refs.units.set(id, unit);
    const turtleId = text(unit.turtleId, `${name}.turtleId`);
    check(!!s.expedition||!turtleIds.has(turtleId), name, '龟档案编号重复'); turtleIds.add(turtleId);
    const slot = integer(unit.slot, `${name}.slot`, 0, level.slots.length - 1);
    if(i<units.length){check(!slots.has(slot), name, '布阵位置重复'); slots.add(slot);}
    const position=point(unit,name),legacy=allowLegacyLayoutSlots?legacyLayout?.slots[slot]:undefined;
    const placed=unit.placement===undefined?undefined:point(unit.placement,name+'.自由落点');
    if(placed)check(!groundIssue(level,placed),name+'.自由落点','必须在可摆放陆地上');
    const oldMode=s.routes===undefined?level.legacySlots?.[slot]:undefined;
    let inTransfer=false;
    if(unit.moveReadyTick!==undefined)integer(unit.moveReadyTick,name+'.调位冷却');
    if(unit.transfer!==undefined){const transfer=object(unit.transfer,name+'.转移'),from=point(transfer.from,'转移起点'),start=integer(transfer.started,'转移开始',0,tick),end=integer(transfer.ends,'转移结束',start+1),f=Math.min(1,(tick-start)/(end-start)),to=placed??level.slots[slot];check(end-start===((s.expedition as RecordValue|undefined)?.coastTrial===1?8:20),'转移','时长不正确');check(level.slots.some(p=>samePoint(p,from))||!groundIssue(level,from),'转移','起点不是合法陆地');inTransfer=samePoint(position,{x:from.x+(to.x-from.x)*f,z:from.z+(to.z-from.z)*f});}
    check(samePoint(position,placed??level.slots[slot])||inTransfer||!!legacy&&samePoint(position,legacy)||!!oldMode&&samePoint(position,oldMode),`${name}.位置`,'与站位坐标或自由落点不一致');
    const role = text(unit.role, `${name}.role`);
    check(own(ROLES, role), name, '职业未知');
    const owned = new Set<SkillId>();
    for (const [j, item] of Array.from(array(unit.skills, `${name}.skills`, 12).entries())) {
      const id = skill(item, `${name}.skills[${j}]`), definition = SKILL_BY_ID[id];
      check(!owned.has(id) && ((!definition.active&&!definition.specialization) || definition.role === role || id==='spirit'), name, '技能重复或职业不兼容');
      owned.add(id);
    }
    refs.unitSkills.set(id, owned);
  }
  for (const [i, raw] of Array.from(enemies.entries())) {
    const enemy = object(raw, `敌人[${i}]`), id = text(enemy.id, `敌人[${i}].id`);
    check(!refs.entities.has(id), `敌人[${i}]`, '战斗个体编号重复');
    refs.entities.add(id); refs.enemies.add(id);
  }

  if(s.summons!==undefined){
    const summoned=array(s.summons,'召唤物',512),next=integer(s.nextSummonId,'召唤序号',1),ids=new Set<string>();
    for(const raw of summoned){const pet=object(raw,'召唤物'),id=text(pet.id,'召唤物编号');check(!refs.entities.has(id)&&!ids.has(id),'召唤物','编号重复');ids.add(id);refs.entities.add(id);
      reference(pet.ownerId,'召唤者',new Set(refs.units.keys()));check(pet.kind==='golem'||pet.kind==='turtle','召唤类型','未知');point(pet,'召唤位置');health(pet,'召唤生命');
      for(const key of ['attack','armor','resist'])number(pet[key],'召唤属性.'+key);
      const born=integer(pet.bornTick,'召唤时间',0,tick);integer(pet.untilTick,'召唤截止',born+1,born+240);
      integer(pet.nextAttackTick,'召唤普攻');integer(pet.nextBurnTick,'召唤灼烧');
      check(Number(id.slice(7))<=next,'召唤序号','越界');
    }
    for(const id of refs.units.keys())check(summoned.filter(raw=>(raw as RecordValue).ownerId===id&&(raw as RecordValue).alive).length<=2,'召唤物','每位最多两只');
  }
  if(s.storms!==undefined)for(const raw of array(s.storms,'风暴区域',20)){const storm=object(raw,'风暴区域');reference(storm.ownerId,'风暴来源',new Set(refs.units.keys()));point(storm,'风暴位置');integer(storm.untilTick,'风暴截止');integer(storm.nextTick,'风暴触发');
    if(storm.kind!==undefined)check(['rock','arrow','blizzard'].includes(storm.kind as string),'风暴类型','未知');
    if(storm.pulse!==undefined)integer(storm.pulse,'风暴段数',0,100);
    if(storm.echoTick!==undefined)integer(storm.echoTick,'碎冰触发');
    if(storm.echoTargets!==undefined)for(const id of array(storm.echoTargets,'碎冰目标',256))reference(id,'碎冰目标',refs.entities);
  }
  for (const [i, raw] of Array.from(allUnits.entries())) {
    const name = `伙伴[${i}]`, unit = object(raw, name), id = unit.id as string, owned = refs.unitSkills.get(id)!;
    integer(unit.level, `${name}.level`, 1, 50); point(unit, name);
    const hp = health(unit, name);
    if(unit.giantBaseMaxHp!==undefined){const base=number(unit.giantBaseMaxHp,`${name}.giantBaseMaxHp`,Number.MIN_VALUE);check(owned.has('giant')&&Math.abs(hp.maxHp-base*1.6)<=tolerance(hp.maxHp),name,'变大生命上限不合法');}
    check(hp.alive || hp.hp === 0, name, '休整个体生命尚未归零');
    for (const field of ['attack', 'armor', 'resist', 'range']) number(unit[field], `${name}.${field}`);
    number(unit.interval, `${name}.interval`, Number.MIN_VALUE);
    for (const field of ['nextAttackTick', 'actionUntilTick', 'attackCount', 'nextRegenTick', 'cleanseReadyTick']) integer(unit[field], `${name}.${field}`);
    integer(unit.lastDamageTick, `${name}.lastDamageTick`, 0, tick);
    if(unit.pendingAttack!==undefined){const shot=object(unit.pendingAttack,`${name}.pendingAttack`);check(s.layoutVersion===2,name,'旧布局不能带延迟攻击');reference(shot.targetId,`${name}.pendingAttack.targetId`,refs.entities);bool(shot.healing,`${name}.pendingAttack.healing`);check(!shot.healing||unit.role==='leaf',name,'治疗攻击职业不一致');integer(shot.launchTick,`${name}.pendingAttack.launchTick`,Math.max(0,tick-3),tick+3);integer(shot.landTick,`${name}.pendingAttack.landTick`,tick,tick+6);check((shot.landTick as number)-(shot.launchTick as number)===3,name,'普攻前摇时间损坏');bool(shot.launched,`${name}.pendingAttack.launched`);}
    for(const key of ['holyUntilTick','holyReadyTick'])if(unit[key]!==undefined){integer(unit[key],`${name}.${key}`);check(owned.has('holyLight'),name,'未拥有圣光');}
    if(unit.rebirthUsed!==undefined){bool(unit.rebirthUsed,`${name}.rebirthUsed`);check(owned.has('rebirth'),name,'未拥有重生');}
    if(unit.tauntUntilTick!==undefined){integer(unit.tauntUntilTick,`${name}.tauntUntilTick`);check(owned.has('taunt'),name,'未拥有挑衅');}
    if(unit.sleepUntilWave!==undefined){integer(unit.sleepUntilWave,`${name}.sleepUntilWave`,(s.wave as number)+1,(s.wave as number)+5);check(owned.has('sleep')&&!hp.alive,name,'沉睡状态不合法');}
    bool(unit.lastShieldUsed, `${name}.lastShieldUsed`);
    statuses(unit.statuses, `${name}.statuses`, refs);
    skillMap(unit.cooldowns, `${name}.cooldowns`, owned);
    skillMap(unit.skillActivations, `${name}.skillActivations`, owned);
    const shield = number(unit.shield, `${name}.shield`, 0, hp.maxHp * .4 + tolerance(hp.maxHp));
    let shieldSum = 0;
    for (const [j, rawShield] of Array.from(array(unit.shields, `${name}.shields`).entries())) {
      const label = `${name}.shields[${j}]`, entry = object(rawShield, label);
      shieldSum += number(entry.amount, `${label}.amount`, 0, hp.maxHp * .4 + tolerance(hp.maxHp));
      integer(entry.untilTick, `${label}.untilTick`);
      const source = reference(entry.sourceId, `${label}.sourceId`, new Set(refs.units.keys()));
      if(entry.buffId!==undefined){
        const battle=s as unknown as BattleState;
        check(entry.buffId==='healingTide'&&entry.skillId===undefined&&isCoastTrial(battle)&&!!battle.expedition?.players.some(p=>(p.buffs.healingTide??0)>0),label,'护盾祝福来源不合法');
        check((entry.untilTick as number)<=tick+60,label,'盈潮护盾持续时间超出上限');
      }else{
        const sourceSkill = skill(entry.skillId, `${label}.skillId`);
        check(refs.unitSkills.get(source)!.has(sourceSkill), label, '护盾来源未拥有对应技能');
      }
    }
    close(shield, shieldSum, `${name}.shield`);
    for (const [enemyId, at] of Object.entries(object(unit.reflectTicks, `${name}.reflectTicks`))) {
      reference(enemyId, `${name}.reflectTicks`, refs.enemies); integer(at, `${name}.reflectTicks.${enemyId}`, 0, tick);
    }
    for (const [j, item] of Array.from(array(unit.drainHistory, `${name}.drainHistory`).entries())) {
      const label = `${name}.drainHistory[${j}]`, entry = object(item, label);
      integer(entry.tick, `${label}.tick`, 0, tick); number(entry.amount, `${label}.amount`, 0, hp.maxHp + tolerance(hp.maxHp));
    }
    for (const field of ['encouragedBy', 'auraTargetId']) if (unit[field] !== undefined) reference(unit[field], `${name}.${field}`, new Set(refs.units.keys()));
  }
  let deadEnemies = 0;
  for (const [i, raw] of Array.from(enemies.entries())) {
    const name = `敌人[${i}]`, enemy = object(raw, name), kind = text(enemy.kind, `${name}.kind`);
    check(own(ENEMIES, kind), name, '敌人类型未知'); point(enemy, name);
    checkRouteId(enemy,name);
    const hp = health(enemy, name); if (!hp.alive) deadEnemies++;
    // A leaked enemy is inactive but retains HP; one movement tick may overshoot the route.
    for (const field of ['attack', 'armor', 'resist', 'speed', 'range', 'distance']) number(enemy[field], `${name}.${field}`);
    number(enemy.interval, `${name}.interval`, Number.MIN_VALUE);
    integer(enemy.leak, `${name}.leak`, 0, CORE_HEALTH_V1);
    for (const field of ['nextAttackTick', 'actionUntilTick', 'attackCount', 'controlWindowUntilTick', 'controlCount']) integer(enemy[field], `${name}.${field}`);
    bool(enemy.summoned, `${name}.summoned`); statuses(enemy.statuses, `${name}.statuses`, refs);
    if(enemy.bossId!==undefined)check(kind==='boss'&&BOSSES.some(b=>b.id===enemy.bossId),name,'首领资料无效');
    if(enemy.mechanismOwner!==undefined){reference(enemy.mechanismOwner,name+'.mechanismOwner',refs.entities);check(s.tacticsVersion===1,name,'机关版本无效');}if(enemy.tacticCount!==undefined)integer(enemy.tacticCount,name+'.tacticCount');
    if(enemy.trait!==undefined){check((s.encounterVersion===1||s.faunaVersion===1)&&['mender','sprinter','bulwark'].includes(String(enemy.trait)),name,'敌人特性未知');integer(enemy.traitReadyTick,`${name}.traitReadyTick`);}
    if(enemy.rations!==undefined)integer(enemy.rations,name+'.rations',0,10000000);
    if(enemy.originWave!==undefined)integer(enemy.originWave,name+'.originWave',1,s.wave as number);
    if((s.expedition as RecordValue|undefined)?.cadenceVersion===1)check(enemy.originWave!==undefined,name,'缺少所属波次');
    if(enemy.abilityReadyTick!==undefined)integer(enemy.abilityReadyTick,name+'.abilityReadyTick');
    if(enemy.cast!==undefined){const c=object(enemy.cast,name+'.cast');check(s.faunaVersion===1&&['web','fireRain','beacon','breakwater','frost','mortar','drain','rally','shock'].includes(String(c.kind)),name,'敌人蓄力不合法');point(c,name+'.cast');integer(c.landTick,name+'.cast.landTick');if(c.points!==undefined)for(const [i,p] of array(c.points,name+'.cast.points',3).entries())point(p,name+'.cast.points.'+i);}
    if(enemy.slam!==undefined){const slam=object(enemy.slam,`${name}.slam`);check(s.encounterVersion===1&&kind==='boss',name,'无效重击');point(slam,`${name}.slam`);integer(slam.landTick,`${name}.slam.landTick`);}
    if(enemy.blockUntilTick!==undefined)integer(enemy.blockUntilTick,`${name}.blockUntilTick`);
    if(enemy.blockOwnerId!==undefined)reference(enemy.blockOwnerId,`${name}.blockOwnerId`,new Set(refs.units.keys()));
    if (enemy.blockedBy !== undefined) reference(enemy.blockedBy, `${name}.blockedBy`, new Set(refs.units.keys()));
  }
  const spawns = array(s.spawns, '出怪计划');
  for (const [i, raw] of Array.from(spawns.entries())) {
    const name = `出怪计划[${i}]`, spawn = object(raw, name), kind = text(spawn.kind, `${name}.kind`);
    check(own(ENEMIES, kind), name, '敌人类型未知');
    checkRouteId(spawn,name);if(spawn.rations!==undefined)integer(spawn.rations,name+'.rations',0,10000000);
    number(spawn.time, `${name}.time`);
    number(spawn.hpScale, `${name}.hpScale`, Number.MIN_VALUE); number(spawn.attackScale, `${name}.attackScale`, 0);
  }
  const spawnCursor = integer(s.spawnCursor, '出怪位置', 0, spawns.length);
  check(enemies.length >= spawnCursor, '出怪位置', '超过已生成敌人数量');
  integer(s.nextEnemyId, '下一个敌人编号', enemies.length + 1);
  const kills = integer(s.kills, '击杀数', 0, enemies.length), leaked = integer(s.leaked, '漏怪数', 0, enemies.length);
  check(kills + leaked === deadEnemies, '敌人计数', '与当前敌人状态不一致');
  if (status === 'won') check(s.levelId===55&&!s.expedition?s.tick===3600&&enemies.length-deadEnemies<=15:spawnCursor === spawns.length && deadEnemies === enemies.length, '胜利状态', '仍有未完成的敌人');

  if(s.focusTargets!==undefined){const focus=object(s.focusTargets,'集火目标');check(Object.keys(focus).length<=10,'集火目标','数量超限');for(const [id,target] of Object.entries(focus)){reference(id,'集火伙伴',new Set(refs.units.keys()));reference(target,'集火敌人',refs.entities);check(enemies.some(e=>(e as RecordValue).id===target),'集火敌人','必须是敌方目标');}}
  const queuedUnits = new Set<string>();
  for (const [i, raw] of Array.from(array(s.commands, '技能指令', units.length).entries())) {
    const name = `技能指令[${i}]`, command = object(raw, name);
    check(command.type === 'cast', name, '指令类型未知');
    const unitId = reference(command.unitId, `${name}.unitId`, new Set(refs.units.keys()));
    check(units.some(raw=>(raw as RecordValue).id===unitId),name,'离场伙伴不能释放技能');
    const id = skill(command.skillId, `${name}.skillId`);
    check(!queuedUnits.has(unitId), name, '同一个体存在重复指令'); queuedUnits.add(unitId);
    check(refs.unitSkills.get(unitId)!.has(id) && SKILL_BY_ID[id].active, name, '主动技能不属于该个体');
    if(command.targetId!==undefined)reference(command.targetId,`${name}.targetId`,refs.entities);
    if(command.point!==undefined){
      check(id==='bubbleRing'||id==='crystalCannon',name,'该技能不接受区域目标');
      const p=object(command.point,`${name}.point`);number(p.x,`${name}.point.x`,-100,100);number(p.z,`${name}.point.z`,-100,100);
    }
  }
  const nextEventId = integer(s.nextEventId, '下一个事件编号', 1);
  let previousEventId = 0;
  for (const [i, raw] of Array.from(array(s.events, '表现事件', 4096).entries())) {
    const name = `表现事件[${i}]`, event = object(raw, name), id = integer(event.id, `${name}.id`, 1, nextEventId - 1);
    check(id > previousEventId, name, '事件编号重复或顺序错误'); previousEventId = id;
    integer(event.tick, `${name}.tick`, 0, tick);
    const type = text(event.type, `${name}.type`); check(EVENT_KINDS.has(type), name, '事件类型未知');
    if (event.sourceId !== undefined) reference(event.sourceId, `${name}.sourceId`, refs.entities);
    if (event.targetId !== undefined) reference(event.targetId, `${name}.targetId`, refs.entities);
    if (event.skillId !== undefined) skill(event.skillId, `${name}.skillId`);
    if (event.amount !== undefined) number(event.amount, `${name}.amount`);
    if (event.x !== undefined || event.z !== undefined) point(event, name);
    for (const field of ['critical', 'secondary']) if (event[field] !== undefined) bool(event[field], `${name}.${field}`);
    for(const field of ['fromX','fromZ'])if(event[field]!==undefined)number(event[field],`${name}.${field}`,-MAX,MAX);
    for(const field of ['radius','duration'])if(event[field]!==undefined)number(event[field],`${name}.${field}`);
    if (event.effect !== undefined) text(event.effect, `${name}.effect`, true);
    if (type !== 'waveEnd') check(event.sourceId !== undefined, name, '缺少来源个体');
    if (['attack', 'heal', 'damage', 'defeat', 'shield', 'control'].includes(type)) check(event.targetId !== undefined, name, '缺少目标个体');
    if (['heal', 'damage', 'leak', 'waveEnd', 'shield', 'control'].includes(type)) check(event.amount !== undefined, name, '缺少效果数值');
  }
}



function validateExpeditionState(s:RecordValue,slots:Point[]):void{
 const e=object(s.expedition,'局内征召'),kind=text(e.kind,'局内模式'),id=s.levelId as number;
 check((e.version===1||e.version===2)&&s.formationVersion===2,'局内规则','版本不匹配');
 if(e.coastTrial!==undefined)check(e.coastTrial===1&&e.version===2&&kind==='chapter'&&id<5,'海湾试验','仅适用于前五关');
 if(e.heldRoles!==undefined){const held=array(e.heldRoles,'手动保留职业',5);check(e.coastTrial===1&&new Set(held).size===held.length&&held.every(v=>typeof v==='string'&&own(ROLES,v)),'手动保留职业','不合法');}
 check(kind===(id<50?'chapter':id===50?'endless':'raid'),'局内模式','与地图不符');
 const limit=kind==='endless'?0:kind==='chapter'?chapterWaves(id):[10,15,20,20][id===55?3:id-51];
 check(e.limit===limit&&e.cost===(e.economyVersion===1?40:limit?(e.version===2?recruitCost(limit):legacyRecruitCost(limit)):50)&&e.cap===(limit?20:0),'征召配置','与波次不符');
 if(e.economyVersion!==undefined)check(e.economyVersion===1&&e.version===2,'干粮经济','未知版本');
 const completed=integer(e.completed,'已完成波次',0,limit||MAX);check(completed<=(s.wave as number)&&(e.cadenceVersion===1||(s.wave as number)<=completed+1),'波次进度','不同步');
 if(e.cadenceVersion!==undefined){check(e.cadenceVersion===1,'波次时钟','未知版本');const cleared=array(e.clearedWaves,'已结算波次').map(v=>integer(v,'已结算波次',1,s.wave as number));check(cleared.length===completed&&new Set(cleared).size===cleared.length,'已结算波次','重复或数量不符');integer(e.nextWaveTick,'下波时间');}
 integer(e.serial,'征召编号');if(e.nextWaveTick!==undefined)integer(e.nextWaveTick,'下波时间');
 const awards=array(e.bossAwards,'首领奖励波次').map(v=>integer(v,'首领奖励波次',1,s.wave as number));check(new Set(awards).size===awards.length,'首领奖励','重复');
 const players=array(e.players,'局内玩家',2);check(players.length===(kind==='raid'?2:1),'局内玩家','数量错误');const owners=new Set<string>();
 players.forEach((raw,i)=>{const p=object(raw,'局内玩家'),owner=text(p.id,'玩家编号');check(!owners.has(owner),'玩家编号','重复');owners.add(owner);
  const templates=array(p.templates,'培养模板',5);check(templates.length>0,'培养模板','为空');const ids=templates.map(raw=>text(object(raw,'培养模板').id,'培养来源'));check(new Set(ids).size===ids.length,'培养模板','重复');
  const expected=Array.from({length:slots.length/players.length},(_,j)=>i*slots.length/players.length+j),actual=array(p.slots,'站位归属');check(JSON.stringify(actual)===JSON.stringify(expected),'站位归属','与地图不符');
  const coins=integer(p.coins,'局内干粮'),earned=integer(p.earned,'获得干粮'),spent=integer(p.spent,'支出干粮'),recruited=integer(p.recruited,'征召数量',0,limit?20:MAX);check(coins===earned-spent+(e.economyVersion===1?90:e.version===2?2*(e.cost as number):0)&&spent===(e.economyVersion===1?recruitmentSpent(recruited):recruited*(e.cost as number)),'局内干粮','账目不一致');
  const buffs=object(p.buffs,'局内祝福');for(const [key,value]of Object.entries(buffs)){check(own(BUFFS,key),'祝福','未知');integer(value,'祝福层数',1,BUFFS[key as keyof typeof BUFFS].cap??MAX);}
  const choices=array(p.choices,'祝福选项',3);check(choices.length===0||choices.length===3,'祝福选项','数量错误');check(new Set(choices).size===choices.length&&choices.every(v=>typeof v==='string'&&own(BUFFS,v)),'祝福选项','重复或未知');
  const pending=integer(p.pending,'待领祝福',0,awards.length);check((choices.length>0)===(pending>0),'待领祝福','不同步');check(Object.values(buffs).reduce<number>((n,v)=>n+(v as number),0)+pending===awards.length,'已领祝福','与首领记录不符');
  const growth=object(p.growth,'成长祝福');for(const key of ['attack','defense','health'])number(growth[key],'成长祝福');
  for(const raw of array(s.units,'局内角色')){const u=object(raw,'局内角色');if(u.ownerId!==owner)continue;check(ids.includes(u.turtleId as string),'局内角色','培养来源不存在');check(expected.includes(u.slot as number),'局内角色','越过站位归属');const rank=integer(u.fusionRank,'融合等级',1,3);const placement=point(u.placement,'固定落点');check(samePoint(placement,slots[u.slot as number]),'固定落点','偏离站位');const base=object(u.expeditionBase,'原始属性');for(const key of ['attack','health','armor','resist','range','interval'])number(base[key],'原始属性');if(rank<3)check((u.skills as string[]).every(id=>!SKILL_BY_ID[id as SkillId]?.specialization),'局内技能','尚未三阶不能拥有进阶主动');}
 });
 check(array(s.units,'局内角色').every(raw=>owners.has(object(raw,'局内角色').ownerId as string)),'局内角色','缺少所属玩家');
}
