# 范围诊断的历史重放绑定

2026-09-08。当前生产范围已由主线程采用新值；这里两个脚本的职责改为**重放此前已归档的旧范围实验**，不再随工作区数值变化而改变“baseline”。当前生产范围与运行验证见 [BATTLE_RANGE_V2.md](../BATTLE_RANGE_V2.md)。

## 原报告保持不变

以下归档不会被脚本覆盖：

- `fourth-level-coverage.json`、`fourth-level-coverage.svg`、`fourth-level-coverage.png` 与 `../FOURTH_LEVEL_COVERAGE.md`。
- `coverage-range-comparison.json` 与 `COVERAGE_RANGE_COMPARISON.md`。

每次运行只在 `docs/reports/history-replays` 下新建一个随机后缀目录。新输出包含本次实际使用的历史来源、校验结果及重放身份，不能被误认为原日期新生成的旧报告。

## 第四关几何与实际 core 诊断

运行：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/reports/fourth-level-coverage.cjs
```

脚本通过 `historical-coverage-runtime.cjs` 读取既有 `game/tests/fixtures/balance-v1` 的 `data.ts.txt`、`battle.ts.txt`、`random.ts.txt`，按其 `provenance.json` 校验 LF 文本 SHA，再使用已安装 TypeScript 在内存转译。冻结源来自提交 `cf544b813771c7a9334f885c52703c43acb949db`。

原第四关报告执行时，根代理已经加入 `balanceVersion=2` 标记，但当时范围尚未改变。此次重放明确使用 v1 旧规则，不谎称其运行时字节与原报告完全相同；而是对路线、站位、所有解析区间、治疗图、脚底包络、候选坐标、真实首拦截/直攻/溅射输出以及五个治疗诊断进行 **17 个字段的完整深比较**。脚底提案也必须符合原记录 SHA。任一项不符即失败。

这能在生产采用新范围后继续复现：旧法师位置 2 到首个被挡敌人 4.566211、当时普攻 0 次；后续 tick 447 发生首攻及间接伤害。它不意味着当前新范围也有这个问题。

## 五关 8 种子的完整服务比较

运行：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/reports/compare-coverage-ranges.cjs
```

此脚本不能直接换用 v1 fixture：原比较依赖已加入的 `balanceVersion=2` 与可配置鼓劲半径，候选组还要在内存改变这两个友军半径。使用没有配置分支的旧 v1 会改变实验含义。

采用的来源为：

1. 从上述固定 Git commit 读取八个指定源码/脚本 blob：`data.ts`、`game.ts`、`save.ts`、`random.ts`、`fusion.ts`、`platform/storage.ts`、`simulate-chapter.cjs`、`simulate-boss-balance.cjs`。加载前校验源码 SHA，TypeScript 在内存转译后再次校验编译结果 SHA。
2. 在 `fixtures/coverage-baseline-v2` 保留当时尚未提交的两个编译模块：`battle.js.txt` 与 `battleValidation.js.txt`。前者从新编译输出中仅反转 `shareRange:4.5, encourageRange:4.5` 为原 `3,3` 后，得到与**已经存在的历史 JSON 所记录 SHA 完全一致**的旧字节；后者是未变化的编译字节，也符合原记录 SHA。这里明确记录恢复方式，没有把重建字节冒称来自那个 Git commit。
3. 原历史 JSON 的 LF SHA 也被固定。七个原报告记录的模块 SHA 必须全部一致。缺少 Git commit、旧片段、指定编译器版本或任何哈希不符时直接失败，不能退回当前 `.test-build` 或任意修改的生产代码。

随后仍运行原 `simulateChapter` 的真实服务流程，逐波检查点重启、重复结算都保持原逻辑。两组 8 种子共 80 个关卡、752 波的全部结果，包括生命、普攻、技能次数、时长、资源及服务 revision，与原历史 JSON 的 `results` 完整深比较；不是只比较最终胜负。

## 隔离范围

- 不编译、不写入、不导入共享 `game/.test-build`；加载器里的同名路径只是历史模块的逻辑键。
- 不修改生产脚本、路线、站位、场景、Cocos 资源或浏览器存档。
- 范围变化仅作用于历史运行时对象，`finally` 恢复进程内原值。
- 不启动 Cocos，不安装任何依赖，不生成玩家存档文件。
- `TYPESCRIPT_JS` / `GOWAYGUI_TYPESCRIPT` 可指定现有编译器；完整全章重放要求与来源清单一致的版本。`SHARP_ROOT` 可指定现有图像渲染依赖。

生产固定站位回归位于 [fixed-slot-coverage.test.cjs](../../game/tests/fixed-slot-coverage.test.cjs)：那份测试加载主线程统一编译的新 core，职责与本历史重放分开。

## 本次实际验证

- 新生产范围的固定站位回归 **10/10 通过**，所有龟的位置和射程均来自真实关卡及职业配置；没有为测试改坐标或改半径。
- [第四关重放](history-replays/fourth-baseline-v1-BlbEvY/fourth-level-coverage.json)：17 个字段全部匹配，原首拦截 tick 47、首法师普攻 tick 447 等历史观测保留。
- [全章重放](history-replays/ranges-baseline-v2-54tnBA/coverage-range-comparison.json)：原七个模块 SHA 全部匹配，80 个关卡 / 752 波完整结果与原 JSON 全部匹配。
- 历史重放过程中没有调用共享编译或 Cocos；验证在主线程构建期间独立完成。
