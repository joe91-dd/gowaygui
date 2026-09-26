# 第五关第五站位：兼容迁移只读建议

2026-09-08。根代理已查看两张最终离线图并批准场景为运行候选，源与 provenance 已冻结，见 `source-freeze.json`。本报告仅审查当前生产源和测试并提出最小改动，没有修改 production、tests、`.test-build`、runtime 或玩家存档，没有启动 Cocos/Blender，也没有把建议写成已测试实现。

结论：沿用现有珊瑚“原封套校验 → 完整旧状态验证 → 只迁移已知 x/z → 严格当前验证”的流程即可。生产最小范围是 `data.ts`、`battleValidation.ts`、`save.ts`；`GameService` 和 `SaveRepository` 现有提交/检查点路径可保持。**布局与 range-v1/v2 是两条独立兼容轴，不应通过增加或改写 balanceVersion 来标记此次布局移动。**

## 具体改动点

| 当前位置 | 最小建议 |
|---|---|
| `game/assets/scripts/core/data.ts:61–69` | 增加独立 `bossSlots` 五点数组；仅 `LEVELS[4].slots` 引用它。各点对象也应独立。前四点仍 `(-5,1),(-1,1),(3,1),(1,-3)`，第五点改 `(6.62,-1.31)`；不要写共享 `slots[4]`。第三关 `coralSlots`、其他关、路线和强度保持。 |
| `battleValidation.ts:14–19` | 保留冻结珊瑚旧点与路线。另加入仅 `levelId=4, slot=4` 的历史点 `(6,-1)` 及第五关冻结路线。可用按 levelId 索引的局部只读表统一处理两关，无需通用升级框架。 |
| `battleValidation.ts:139–147` | 将内部用途改名为 `migrateLegacyLayoutCoordinates`，按当前关查表；只对匹配旧点的单位写当前 `LEVELS[levelId].slots[unit.slot]` 的 x/z。死龟同样处理。函数仍只从 decoder 在完整验证成功后调用。当前只有 save.ts 导入旧函数名，无其他生产或测试引用。 |
| `battleValidation.ts:150/178–180/193–194` | 参数语义由 `allowLegacyCoralSlots` 改为 `allowLegacyLayoutSlots`；正常 `validateBattle` 仍 false，decode 入口才 true。level2/4 都要求快照路线等于各自当前路线；decode 还要求该关冻结旧路线。仅选中关/slot 的完整旧坐标对获准，其他点严格匹配当前。无需扩大其他关路线规则。 |
| `save.ts:4/42/76/95–103` | 更新迁移函数名及布尔参数名，维持现有调用顺序。必须先验证原始 payload 的 checksum，再解析、全量验证、只迁移活动 combat、严格 `validateSave`。不要在 open 时编码或写盘。 |
| `game.ts:67–77/159–176`、`save.ts:105–135` | 不需修改。begin/checkpoint/complete 共用严格验证，已绑定 runId/level/wave/单位ID/slot/turtleId；repository 已保留 loadedRaw 与原子提交顺序。 |

第五关冻结路线应写完整字面量：`(-9,0)→(-4,0)→(0,0)→(2,-2)→(5,-2)→(6,0)→(9,0)`。只用“路线长度一样”不能证明属于该历史布局。坐标继续沿用现有 `samePoint` 的 `1e-8 × max(1,绝对值)` 容差；不能只比 x 或四舍五入吸附未知点。当前与旧点差远大于该容差。

例如 level4 的 slot4 允许 `(6,-1)` 或 `(6.62,-1.31)`；`(6,-1.31)`、`(6.62,-1)`、珊瑚当前第五点 `(5.832,-.748)` 均拒绝。level4 的 slot2 仍只允许 `(3,1)`，不得因为它也是珊瑚旧点就全局迁到 `(3.395,1.099)`。同理 level2 不能采用 boss 的新点。不要依赖关卡通关进度来关闭历史支持，旧备份随时可能重新出现。

schema、SAVE_KEY、BattleState.version 和 revision 规则保持现有值即可。此时坐标对已经足以区分明确历史布局；本建议不新增全局 layoutVersion，也不解决未来更改路线的另一类迁移。

## 旧范围与新布局的四种组合

`battleValidation.ts:154` 目前只允许 `balanceVersion` 缺失或数值 2。`battle.ts:209/358` 在缺失时令鼓劲/分担继续使用 3；数值 2 使用当前 4.5。普攻/治疗范围存在每个 `unit.range` 中，读取时保持原值；仅新建下一波才从 ROLES 和 reach 重新计算。

