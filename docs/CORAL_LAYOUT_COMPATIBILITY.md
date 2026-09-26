# 珊瑚转角站位调整：本地存档兼容

更新日期：2026-09-08。**两处站位与受控旧档迁移已实现，相关核心回归 86/86 通过，项目 TypeScript 检查通过，代码已冻结。** 本子任务未启动 Cocos、未修改视图或运行场景，也未读写浏览器用户存档。脚底、平台、点击及暂停恢复效果仍待主代理统一构建的实际运行检查。

## 已实施范围

| 文件 | 最终修改 |
| --- | --- |
| `game/assets/scripts/core/data.ts` | 第三关使用独立五点 coralSlots，只有第三、第五站位移动；数组和点对象均不与其他关共享。 |
| `game/assets/scripts/core/battleValidation.ts` | 默认验证所有关卡单位的 slot 与 x/z；新增仅供 decoder 使用的历史珊瑚坐标验证入口及幂等迁移函数。第三关路线须匹配已知路线。 |
| `game/assets/scripts/core/save.ts` | 解码原封套并完整验证后，只规范化活动 combat 的已知旧坐标，再严格验证。正常保存还绑定单位 ID、slot、龟档案 ID。 |
| `game/assets/scripts/core/game.ts` | checkBattle 增加 4 行单位 ID ↔ slot ↔ turtleId 绑定检查，用于 begin/checkpoint/complete 共用入口。 |
| `game/tests/coral-layout-compatibility.test.cjs` | 新增 13 项历史布局、恢复与事务边界回归。 |

SaveRepository.open/commit 原实现未修改。主键、备份键、schema:1、BattleState.version:1 保持原值，没有增加全局或快照布局标记。

坐标取自 `game/art-source/environment/coral-bend/candidate-01/proposal.json`。源文件保留了提出方案时的候选状态；主代理随后批准本表两处移动，本文记录 core 实施结果，不把离线 FBX 视作运行验收证明。

| 站位索引 | 玩家站位 | 旧 X/Z | 当前 X/Z |
| --- | --- | --- | --- |
| 2 | 第三站位 | (3, 1) | (3.395, 1.099) |
| 4 | 第五站位 | (6, -1) | (5.832, -0.748) |

其他三点仍为 (-5,1)、(-1,1)、(1,-3)。第三关路线不变：(-9,0) → (-4,0) → (-2,2) → (2,2) → (3,-2) → (6,-2) → (9,0)。关卡 0、1、3、4 的站位和路线没有改动。

## 解码与正常提交契约

```text
验证原始封套 format / payload / checksum
→ JSON.parse(payload)，得到独立内存对象
→ validateSaveState(save, true)
  完整存档与模拟不变量检查
  + 当前坐标或本次已知旧坐标对
  + battle 与 run 关卡/波次/单位/档案绑定
→ 仅活动 combat 调用 migrateLegacyCoralCoordinates
→ validateSave(save)，重新严格验证当前坐标
→ 返回内存 GameSave
```

validateBattleForSaveDecode 复用默认全套结构、生命、时间、状态、技能、引用检查，只对 levelId=2 的 slot 2/4 开放上述旧坐标。x/z 成对匹配，使用既有 1e-8 × max(1,绝对值) 容差；不凭 slot 覆盖任意位置。其余站位严格匹配当前点。第三关路线必须等于当前 LEVELS 路线，兼容入口额外检查冻结的历史路线；本次没有扩展其他关卡的路线规则。

迁移只把匹配旧坐标的单位 x/z 赋为当前常量，包含阵亡单位。允许部分占用、新旧已知点混合、没有受影响站位；反复 decode/encode/decode 或以后再次导入旧封套均幂等，不累加偏移，不依赖设备或通关状态。

正常 validateBattle、validateSave、beginWave、checkpointBattle、completeWave、repository.commit 使用严格当前坐标。service 与 save 验证要求每个战斗单位对应同一个未被消耗的 run.units[id]，且 slot、turtleId 一致。即使同 run/wave 且 tick 更大，旧坐标回调也不能写回；离站坐标、错配 slot/档案同样拒绝。

已经成功的同 command ID 重试仍通过原有幂等收据直接返回旧结果，不再执行其参数，也不会写旧状态。新 command ID 的旧坐标提交被测试拒绝，原完成重试仍保持无副作用。

## 各阶段与状态保留

| 原 phase / status | 已实现行为 |
| --- | --- |
| prep | 保留状态，不重复 beginRun/扣体力；下一次 createBattle 使用当前独立站位。 |
| between | 保留伙伴、替补、候选、来源、金币、波次与 RNG；下一波自然使用当前布局。 |
| combat / fighting | 完整验证后仅规范化已知旧 x/z，保留模拟状态，继续同一波。 |
| combat / won 或 lost | 允许已结束、尚未 service 结算的真实快照；保留胜负，随后正常 completeWave/settle，重试不重复奖励。 |
| reveal | 固定输出、父系来源、pendingMergeId、RNG 与收藏不变，不重新合成或提前揭晓。 |
| result | 金币、材料、首通、翻倍、收藏/历史与结算收据不变。 |

正常非 combat 阶段没有活动 battle，completeWave/settle 会删除它。既有 validateSave 未禁止非 combat 中未使用的 battle 扩展值，本次不触碰它，不顺带清理数据；只有真实活动 combat 迁移。

