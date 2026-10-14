"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
exports.displayName = displayName;
exports.makeInitialSave = makeInitialSave;
const deterministicMath_1 = require("./deterministicMath");
const rewardedAds_1 = require("./rewardedAds");
const dailyAccess_1 = require("./dailyAccess");
const combatTape_1 = require("./combatTape");
const dailyAccess_2 = require("./dailyAccess");
const cloudOperations_1 = require("./cloudOperations");
const expeditionRun_1 = require("./expeditionRun");
const battle_1 = require("./battle");
const taskPolicy_1 = require("./taskPolicy");
const patrol_1 = require("./patrol");
const monthCard_1 = require("./monthCard");
const data_1 = require("./data");
const random_1 = require("./random");
const fusion_1 = require("./fusion");
const save_1 = require("./save");
const storage_1 = require("../platform/storage");
const battle_2 = require("./battle");
const placement_1 = require("./placement");
const battleValidation_1 = require("./battleValidation");
const skillBooks_1 = require("./skillBooks");
const prototype = require("./prototype");
const prototypeConfig_1 = require("./prototypeConfig");
const talents_1 = require("./talents");
const community_1 = require("./community");
const arena_1 = require("./arena");
const progression_1 = require("./progression");
const raids_1 = require("./raids");
const petOrder_1 = require("./petOrder");
const economy_1 = require("./economy");
const living_1 = require("./living");
const development_1 = require("./development");
const mail_1 = require("./mail");
const rewardPacks_1 = require("./rewardPacks");
const shop_1 = require("./shop");
const emptyTraining = () => ({ attack: 0, health: 0, defense: 0, growth: 0 });
const chinaDay = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
const nextId = (s, prefix) => `${prefix}-${++s.idCounter}`;
const live = prototype.currentUnits;
function displayName(t) { return t.name || data_1.ROLES[t.role].name; }
function makeInitialSave(now, seed) {
    const s = { schema: 1, revision: 0, idCounter: 0, rng: seed >>> 0, createdAt: now, clockHighWater: now,
        gold: 300, stamina: 30, staminaAt: now, materials: { attack: 2, health: 2, defense: 2, growth: 1 },
        collection: {}, history: {}, capacity: data_1.ECONOMY.capacity, unlockedLevel: 0, cleared: [], tutorialDone: false, tutorialStarted: false,
        settings: { music: .65, effects: .8, quality: 'high', reducedMotion: false, autoSkills: true, manualSkillTurtles: [] },
        dailyAds: { day: chinaDay(now), total: 0, counts: { stamina: 0, doubleGold: 0, refresh: 0 } }, results: {}, commands: {} };
    for (const role of data_1.ROLE_IDS) {
        const id = nextId(s, 't');
        const active = (0, data_1.skillsForRole)(role).find(id => data_1.SKILL_BY_ID[id].active);
        const passive = (0, talents_1.initialSkills)(s, role, 2).find(id => !data_1.SKILL_BY_ID[id].active) ?? data_1.ROLES[role].starters[0];
        s.collection[id] = { id, role, name: '', skills: Array.from(new Set([active, passive, ...data_1.ROLES[role].starters, 'strong', 'armor', 'regen'])).slice(0, 4), innate: (0, talents_1.initialTalents)(s, role), training: emptyTraining(), generation: 0, bornAt: now, parentIds: [], locked: false };
    }
    (0, save_1.validateSave)(s);
    return s;
}
function updateTime(s, wallNow, offline = false) {
    (0, save_1.requireRule)(Number.isFinite(wallNow) && wallNow >= 0, '设备时间不可用');
    const now = Math.max(s.clockHighWater, Math.floor(wallNow));
    s.clockHighWater = now;
    if (offline)
        (0, dailyAccess_2.mailStaminaOverflow)(s, now, data_1.ECONOMY.staminaIntervalMs, data_1.ECONOMY.staminaCap);
    (0, dailyAccess_2.dailyAccess)(s, now);
    (0, patrol_1.accruePatrol)(s, now);
    const gain = Math.floor(Math.max(0, now - s.staminaAt) / data_1.ECONOMY.staminaIntervalMs);
    if (s.stamina >= data_1.ECONOMY.staminaCap)
        s.staminaAt = now;
    else if (gain > 0) {
        s.stamina = Math.min(data_1.ECONOMY.staminaCap, s.stamina + gain);
        s.staminaAt = s.stamina >= data_1.ECONOMY.staminaCap ? now : s.staminaAt + gain * data_1.ECONOMY.staminaIntervalMs;
    }
    const day = chinaDay(now);
    if (day > s.dailyAds.day)
        s.dailyAds = { day, total: 0, counts: { stamina: 0, doubleGold: 0, refresh: 0 } };
    return now;
}
function freshTurtle(s, now, role = (0, random_1.choose)(s, data_1.ROLE_IDS)) {
    const skills = (0, talents_1.initialSkills)(s, role, 1 + Math.floor((0, random_1.random)(s) * 3));
    return { id: nextId(s, 't'), role, name: '', skills, innate: (0, talents_1.initialTalents)(s, role), training: emptyTraining(), generation: 0, bornAt: now, parentIds: [], locked: false };
}
function rescueBoss(s, r, battle, now) {
    if (r.bossRescuedWaves === undefined || r.mode !== 'chapter' || r.bossRescuedWaves.includes(battle.wave) || !battle.enemies.some(e => e.kind === 'boss' && !e.alive && e.hp <= 0))
        return false;
    r.bossRescuedWaves.push(battle.wave);
    prototype.refreshBench(s, r, now, (save, at) => {
        const t = freshTurtle(save, at), roll = (0, random_1.random)(save), last = battle.wave === 5;
        const count = last ? (roll < .2 ? 3 : roll < .7 ? 4 : 5) : (roll < .25 ? 2 : roll < .75 ? 3 : 4);
        t.skills = (0, talents_1.initialSkills)(save, t.role, count);
        for (const key of ['attack', 'health', 'defense'])
            t.innate[key] = t.innate[key] === 100 ? 100 : Math.min(99, t.innate[key] + (last ? 10 : 5));
        t.innate.growth = Math.min(110, t.innate.growth + (last ? 3 : 1));
        return t;
    });
    return true;
}
function migratePreparedMaps(s) {
    const r = s.run;
    if (r?.rulesVersion === '0.6' && ['prep', 'between'].includes(r.phase) && !r.battle && r.mapVersion !== 6) {
        r.mapVersion = 6;
        let slot = 0;
        for (const u of Object.values(r.units)) {
            delete u.placement;
            if (!u.consumedBy && !u.removed && u.slot !== null)
                u.slot = slot++;
            u.level = (0, development_1.levelInfo)(u.turtle).level;
        }
    }
    const raid = s.community?.raid;
    if (raid && ['prep', 'between'].includes(raid.phase) && raid.mapVersion !== 6) {
        raid.mapVersion = 6;
        raid.members.forEach((m, i) => { m.station = i; delete m.placement; });
    }
}
function runOf(s, phases) {
    (0, save_1.requireRule)(s.run, '当前没有进行中的关卡');
    if (phases)
        (0, save_1.requireRule)(phases.includes(s.run.phase), '请先完成当前操作');
    return s.run;
}
function unitOf(r, id) { const u = r.units[id]; (0, save_1.requireRule)(u && !u.consumedBy && !u.removed, '这只龟已经消耗或退出本局'); return u; }
function ensureHome(s) { (0, save_1.requireRule)(!s.shop?.pending, '请先查看商城结果'); prototype.checkOutsideReady(s); }
function availableSlot(r) { const occupied = new Set(live(r).map(u => u.slot)); for (let n = 0; n < 5; n++)
    if (!occupied.has(n))
        return n; return null; }
