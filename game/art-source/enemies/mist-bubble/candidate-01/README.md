# 雾泡怪 candidate-01

原创软质玩具敌人候选。2026-09-08 根代理实看正面、三分之四和战斗角度图后批准 c01 晋升；三份冻结导出原字节复制到 `game/assets/resources/models/enemies/mist-bubble`。没有启动 Cocos，实际运行验收仍待完成。图集入口 `review.html`；晋升记录与精确 SHA-256 见 `promotion-manifest.json`。原 `asset-manifest.json` / `REVIEW.md` 保留为晋升前的历史记录。

预期加载路径 `models/enemies/mist-bubble/mist-bubble/mist-bubble`，待首次 Cocos 导入确认。`promote_runtime.py` 可幂等复核，不覆盖不同版本、不生成 meta 或 UUID；源文件保持不变。

对应 `core/data.ts` 的 mist：血量 180、护甲 0、抗性 60、移速 .9、攻击 20、攻击间隔 1.4 秒、近战范围 .8、漏怪伤害 1。它是抗魔法伤害的近战敌人；造型没有擅自增加隐身、穿透、飞行等机制。

## 造型与原创来源

浅紫灰的大泡团组成不对称云朵轮廓，四只短软足、葡萄紫眼睛和小圆口。六个大体积通过体素融合、平滑和受控减面，成为一个连通、闭合的实体外壳；没有使用大量透明球、透明粒子或贴片代替角色。与小墨团的深灰泪滴身形和外展短肢作出明确区别。

全部网格、UV 调色和眼睛图案、骨骼与动作由项目脚本原创。只读取本项目 A4 角色图、海岛场景、已审小墨团作风格参考。基础闭合几何/UV/导出思路沿用内部脚本，雾泡怪主体和动作新写，无外部模型、纹理、音画片段或动作包。源图集为 512×512 RGBA、Alpha 全 1。

## 源文件

- `../../build_mist_bubble.py`：独立生成脚本；写入仅限本候选目录。
- `mist-bubble.blend`：13 个可编辑部件、10 骨、五动作、两张内嵌图。外壳单独保留，可继续雕改。
- `mist-bubble-review-scene.blend`：单网格导出版本与工作室灯光。
- `mist-bubble-poses.blend`、`mist-bubble-island-context.blend`：真实变形定格和海岛上下文；不用于运行导出。
- `export/mist-bubble.fbx`、`export/mist-colour.png`、`export/mist-roughness.png`：已冻结晋升的运行导出候选，源文件保留不变。
- `mist-bubble.glb`：辅助交换格式。
- `verify_and_review.py`：FBX 回导、每半帧验证、源检查和五张审查图。
- `package_candidate.py`：不启动 Blender 的最终文件/嵌入图/引用源检查，生成资产清单。

## 参数与导入交接

10,748 三角、5,400 顶点、1 运行网格、1 UV、1 材质、10 骨。材质 `MistBubble_Toy_Atlas`，图像前缀 `MistBubble_Colour_` / `MistBubble_Roughness_`。原色图按 sRGB 使用，粗糙图按 Non-Color 灰度使用（.34 / .44，Alpha=1）。非金属 F0=.04；没有透射或透明度叠层。与既有模型一样，运行时若使用 native Standard，须核对导入材质粗糙图到 pbrMap G 的适配；本候选没有修改适配器。

Blender Z-up、前方 -Y；FBX axis_forward=-Z、axis_up=Y，沿用已审敌人约定。预期 Cocos 正面 +Z、脚底 Y=0，实际 importer 路径、材质与动画尚未验收，不手写 UUID。

源宽 / 深 / 高约 `[1.040335, .673918, 1.061897]`；建议等比 `.83`，对应 `[.863478, .559352, .881374]`。所有动作原地，路径移动由已有战斗逻辑与视图承担。路面根节点沿用 Y=.064；建议血条挂在未缩放 actor 的 Y≈1.10，最终以实际角度和 UI 遮挡为准。

| 动作 | 预期 clip | 帧 / 30 fps | 秒 | 播放 |
| --- | --- | --- | --- | --- |
| idle | MistBubble_Rig\|idle | 1–73 | 2.4 | 循环 |
| walk | MistBubble_Rig\|walk | 1–25 | .8 | 循环 |
| attack | MistBubble_Rig\|attack | 1–37 | 1.2 | 单次 |
| hit | MistBubble_Rig\|hit | 1–19 | .6 | 单次 |
| exit | MistBubble_Rig\|exit | 1–31 | 1.0 | 播完移除 |

idle 为缓慢鼓气，walk 为交替抬软足和轻晃，attack 为鼓气蓄势后前冲，hit 为软体压扁回弹，exit 为收缩退场。没有把数值伤害或额外粒子逻辑写入动画。

## 技术检查与重建

`round-trip-check.json` 对真实回导 FBX 的五动作逐半帧求变形顶点，共 365 个样本，检查非有限值、地面、运动幅度、循环与归位。`source-check.json` 检查闭合向外表面、云壳单连通、曲面眼睛、打包图、源哈希不变。必须明确设置 Blender 4.5 action slot；仅修改动作名不算播放验证。技术通过不代表 Cocos、性能或最终美术通过。

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_mist_bubble.py -- --no-render
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/mist-bubble/candidate-01/verify_and_review.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' game/art-source/enemies/mist-bubble/candidate-01/package_candidate.py
```

渲染固定 2 CPU 线程，工作室 24 samples、联系图与海岛 20，均低于 32。所有内容均可本地重建，无额外 API 或下载依赖。重建后 FBX 二进制时间戳可能改变，必须重新回导、实看和生成哈希清单，不能保留旧验收记录冒充新文件证据。
