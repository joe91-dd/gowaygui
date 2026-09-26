# 龟龟拖动互换 · 2026-09-24

已接入关卡、无尽、本地及联机副本的占位落点判断，并统一世界 BOSS 的互换落点合法性检查。原有核心交换逻辑保留；双方实际自定义落点交换，角色身份和战斗资源不交换。关卡/无尽拖动提示“松手互换位置”。备战替补拖入保留替换出战机制。

验证：源码与实际 Cocos 构建产物均运行 tools/test-position-swap.cjs；覆盖 57 张地图、4 个副本备战与战中、世界 BOSS、真实 BattleScreen 拖动处理器、取消拖动和冷却。Cocos 构建自带回归通过，HUD 与副本拖动释放测试通过。浏览器实际拖动岩盾至叶灵落点，确认二者交换。

构建：game/build/turtle-swap-20260923
构建日志：game/temp/build-logs/20260923-235646.creator.log
主脚本 SHA256：6eab7278eb9d344ad72f6a19283ea9c5744b03ce8c28bb2ee783569179324a33
启动：game/tools/start-turtle-swap-preview.ps1
试玩：http://127.0.0.1:7654/?preview=all-maps&all-modes=1&cache=20260924turtle-swap
此试玩使用独立房间数据；7653 原试玩和进度保留。