function enterPermanent(s, r, id) {
    const saved = s.collection[id];
    (0, save_1.requireRule)(saved && r.selectedSources.includes(id), '这只龟不在本次出战名单');
    (0, save_1.requireRule)(!r.usedSources.includes(id), '同一永久来源每局只能进入一次');
    const u = { id: nextId(s, 'u'), turtle: (0, save_1.copy)(saved), sources: [id], savedId: id, slot: availableSlot(r), level: (0, development_1.levelInfo)(saved).level };
    r.units[u.id] = u;
    r.usedSources.push(id);
    return u;
}
function updateLocalLevel(_s, u, _legacy = false) {
    u.level = (0, development_1.levelInfo)(u.turtle).level;
}
function checkBattle(r, runId, battle) {
    (0, battleValidation_1.validateBattle)(battle);
    (0, save_1.requireRule)(r.id === runId && battle.levelId === r.levelId && (r.expedition ? !!battle.expedition && battle.expedition.kind === r.expedition.kind : battle.wave === r.wave + 1), '这条战斗回调不属于当前局次或波次');
    (0, save_1.requireRule)(r.rulesVersion === battle.rulesVersion && (r.rulesVersion !== '0.6' || r.mode === battle.mode), '战斗规则版本与对局不一致');
    (0, save_1.requireRule)(battle.coreHealth <= r.coreHealth, '战斗不能额外增加核心耐久');
    if (r.battle)
        (0, save_1.requireRule)(battle.tick >= r.battle.tick, '不能用较早的战斗进度覆盖当前检查点');
    if (r.expedition)
        (0, save_1.requireRule)(JSON.stringify(battle.expedition.players.map(p => ({ id: p.id, templates: p.templates, slots: p.slots }))) === JSON.stringify(r.expedition.players.map(p => ({ id: p.id, templates: p.templates, slots: p.slots }))), '局外培养来源和站位归属不能改变');
    const expected = live(r).filter(u => u.slot !== null).map(u => u.id).sort();
    (0, save_1.requireRule)(JSON.stringify(battle.units.map(u => u.id).sort()) === JSON.stringify(expected), '战斗伙伴与布阵不一致');
    for (const unit of battle.units) {
        const source = r.units[unit.id];
        (0, save_1.requireRule)(JSON.stringify(source?.placement) === JSON.stringify(unit.placement), '战斗自由落点与布阵不一致');
        (0, save_1.requireRule)(source && !source.consumedBy && source.slot === unit.slot && source.turtle.id === unit.turtleId, '战斗伙伴与站位或档案不一致');
    }
}
/** All permanent mutations go through a persisted, idempotent transaction. */
class GameService {
    constructor(repository, clock = storage_1.systemClock, seed = Date.now(), cloud = {}) {
        this.repository = repository;
        this.clock = clock;
        this.verifyCombat = !!(cloud.record || cloud.verifyCombat);
        this.state = repository.open(() => makeInitialSave(Math.floor(clock.now()), seed));
        if (cloud.record) {
            for (const method of cloudOperations_1.CLOUD_METHODS) {
                const target = this, original = target[method];
                target[method] = (...args) => { if (this.cloudOperation)
                    return original.apply(this, args); args.forEach(combatTape_1.sealCombatInputs); this.cloudOperation = { method, args: (0, save_1.copy)(args.map(v => v === undefined ? { $cloudUndefined: true } : v)), at: Math.floor(this.clock.now()) }; try {
                    const result = original.apply(this, args);
                    args.forEach(combatTape_1.resetCombatInputs);
                    return result;
                }
                finally {
                    this.cloudOperation = undefined;
                } };
            }
        }
        if (!cloud.skipResume)
            this.resumeOffline();
    }
    recordCloud(next, at) { if (this.cloudOperation) {
        next.cloudJournal ?? (next.cloudJournal = []);
        (0, save_1.requireRule)(next.cloudJournal.length < 512, '待同步操作较多，请先连接服务器保存进度');
        next.cloudJournal.push({ ...(0, save_1.copy)(this.cloudOperation), at });
    } }
    acknowledgeCloud(count, requestId) { if (this.state.cloudAcknowledged === requestId)
        return; const next = (0, save_1.copy)(this.state); (0, save_1.requireRule)(Number.isInteger(count) && count >= 0 && count <= (next.cloudJournal?.length ?? 0), '同步记录不一致'); next.cloudJournal = (next.cloudJournal ?? []).slice(count); next.cloudAcknowledged = requestId; next.revision++; this.repository.commit(next); this.state = next; }
    resumeOffline() { const next = (0, save_1.copy)(this.state), at = updateTime(next, this.clock.now(), true); this.recordCloud(next, at); next.revision++; this.repository.commit(next); this.state = next; }
    buyDaily(commandId, key) { this.transact(commandId, 'dailyBuy:' + key, (s, now) => (0, dailyAccess_2.buyDaily)(s, key, now)); }
    recordRaidAttempt(commandId, tier, day, used) { this.transact(commandId, 'roomAttempt', (s, now) => { (0, save_1.requireRule)(tier >= 0 && tier <= 3 && Number.isInteger(tier) && Number.isInteger(used) && used >= 0 && used <= 6, '副本次数资料无效'); const d = (0, dailyAccess_2.dailyAccess)(s, now); if (d.day === day) {
        const key = ('raid' + tier);
        d.used[key] = Math.max(d.used[key] ?? 0, used);
    } }); }
    acceptCloudSave(save) { (0, save_1.validateSave)(save); const next = (0, save_1.copy)(save); next.revision = this.state.revision + 1; this.repository.commit(next); this.state = next; }
    get snapshot() { return (0, save_1.copy)(this.state); }
    /** Narrow defensive reads for frame-driven presentation; never expose the persisted state. */
    get settingsSnapshot() { return (0, save_1.copy)(this.state.settings); }
    get runSnapshot() { return this.state.run ? (0, save_1.copy)(this.state.run) : undefined; }
    get revision() { return this.state.revision; }
    enablePatrol(commandId) { if (!this.state.patrol)
        this.transact(commandId, 'enablePatrol', (save, now) => (0, patrol_1.enablePatrol)(save, now)); }
    claimPatrol(commandId) { return this.transact(commandId, 'claimPatrol', save => (0, patrol_1.claimPatrol)(save)); }
    claimMonthCard(commandId) { return this.transact(commandId, 'claimMonthCard', (s, now) => (0, monthCard_1.claimMonthCard)(s, now)); }
    enableIncrement(commandId) { if (!this.state.economyVersion)
        this.transact(commandId, 'economyV2', s => (0, economy_1.migrateEconomy)(s)); }
    enableLiving(commandId) { if (!this.state.livingVersion)
        this.transact(commandId, 'livingV1', s => (0, living_1.enableLiving)(s)); }
    allocatePetPoints(commandId, id, points) { this.transact(commandId, 'allocate', s => { ensureHome(s); (0, development_1.allocatePoints)(s, id, points); }); }
    resetPetPoints(commandId, id) { this.transact(commandId, 'resetPoints', s => { ensureHome(s); (0, development_1.resetPoints)(s, id); }); }
    readMail(commandId, id) { this.transact(commandId, 'readMail', s => (0, mail_1.readMail)(s, id)); }
    claimMail(commandId, id) { this.transact(commandId, 'claimMail', s => (0, mail_1.claimMail)(s, id)); }
    deleteMail(commandId, id) { this.transact(commandId, 'deleteMail', s => (0, mail_1.deleteMail)(s, id)); }
    openBookPack(commandId, grade) { return this.transact(commandId, 'openPack', s => (0, rewardPacks_1.openBookPack)(s, grade)); }
    receiveRoomMail(commandId, mail) {
        this.transact(commandId, 'roomMail', s => {
            (0, save_1.requireRule)(mail.id.length < 180 && Number.isSafeInteger(mail.xp) && mail.xp >= 0 && mail.xp < 100000, '房间结算资料无效');
            if (s.mailbox?.items.some(m => m.id === mail.id))
                return;
            const received = (0, mail_1.sendSystemMail)(s, mail.id, mail.title, mail.body, mail.grants, mail.at, mail.id.startsWith('system:') ? 'system' : 'room');
            if (mail.pets) {
                (0, save_1.requireRule)(Array.isArray(mail.pets) && mail.pets.length <= 5, '伙伴奖励无效');
                mail.pets.forEach(save_1.validateTurtle);
                received.pets = (0, save_1.copy)(mail.pets);
            }
            (0, development_1.grantExperience)(s, mail.petIds, mail.xp);
            if (mail.chest) {
                (0, progression_1.grantChest)(s, 'raid:' + mail.id, mail.chest.title, mail.chest.stars, mail.chest.grants, mail.at);
                if (s.livingVersion)
                    (0, taskPolicy_1.recordTask)(s, 'roomChallenge', commandId, mail.at);
            }
        });
    }
    purchaseShop(commandId, pool, count) { return this.transact(commandId, 'shop:' + pool + ':' + count, (s, now) => (0, shop_1.purchaseShop)(s, now, commandId, pool, count, freshTurtle)); }
    purchaseShopPack(commandId, pack, quantity = 1) { return this.transact(commandId, 'shopPack:' + pack + ':' + quantity, (s, now) => (0, shop_1.purchaseShopPack)(s, now, commandId, pack, freshTurtle, quantity)); }
    finishShopReveal(commandId) { this.transact(commandId, 'shopReveal', s => { (0, save_1.requireRule)(s.shop?.pending, '没有待领取的商城结果'); delete s.shop.pending; }); }
    transact(commandId, kind, action) {
        (0, save_1.requireRule)(/^[a-zA-Z0-9:_-]{1,160}$/.test(commandId) && !['__proto__', 'constructor', 'prototype'].includes(commandId), '操作编号不合法');
        const previous = Object.prototype.hasOwnProperty.call(this.state.commands, commandId) ? this.state.commands[commandId] : undefined;
        if (previous) {
            (0, save_1.requireRule)(previous.kind === kind, '操作编号已用于其他动作');
            return (0, save_1.copy)(previous.result);
        }
        const next = (0, save_1.copy)(this.state), now = updateTime(next, this.clock.now());
        (0, progression_1.syncProgression)(next, now);
        migratePreparedMaps(next);
        const result = action(next, now);
        if (this.verifyCombat) {
            (0, combatTape_1.resetCombatInputs)(next);
            (0, combatTape_1.resetCombatInputs)(result);
        }
        migratePreparedMaps(next);
        if (next.livingVersion)
            (0, taskPolicy_1.recordTask)(next, kind, commandId, now);
        if (next.livingVersion)
            for (const t of Object.values(next.collection))
                (0, development_1.initDevelopment)(t);
        (0, progression_1.syncProgression)(next, now);
        // Clock/checkpoint writes have monotonic state checks and no reward. They need no permanent receipt.
        if (kind !== 'clock' && kind !== 'checkpoint')
            next.commands[commandId] = { kind, result: result === undefined ? null : (0, save_1.copy)(result) };
        if (next.community)
            (0, community_1.refreshCommunity)(next, now);
        this.recordCloud(next, now);
        next.revision++;
        this.repository.commit(next);
        this.state = next;
        return result === undefined ? result : (0, save_1.copy)(result);
    }
    receiveAccountParcel(parcel) {
        this.transact(parcel.id, 'accountReward', s => {
            const tradeIncome = /^trade:[a-f0-9-]{36}$/.test(parcel.id) && Array.isArray(parcel.pets) && parcel.pets.length === 0 && Array.isArray(parcel.grants) && parcel.grants.every(g => g.kind === 'gold');
            (0, save_1.requireRule)((parcel.id.startsWith('account:') || tradeIncome) && Array.isArray(parcel.pets) && parcel.pets.length <= 4 && Array.isArray(parcel.grants) && parcel.grants.length <= 8 && parcel.grants.every(rewardPacks_1.validReward), '账号奖励资料无效');
            parcel.pets.forEach(save_1.validateTurtle);
            const fresh = parcel.pets.filter(t => !s.collection[t.id]);
            (0, save_1.requireRule)(Object.keys(s.collection).length + fresh.length <= s.capacity, '龟龟背包空间不足，奖励仍保存在任务待领取中，请整理后再领');
            for (const t of fresh)
                s.collection[t.id] = (0, save_1.copy)(t);
            for (const grant of parcel.grants)
                (0, rewardPacks_1.applyReward)(s, grant);
            const mail = (0, mail_1.sendSystemMail)(s, parcel.id, parcel.title, parcel.body + (fresh.length ? ' 已获得 ' + fresh.length + ' 只伙伴，请到龟龟背包查看。' : ''), []);
            mail.claimed = true;
        });
    }
    receiveAdReward(receipt, kind, context) {
        (0, save_1.requireRule)(/^[a-f0-9]{48}$/.test(receipt), '广告奖励凭证无效');
        if (kind === 'supplies')
            this.transact('verifiedAd:' + receipt, 'adSupplies', s => { (0, save_1.requireRule)((0, rewardedAds_1.adRemaining)(s, 'supplies') > 0, '今日广告补给次数已用完'); s.dailyAds.supplies = (s.dailyAds.supplies ?? 0) + 1; s.dailyAds.total++; s.gold += rewardedAds_1.AD_SUPPLIES_GOLD; s.materials.growth++; });
        else if (rewardedAds_1.AD_EXTRA.includes(kind))
            this.transact('verifiedAd:' + receipt, 'ad:' + kind, (s, now) => {
                var _a;
                (0, save_1.requireRule)((0, rewardedAds_1.adRemaining)(s, kind) > 0, '今日此项广告次数已用完');
                const key = kind === 'arenaAttempt' ? 'arena' : kind === 'endlessAttempt' ? 'endless' : kind === 'patrolClaim' ? 'patrol' : context;
                (0, save_1.requireRule)(key === 'arena' || key === 'endless' || key === 'patrol' || /^raid[0-3]$/.test(key ?? ''), '广告补给项目无效');
                const target = key, rule = dailyAccess_1.DAILY_RULES[target];
                if ('unlock' in rule)
                    (0, save_1.requireRule)(s.cleared.includes(rule.unlock), '请先解锁该挑战');
                if (target === 'patrol')
                    (0, dailyAccess_1.grantInstantPatrol)(s, now);
                const d = (0, dailyAccess_2.dailyAccess)(s, now);
                d.rewarded ?? (d.rewarded = {});
                d.rewarded[target] = (d.rewarded[target] ?? 0) + 1;
                (_a = s.dailyAds).extra ?? (_a.extra = {});
                s.dailyAds.extra[kind] = (s.dailyAds.extra[kind] ?? 0) + 1;
                s.dailyAds.total++;
            });
        else
            this.simulateAd('verifiedAd:' + receipt, kind, context);
    }
    communityAction(commandId, action) { return this.transact(commandId, 'community:' + action.kind, (s, now) => (0, community_1.dispatchCommunity)(s, now, action)); }
    beginRaid(commandId, tier, ids, replacePending = false) { return this.transact(commandId, 'beginRaid', (s, now) => { if (replacePending)
        this.endPendingBattles(s, now); return (0, raids_1.startRaid)(s, now, tier, ids); }); }
    beginArena(commandId, opponentId, ids, replacePending = false) { return this.transact(commandId, 'beginArena', (s, now) => { if (replacePending)
        this.endPendingBattles(s, now); return (0, arena_1.startArena)(s, now, opponentId, ids); }); }
    beginArenaPractice(commandId, opponentId, replacePending = false) { return this.transact(commandId, 'arenaPractice', (s, now) => { if (replacePending)
        this.endPendingBattles(s, now); return (0, arena_1.startArena)(s, now, opponentId, (0, community_1.communityOf)(s).arenaDefense, true); }); }
    checkpointArena(commandId, next) { this.transact(commandId, 'checkpoint', s => { const a = (0, community_1.communityOf)(s).arena; (0, save_1.requireRule)(a, '没有竞技场'); (0, arena_1.validateArenaCheckpoint)(a, next); s.community.arena = (0, save_1.copy)(next); }); }
    finishArena(commandId, next, abandon = false) { return this.transact(commandId, 'finishArena', s => (0, arena_1.finishArena)(s, next, abandon)); }
    selectRaidPet(commandId, id) { this.transact(commandId, 'raidSwap', s => { const r = (0, community_1.communityOf)(s).raid; (0, save_1.requireRule)(r && r.phase !== 'combat', '当前请在战斗中轮换'); (0, raids_1.swapRaidPet)(r, 0, id); }); }
    selectRaidStation(commandId, station, point) { this.transact(commandId, 'raidStation', s => { const r = (0, community_1.communityOf)(s).raid; (0, save_1.requireRule)(r && r.phase !== 'combat', '当前请在战斗中调整站位'); (0, raids_1.moveRaidStation)(r, 0, station, point); }); }
    raidExpeditionCommand(commandId, action, args, next) { this.transact(commandId, 'raidExpedition:' + action, s => { const r = s.community?.raid; (0, save_1.requireRule)(r?.expeditionVersion && r.battle, '副本尚未开始'); if (next) {
        (0, raids_1.validateRaidCheckpoint)(r, next);
        Object.assign(r, (0, save_1.copy)(next));
    } (0, battle_1.expeditionAction)(r.battle, r.members[0].ownerId, action, args); }); }
    beginRaidWave(commandId) { return this.transact(commandId, 'beginRaidWave', s => (0, raids_1.beginRaidWave)(s)); }
    checkpointRaid(commandId, next) { this.transact(commandId, 'checkpoint', s => { const r = (0, community_1.communityOf)(s).raid; (0, save_1.requireRule)(r, '没有副本'); (0, raids_1.validateRaidCheckpoint)(r, next); s.community.raid = (0, save_1.copy)(next); }); }
    finishRaid(commandId, next, abandon = false) { return this.transact(commandId, 'finishRaid', s => { (0, progression_1.discoverBattle)(s, next.battle); return (0, raids_1.finishRaid)(s, next, abandon); }); }
    claimCodex(commandId, kind, id) { return this.transact(commandId, "codex", s => (0, progression_1.claimCodex)(s, kind, id)); }
    claimChest(commandId, id) { this.transact(commandId, "chest", s => (0, progression_1.claimChest)(s, id)); }
    claimArenaTier(commandId, tier) { this.transact(commandId, "tier", s => (0, progression_1.claimArenaTier)(s, tier)); }
    matchArena(commandId, ids, replacePending = false) { return this.transact(commandId, 'matchArena', (s, now) => { if (replacePending)
        this.endPendingBattles(s, now); return (0, arena_1.startArena)(s, now, (0, arena_1.matchArena)(s), ids); }); }
    refreshClock(commandId) { this.transact(commandId, 'clock', () => null); }
    enablePrototype(commandId) {
        if (this.state.rulesVersion === '0.6')
            return;
        this.transact(commandId, 'enableV06', s => prototype.enablePrototype(s));
    }
    beginPrototypeRun(commandId, levelId, selected, mode = 'chapter', replacePending = false) {
        return this.transact(commandId, 'beginV06', (s, now) => {
            if (replacePending)
                this.endPendingBattles(s, now);
            return prototype.startPrototypeRun(s, now, levelId, selected, mode, freshTurtle).id;
        });
    }
    expeditionCommand(commandId, action, args, battle) {
        this.transact(commandId, 'expedition:' + action, s => { const r = runOf(s, ['prep', 'combat']); (0, save_1.requireRule)(r.expedition && r.battle, '当前不是征召战斗'); if (battle) {
            checkBattle(r, r.id, battle);
            (0, expeditionRun_1.syncExpeditionRun)(r, battle);
        } const b = r.battle; (0, battle_1.expeditionAction)(b, 'local-player', action, args); (0, expeditionRun_1.syncExpeditionRun)(r, b); });
    }
    lockBench(commandId, id, locked) { this.transact(commandId, 'benchLock', s => prototype.lockBench(s, id, locked)); }
    setHomeTeam(commandId, ids) {
        this.transact(commandId, 'homeTeam', s => { (0, save_1.requireRule)(ids.length === Math.min(5, Object.keys(s.collection).length) && ids.length > 0 && new Set(ids).size === ids.length, '请选择五只不同的首发伙伴；不足五只时全部上阵'); for (const id of ids) {
            (0, save_1.requireRule)(!!s.collection[id], '伙伴不在收藏中');
        } s.homeTeam = [...ids]; });
    }
    swapCollectionOrder(commandId, a, b) { this.transact(commandId, 'petOrder', s => (0, petOrder_1.swapPetOrder)(s, a, b)); }
    deployBench(commandId, id, slot, battle) {
        this.transact(commandId, 'deploy', s => { const r = runOf(s); (0, save_1.requireRule)(!r.expedition, '征召玩法没有备战席'); if (r.phase === 'combat') {
            (0, save_1.requireRule)(battle, '请先保存当前战斗');
            checkBattle(r, r.id, battle);
            r.battle = (0, save_1.copy)(battle);
        } prototype.deployBench(s, id, slot); });
    }
    setBattleSpeed(commandId, speed) {
        this.transact(commandId, 'speed', s => { const r = runOf(s); (0, save_1.requireRule)(r.rulesVersion === '0.6' && (speed === 1 || speed === 2), '速度只能选择 1X 或 2X'); r.speed = speed; });
    }
    prepareEndlessReward(commandId, wave) { this.transact(commandId, 'endlessDraw', s => prototype.prepareEndlessReward(s, wave)); }
    chooseEndlessReward(commandId, wave, index) { return this.transact(commandId, 'endlessReward', s => prototype.chooseEndlessReward(s, wave, index)); }
    buyEndlessReward(commandId, wave, all = false) { return this.transact(commandId, 'endlessBuy', s => prototype.buyEndlessReward(s, wave, all)); }
    closeEndlessReward(commandId, wave) { this.transact(commandId, 'endlessClose', s => prototype.closeEndlessReward(s, wave)); }
    takeHome(commandId, id) { return this.transact(commandId, 'takeHome', s => prototype.carryTurtle(s, id)); }
    discardTakeaway(commandId, id) { this.transact(commandId, 'discardTakeaway', s => prototype.discardTakeaway(s, id)); }
    releaseTurtle(commandId, id) { this.transact(commandId, 'release', s => prototype.releaseCollected(s, id)); }
    startOutsideFusion(commandId, aId, bId) { return this.transact(commandId, 'outsideFusion', (s, now) => prototype.startOutsideFusion(s, now, aId, bId)); }
    revealOutsideFusion(commandId) {
        return this.transact(commandId, 'outsideReveal', s => { const e = s.outsideFusion; (0, save_1.requireRule)(e, '没有待揭晓的局外合成'); e.revealed = true; return e.candidate; });
    }
    keepOutsideFusion(commandId, choice) { return this.transact(commandId, 'outsideKeep', s => prototype.keepOutsideFusion(s, choice)); }
    revealSkillBook(commandId) { this.transact(commandId, 'bookUnveil', s => { (0, save_1.requireRule)(s.bookReveal, '没有待揭晓的技能书'); s.bookReveal.revealed = true; }); }
    finishBookReveal(commandId) { this.transact(commandId, 'bookReveal', s => { (0, save_1.requireRule)(s.bookReveal, '没有待揭晓的技能书'); delete s.bookReveal; }); }
    fuseSkillBooks(commandId, materials) {
        return this.transact(commandId, 'bookFusion', s => { ensureHome(s); return (0, skillBooks_1.fuseSkillBooks)(s, materials); });
    }
    updateAvatar(commandId, avatar) {
        this.transact(commandId, 'avatar', s => {
            (0, save_1.requireRule)(data_1.ROLE_IDS.includes(avatar.role), '头像角色不存在');
            (0, save_1.requireRule)(avatar.image === undefined || avatar.image.length <= 360000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar.image), '头像格式或大小不合适');
            s.avatar = { ...avatar };
        });
    }
    updateSettings(commandId, settings) {
        return this.transact(commandId, 'settings', s => {
            const next = { ...s.settings, ...settings };
            (0, save_1.requireRule)(Number.isFinite(next.music) && next.music >= 0 && next.music <= 1 && Number.isFinite(next.effects) && next.effects >= 0 && next.effects <= 1, '音量应在0到100%之间');
            (0, save_1.requireRule)(['high', 'low'].includes(next.quality) && typeof next.reducedMotion === 'boolean', '画面设置不正确');
            (0, save_1.requireRule)(next.controlGuideDone === undefined || typeof next.controlGuideDone === 'boolean', '教学设置不正确');
            (0, save_1.requireRule)(next.autoSkills === undefined || typeof next.autoSkills === 'boolean', '自动施法设置不正确');
            (0, save_1.requireRule)(next.manualSkillTurtles === undefined || Array.isArray(next.manualSkillTurtles) && next.manualSkillTurtles.length <= 100 && next.manualSkillTurtles.every(id => typeof id === 'string' && id.length < 128), '手动技能设置不正确');
            s.settings = next;
            return next;
        });
    }
    rename(commandId, id, name) {
        this.transact(commandId, 'rename', s => { ensureHome(s); const t = s.collection[id]; (0, save_1.requireRule)(t, '找不到这只龟'); name = name.trim(); (0, save_1.requireRule)(Array.from(name).reduce((n, c) => n + (/[\x00-\x7f]/.test(c) ? 1 : 2), 0) <= 12 && !/[\x00-\x1f]/.test(name), '名字最多6个汉字或12个英文字符'); t.name = name; });
    }
    setLocked(commandId, id, locked) {
        this.transact(commandId, 'lock', s => { (0, save_1.requireRule)(!s.outsideFusion && !s.bookReveal, '请先完成当前揭晓与选择'); const t = s.collection[id]; (0, save_1.requireRule)(t, '找不到这只龟'); t.locked = !!locked; });
    }
    train(commandId, id, material) {
        return this.transact(commandId, 'train', s => {
            ensureHome(s);
            const t = s.collection[id];
            (0, save_1.requireRule)(t, '找不到这只龟');
            (0, save_1.requireRule)(['attack', 'health', 'defense', 'growth'].includes(material), '培养项目不存在');
            const growth = material === 'growth', cap = s.livingVersion ? (growth ? 20 : 40) : (growth ? 5 : 10), max = growth ? 110 : 100, cost = (0, development_1.trainingCost)(s, t, material);
            (0, save_1.requireRule)(t.training[material] < cap && t.innate[material] + t.training[material] < max, '这项培养已达到上限');
            (0, save_1.requireRule)(s.gold >= cost && s.materials[material] >= 1, '金币或培养材料不足');
            s.gold -= cost;
            s.materials[material]--;
            t.training[material]++;
            return t;
        });
    }
    learnSkillBook(commandId, id, bookSkillId) {
        return this.transact(commandId, 'skillBook', s => {
            ensureHome(s);
            const turtle = s.collection[id];
            (0, save_1.requireRule)(turtle, '找不到这只龟');
            const books = s.skillBooks, count = books?.[bookSkillId];
            (0, save_1.requireRule)(books && typeof count === 'number' && Number.isSafeInteger(count) && count > 0, '这本技能书数量不足');
            const application = (0, skillBooks_1.applySkillBook)(s, turtle, bookSkillId);
            // This transaction consumes the actual book once. No extra price or supply
            // is invented here; any future change to those needs an economic rule.
            books[bookSkillId] = count - 1;
            s.collection[id] = application.turtle;
            if (s.rulesVersion === '0.6')
                s.bookReveal = { commandId, receipt: (0, save_1.copy)(application.receipt), turtle: (0, save_1.copy)(application.turtle) };
            // Finished runs deliberately keep their earlier individuals and fixed
            // offspring. Later collection archives the then-current permanent source.
            return application.receipt;
        });
    }
    beginRun(commandId, levelId, selectedSources, replacePending = false) {
        return this.transact(commandId, 'beginRun', (s, now) => {
            if (replacePending)
                this.endPendingBattles(s, now);
            ensureHome(s);
            const level = data_1.LEVELS[levelId];
            (0, save_1.requireRule)(level && levelId <= s.unlockedLevel, '请先通过前一关');
            (0, save_1.requireRule)(selectedSources.length >= 1 && selectedSources.length <= 5 && new Set(selectedSources).size === selectedSources.length && selectedSources.every(id => !!s.collection[id]), '请选择一至五只不同的伙伴');
            const free = levelId === 0 && !s.tutorialStarted;
            (0, save_1.requireRule)(free || s.stamina >= data_1.ECONOMY.staminaCost, '体力不足，休息片刻再来吧');
            if (!free)
                s.stamina -= data_1.ECONOMY.staminaCost;
            if (levelId === 0)
                s.tutorialStarted = true;
            const r = { id: nextId(s, 'run'), levelId, phase: 'prep', wave: 0, coreHealth: 20, goldEarned: 0, combatSeconds: 0, startedAt: now,
                selectedSources: [...selectedSources], usedSources: [], units: {}, merges: {}, mergeWavesUsed: [], recruitAvailable: false, recruitCandidates: [], refreshUsed: false };
            enterPermanent(s, r, selectedSources[0]);
            s.run = r;
            return r.id;
        });
    }
    recruit(commandId, choice) {
        return this.transact(commandId, 'recruit', s => {
            const r = runOf(s, ['prep', 'between']);
            (0, save_1.requireRule)(r.recruitAvailable, '本波加入机会已经使用');
            (0, save_1.requireRule)(live(r).length < 10, '本局最多十只龟，请先合成腾出位置');
            let u;
            if ('permanentId' in choice)
                u = enterPermanent(s, r, choice.permanentId);
            else {
                const t = r.recruitCandidates.find(t => t.id === choice.candidateId);
                (0, save_1.requireRule)(t, '候选已经更新');
                u = { id: nextId(s, 'u'), turtle: (0, save_1.copy)(t), sources: [], slot: availableSlot(r), level: 1 };
                r.units[u.id] = u;
            }
            r.recruitAvailable = false;
            r.recruitCandidates = [];
            return u;
        });
    }
    placeUnit(commandId, id, point, battle) {
        this.transact(commandId, 'place', s => {
            const r = runOf(s, ['prep', 'between', 'combat']);
            (0, save_1.requireRule)(!r.expedition, '请长按伙伴拖到固定站位');
            (0, save_1.requireRule)(r.rulesVersion === '0.6', '此旧版对局请先结束后再自由布阵');
            if (r.phase === 'combat') {
                (0, save_1.requireRule)(battle, '请先保存当前战斗');
                checkBattle(r, r.id, battle);
                r.battle = (0, save_1.copy)(battle);
            }
            const u = unitOf(r, id), others = live(r).filter(v => v.id !== id && v.slot !== null), map = data_1.BATTLE_MAPS[r.levelId], p = (0, placement_1.normalizedPoint)(point);
            const occupied = others.find(v => { const at = v.placement ?? map.slots[v.slot]; return (0, deterministicMath_1.simulationHypot)(at.x - p.x, at.z - p.z) < .78; });
            if (occupied) {
                prototype.movePrototypeUnit(s, id, occupied.slot);
                return;
            }
            (0, save_1.requireRule)(!(0, placement_1.placementIssue)(map, p, others.map(v => v.placement ?? map.slots[v.slot])), (0, placement_1.placementIssue)(map, p, others.map(v => v.placement ?? map.slots[v.slot])) ?? '这里不能摆放');
            if (u.slot === null) {
                const slot = map.slots.findIndex((_, i) => !others.some(v => v.slot === i));
                (0, save_1.requireRule)(others.length < 5 && slot >= 0, '已上阵五只，请先换下一只伙伴');
                prototype.deployBench(s, id, slot, p);
            }
            else {
                if (r.phase === 'combat')
                    (0, battle_2.moveBattleUnit)(r.battle, id, u.slot, p);
                u.placement = p;
            }
        });
    }
    moveUnit(commandId, id, slot, battle, benchSlot) {
        this.transact(commandId, 'move', s => {
            if (s.run?.rulesVersion === '0.6') {
                const r = s.run;
                (0, save_1.requireRule)(!r.expedition, '请使用局内征召、换位和同阶合成');
                if (r.phase === 'combat') {
                    (0, save_1.requireRule)(battle, '请先保存当前战斗');
                    checkBattle(r, r.id, battle);
                    r.battle = (0, save_1.copy)(battle);
                }
                prototype.movePrototypeUnit(s, id, slot, benchSlot);
                return;
            }
            const r = runOf(s, ['prep', 'between']), u = unitOf(r, id);
            (0, save_1.requireRule)(slot === null || (Number.isInteger(slot) && slot >= 0 && slot < 5), '布阵位置不存在');
            const other = slot === null ? undefined : live(r).find(v => v.id !== u.id && v.slot === slot);
            if (other)
                other.slot = u.slot;
            u.slot = slot;
            (0, save_1.requireRule)(live(r).some(v => v.slot !== null), '至少保留一只龟在场');
            (0, save_1.requireRule)(live(r).filter(v => v.slot === null).length <= 5, '替补席已满，最多五只替补');
        });
    }
    /** Called by the battle adapter after constructing the deterministic wave state. */
    beginWave(commandId, runId, battle) {
        this.transact(commandId, 'beginWave', s => {
            const r = runOf(s, ['prep', 'between']);
            (0, save_1.requireRule)((r.mode === 'endless' || r.wave < (r.waveLimit ?? data_1.BATTLE_MAPS[r.levelId].waves)) && live(r).some(u => u.slot !== null), '没有可出战伙伴');
            (0, save_1.requireRule)(!r.rewardNodes?.some(prototype.hasPendingReward), '请先揭晓本波随机奖励');
            for (const unit of battle.units) {
                const source = r.units[unit.id], sleeping = source?.sleepUntilWave;
                if (source?.fallen && sleeping === undefined)
                    (0, save_1.requireRule)(!unit.alive && unit.hp === 0, '伙伴已倒下，本局不能再次出战');
                if (sleeping !== undefined && sleeping > battle.wave)
                    (0, save_1.requireRule)(!unit.alive && unit.hp === 0 && unit.sleepUntilWave === sleeping, '伙伴尚未从沉睡苏醒');
            }
            checkBattle(r, runId, battle);
            (0, save_1.requireRule)(battle.status === 'fighting' && battle.tick === 0, '新波次必须从准备状态开始');
            r.phase = 'combat';
            r.battle = (0, save_1.copy)(battle);
            r.recruitAvailable = false;
            r.recruitCandidates = [];
        });
    }
    checkpointBattle(commandId, runId, battle) {
        this.transact(commandId, 'checkpoint', (s, now) => { const r = runOf(s, ['combat']); checkBattle(r, runId, battle); (0, progression_1.discoverBattle)(s, battle); if (r.expedition)
            (0, expeditionRun_1.syncExpeditionRun)(r, battle);
        else {
            r.battle = (0, save_1.copy)(battle);
            rescueBoss(s, r, r.battle, now);
        } });
    }
    completeWave(commandId, runId, battle) {
        this.transact(commandId, 'completeWave', (s, now) => {
            var _a;
            const r = runOf(s, ['combat']);
            checkBattle(r, runId, battle);
            (0, save_1.requireRule)(battle.status === 'won' || battle.status === 'lost', '这一波战斗尚未结束');
            (0, progression_1.discoverBattle)(s, battle);
            if (r.expedition) {
                (0, expeditionRun_1.syncExpeditionRun)(r, battle);
                (0, expeditionRun_1.settleExpeditionRun)(s, r, battle.status === 'won', now, freshTurtle);
                return;
            }
            r.contributions ?? (r.contributions = {});
            for (const [id, row] of Object.entries(battle.contributions ?? {})) {
                const total = (_a = r.contributions)[id] ?? (_a[id] = { name: row.name, damage: 0, healing: 0, shield: 0, reflected: 0, rebirths: 0 });
                for (const key of ['damage', 'healing', 'shield', 'reflected', 'rebirths'])
                    total[key] += row[key];
            }
            for (const actor of battle.units.concat(battle.benchUnits ?? [])) {
                const u = r.units[actor.id];
                if (u) {
                    if (r.rulesVersion === '0.6')
                        u.fallen = !actor.alive;
                    if (actor.sleepUntilWave !== undefined)
                        u.sleepUntilWave = actor.sleepUntilWave;
                    else
                        delete u.sleepUntilWave;
                }
            }
            if (r.bossRescuedWaves !== undefined) {
                r.battle = (0, save_1.copy)(battle);
                rescueBoss(s, r, r.battle, now);
            }
            r.coreHealth = battle.coreHealth;
            r.combatSeconds += battle.elapsed;
            delete r.battle;
            if (battle.status === 'lost') {
                this.settle(s, r, false, now);
                return;
            }
            r.wave++;
            (0, development_1.grantExperience)(s, r.usedSources, r.mode === 'endless' ? 10 + Math.min(60, r.wave) * 2 : 22 + r.levelId * 2 + r.wave * 3);
            for (const u of live(r)) {
                const owned = u.savedId ? s.collection[u.savedId] : undefined;
                if (owned?.development)
                    u.turtle.development = (0, save_1.copy)(owned.development);
            }
            r.goldEarned += (0, economy_1.goldAmount)(s, r.mode === 'endless' ? prototypeConfig_1.PROTOTYPE.endless.waveGold : data_1.ECONOMY.waveGold);
            live(r).forEach(u => updateLocalLevel(s, u, r.rulesVersion === '0.6'));
            if (r.rulesVersion === '0.6') {
                if (r.mode === 'endless')
                    prototype.recordEndlessWave(s, r);
                else if (r.wave === (r.waveLimit ?? data_1.BATTLE_MAPS[r.levelId].waves)) {
                    this.settle(s, r, true, now);
                    return;
                }
                r.phase = 'between';
                if (r.mode === 'chapter' && r.bossRescuedWaves === undefined)
                    prototype.refreshBench(s, r, now, freshTurtle);
                return;
            }
            if (r.wave === data_1.BATTLE_MAPS[r.levelId].waves) {
                this.settle(s, r, true, now);
                return;
            }
            r.phase = 'between';
            r.recruitAvailable = true;
            r.recruitCandidates = Array.from({ length: 3 }, () => freshTurtle(s, now));
        });
    }
    mergePreview(aId, bId) {
        const r = runOf(this.state, this.state.run?.rulesVersion === '0.6' ? ['prep', 'between', 'combat'] : ['between']);
        if (r.rulesVersion === '0.6')
            (0, save_1.requireRule)(unitOf(r, aId).benchSlot !== undefined && unitOf(r, bId).benchSlot !== undefined, '请选择两只备战伙伴');
        return (0, fusion_1.previewFusion)(unitOf(r, aId).turtle, unitOf(r, bId).turtle);
    }
    merge(commandId, aId, bId, battle, allowPermanent = false) {
        return this.transact(commandId, 'merge', (s, now) => {
            if (s.run?.rulesVersion === '0.6') {
                const r = s.run;
                (0, save_1.requireRule)(!r.expedition, '请使用局内征召、换位和同阶合成');
                if (r.phase === 'combat') {
                    (0, save_1.requireRule)(battle, '请先保存当前战斗');
                    checkBattle(r, r.id, battle);
                    r.battle = (0, save_1.copy)(battle);
                }
                return prototype.mergeBench(s, now, aId, bId, allowPermanent);
            }
            const r = runOf(s, ['between']);
            (0, save_1.requireRule)(aId !== bId, '请选择两只不同的龟');
            (0, save_1.requireRule)(data_1.BATTLE_MAPS[r.levelId].mergeWaves.includes(r.wave) && !r.mergeWavesUsed.includes(r.wave), '当前波次没有合成机会');
            const a = unitOf(r, aId), b = unitOf(r, bId), sources = [...a.sources, ...b.sources];
            (0, save_1.requireRule)(new Set(sources).size === sources.length, '同一来源不能参与两次');
            const eventId = nextId(s, 'merge');
            const turtle = (0, fusion_1.generateFusion)(s, a.turtle, b.turtle, nextId(s, 't'), now);
            const output = { id: nextId(s, 'u'), turtle, sources, slot: a.slot ?? b.slot, level: (0, development_1.levelInfo)(turtle).level };
            a.consumedBy = eventId;
            b.consumedBy = eventId;
            r.units[output.id] = output;
            r.merges[eventId] = { id: eventId, inputIds: [aId, bId], outputId: output.id, originalSources: [...sources], wave: r.wave, revealed: false, probabilityVersion: fusion_1.FUSION_VERSION };
            r.mergeWavesUsed.push(r.wave);
            r.pendingMergeId = eventId;
            r.phase = 'reveal';
            return output;
        });
    }
    reveal(commandId) {
        return this.transact(commandId, 'reveal', s => {
            const r = runOf(s, ['reveal']), id = r.pendingMergeId;
            (0, save_1.requireRule)(id, '没有等待揭晓的结果');
            const event = r.merges[id];
            event.revealed = true;
            delete r.pendingMergeId;
            r.phase = r.resumeAfterReveal ?? 'between';
            delete r.resumeAfterReveal;
            return unitOf(r, event.outputId);
        });
    }
    collectionPreview(unitId) {
        const r = runOf(this.state, ['prep', 'between', 'result']), u = unitOf(r, unitId);
        const sources = u.sources.map(id => this.state.collection[id]).filter((t) => !!t);
        return (0, save_1.copy)({ candidate: u.turtle, sources, alreadySaved: !!u.savedId, lockedSources: sources.filter(t => t.locked).map(t => t.id) });
    }
    collect(commandId, unitId) {
        return this.transact(commandId, 'collect', (s, now) => {
            const r = runOf(s, ['prep', 'between', 'result']), u = unitOf(r, unitId);
            if (r.rulesVersion === '0.6')
                return prototype.carryTurtle(s, unitId);
            if (u.savedId) {
                const saved = s.collection[u.savedId];
                (0, save_1.requireRule)(saved, '这个旧档案已在新版收藏中整理');
                return saved;
            }
            (0, save_1.requireRule)(u.sources.every(id => !!s.collection[id]), '来源档案发生了变化，请重新比较');
            (0, save_1.requireRule)(u.sources.every(id => !s.collection[id].locked), '来源中有已锁定的龟，请先解锁后再确认收录');
            (0, save_1.requireRule)(Object.keys(s.collection).length - u.sources.length + 1 <= s.capacity, '收藏空间不足');
            (0, save_1.requireRule)(!s.collection[u.turtle.id] && !s.history[u.turtle.id], '新龟的档案编号已存在');
            const t = (0, save_1.copy)(u.turtle);
            t.locked = false;
            for (const id of u.sources) {
                s.history[id] = { turtle: (0, save_1.copy)(s.collection[id]), retiredAt: now, replacementId: t.id, eventId: commandId };
                delete s.collection[id];
            }
            s.collection[t.id] = t;
            u.sources = [t.id];
            u.savedId = t.id;
            u.turtle = (0, save_1.copy)(t);
            if (!r.usedSources.includes(t.id))
                r.usedSources.push(t.id);
            const event = Object.values(r.merges).find(e => e.outputId === u.id);
            if (event)
                event.collectedId = t.id;
            return t;
        });
    }
    abandonRun(commandId) {
        return this.transact(commandId, 'abandon', (s, now) => this.abandonCurrentRun(s, now));
    }
    abandonCurrentRun(s, now) {
        const r = runOf(s);
        if (r.phase === 'result')
            return s.results[r.id];
        // A fixed reveal survives abandoning: the candidate remains in the result screen for collection.
        if (r.pendingMergeId) {
            r.merges[r.pendingMergeId].revealed = true;
            delete r.pendingMergeId;
        }
        if (r.expedition)
            return (0, expeditionRun_1.settleExpeditionRun)(s, r, false, now, freshTurtle);
        if (r.rulesVersion === '0.6' && r.battle) {
            r.combatSeconds += r.battle.elapsed;
            delete r.battle;
        }
        return this.settle(s, r, false, now);
    }
    /** Settlement and replacement share one transaction, so a rejected new run preserves the old battle. */
    endPendingBattles(s, now) {
        if (s.community?.raid && !s.community.raid.settled) {
            (0, progression_1.discoverBattle)(s, s.community.raid.battle);
            (0, raids_1.finishRaid)(s, s.community.raid, true);
        }
        if (s.community?.arena && !s.community.arena.settled)
            (0, arena_1.finishArena)(s, s.community.arena, true);
        if (s.run && s.run.phase !== 'result')
            this.abandonCurrentRun(s, now);
    }
    settle(s, r, victory, now) {
        if (r.rulesVersion === '0.6')
            return prototype.settlePrototype(s, r, victory, now);
        if (s.results[r.id])
            return s.results[r.id];
        const first = victory && !s.cleared.includes(r.levelId), baseGold = r.goldEarned + (victory ? (0, economy_1.goldAmount)(s, data_1.ECONOMY.clearGold) : 0);
        const materials = {};
        if (first) {
            const material = data_1.ROLE_IDS[r.levelId] === 'stone' ? 'health' : r.levelId === 4 ? 'growth' : 'attack';
            materials[material] = 1;
            s.materials[material]++;
        }
        const result = { runId: r.id, levelId: r.levelId, victory, waves: r.wave, baseGold, firstClearGold: first ? (0, economy_1.goldAmount)(s, data_1.ECONOMY.firstClearGold) : 0, combatSeconds: r.combatSeconds, at: now, doubled: false, materials };
        s.gold += baseGold + result.firstClearGold;
        s.results[r.id] = result;
        r.phase = 'result';
        delete r.battle;
        r.recruitAvailable = false;
        r.recruitCandidates = [];
        if (first) {
            s.cleared.push(r.levelId);
            s.unlockedLevel = Math.min(data_1.LEVELS.length - 1, Math.max(s.unlockedLevel, r.levelId + 1));
        }
        if (victory && r.levelId === 0)
            s.tutorialDone = true;
        return result;
    }
    simulateAd(commandId, kind, resultRunId) {
        return this.transact(commandId, 'ad:' + kind, (s, now) => {
            (0, save_1.requireRule)(['stamina', 'doubleGold', 'refresh'].includes(kind), '奖励入口不存在');
            (0, save_1.requireRule)(!s.run || ['prep', 'between', 'result'].includes(s.run.phase), '请先完成当前战斗或揭晓');
            (0, save_1.requireRule)((0, rewardedAds_1.adRemaining)(s, kind) > 0, '今天的体验奖励次数已用完');
            let reward = 0;
            if (kind === 'stamina') {
                (0, save_1.requireRule)(s.stamina < data_1.ECONOMY.staminaCap, '体力已满');
                reward = Math.min(5, data_1.ECONOMY.staminaCap - s.stamina);
                s.stamina += reward;
                if (s.stamina === data_1.ECONOMY.staminaCap)
                    s.staminaAt = now;
            }
            else if (kind === 'doubleGold') {
                const result = resultRunId ? s.results[resultRunId] : undefined;
                (0, save_1.requireRule)(result && !result.doubled && result.baseGold > 0, '本次金币已翻倍或没有可翻倍金币');
                result.doubled = true;
                reward = result.baseGold;
                s.gold += reward;
            }
            else {
                const r = runOf(s, ['prep', 'between']);
                (0, save_1.requireRule)(r.recruitAvailable && !r.refreshUsed && r.recruitCandidates.length > 0, '本局更换机会已用完或当前没有候选');
                r.recruitCandidates = Array.from({ length: 3 }, () => freshTurtle(s, now));
                r.refreshUsed = true;
                reward = 1;
            }
            s.dailyAds.counts[kind]++;
            s.dailyAds.total++;
            return reward;
        });
    }
}
exports.GameService = GameService;
