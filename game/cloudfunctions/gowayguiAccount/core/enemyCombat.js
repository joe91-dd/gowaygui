"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENEMY_ATTACKS = void 0;
exports.enemyCombat = enemyCombat;
exports.enemySkillDetail = enemySkillDetail;
exports.enemyAttackArea = enemyAttackArea;
exports.enemyAreaContains = enemyAreaContains;
const deterministicMath_1 = require("./deterministicMath");
const enemyG1Catalog_1 = require("./enemyG1Catalog");
/** Every approved species has an anatomical basic attack and a distinct skill identity. */
exports.ENEMY_ATTACKS = {
    B01: ['claw', 'clawSweep', '双钳横扫'], B02: ['headbutt', 'hornRush', '荆角挑撞'], B03: ['headbutt', 'poisonBreath', '珊毒喷吐'], B04: ['headbutt', 'groundSpikes', '苔角地刺'], B05: ['tentacle', 'inkFan', '八腕墨潮'], B06: ['punch', 'groundSpikes', '双拳晶裂'], B07: ['headbutt', 'liquidJet', '铁吻水炮'], B08: ['claw', 'shellBomb', '背壳炮击'], B09: ['frostBolt', 'frostBreath', '岚翼寒息'], B10: ['spikeBolt', 'poisonPool', '孢冠散播'],
    B11: ['sting', 'web', '织潮猎网'], B12: ['fireBolt', 'fireRain', '焰轮火雨'], B13: ['headbutt', 'fireRain', '陨火坠落'], B14: ['bite', 'poisonBreath', '裂潮毒息'], B15: ['bite', 'fireBreath', '赤怒炎息'], B16: ['spikeBolt', 'poisonPool', '菌伞毒孢'], B17: ['claw', 'clawSweep', '藤镰交斩'], B18: ['inkBolt', 'shellBomb', '铁帆重炮'], B19: ['sparkBolt', 'lightningLine', '雷喙贯击'], B20: ['frostBolt', 'frostRain', '镜潮冰雨'],
    B21: ['bite', 'liquidJet', '葬锚暗流'], B22: ['inkBolt', 'shellBomb', '深灯墨弹'], B23: ['punch', 'slam', '锈锤震地'], B24: ['sting', 'spikeShot', '蜂针贯射'], B25: ['headbutt', 'liquidJet', '潮鼓水箭'], B26: ['sting', 'spikeRain', '盐晶针雨'], B27: ['bite', 'spikeShot', '贝羽直射'], B28: ['headbutt', 'frostBreath', '巨吻寒息'], B29: ['bite', 'poisonPool', '腐潮毒池'], B30: ['headbutt', 'spikeShot', '骨帆贯刺'], B31: ['headbutt', 'groundSpikes', '藤壳撼地'], B32: ['bite', 'clawSweep', '月刃翼斩'], B33: ['claw', 'clawSweep', '锚臂摆锤'], B34: ['bite', 'groundSpikes', '潮砂破土'], B35: ['bite', 'fireBreath', '礁鬃烈息'], B36: ['spikeBolt', 'spikeRain', '棘冠落针'],
    H01: ['headbutt', 'fireBreath', '龙王炎息'], H02: ['tentacle', 'inkFan', '幽渊八腕'], H03: ['claw', 'fireRain', '熔礁火雨'], H04: ['headbutt', 'spikeShot', '晶脊贯刺'],
    W01: ['headbutt', 'groundSpikes', '负岳崩岩'], W02: ['tentacle', 'tentacleLash', '万触鞭挞'], W03: ['headbutt', 'slam', '焚潮震击'], W04: ['claw', 'frostBreath', '星冠寒息'],
    M01: ['inkBolt', 'inkFan', '墨团喷溅'], M02: ['claw', 'clawSweep', '疾钳横扫'], M03: ['claw', 'guardPulse', '铁壳加固'], M04: ['frostBolt', 'frostBreath', '雾泡寒息'], M05: ['inkBolt', 'liquidJet', '吐墨直射'], M06: ['sting', 'web', '潮毒结网'], M07: ['inkBolt', 'shellBomb', '炮背轰击'], M08: ['sparkBolt', 'healingPulse', '海萤疗光'], M09: ['spikeBolt', 'spikeShot', '帆翼飞刺'], M10: ['spikeBolt', 'groundSpikes', '盾叶地刺'], M11: ['sparkBolt', 'lightningLine', '电须直击'], M12: ['spikeBolt', 'spikeRain', '爆盐针雨'], M13: ['bite', 'hornRush', '钻沙突袭'], M14: ['punch', 'groundSpikes', '走根穿刺'], M15: ['inkBolt', 'guardPulse', '灯笼护光'], M16: ['punch', 'slam', '珊盾砸击'], M17: ['punch', 'inkFan', '墨泡扬沙'], M18: ['spikeBolt', 'spikeShot', '棘籽贯射'], M19: ['punch', 'healingPulse', '潮钟回响'],
    E01: ['claw', 'shellBomb', '搬壳投掷'], E02: ['sting', 'web', '缚丝捕网'], E03: ['frostBolt', 'healingPulse', '潮铃治愈'], E04: ['inkBolt', 'inkFan', '符潮喷墨'], E05: ['headbutt', 'rally', '阵鼓号令'], E06: ['spikeBolt', 'spikeRain', '棱镜散刺'], E07: ['headbutt', 'groundSpikes', '掘礁破土'], E08: ['claw', 'clawSweep', '双镰回斩'], E09: ['bite', 'spikeShot', '风眼羽矢'],
};
function enemyCombat(key) {
    const def = (0, enemyG1Catalog_1.enemyG1)(key), [basic, skill, name] = exports.ENEMY_ATTACKS[def?.id ?? key] ?? exports.ENEMY_ATTACKS.M02, boss = def?.kind === 'boss', world = def?.id.startsWith('W');
    const fan = ['clawSweep', 'fireBreath', 'poisonBreath', 'frostBreath', 'inkFan'].includes(skill), line = ['hornRush', 'liquidJet', 'spikeShot', 'lightningLine', 'tentacleLash'].includes(skill);
    const close = ['clawSweep', 'hornRush', 'slam'].includes(skill), length = close ? (world ? 3.8 : boss ? 3.1 : 2.1) : (world ? 5 : boss ? 4.8 : 3.5);
    const colour = /fire|slam/.test(skill) ? '#FF8B43' : /poison/.test(skill) ? '#ACE150' : /ink|tentacle/.test(skill) ? '#B976EE' : /frost/.test(skill) ? '#75DFFF' : /lightning/.test(skill) ? '#D8B0FF' : '#FFD185';
    return { basic, skill, name, ranged: basic.endsWith('Bolt'), magic: ['inkBolt', 'frostBolt', 'fireBolt', 'sparkBolt'].includes(basic), windup: world ? 1.8 : boss ? 1.6 : 1.25, cooldown: world ? 10 : boss ? 12 : def?.kind === 'elite' ? 16 : 21, area: { shape: fan ? 'fan' : line ? 'line' : 'circle', length, width: world ? 1.45 : boss ? 1.15 : .85, radius: world ? 1.65 : boss ? 1.35 : 1, halfAngle: (skill === 'clawSweep' ? 55 : 36) * Math.PI / 180 }, colour };
}
function enemySkillDetail(key) {
    const p = enemyCombat(key), support = ['healingPulse', 'guardPulse', 'rally'].includes(p.skill);
    if (support)
        return p.skill === 'healingPulse' ? '短暂蓄力后治疗附近同伴，可眩晕打断。' : p.skill === 'guardPulse' ? '短暂蓄力后加固附近同伴的护甲，可眩晕打断。' : '蓄力后召来两名随从，可用眩晕打断。';
    const shape = p.area.shape === 'fan' ? '扇形' : p.area.shape === 'line' ? '直线' : '圆形落点';
    return `${p.name}：${shape}预警后命中范围内伙伴。预警方向与落点锁定，提前调离或眩晕打断。`;
}
/** Stored at warning creation; moving a target never rotates a committed attack. */
function enemyAttackArea(profile, source, target) {
    const d = (0, deterministicMath_1.simulationHypot)(target.x - source.x, target.z - source.z), a = profile.area;
    return { ...a, ...(a.shape === 'circle' ? target : source), dx: d > .001 ? (target.x - source.x) / d : 1, dz: d > .001 ? (target.z - source.z) / d : 0 };
}
/** Same geometry as the renderer, including inclusive telegraph boundaries. */
function enemyAreaContains(a, p) {
    const x = p.x - a.x, z = p.z - a.z, eps = 1e-6;
    if (a.shape === 'circle')
        return x * x + z * z <= a.radius * a.radius + eps;
    const along = x * a.dx + z * a.dz, across = x * a.dz - z * a.dx;
    if (a.shape === 'line')
        return along >= -eps && along <= a.length + eps && Math.abs(across) <= a.width * .5 + eps;
    return x * x + z * z <= a.length * a.length + eps && along >= -eps && Math.abs(across) <= along * (0, deterministicMath_1.simulationTan)(a.halfAngle) + eps;
}