| 载入的第五关 combat | decoder 后坐标 | range/版本 |
|---|---|---|
| 旧点 + 缺失 balanceVersion | 只 slot4 规范化新点 | 缺失仍缺失；各 unit.range 原值；鼓劲/分担继续 3 |
| 新点 + 缺失 balanceVersion | 不变，可反复读入 | 同上；这是已迁移过的旧范围波次，必须支持 |
| 旧点 + balanceVersion=2 | 只 slot4 规范化新点 | 保留 2 和已保存 unit.range；鼓劲/分担按现有 v2 |
| 新点 + balanceVersion=2 | 不变 | 当前正常波次 |

布局迁移不得创建战斗、补 `balanceVersion=2`、覆盖 `unit.range`、重跑 RNG/时钟、修复资质或重算技能。范围缺失不能作为旧布局判据，旧点也不能作为旧范围判据。不支持的标记 `null/0/1/3/'2'/false` 仍应拒绝。

这一改点使位置3→5距离从约3.606变为4.294240；旧叶子4格无远望失去这条治疗边，旧4.3仍覆盖，v2的4.5覆盖。位置3的最近友军由5改为2。因此**保留旧技能规则并不等于保留旧布局剩余战斗轨迹**。正确续算基准是同一个完整历史状态仅改这一个合法坐标对，然后继续旧范围规则。

## 状态与事务边界

仅 `phase==='combat'` 的活动 `run.battle.units` 写已知旧点。prep/between 的伙伴保存的是 slot 索引，下次 createBattle 自然取新坐标；reveal 固定合成结果、pendingMergeId、来源、RNG 不动；result 奖励、材料、首通/翻倍与收据不动。现有 validator 不处理非 combat 的闲置 battle 扩展，本轮不顺带清理它。

combat 的 fighting、won、lost 均先完整验证；后两者可能是已模拟结束但尚未 service 结算的快照，不能重开波次或重新判定胜负。单位受伤/倒地、替补、命令、盾/状态/冷却、敌人坐标/进度、出怪计划、首领召唤标记、tick/pendingSeconds/RNG、事件及编号都深相等保留，只改变合法的 unit.x/z。

历史事件 x/z 不平移；`blockedBy`、`encouragedBy`、`auraTargetId` 的有效引用保留，decoder 不提前更新它们。下一个自然 tick 的 `updateAuras` / `updateMovement`（battle.ts:206–235）会重新确定最近对象和阻挡；已 won/lost 的快照不再推进。命令对应单位ID，不能因为挪位重新排队或发奖。

`SaveRepository.open` 的 loadedRaw 必须仍是原 primary 字符串，即使实际从 backup 解码恢复；primary/backup 的读时原文均不写。第一次正常事务仍 revision+1，备份上一个迁移后内存状态，然后主键作为提交点。坏主档加有效旧备份、两坏档 SAVE_RECOVERY、两写入点失败、主键已写但丢应答、双页面 CAS 的行为全部延续。

正常新版 begin/checkpoint/complete/direct commit 拒绝旧点和非站位点，即使 tick 更大也拒绝。已完成 command ID 的幂等重试仍只读原收据而忽略新参数，不应把它误报为“写入旧坐标成功”。checkpoint/clock 当前不保留永久收据（game.ts:93–94），以原单调状态/CAS 规则处理，不为迁移增设收据。

## 13 项珊瑚回归的复用与必要新增

当前 `coral-layout-compatibility.test.cjs` 13项实际覆盖完整：独立数组、五阶段、丰富战斗、幂等混合/空占用、先验后迁、旧主档、旧备份、失败提交、新回调、中途恢复、未结算终态、双页面、通关后导入。本次只读，没有重跑或修改这些测试。

