# 结算材料收据

`RunResult` 增加可选字段 `materials?: Partial<Record<Material, number>>`，记录本次结算实际发放的材料。现有 `GameService` 方法签名不变，通过 `service.snapshot.results[runId].materials` 读取；`abandonRun` 返回的结算记录也包含相同字段。

新生成的结算总会写此字段：例如首次通关巨钳来袭为 `{growth: 1}`；重复通关、失败或主动结束而没有材料奖励时为 `{}`。五关首通映射保持原值，依次为生命、攻击、攻击、攻击、成长材料各一枚。没有改变奖励数值。

旧存档缺少字段时继续保留 `undefined`，含义是“旧版未记录这项奖励”，不能根据当前关卡配置或首通金币反推历史发放量。界面可以不显示这一栏，或提示旧记录未保存材料明细；不能把缺字段明确描述成“当时未获得材料”。旧报告和存档封套无需改写，存档 schema 仍为 1。

材料增加、材料收据、金币、关卡进度和结算命令在同一事务内提交。主存档写入失败不会只增加库存而缺少收据；提交成功后的相同命令重放、重新打开结算或广告金币翻倍均不会再次发放材料。翻倍只改变金币字段，不改变材料收据。

校验允许缺字段或空对象；有条目时只接受 `attack`、`health`、`defense`、`growth` 四个键，数量必须为大于零的安全整数。数组、`null`、未知键、零、负数、小数及字符串数量均拒绝。`results` 内的材料收据和 `commands` 内 `abandon` 返回值的副本都校验；校验不拿当前奖励配置重算历史记录。

2026-09-08 验证：Cocos 自带 TypeScript strict 编译通过；领域测试 24 项、整章服务联调 2 项、新材料收据测试 6 项，总计 32/32 通过，无跳过。新增测试覆盖真实五关首通库存差额、重复回调、存档重启、再次通关、金币翻倍、提交失败后重试、旧版字段缺失及损坏材料收据。

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine/node_modules/typescript/bin/tsc' --module commonjs --target es2020 --rootDir game/assets/scripts --outDir game/.test-build --strict --skipLibCheck game/assets/scripts/core/game.ts
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test game/tests/domain.test.cjs game/tests/material-receipts.test.cjs game/tests/integration.test.cjs
```
