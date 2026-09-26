# 怪物行走动作修复 — 2026-09-26

试玩：http://127.0.0.1:7658/?preview=all-maps&all-modes=1&balance=coast&map=0&cache=20260926feet-final

本次修改战斗表现层，沿用既有地图、路径、移速、数值和前五关试验规则。

- 从现有怪物模型的 walk 骨骼曲线生成更清晰的迈腿、触足爬行、腹足蠕动与鳍尾游动。保留原有左右相位、身体与攻击动作；限制关节摆幅，避免过度拉伸。
- 连续受击不再反复切断移动中的 walk；停下攻击、技能和死亡仍保留各自动作。
- 步频按模拟 tick 之间的真实位移计算，适配减速、暂停和倍速。对象池复用时清空旧移动记录。
- 保留 GPU 烘焙蒙皮。新行走片段按源资源共享，每个物种使用独立烘焙缓存键；不修改原始 FBX/GLB。

验证：TypeScript 全量检查通过；`tools/test-enemy-locomotion.cjs` 验证左右交替、循环、四元数规范化、原资源不变、躯干保持原曲线、物种缓存隔离、步频与体型/速度关系；最终构建的核心战斗回归通过。

浏览器实战抽查了前两波、Boss 行走姿态、暂停/恢复和 2X 切换；未见运行错误。共享渲染路径用于所有模式，未逐个重打所有关卡。

构建：`game/build/enemy-gait-20260926`（136 个脚本模块；沿用已导出的 Cocos 3.8.8 引擎和资源）。

服务器：7658，房间服务使用 `.server-build-coast`。旧 7657 试玩保留。

恢复点与报告：`game/temp/enemy-gait-20260926/source-before.tar`、`source-after.tar`、`source-rig-audit.json`、`built-core-regression.json`。
