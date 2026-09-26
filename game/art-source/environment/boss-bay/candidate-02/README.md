# 巨钳来袭 c02：仅修正草地顶面方向

本候选针对根代理在实际 Cocos 中发现的“道路、岸石和植物可见，绿色岛面透出蓝海”问题。未改变关卡布局、场景造型或材质，未晋升运行文件，未启动 Cocos。

## 已确认原因

- c01 实际 FBX 的绿色 atlas tile 1 共 2,304 个多边形全部朝下；存储法线 local Z 为 -1 至 -0.9785884。
- Cocos 当前旧版导入缓存中，同一部分共 4,608 个三角：4,480 个非退化三角全部朝下，128 个为原中心环产生的退化三角。Ground 节点旋转 X=-90°、正缩放100，因此局部 -Z 对应世界向下。
- 对比实际 dusk/coral FBX，各自 2,304 个绿色面均朝上。首页 c01 的 1,344 个草地面同样均朝上，当前不存在这个倒面问题。
- 生成器 `candidate-01/build_boss_bay.py:97` 对每个网格调用通用 `recalc_face_normals`；开放草地曲面没有“上表面必须向上”的后置条件。该操作在首领岛曲面上选中了向下的整体方向。`195–203` 为草地生成位置。
- 运行 `BattleWorld.ts:144` 的 `setEnvironment` 使用共用导入材质，只添加阴影接收与海面，没有改成双面。导入的 Island_atlas technique 0 没有覆盖 rasterizer cullMode，官方本机 Cocos 3.8.8 `cocos/gfx/base/pipeline-sub-state.ts:53` 默认 `CullMode.BACK`。因此世界向下的草地被相机剔除。
- 旧 Cycles 实景能显示背面，旧 BVH 支撑射线只核对命中坐标/高度，未检查命中法线，因此这些旧检查不能证明运行时单面可见。

只读证据和可重放脚本位于 `../normal-review/`。该目录的 `surface-normal-audit.json` 记录 c01 的 FBX 与旧 Cocos 二进制 SHA，不把新结果写成旧结果。

## 本次修复和检查

`fix_upward_surface.py` 直接读取冻结的 c01 可编辑 `.blend` 与已合并预览 `.blend`，仅对草地顶面反转面顺序。每次反转后明确断言全部 2,304 面的 local Z 法线大于 .97，并检查每个顶点坐标、每面顶点与 UV 配对、材质和变换相同。没有重新生成地形、重新采样 RNG、调整通用材质或新增双面开销。

`verify_fbx_semantics.py` 通过普通 Python 读取两个实际 FBX：

- 2,304 个草地多边形恰好反向，对应法线恰好取反。
- 其他 24,016 个面的索引顺序、每个对应法线完全相同（最大法线差 0）。
- 3 个网格的全部顶点坐标及逐顶点 UV 配对相同；模型变换和轴约定相同。
- 55,128 三角、3 mesh / 2 material、所有 route / slots / bounds 保持一致。
- 两张图集完整原字节相同。
- c01 全部 49 文件（包括旧报告、预览与备份）按 `c01-full-freeze.json` 保留原字节。

为控制本次范围，保留原中心环的 128 个退化三角。它们面积为零，不是消失的 4,480 个草地实三角；本轮未做删点、焊接或其他拓扑优化。

## 文件与后续验收

- `boss-bay.blend`：可编辑源，仅草地面方向修正。
- `boss-bay.fbx`：待根代理审查晋升的独立 FBX。
- `island-colour.png` / `island-roughness.png`：原字节图集。
- `boss-bay-review-scene.blend`：独立预览源，海面/相机/灯不进入 FBX。
- `fbx-semantic-check.json`：已通过实际 FBX 比对。
- `render-battle-overview.png` / `render-top-down.png`：相同相机的实际 CPU 2 / 32 samples 检查图。

根代理替换 FBX 并完成 Cocos 导入后，运行：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'game/art-source/environment/boss-bay/candidate-02/verify_fbx_semantics.py' --check-imported
```

此检查先要求运行 FBX SHA 等于本候选，随后读取真实 library Ground 索引、法线和 UV，要求绿色部分 4,480 个实三角全部朝上、全部 4,608 个存储法线朝上、128 个退化三角数保持不变。它只读缓存，不修改 .meta 或 library，不会启动 Cocos。导入检查未完成前，不能宣称运行验收通过。

本次不需要重跑战斗规则测试；实际 Cocos 可见性、原镜头材质/阴影及资源恢复由根代理统一检查。
