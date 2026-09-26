# 第五关布局迁移与场景晋升：实施记录

2026-09-08。已按根代理授权实现，代码和三份资源冻结；未跑全 suite、未启动 Cocos、未提交 Git。之前的 `BOSS_LAYOUT_COMPATIBILITY_REVIEW.md`、离线比较、source/provenance 和历史 fixture/report 保留原字节，本文件记录后续实施结果。

生产变更仅三个文件：

- `game/assets/scripts/core/data.ts`：新增独立 bossSlots；只有 levelId4 的第五点从 `(6,-1)` 改为 `(6.62,-1.31)`。第四关坐标、各关路线、职业范围、强度和技能规则不变。
- `game/assets/scripts/core/battleValidation.ts`：局部冻结表只列珊瑚/首领两关的已知旧点和不变路线。常规验证严格检查当前点，旧点只允许 decoder；迁移仅修改匹配历史点的单位 x/z，包含倒地龟。表不负责通用 schema/路线升级。
- `game/assets/scripts/core/save.ts`：只替换迁移入口名称与布尔参数名称，维持原始 checksum → 完整状态验证 → 活动 combat 合法坐标规范化 → 严格当前验证的调用顺序。

`battle.ts`、`game.ts`、SaveRepository.open/commit 实现未修改；schema、版本、revision、读时原文 loadedRaw、CAS 和 primary 提交点均保持。读取不写盘，不改 RNG/生命/技能/命令/奖励，不重建战斗。非 combat 五阶段边界保持原语义。

旧范围/新布局相互独立：balanceVersion 缺失或 2 均可配旧/新点；缺失不补 2，各 unit.range 不重算；旧鼓劲/分担继续由既有规则用 3。下一波正常 createBattle 才使用当前范围与新布局。布局移动可能改变剩余轨迹，续算基准是同一旧状态仅修改批准坐标后继续原范围规则。

## 实际验证

新增 `game/tests/boss-layout-compatibility.test.cjs` 15项，覆盖审查清单 B01–B14（完整首领召唤状态另独立一项）：独立坐标、五阶段、死/活第五龟、完整状态和事件、幂等/未占用、坏checksum/未知坐标对/串关坐标、主备份读取不写、提交失败和丢应答、严格新回调、中途检查点、真实最终波 won/lost 结算、双页面CAS、全通关后旧档、四种范围/布局组合的主/备份、旧规则续算与下一波升级。

两处既有测试只改必要预期：珊瑚独立数组测试改为检查 boss 的独立新点，其余三关仍原共享点；balance-version 的第五关先经 decode 规范化，再用冻结v1引擎在同一规范化状态续算对照。没有放宽 validator、删旧测试或改历史 fixture。

实际命令结果：

1. 核心 TypeScript 编译至获准使用的 `.test-build`，退出0。
2. `node --test game/tests/boss-layout-compatibility.test.cjs game/tests/coral-layout-compatibility.test.cjs game/tests/balance-version.test.cjs`：**32 tests，32 pass，0 fail，0 skipped，4.9562687秒**。分项为 boss15 / coral13 / balance4。
3. game目录 `tsc --noEmit -p tsconfig.json`：退出0。
4. `git status --short -- game/tests/fixtures docs/reports` 无输出；历史文件未改。

使用 bundled Node 和 Cocos 3.8.8 现有 TypeScript。未再运行无关全套，也未启动额外 Blender。主线程可开始统一构建验收。

## 三份运行资源

已由 `promote_candidate.py` 核对 source-freeze/provenance 全部SHA、当前第五关 route/slots 与场景manifest一致，再复制。`promotion-manifest.json` 记录实际路径、大小、SHA、授权和待验收项。

| 实际目标文件 | SHA256 |
|---|---|
| game/assets/resources/environment/boss-bay/boss-bay.fbx | 011b94a72decfa697f8b6df16a0970e8ebd8df802240ee59b6e8248f53394397 |
| game/assets/resources/environment/boss-bay/island-colour.png | 47b2d8799e18e6fcb5af58ddd079dbe7bf934c175922a1f93d3a3b07066d700f |
| game/assets/resources/environment/boss-bay/island-roughness.png | bd4f1cecf97a4da3f7199ee2117a2fc9242edcf7ebe24edbe248917846762e16 |

沿现有 Cocos FBX 导入约定，预期加载 prefab `environment/boss-bay/boss-bay/boss-bay`；图集 `environment/boss-bay/island-colour/texture`、`environment/boss-bay/island-roughness/texture`。材质名复用 `Island_atlas` / `Warm_pearl_and_lamps`。实际子资产路径仍须主线程导入后确认。

没有手写 `.meta`/UUID，没有修改 views。需主线程核验旧 combat 读入后立即暂停、第五台脚底/点击投影、后台保存恢复、继续/下一波、旧范围保留以及终局奖励幂等。离线脚底/图审通过与这些核心测试不等于 Cocos 或发布验收通过。
