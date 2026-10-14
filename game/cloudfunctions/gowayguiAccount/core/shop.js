"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOLD_IAP_PACKS = exports.ATTACK_BOOKS = exports.SHOP_CONFIG = exports.unlimitedPack = exports.SHOP_PACK_LIMIT = exports.SHOP_PACKS = void 0;
exports.packRemaining = packRemaining;
exports.packBookOdds = packBookOdds;
exports.shopPrice = shopPrice;
exports.purchaseShop = purchaseShop;
exports.purchaseShopPack = purchaseShopPack;
const bookPolicy_1 = require("./bookPolicy");
const bookPolicy_2 = require("./bookPolicy");
const data_1 = require("./data");
const random_1 = require("./random");
const talents_1 = require("./talents");
const prototypeConfig_1 = require("./prototypeConfig");
const economy_1 = require("./economy");
const save_1 = require("./save");
exports.SHOP_PACKS = [
    { id: 'turtleBasic', name: '普通伙伴礼包', price: 200, description: '获得1只随机造型的4技能伙伴。固定4技能，天赋和技能搭配随机。' },
    { id: 'turtleAdvanced', name: '高级伙伴礼包', price: 1000, description: '获得1只随机造型的4–6技能伙伴。4/5/6技能概率：50% / 35% / 15%。天赋和搭配随机。' },
    { id: 'bookRandom', name: '随机技能书包', price: 80, description: '获得1本随机技能书。通用技能90%、职业主动10%，同类别内等概率。' },
    { id: 'bookAttack', name: '攻击技能书包', price: 180, description: '获得1本攻击类书。98%为攻击被动，按普通权重分配；1%穿甲弹、1%海霜风暴。' },
    { id: 'materialRandom', name: '随机培养材料包', price: 750, description: '获得20份材料，每份独立抽取：蟹肉30%、蚌肉30%、鱼肉25%、海参15%。' },
    { id: 'materialFixed', name: '培养材料组合包', price: 1500, description: '固定获得蟹肉、蚌肉、鱼肉、海参各8份，共32份。' },
];
exports.SHOP_PACK_LIMIT = 20;
const unlimitedPack = (id) => id === 'materialRandom' || id === 'materialFixed';
exports.unlimitedPack = unlimitedPack;
const shopDay = (now) => new Date(now + 8 * 3600000).toISOString().slice(0, 10);
function packRemaining(s, now, id) { if ((0, exports.unlimitedPack)(id))
    return Infinity; const daily = s.shop?.daily; return exports.SHOP_PACK_LIMIT - (daily && daily.day >= shopDay(now) ? daily.counts[id] ?? 0 : 0); }
exports.SHOP_CONFIG = { turtlePrice: 200, bookPrice: 200, tenDiscount: .9, hundredEvery: 100, turtleSkillWeights: [80, 18, 2], basicSkillWeights: [100], advancedSkillWeights: [50, 35, 15],
    activeWeights: { hold: 1, greatHeal: 1.5, bubbleRing: 1.5, piercingShot: .3, crystalCannon: .3 } };
