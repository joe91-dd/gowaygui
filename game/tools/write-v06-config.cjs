const fs=require('node:fs'),path=require('node:path');
const {PROTOTYPE,BOOK_WEIGHTS,QUALITY_PAIRS,STAGE_REWARDS,REWARD_WEIGHTS}=require('../.test-build/core/prototypeConfig.js');
const {SKILLS,ROLES}=require('../.test-build/core/data.js');
const {countDistribution,FUSION_VERSION}=require('../.test-build/core/fusion.js');
const names=Object.fromEntries(SKILLS.map(s=>[s.id,s.name]));
const pools=['normal','ordinary','fine'],totals=Object.fromEntries(pools.map(k=>[k,Object.values(BOOK_WEIGHTS).reduce((sum,w)=>sum+w[k],0)]));
const text=`# V0.6.1 测试配置

以下是 Gameplay Prototype 测试值，不代表最终平衡。按本轮反馈调整 1～8 技能合成分布；职业兼容、技能数量上限、9～12 技能单项概率、资质成长和技能书随机覆盖规则保留。

## 合成技能数量

概率版本：${FUSION_VERSION}。按双亲平均技能数在八档权重之间插值，仅重新分配 1～8 技能的概率质量；9～12 技能的单项概率沿用旧算法。下表以两只同技能数量、兼容且实际技能池足够为例，逐项百分比来自当前算法。池内技能重复或职业不兼容时，实际结果以游戏确认页为准；不会凭空补入双亲没有的技能。双亲平均超过8技能的分布保持旧算法。

| 双亲 | 技能池大小 | ${Array.from({length:12},(_,i)=>`${i+1}技能`).join(' | ')} |
|---|---:|${Array.from({length:12},()=> '---:').join('|')}|
${Array.from({length:8},(_,i)=>{const n=i+1,pool=Math.min(12,n*2),d=countDistribution(n,n,pool);return `| ${n}+${n} | ${pool} | ${Array.from({length:12},(_,k)=>{const p=d.find(e=>e.value===k+1)?.probability??0;return p?(p*100).toFixed(k>=10?3:2)+'%':'—';}).join(' | ')} |`;}).join('\n')}

1+1 在两种不同兼容技能时，2技能为65%；8+8 在12项兼容池时，8技能49.2%、9技能12%、10技能4%、11技能1.95%、12技能0.05%。同一数值不等于极品技能搭配、高资质和高成长同时命中的概率。

## 关卡和资产

- 开局最多五只永久个体直接上场，加五个随机备战槽。锁定免费；非末波刷新未锁定槽及空槽。两备战合成消耗两只得到一只，结果默认锁定（PROTOTYPE.lockFusionResult，可改）。
- 换下伙伴回备战并自动锁定，同波重新上场保留状态。局内合成涉及收藏本体时，警告并确认后永久消耗参与本体；新龟仍需通关带回。
- 每波八金币；原首通奖励、入场体力和既有培养费用保留。成功带回最终有效新个体；失败或主动结束不带回新个体。无容量时保留待整理，不删除旧资产。
- 收藏上限五十；旧超额收藏按迁移时数量保留。局外合成使用 keep-one 规则记录，固定 C 后 A/B/C 留一，另两只消耗。历史只保留兼容数据。
- 关卡首波普通怪数量为 ${PROTOTYPE.chapter.startCounts.join(' / ')}，随后加 floor((波次−1)×0.8)。保留关卡路径、刷新时长和既有难度系数；按波次混合快怪、护甲、法抗、远程压力，五波精英、末关首领。

## 无尽

- 通关第二关后解锁，免费入场，最多五只收藏龟，复用第四索引海湾与同一战斗引擎；无备战刷龟。每完成一波获得四金币。
- 每五波生成五个固定资源候选，并等概率随机选中其中一个位置；画面自动换位后发放该份。候选可重复；候选和中奖位置均先保存，重启不重抽。由于每个候选独立按下表生成，最终所得类型的边际概率也按下表，不再通过手选提高技能书获得率。每十波自动记入阶段奖励。失败/主动结束统一保存本局合法收益，刷新恢复不会重复领取。
- 普通怪数 min(24,6+floor((波次−1)/2))，22秒内刷新；每五波精英、每十波首领。首领波普通怪数减半向上取整。血量系数 0.85×1.07^(min(波次,60)−1)，超过60波再乘 1+0.07×(波次−60)；攻击系数取平方根，移动速度不随波次无限增长。

| 单个候选类型 | 出现概率 | 数量 |
|---|---:|---|
| 金币 | ${REWARD_WEIGHTS.gold}% | 15 + min(15,floor(波次/10)×5) |
| 攻击资质药 | ${REWARD_WEIGHTS.attack}% | 1 |
| 生命资质药 | ${REWARD_WEIGHTS.health}% | 1 |
| 防御资质药 | ${REWARD_WEIGHTS.defense}% | 1 |
| 成长药 | ${REWARD_WEIGHTS.growth}% | 1 |
| 技能书 | ${REWARD_WEIGHTS.book}% | 1，继续按下表 normal 权重抽取 |

| 阶段 | 金币 | 其他奖励 |
|---|---:|---|
| 10波 | 35 | 随机一种资质药×1 |
| 20波 | 35 | 成长药×1、普通随机技能书礼包×1 |
| 30波 | 50 | 随机一种资质药×1、成长药×1、精品随机技能书礼包×1 |

之后按30波循环，金币每轮增加10，额外增加最多50。礼包在达成波次时固定抽取并自动打开；结算展示礼包来源和实际书，二者不重复发放。配置表 STAGE_REWARDS 与 PROTOTYPE.endless 控制初值。

## 技能书差异化权重

下表是相对权重。技能书被选为奖励类型之后，单书概率 = 本列权重 / 本列合计；不等于整个奖励格的直接掉率。normal 用于自动抽奖候选，ordinary 用于普通礼包，fine 用于精品礼包。精品更偏向职业构筑与主动技能，仍是随机书，可能得到当前没有合适龟学习的书。

| 技能书 | 候选书池 normal | 普通礼包 ordinary | 精品礼包 fine |
|---|---:|---:|---:|
${SKILLS.map(s=>`| ${s.name} | ${BOOK_WEIGHTS[s.id].normal} | ${BOOK_WEIGHTS[s.id].ordinary} | ${BOOK_WEIGHTS[s.id].fine} |`).join('\n')}
| 合计 | ${totals.normal} | ${totals.ordinary} | ${totals.fine} |

## 品质显示

综合分 = 技能数量分45 + 技能构筑分15 + 资质分20 + 成长分20。技能数量按12项归一化；构筑采用 BOOK_WEIGHTS.quality 的技能平均值及每个配对额外0.1，最高归一化1；三资质按60～100、成长按0.90～1.10归一化，均计入永久培养。

白/普通：0；绿/良好：25；蓝/优秀：42；紫/珍稀：58；橙/卓越：76。达到对应门槛显示该色。排序按品质、分数、个体编号。颜色和分数不进入战斗数值、抽书、合成概率；改名不改变分数。

构筑配对初值：

${Object.entries(QUALITY_PAIRS).map(([role,pairs])=>`- ${ROLES[role].name}：${pairs.map(pair=>pair.map(id=>names[id]).join('＋')).join('；')}。`).join('\n')}

配置源：game/assets/scripts/core/prototypeConfig.ts；合成概率源：game/assets/scripts/core/fusion.ts。本页由 game/tools/write-v06-config.cjs 从编译后的配置及中文技能表生成。改配置后重新编译核心再生成本页，避免两套数字漂移。
`;
fs.writeFileSync(path.resolve(__dirname,'../../docs/V06_CONFIG.md'),text);console.log('Wrote docs/V06_CONFIG.md');
