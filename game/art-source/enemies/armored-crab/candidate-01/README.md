# 铁壳蟹 candidate-01

原创矮壮重甲敌人候选。2026-09-08 根代理实看正面、三分之四、战斗全景与快跑蟹尺度对照后，批准 c01 晋升为运行候选；三份导出资源原字节冻结复制到 `game/assets/resources/models/enemies/armored-crab`。没有启动 Cocos，实际运行验收仍待完成。完整参数见 `model-stats.json`，真实五动作检查见 `round-trip-check.json`，图集入口为 `review.html`。

晋升记录与精确 SHA-256 见 `promotion-manifest.json`；`promote_runtime.py` 可幂等复核，不覆盖不同版本、不生成 meta/UUID。预期资源路径 `models/enemies/armored-crab/armored-crab/armored-crab`，待首次 Cocos 导入确认。原 `asset-manifest.json` / `REVIEW.md` 保留为晋升前的历史记录。

## 规则与造型

对应 `core/data.ts` 的 armored / 铁壳蟹：血量 240、护甲 60、移速 .7、攻击 24、攻击间隔 1.5 秒、近战范围 .8、漏怪伤害 1。快跑蟹对应血量 80、护甲 0、移速 1.6。

本版重做宽而低的身体、六块厚圆甲片和中央圆甲、短粗八腿、厚圆钳与低眼位。奶油色仅用于接缝、眉、钳指和关节等细节。两只蟹共享项目自有的网格/图集制作方法，铁壳蟹没有直接换色复用快跑蟹网格。

所有网格、UV 图案、骨骼和关键帧均为本项目制作；只使用内部 A4、海岛、已审快跑蟹作风格参考，没有外部模型、图片、动作包或游戏提取素材。所有参考源仅被读取，没有修改。

## 源文件与重建

- `../../build_armored_crab.py`：独立生成脚本，输出固定在本候选目录。
- `armored-crab.blend`：38 个可编辑部件、两张打包图、16 骨和五动作。
- `armored-crab-review-scene.blend`：单网格导出版本与工作室灯光。
- `export/armored-crab.fbx`、`export/armored-colour.png`、`export/armored-roughness.png`：已冻结并晋升的运行导出候选，源文件保留不变。
- `armored-crab.glb`：辅助交换格式。
- `verify_and_review.py`：FBX 回导、每半帧动作检查、源文件检查和六张审查图。
- `source-check.json`、`round-trip-check.json`：源/导出验证；两个 comparison/battle manifest 记录尺度、相机及未改动的参考哈希。

从项目根目录执行：

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_armored_crab.py -- --no-render
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/armored-crab/candidate-01/verify_and_review.py
```

第二条追加 `-- --no-render` 可只检查。所有渲染固定 2 CPU 线程；工作室 24 samples，其他图片 20，最高不超过 32。

## 参数与导入

13,340 三角、6,746 顶点、1 网格、1 UV、1 材质、16 骨、8 条腿。材质前缀 `ArmoredCrab_Toy_Atlas`；图像前缀 `ArmoredCrab_Colour_` / `ArmoredCrab_Roughness_`。图集 512×512；粗糙图为 Non-Color 灰度、Alpha=1，约 .38–.45。非金属，Specular IOR Level=.5，F0=.04。眼白、虹膜、瞳孔及亮点在同一个闭合椭球表面的 UV 上，没有叠加瞳孔薄片。

Blender Z-up、前方 -Y；FBX 为 axis_forward=-Z / axis_up=Y，沿用墨团和快跑蟹约定，预期 Cocos 正面 +Z、脚底 Y=0。真实 importer 元数据和画面尚未检查。

源宽/深/高为 `[1.358952,.816715,.693897]`，Z 最低为 0。建议等比 `.90` 后 `[1.223057,.735044,.624507]`；相对 `.83` 的快跑蟹约宽 38%、矮 19%。实际碰撞、血条和遮挡须接入后确认。

| 动作 | 预期名称 | 帧 / 30 fps | 秒 |
| --- | --- | --- | --- |
| idle | ArmoredCrab_Rig\|idle | 1–73 | 2.4 |
| walk | ArmoredCrab_Rig\|walk | 1–25 | .8 |
| attack | ArmoredCrab_Rig\|attack | 1–34 | 1.1 |
| hit | ArmoredCrab_Rig\|hit | 1–16 | .5 |
| exit | ArmoredCrab_Rig\|exit | 1–28 | .9 |

idle/walk 循环，其余单次；exit 播完移除。全部为原地动作，无根节点平移。walk 周期比快跑蟹长一倍、幅度更小；attack 第 9 帧蓄力、第 16 帧夹击；hit 回弹较小。

## 技术验证边界

FBX 五动作共 347 个半帧样本通过：真实顶点运动、idle/walk 接缝 0、attack/hit 归位，最低地面误差约 .006 毫米。源检查包括闭合表面、朝外绕序、打包图、八腿、归一化权重和源哈希不变。明确设置 Blender 4.5 action slot，避免只改动作名称而模型不动。

战斗图映射当前 GameEntry 相机 `(0,15,18)` 看向 `(0,.2,0)`，42° 垂直 FOV、16:9；在 Blender 中为 `(0,-18,15)` 看向 `(0,0,.2)`。它仍是离线 Blender 渲染，不是 Cocos 截图，没有验证实际着色器、移动速度和性能。技术通过不代表最终美术通过。