exports.ATTACK_BOOKS = ['fervor', 'caprice', 'polymorph', 'giant', 'scatter', 'arcane', 'counterStorm', 'calm', 'swift', 'reach', 'critical', 'combo', 'lifesteal', 'bounce', 'shredResist', 'spellDrain', 'shredArmor', 'extraTarget', 'piercingShot', 'crystalCannon'];
function packBookOdds(id) {
    const skills = data_1.SKILLS.filter(s => (0, bookPolicy_2.bookAllowed)(s.id, 'shop') && (id === 'bookRandom' || exports.ATTACK_BOOKS.includes(s.id)));
    if (id === 'bookRandom') {
        const common = skills.filter(s => !s.active).length, active = skills.filter(s => s.active).length;
        return skills.map(s => ({ skillId: s.id, chance: s.active ? .1 / active : .9 / common }));
    }
    const total = skills.filter(s => !s.active).reduce((sum, s) => sum + prototypeConfig_1.BOOK_WEIGHTS[s.id].normal, 0);
    return skills.map(s => ({ skillId: s.id, chance: s.active ? .01 : prototypeConfig_1.BOOK_WEIGHTS[s.id].normal / total * .98 }));
}
function weighted(s, items) {
    const sum = items.reduce((n, i) => n + i.weight, 0);
    let roll = (0, random_1.random)(s) * sum;
    for (const item of items) {
        roll -= item.weight;
        if (roll < 0)
            return item.value;
    }
    return items[items.length - 1].value;
}
function shopPrice(s, pool, count) { return (0, economy_1.goldAmount)(s, (pool === 'turtle' ? exports.SHOP_CONFIG.turtlePrice : exports.SHOP_CONFIG.bookPrice) * count * (count === 10 ? exports.SHOP_CONFIG.tenDiscount : 1)); }
function purchaseShop(s, now, commandId, pool, count, generate) {
    (0, save_1.requireRule)(pool === 'turtle' || pool === 'book', '商城分类不存在');
    (0, save_1.requireRule)(count === 1 || count === 10, '只能单次或十次招募');
    (0, save_1.requireRule)(!s.shop?.pending && !s.outsideFusion && !s.bookReveal, '请先完成当前揭晓');
    (0, save_1.requireRule)(!s.run || s.run.phase === 'result', '请先结束当前冒险');
    const cost = shopPrice(s, pool, count);
    (0, save_1.requireRule)(s.gold >= cost, '金币不足');
    (0, save_1.requireRule)(pool !== 'turtle' || Object.keys(s.collection).length + count <= s.capacity, '收藏空间不足，请先整理伙伴');
    const shop = s.shop ?? (s.shop = { turtleCount: 0, bookCount: 0 }), draws = [];
    for (let i = 0; i < count; i++) {
        const index = pool === 'turtle' ? ++shop.turtleCount : ++shop.bookCount, hundred = index % exports.SHOP_CONFIG.hundredEvery === 0;
        let guarantee = hundred ? 'hundred' : 'normal';
        if (pool === 'turtle') {
            let skills = hundred ? 6 : weighted(s, exports.SHOP_CONFIG.turtleSkillWeights.map((weight, n) => ({ value: n + 4, weight })));
            if (i === 9 && !draws.some(d => d.turtle.skills.length >= 5) && skills < 5) {
                skills = 5;
                guarantee = 'ten';
            }
            const turtle = generate(s, now);
            turtle.skills = (0, talents_1.ordinaryPetSkills)(s, turtle.role, skills);
            s.collection[turtle.id] = turtle;
            draws.push({ turtle, guarantee });
        }
        else {
            let ids = data_1.SKILLS.filter(skill => (0, bookPolicy_2.bookAllowed)(skill.id, 'shop') && (!hundred || skill.active)).map(skill => skill.id);
            const attackGuarantee = i === 9 && !draws.some(d => exports.ATTACK_BOOKS.includes(d.skillId));
            // If the hundredth book is defensive, an earlier draw carries the ten-draw attack guarantee.
            if (attackGuarantee && !hundred) {
                ids = ids.filter(id => exports.ATTACK_BOOKS.includes(id));
                guarantee = 'ten';
            }
            const skillId = hundred || attackGuarantee ? weighted(s, ids.map(id => ({ value: id, weight: 1 }))) : (0, bookPolicy_1.policyBook)(s, 'activity');
            s.skillBooks ?? (s.skillBooks = {});
            s.skillBooks[skillId] = (s.skillBooks[skillId] ?? 0) + 1;
            draws.push({ skillId, guarantee });
            if (attackGuarantee && hundred && !exports.ATTACK_BOOKS.includes(skillId)) {
                const prior = draws[0], old = prior.skillId, replacement = weighted(s, exports.ATTACK_BOOKS.filter(id => (0, bookPolicy_2.bookAllowed)(id, 'shop') && !data_1.SKILLS.find(x => x.id === id).active).map(id => ({ value: id, weight: prototypeConfig_1.BOOK_WEIGHTS[id].normal })));
                s.skillBooks[old]--;
                s.skillBooks[replacement] = (s.skillBooks[replacement] ?? 0) + 1;
                prior.skillId = replacement;
                prior.guarantee = 'ten';
            }
        }
    }
    s.gold -= cost;
    const receipt = { id: commandId, pool, count, cost, draws, at: now };
    shop.pending = receipt;
    return receipt;
}
function purchaseShopPack(s, now, commandId, id, generate, quantity = 1) {
    const config = exports.SHOP_PACKS.find(p => p.id === id);
    (0, save_1.requireRule)(config, '礼包不存在');
    (0, save_1.requireRule)(!s.shop?.pending && !s.outsideFusion && !s.bookReveal, '请先完成当前揭晓');
    (0, save_1.requireRule)(!s.run || s.run.phase === 'result', '请先结束当前冒险');
    (0, save_1.requireRule)(Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= exports.SHOP_PACK_LIMIT, '请选择1–20个礼包');
    (0, save_1.requireRule)(packRemaining(s, now, id) >= quantity, '超过今日礼包剩余购买数量');
    const cost = (0, economy_1.goldAmount)(s, config.price * quantity), turtlePack = id === 'turtleBasic' || id === 'turtleAdvanced';
    (0, save_1.requireRule)(s.gold >= cost, '金币不足');
    (0, save_1.requireRule)(!turtlePack || Object.keys(s.collection).length + quantity <= s.capacity, '伙伴背包空间不足，请减少数量或先整理伙伴');
    const shop = s.shop ?? (s.shop = { turtleCount: 0, bookCount: 0 }), draws = [];
    for (let q = 0; q < quantity; q++) {
        if (turtlePack) {
            const count = weighted(s, (id === 'turtleBasic' ? exports.SHOP_CONFIG.basicSkillWeights : exports.SHOP_CONFIG.advancedSkillWeights).map((weight, n) => ({ value: n + 4, weight })));
            const turtle = generate(s, now);
            turtle.skills = (0, talents_1.ordinaryPetSkills)(s, turtle.role, count);
            s.collection[turtle.id] = turtle;
            draws.push({ turtle, guarantee: 'normal' });
        }
        else if (id === 'bookRandom' || id === 'bookAttack') {
            let skillId;
            if (id === 'bookRandom')
                skillId = (0, bookPolicy_1.policyBook)(s, 'activity');
            else {
                const roll = (0, random_1.random)(s);
                skillId = roll < .01 ? 'piercingShot' : roll < .02 ? 'crystalCannon' : weighted(s, exports.ATTACK_BOOKS.filter(id => (0, bookPolicy_2.bookAllowed)(id, 'shop') && !data_1.SKILLS.find(s => s.id === id).active).map(id => ({ value: id, weight: prototypeConfig_1.BOOK_WEIGHTS[id].normal })));
            }
            s.skillBooks ?? (s.skillBooks = {});
            s.skillBooks[skillId] = (s.skillBooks[skillId] ?? 0) + 1;
            draws.push({ skillId, guarantee: 'normal' });
        }
        else {
            const materials = ['attack', 'health', 'defense', 'growth'], amounts = {};
            if (id === 'materialFixed')
                materials.forEach(m => amounts[m] = 8);
            else
                for (let i = 0; i < 20; i++) {
                    const m = weighted(s, materials.map((value, j) => ({ value, weight: [30, 30, 25, 15][j] })));
                    amounts[m] = (amounts[m] ?? 0) + 1;
                }
            for (const material of materials) {
                const amount = amounts[material] ?? 0;
                if (!amount)
                    continue;
                s.materials[material] += amount;
                draws.push({ material, amount, guarantee: 'normal' });
            }
        }
    }
    if (!turtlePack && id.startsWith('material')) {
        const sums = new Map();
        for (const d of draws)
            sums.set(d.material, (sums.get(d.material) ?? 0) + d.amount);
        draws.length = 0;
        for (const [material, amount] of sums)
            draws.push({ material, amount, guarantee: 'normal' });
    }
    const day = shopDay(now);
    if (!shop.daily || day > shop.daily.day)
        shop.daily = { day, counts: {} };
    if (!(0, exports.unlimitedPack)(id))
        shop.daily.counts[id] = (shop.daily.counts[id] ?? 0) + quantity;
    s.gold -= cost;
    const receipt = { id: commandId, pool: 'pack', packId: id, count: quantity, cost, draws, at: now };
    shop.pending = receipt;
    return receipt;
}
/** Product catalogue only. Currency is granted only after verified platform payment. */
exports.GOLD_IAP_PACKS = [{ id: 'gold_1000000', name: '100万金币礼包', gold: 1000000, priceYuan: 6, petSkills: 6 }, { id: 'gold_5000000', name: '500万金币礼包', gold: 5000000, priceYuan: 26, petSkills: 7 }, { id: 'gold_10000000', name: '1000万金币礼包', gold: 10000000, priceYuan: 66, petSkills: 8 }];
