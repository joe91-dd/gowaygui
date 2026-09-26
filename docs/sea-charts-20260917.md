# 五类海图界面接入

- 关卡：`ChapterMap.ts` 使用批准的第一张海图；50 关、每页 5 岛、锁定状态及继续挑战仍读取真实进度。
- 副本：`RoomMenus.open` 显示四岛选择，选中后进入现有真人组队 / 匹配 / 邀请流程。
- 无尽：显示 5、10、20、30、50、80、100 波主航线。完整奖励预览含 40、60、70、90 波。增加 5 波首航里程箱，保留每 10 波结算箱和 100 波以后的原有奖励，不封顶战斗波数。
- 竞技场：新海图入口保留进攻、防守、匹配、排行、段位与周结算奖励。
- 世界 BOSS：背景不含固定首领；按服务端 `bossIndex` 加载今日高清画像，跨日重新取图、刷新次数与状态。领取仍由服务器校验。

## 动效与资源

`SeaChart.ts` 管理页面所有者、海水局部折射、小船起伏与船帆摆动、宝箱浮动、可领奖励暖光和首领呼吸光效。减少动态设置关闭运动；页面销毁释放材质、图像和异步加载引用，隐藏页面暂停推进。

生产底图位于 `game/assets/resources/art-modern/chart-*.png`；透明宝箱为 `chart-chests.png`，不替换旧奖励页面的贴图。资源全部保存在项目内。

所有底图使用内置 Image Gen 对批准图做局部清理：保留岛屿、海水、纸张与构图，移除可编辑 UI、船和固定 BOSS；无尽末端补一座 100 波小岛；宝箱保留设计并移除奶油色背景为透明 alpha。未使用 API/CLI 生图。

## 验证

- `game/tests/sea-chart.test.cjs`：百波真实结算、领取和重载幂等、超过百波兼容、减少动态及资源销毁。
- `game/tests/chapter-map.test.cjs`：真实关卡、锁定、分页和进入回调。
- `game/tests/world-boss.test.cjs`：北京时间五日轮换、挑战计时、服务器伤害榜及奖励去重。
- 定向测试 17 项通过；完整 Cocos TypeScript 检查通过。
- 全量测试另见 `game/temp/sea-chart-tests.log`：有历史功能/平衡和测试桩失败，不能视为全量绿灯；未扩大本次修改去修复无关行为。

## 构建与试玩

构建：`game/tools/build-web.ps1 -ConfigName build-config.sea-charts.json -UserDataName creator-sea-charts-build`。
输出：`game/build/sea-charts-20260917`，Cocos 3.8.8。
本地服务使用 `game/server/lobby-server.cjs`，环境变量 `GAME_ROOT` 指向该输出，`PORT=7485`，`HOST=127.0.0.1`。维持原 `game/server/data/rooms.json` 数据，不清档。

试玩地址：http://127.0.0.1:7485/ 。浏览器视觉验证记录见项目根目录 `design-qa.md`。