| 用例 | 第五关必须具体检查 |
|---|---|
| B01 独立数据 | boss 五点字面量、原路线、与0/1/2/3数组及点对象无别名；其他关实际点不变。 |
| B02 五阶段 | prep/between/reveal/result 深相等；combat 只 slot4 x/z 改；揭晓不重抽，结算/翻倍不重奖。 |
| B03 完整战斗 | 活/死第五龟分别覆盖，替补不入 battle；伤害/盾/命令/事件/pendingSeconds/首领召唤状态保留。 |
| B04 幂等与空位 | 第五位占用、未占用、已经新点、反复encode/decode、再次导入原封套；只移一次，不累加偏移。 |
| B05 严格旧点准入 | 坏checksum先拒绝；混搭x/z、任意点、非有限/null、坏route、slot/档案错配、负HP都拒绝；珊瑚/boss不能串用坐标表。 |
| B06 旧主档 | 读时零setItem、两个原字符串和revision不变；首个正常提交无假CAS冲突；backup为上次规范化状态。 |
| B07 备份恢复 | 坏primary+合法旧backup恢复；两坏档保留原文并SAVE_RECOVERY；有效primary优先。 |
| B08 提交失败 | backup写失败、primary写前失败、写后丢应答、重开幂等；不前移内存、不重复奖励。 |
| B09 新回调严格 | begin/checkpoint/complete和repository.commit拒绝旧/任意点；迟到且更大tick仍拒绝；错误slot/turtleId拒绝。 |
| B10 中途恢复 | 与“同一旧状态仅改允许坐标”的参考逐步深相等；checkpoint重开一致；更早tick拒绝。 |
| B11 未结算终态 | 真实模拟得到won/lost，迁移后正常complete/settle；第五关最后波won应result，重复收据不再奖。 |
| B12 并发 | 两页面从同旧原文读入，先提交者正常，后者冲突；重开后可提交。 |
| B13 长期旧档 | 全通关后仍可导入旧boss combat/backup；其他活动关卡和无run档不受影响。 |
| B14 两兼容轴 | 上表四组合全部做只差x/z深相等；主/备至少各一次缺版本；unsupported marker仍拒绝；下一波同时用新布局与v2范围。 |

新建独立 `boss-layout-compatibility.test.cjs` 即可，不必为此大改整个测试工具。历史点必须是冻结字面量，不能把新 createBattle 结果直接命名旧档。range-v1相关用例应使用现有有SHA的 `tests/fixtures/balance-v1` 生成真实缺版本波次；不能删除balanceVersion再称其为完全真实v1来源。布局-only测试可明确采用引擎生成的非坐标状态加冻结旧点，与当前珊瑚用例方法一致。

两处既有测试**预期必须调整**，不要通过放松生产校验修绿：

1. `coral-layout-compatibility.test.cjs:89–99` 仍断言 `[0,1,3,4]` 都用 OLD。保留珊瑚13项意图，将“原共享点仍保留”的关卡集合改为 `[0,1,3]`，另外明确断言 boss 新数组/新点与 coral 无别名；不是删掉 level4 覆盖。
2. `balance-version.test.cjs:54–61` 当前对冻结v1第五关旧点直接调用 `validateBattle`，随后和未迁移旧布局逐tick相等。改点后它按设计应被严格validator拒绝。保留其他关原断言；对第五关，让当前服务从真实旧封套 decode 获得规范化状态，另把同一旧状态的 slot4 仅赋新字面量作为参考，比较冻结v1 `stepBattle` 与当前 `stepBattle` 的续算。深相等保留整个缺版本状态及旧range，不改历史fixture，也不放宽正常validator。这个测试证明“新布局下旧范围仍用旧规则”，不宣称原布局轨迹没变。

`fixed-slot-coverage.test.cjs` 的冻结站位是第四关 levelId3，本轮无需改它。历史报告/历史代码fixture及八种子原结果不得覆盖；如需更新第五关模拟，应写新报告。

## 构建后实际验收

由根代理统一改 production、做回归/TypeScript、构建并晋升场景。本子任务不做这些动作。实际至少验证旧第五关 combat 进入立即暂停时模型在新平台上、脚不悬空、slot5点击投影一致；后台checkpoint/重开/继续以及波间下一波不二次跳位；旧范围波次仍保持旧range，下一波才取v2；准备、揭晓、终局/奖励恢复也无重入。

八种子 slot5 比较总体无重大退化，但泡泡5全零输出和上述旧叶子覆盖变化已记录，不能替代这些实际布阵和旧波次检查。

## 此次只读证据版本

审查时 `data.ts` 的第五关仍为原点；以下 SHA256 固定了建议所对应的版本，后续行号可因根代理实施而变化。

| 文件 | SHA256 |
|---|---|
| core/data.ts | 0fa0d219e0134a2c3ed18cd1878da66d42398141e59c0630faff58cc922dffe3 |
| core/save.ts | da0021c062593d9c4eb812761ae42d41cb1d97b4327de59ddfb932cb0c745078 |
| core/battleValidation.ts | 133b4eff3c8bf2ff74235a0aeead7bccc506d603b3bcc4346935f27a93ae9d2e |
| core/game.ts | 15c88326881467d5b66560303ea5081aedc030e2fb4f871418c3c0a747ba8700 |
| core/battle.ts | a34bbff9a9c8cf707055f07c79c27bc258d130ce2d46e46ac3713ff4865c9d12 |
| tests/coral-layout-compatibility.test.cjs | 8bb9da7a3c589e80ad5e945ec0cf100dad6aff4b602120a10e979e3a9a40596a |
| tests/balance-version.test.cjs | b159a6fb046fe9461fcd79594d35349775687a10e72a66c1fde7439b978935bd |
