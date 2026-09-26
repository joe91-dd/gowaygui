# 水晶龟 c02 运行候选交接

根代理已实际查看 c02 正面与三分之四，批准作为运行候选并冻结造型。c02 自己的六动作回导、归一化权重、接地、关键半帧穿插及图集源重建检查已通过。新增八张真实 3D 渲染已逐张实看；此前已审两图保持原哈希，没有重新渲染。实际复制与冻结结果以 `promotion-manifest.json` 和 `promotion-verification.json` 为准。最终用户美术验收和真实 Cocos 观感仍待完成。

## 运行资源

运行目录为 `game/assets/resources/models/crystal-turtle/`，仅包含本次提供的三份资源：

- `crystal-turtle.fbx`：28,899 三角、15,031 加权顶点、10 骨骼、1 材质、1 UV，内嵌贴图。
- `crystal-colour.png`：1024×1024 自有颜色图集。
- `crystal-roughness.png`：1024×1024 自有粗糙度图集。

依照同系列 FBX 导入流程，预期 resources prefab 路径为 `models/crystal-turtle/crystal-turtle/crystal-turtle`，须由根代理在 Cocos 首次导入后核对。没有手写任何目录、资源或子资产 UUID；Cocos 自行生成 .meta，后续保留它们。GLB 仅在 art-source，不进入运行目录。

## 材质与尺度

材质名预期 `CrystalAtlas_01`，前缀 `CrystalAtlas_`。原生 Standard 桥接需在本角色接入点明确允许该前缀。Importer 的 `mainTexture` 预期为 `crystal-colour.png`，映射到 Standard 的 `mainTexture`；`shininessExponentMap` 预期为 `crystal-roughness.png`，沿同系列映射到 `pbrMap`。这些 Cocos 属性是同流程推定，仍需实际导入核对。

采用不透明材质：Alpha=1、Transmission=0、Metallic=0，GLB 材质 OPAQUE 已检查，没有透明排序或折射依赖。晶体图集粗糙度 0.22；蓝晶观感来自真实刻面/圆角、染色和反光，不使用图板。

Blender 源为 Z 上/-Y 前；FBX 导出 Y 上/-Z 前；同系列 Cocos 转换后预期 +Z 前。战斗 scale **0.65**，脚底 Y **0**。源头宽/主壳宽 **0.595923**。

| 回导静止 bounds，Cocos X/Y/Z | 最小坐标 | 最大坐标 | 尺寸 |
| --- | --- | --- | --- |
| 未缩放 | (-1.123720, 0, -1.273628) | (1.123720, 1.882512, 1.716785) | (2.247441, 1.882512, 2.990412) |
| scale 0.65 | (-0.730418, 0, -0.827858) | (0.730418, 1.223633, 1.115910) | (1.460837, 1.223633, 1.943768) |

脚底 Y 下界约 1.6e-9，表内四舍五入为 0。最高主晶决定模型总高，选择框、名字条或效果挂点宜按实际模型高度核对。

## 六动作

十骨骼名称为 `root/body/shell/neck/head/front_L/front_R/rear_L/rear_R/tail`。FBX action 前缀预期 `CrystalTurtle_Rig|`。c02 保留 c01 六动作源函数和曲线，经 AST 对照一致。

| Clip | 30 fps 帧区间 | 时长 | 播放建议与表现 |
| --- | --- | --- | --- |
| idle | 1–72 | 2.366667 秒 | 循环，呼吸和小幅头尾动作 |
| attack | 1–27 | 0.866667 秒 | 单次，集中/释放，壳轻脉动；第 13 帧主要释放姿态 |
| skill | 1–42 | 1.366667 秒 | 单次，较长聚力、身体略起伏和晶壳脉动；第 20 帧主姿态 |
| hit | 1–18 | 0.566667 秒 | 单次，第 4 帧回缩 |
| rest | 1–72 | 2.366667 秒 | 循环，稍蹲并缩颈 |
| fusion | 1–60 | 1.966667 秒 | 单次，第 23 帧小跳 |

全部回导 clip 有真实加权顶点位移，首尾最大差为 0。逐半帧最低脚底约 -7.32e-8 m，属于浮点误差。attack/skill/hit 共 171 个半帧采样，前脸与壳/前腿的 BVH 交集均为 0；正常脖颈/后脑嵌接不计入此检查。这是离散采样，不能证明任意连续时刻绝无穿插。

## 可编辑源与重建

`crystal-turtle.blend` 保留 97 个可编辑网格部件、骨架和六动作，两图集已打包。`crystal-turtle-review-scene.blend` 为 LOD 摄影棚；`crystal-turtle-keypose-review.blend` 为动作检查摄影棚。独立生成脚本是 `game/art-source/build_crystal_turtle_candidate02.py`，固定输入为本目录 `inputs/authored-c12b-foundation.blend`，来源与 SHA 在 `inputs/provenance.json`。

图集由脚本数值调色板、种子 73161 和解析眼部 UV 方程全量生成；没有栅格图片输入。两张 PNG 独立重建后逐字节一致。c01 非壳部网格、UV、权重和六动作源曲线保持一致。c01、石龟、刺刺龟源与已冻结运行 payload 均保留，保护哈希见 candidate/promotion manifest。

核验命令：`blender --background -t 2 --python-exit-code 1 --python review_candidate02.py -- --skip-approved-views`。完整进程正常退出 0；所有渲染固定 2 CPU、800×680、32 samples。渲染进程已结束，再进行 stdlib 复制晋升。没有启动 Cocos、编辑视图/core/shared docs 或创建 metadata。

`runtime_promotion.py promote` 执行已授权的独立新目录晋升；默认或 `verify` 只读检查冻结源与运行 payload。

FBX SHA256：`b35d20a6ffbc737231631e505c8ae5b9d5eefea3a83b1b46fd58b838a5bd0364`。
源 blend SHA256：`694e5496e9e44040259f3f4ea525b42a51e13acb52c4c685b134fb2fb152a51e`。
颜色图集 SHA256：`8762633b9608f096b592f29db3d3d8cc12cda0ef247a53b2697e385f74f981e2`。
粗糙度图集 SHA256：`f84cf3281104c0baa61c5f03658db6c1ff1f1c9cfdcacef8943bccf1c20e10e5`。

## 实看范围与剩余取舍

两张已审图加八张补图覆盖正面、三分之四、侧面、俯视战斗角和六动作代表姿态。没有发现检查角度下的面部穿插、晶根漂浮、脚底贯穿或贴图缺失。战斗角中的中央高晶与蓝色外轮廓易辨；动作幅度偏克制，实际游戏中的技能节奏还需与视图效果一起检查。

刻面和部分大高光仍清楚，晶簇之间仍露出深蓝光滑壳面，侧面个别晶根呈较厚的柱形。以上为冻结候选的已知美术取舍，不在技术 QA 阶段追加造型。真实 Cocos 灯光/Standard 粗糙度和手机镜头下的眼部层次由根代理下一轮核对。
