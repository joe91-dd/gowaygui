# 七张已确认战斗场景接入 — 2026-09-23

试玩：http://127.0.0.1:7653/?preview=all-maps&all-modes=1&cache=20260923approvedmodes-final2

## 交付范围
- 50 无尽：星夜群岛
- 51 碎礁洞穴
- 52 深潮遗迹
- 53 巨钳王庭
- 54 潮汐竞技场
- 55 双环潮狱
- 56 世界 BOSS 海庭（首领继续按原规则轮换）

确认稿保存在 output/battle-scenes-review-20260923。本次将每张图清理为无 HUD、无角色/敌人的环境底图；运行时沿用原有角色、怪物、技能、飘字及结算。场景像素坐标统一转换为世界坐标，路线、自由站位边界、障碍和珍珠终点共用注册数据。副本组队/准备/轮换、竞技场突破和手动/自动出场、无尽波次、世界 BOSS 90 秒规则保留。1–50 关与主页设计未改。

## 文件与恢复
- 干净场景纹理：game/assets/resources/art-modern/map-mode-scene-50.png 至 56.png
- 几何：game/assets/scripts/core/modeStageGeometry.ts
- Cocos 配置：game/build-config.mode-scenes-20260923.json
- Web 成品：game/build/approved-mode-scenes-20260923
- 服务内核：game/.server-build-mode-scenes/core
- 启动：game/tools/start-mode-scenes-preview.ps1（端口 7653，带房间服务）
- 修改前源码备份：game/temp/approved-mode-scenes-20260923
- 服务数据/验收记录：game/temp/mode-scenes-preview-20260923
- 旧试玩 7640 和确认图画廊 7652 保留。

## 验证
- 源码 TypeScript 检查通过（tsconfig.modecheck.json 仅检查 assets/scripts，排除编辑器模板）。
- 24 项测试通过：七张图站位/道路/水面、四副本出怪、所有首领 90 秒终点、拖动与技能手势等。
- 实际 7653 房间 HTTP：四副本各创建队伍、加入四 AI、准备、开战成功并产生战斗 tick；测试房间均已结束。
- Cocos 正式构建返回 36，20260923-124620 日志无关键错误；打包后的七张地图与源码对象完全一致。
- 浏览器 1280×720 实测：竞技场完成结算；世界 BOSS 进入备战/开战；碎礁洞穴准备/开战；无尽准备/开战。无尽、世界 BOSS、副本技能栏显示在场景内。已恢复浏览器默认视口。
- 最后去掉副本/竞技场头像上方重复小标题：源码与成品 bundle 同步删除同一行，保持行数；无逻辑更动，成品回归重新通过。最终 bundle SHA256 以 final-built-core.json 为准，而非此前构建日志。

## 验收入口
默认新链接返回海岛，全部玩法开放。左上角“全地图验收”可切换；直接参数 map=50/51/52/53/54/55/56 分别进入上述场景。真实副本匹配与备战从主页“副本”进入。