迁移不重建 createBattle、不增加 revision、不读时钟/RNG、不发 command、不写盘。深相等回归覆盖 tick、elapsed、pendingSeconds、RNG、双方 HP/存活、敌人/出怪、盾/状态、技能冷却及命令、事件/编号、进度、合成、来源、收藏、奖励及幂等记录。历史 events 的位置保持原文，不批量平移；已有 blockedBy/encouragedBy/auraTargetId 引用保留，由下一个正常 tick 按当前规则更新，读取不偷跑模拟。

新站位可能改变剩余战斗轨迹。此方案保留历史进度，**不保证继续得到旧布局逐 tick 相同轨迹**。续算测试基准为“同一历史状态仅改允许 x/z 后继续”，不是未迁移旧布局。

## 原子提交、备份与失败

1. 有效旧主档打开后仅内存改变坐标；两份原字符串和 revision 不变，无 storage.setItem，recoveredFromBackup=false。
2. loadedRaw 保持原主档字符串，不替换成迁移对象编码；首个正常 commit 不误报冲突。其他页面先写入会触发既有 SAVE_CONFLICT。
3. 下个正常事务 revision +1；backup 写迁移后的上一次完整内存状态，primary 写新状态，primary 仍是提交点。
4. 坏主档 + 有效旧 combat 备份经同一 decoder 恢复，recoveredFromBackup=true；open 保留两份原文，后续正常提交可更新主档。
5. 两份都不通过 checksum/结构/坐标验证时，保持 SAVE_RECOVERY 与原始键值，不吸附未知坐标，不清空、新建、退款或发奖。
6. backup 写失败或 primary 写前失败不前移内存事务，重开可重复迁移；primary 已写但收到异常时重开读取已提交状态，由 command 收据避免重复执行。

.backup 是上次完整提交，不是永久取证档。open 不改原文；恢复后的正常 commit 会更新原文，不能承诺坏主档永久保留。

## 测试与待验收项

新增 fixture 明确冻结 OLD/CURRENT/ROUTE 字面量，非布局模拟状态由引擎生成后赋为历史点，没有把新 createBattle 直接称为旧档；won/lost 由真实模拟产生。

| 新用例 | 对应原清单 | 已验证内容 |
| --- | --- | --- |
| 1 独立数组 | C13 | 仅第三关独立，其他四关点不变；各关离站点被拒绝。 |
| 2 五阶段 | C01 | 五阶段深相等边界，真实合成揭晓和结算/翻倍重试。 |
| 3 丰富 combat | C02 | 死/活龟、替补、护盾、命令/事件、pendingSeconds，仅 x/z 改变。 |
| 4 幂等变体 | C03 | 部分占用、新旧混合、重复解码、再次导入旧封套。 |
| 5 先验后迁 | C07 | checksum、未知坐标、错配坐标对、null、HP/状态、坏路线、slot/档案错配拒绝。 |
| 6 旧主档 | C05 | 读取无写、revision 不变、主档优先、首提交与 backup 正常。 |
| 7 旧备份 | C06/C07 | 坏主档下旧备份恢复；两坏档原文保留并 SAVE_RECOVERY。 |
| 8 提交失败 | C10 | 两写入点失败、已写丢应答、重开和收据幂等。 |
| 9 新回调 | C09 | begin/checkpoint/complete/direct commit 严格点位，更大 tick 不绕过。 |
| 10 中途恢复 | C08 | 逐步续算与仅改合法坐标的基准一致，checkpoint 重开与倒退 tick 拒绝。 |
| 11 未结算终态 | C04 | 真实 won/lost 正常完成，重开后同收据不重复结算。 |
| 12 双页面 | C11 | 惰性迁移保留原文并发检查，旧页不能覆盖，重开可提交。 |
| 13 通关后导入 | C12 | 已全通关仍接受历史 combat，旧 backup 同样处理。 |

相关 domain、battle、battle-validation、integration、boss-balance、material-receipts 回归一并运行，共 **86 项，86 通过，0 失败**，约 30.5 秒。既有用例补充无 run 初始档、重复站位/非有限数据、完整五关流程、30 个技能、原子失败和材料收据；不以它们代替冻结历史布局用例。

在 game 目录实际执行，均退出码 0：

```text
NODE TSC --target ES2020 --module commonjs --strict --skipLibCheck
  --rootDir assets/scripts --outDir .test-build
  assets/scripts/core/game.ts assets/scripts/core/battle.ts

NODE --test tests/domain.test.cjs tests/battle.test.cjs
  tests/battle-validation.test.cjs tests/integration.test.cjs
  tests/boss-balance.test.cjs tests/material-receipts.test.cjs
  tests/coral-layout-compatibility.test.cjs

NODE TSC --noEmit -p tsconfig.json
```

NODE = C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe

TSC = C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js

**C14 待主代理统一构建核验**：旧 combat 读入立即暂停、龟脚/平台、slotWorld 点击投影、hide/checkpoint、继续、波间与下一波一致且无二次跳位。主代理负责场景晋升及 GameEntry/BattleWorld 接线。核心通过不等于 Cocos 或发布验收通过。

## 修改前证据（历史记录）

实施前只读实验在进程内仅换第三关 slots，旧 (3,1)/(6,-1) 封套仍可 decode，tick7→tick10 旧坐标检查点仍获接受，甚至有限离站坐标 (999,-777) 也不会因站位不一致拒绝。当时仅检查有限 x/z，没有 slot 绑定，因此单改 data 会造成旧战斗与新平台错位。实验也确认坏主档可用旧备份恢复、两坏原文保留。**这些是修改前行为，已被本实现修正，不描述当前代码。**

本轮没有以清空存档、重开波次或当前测试局即将通关来绕开未来历史快照兼容。
