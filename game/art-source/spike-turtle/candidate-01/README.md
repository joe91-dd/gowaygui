# 刺刺龟 candidate-01

本目录是原创真实 3D 首版候选，没有晋升运行资源，也不是最终美术验收。石龟 c12b 的自有头部、眼球/眼睑、短四肢和十骨架作为系列基础；新做琥珀分瓣甲壳、九根大刺、略不对称的上扬眉及微笑，并重新编排六动作。无服装、武器或飞刺弹体。

## 文件

- `spike-turtle.blend`：可编辑分部件网格、十骨架、六动作，两张 1024 图集打包。
- `spike-turtle-review-scene.blend`：实际导出 LOD 与摄影棚。
- `export/spike-turtle.fbx`、`spike-colour.png`、`spike-roughness.png`：独立导入候选；FBX 同时内嵌纹理。
- `spike-turtle.glb`：兼容源格式，仅保留在 art-source。
- `../../build_spike_turtle_candidate01.py`：完整生成脚本；`inputs/authored-c12b-foundation.blend`：本目录固定的自有基础网格快照，来源与哈希见 `inputs/provenance.json`。
- `review_candidate01.py`：源、图集、FBX 回导和关键姿态检查。
- `render_island_context.py`：只在本目录写入真实海岛比例图及摄影棚源，不修改海岛或敌人来源。
- `iterations/initial-shape/`：首轮较长甲片、偏桃橙色和过硬刺尖的源、脚本与快图记录，不是当前最终候选。

图集从本生成脚本的数值调色板、种子 54123、数学色粒以及眼部 UV 方程全量生成，无栅格图输入。验证脚本只提取该生成函数与参数再次生成两张 PNG，已与导出逐字节比较一致。来自基础 blend 的旧石龟材质和旧图片会在新源保存前移除，不用于最终贴图。

## 已完成的技术检查

当前 FBX 为 28,900 三角形、15,086 个归一化权重点、10 骨骼、1 材质、1 UV 层。头部源网格闭合流形，源文件两张图集已打包。六动作回导的帧区间正确，均有真实加权顶点位移，首尾差为 0；最低脚底高度约 -0.00000143 m，属于本次采样的微小误差。

| 动作 | 30 fps 帧区间 | 时长 | 建议 |
| --- | --- | --- | --- |
| idle | 1–72 | 2.367 秒 | 循环 |
| attack | 1–27 | 0.867 秒 | 单次，低头与壳部短蓄力/释放 |
| skill | 1–42 | 1.367 秒 | 单次，较长蓄力、壳部抬压与释放 |
| hit | 1–18 | 0.567 秒 | 单次，短后仰 |
| rest | 1–72 | 2.367 秒 | 循环，低伏呼吸 |
| fusion | 1–60 | 1.967 秒 | 单次，蓄力小跳 |

attack、skill、hit 共 171 个半帧前脸 BVH 采样中，前脸与壳/前腿无交集。该检查排除正常脖颈嵌接，不证明任意连续时间点绝无穿插。逐张实看记录与渲染进程结束状态以 `manual-review.json` 为准。

## 审美范围和待评审点

头宽高沿用 c12b，主壳压回同系列约 0.60 的头/壳宽度比例。新壳为 35 片主体甲、15 片较短边片及九根大刺，使用更暖的琥珀金与棕色凹缝。

已查看的三视图中，新壳明显区别石龟，下圈长板问题已改善；但大刺的平面仍偏硬，部分甲片排列较规整，眉嘴的机灵变化较克制。这些是首版候选的剩余美术问题，不能用技术通过代替审美验收。海岛图是 Blender 的真实网格离线构图，不是 Cocos 试玩截图。

## 未来导入注意

目前不创建 resources 路径或 importer UUID。若后续批准接入，沿用骨骼名 `root/body/shell/neck/head/front_L/front_R/rear_L/rear_R/tail` 与六 clip；FBX action 前缀为 `SpikeTurtle_Rig`。Blender 为 Z 上、-Y 前，FBX 导出 Y 上/-Z 前，既有 Cocos 转换约定下预期 +Z 前，战斗 scale 0.65、脚底 Y=0。

材质前缀是 `SpikeAtlas_`，导出使用 `SpikeAtlas_01`。现有石龟材质适配器默认只接受 `StoneAtlas_`；未来必须在接入位置明确允许新前缀并核对真实 importer。预期导入颜色属性 `mainTexture` 对应 `spike-colour.png`，`shininessExponentMap` 对应 `spike-roughness.png`；现有 Standard 桥接将它们映射为 `mainTexture` 和 `pbrMap`。这仅是根据同一 FBX 流程的预期，本候选没有启动 Cocos 验证。

所有 Blender 命令使用 `--background -t 2 --python-exit-code 1`；渲染 FIXED 2 线程、最高 32 samples。运行本目录脚本只写本候选；不触碰石龟资源、视图或共享 docs。

当前 FBX SHA256：`f26c593116b59d251732596431c45f16285b369b602b2e4084c86ac363ba9a56`。
