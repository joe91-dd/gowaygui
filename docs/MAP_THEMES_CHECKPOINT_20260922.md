# 战斗地图主题进度检查点（2026-09-22）

当前状态已保存于工作区与 F:/Codex/Projects/gowaygui。

## 已完成

- 1–50 关地图使用独立主题美术，16–50 主题分组：
  - 16–20 日光遗迹
  - 21–25 远洋回声
  - 26–30 翡翠林岸
  - 31–35 双庭圣殿
  - 36–40 白沙环礁
  - 41–45 深海回廊
  - 46–50 终焉海庭
- 50 张战斗图资源位于 game/assets/resources/art-modern/map-coast-stage-1.png 至 map-coast-stage-50.png，另有 map-guardian-pearl.png。
- 路线规则：各路线从起点连通至同一珍珠终点；多起点按关卡配置生成；龟龟初始站位避开道路与红区；可站位区域连续且扩大。
- HUD 与战斗画布保持手机横屏的包含比例。

## 验证

- game/tools/test-coast-registration.cjs：1–50 关全部通过，包含路线连通、敌人沿路、站位安全、珍珠终点和 HUD 投影检查。
- Cocos Web 构建：game/build/map-themes-20260920，2026-09-21 23:15 生成。
- 试玩服务副本：game/build/vfx-integrated-20260920。
- 已抽查16、25、35、45、50关主题画面并加载成功。

## 试玩

http://127.0.0.1:7640/?preview=all-maps&appearance=advanced&all-modes=1&map=15&cache=20260921finalthemes

map=0 对应第1关，map=49 对应第50关。

