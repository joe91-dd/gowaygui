# 特效大师方案运行时接入清单（2026-09-20）

状态：已接入当前 Cocos 战斗运行链，并以 `BattleWorld` 的事件驱动为唯一表现入口。

## 龟龟双套外观

| 套件 | 判定 | 运行资源 | 进阶武器 |
|---|---|---|---|
| 基础龟龟 | 技能数 `< 10` | `models-g1/{stone,spike,crystal,leaf,bubble}` | 无 |
| 10 技能进阶龟龟 | 技能数 `>= 10` | `models-g1/advanced/{role}` | `models-g1/advanced-weapons/{role}` |

战斗中按 `skills.length` 自动切换；异步资源晚到时会在当前 actor 上热替换，不会短暂消失，也不会丢失站位、生命和动作状态。进阶武器挂在骨骼手部 socket，随转向、攻击和施法动作跟随。

## 怪物资产统计

目录 `enemyG1Catalog.ts` 当前共有 72 个身份，全部通过 `loadLevelFauna()` 按关卡/波次预热，并由 `faunaVisual()` 选择模型与骨骼家族：

- 普通怪 19：M01–M19
- 精英 9：E01–E09
- 关卡首领 36：B01–B36
- 副本首领 4：H01–H04
- 世界首领 4：W01–W04

所有身份都有 `models-enemy-g1/{id}` 源文件（FBX/GLB），没有只登记不加载的条目。普通怪、精英和首领按 `blob / crab / snail / floating / biped / quadruped / serpent / octopus / ray / spider / hermit / scorpion / centipede` 家族复用骨骼动作与材质适配；首领额外保留核心脉冲、预警与专属技能事件。

## 已接入的表现事件

- 主动技能：岩石风暴、穿甲弹、海霜风暴、大治疗、潮灵召唤，以及五个专精的分裂、箭雨、碎冰、复活、石人落地。
- 敌方技能：火雨、蛛网、迫击、冻结、吸取、集结、信标、防波堤、世界首领四种大范围主题效果。
- 状态反馈：护盾、减速/冻结、定身/锚链、破甲/虚弱、沉默、眩晕、净化、复起、召唤。
- 生命周期：入场、攻击拖尾、命中/暴击、死亡碎裂、波间退场与召唤落地。
- 动作合同：保留 idle/walk/attack/attack2/skill/hit/rest/exit/greeting；运行时已增加 `death`、`castStart`、`castLoop`、`castRelease`、`turnL`、`turnR` 状态别名，在旧资源缺少专用 clip 时按 `death→exit/rest`、施法阶段→`skill`、转身→`walk` 安全回退。

特效池仍以 48 个共享节点为上限；高优先级预警、死亡和复起效果会淘汰低优先级小命中，避免同屏遮挡危险提示。
