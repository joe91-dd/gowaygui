"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableLiving = enableLiving;
const economy_1 = require("./economy");
const development_1 = require("./development");
const mail_1 = require("./mail");
function enableLiving(s) {
    if (s.livingVersion)
        return;
    (0, economy_1.migrateGoldV3)(s);
    s.livingVersion = 1;
    // Include pending reveals and receipts so snapshot equality and recovery survive migration.
    const visit = (value) => { if (!value || typeof value !== 'object')
        return; if (value.role && value.innate && value.training && Array.isArray(value.skills) && value.id)
        (0, development_1.initDevelopment)(value); for (const child of Object.values(value))
        visit(child); };
    visit(s);
    (0, mail_1.sendSystemMail)(s, 'system:living-expedition', '海岛来信 · 新的成长旅程', '伙伴现在可以通过战斗积累经验。每次升级获得3个自由属性点，最高50级。金币余额、价格与待领取奖励已统一缩小十倍，购买力保持一致。每周竞技场结算奖励将投递到这里。', []);
}
