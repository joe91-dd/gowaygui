# 刺刺龟 c02 运行候选交接

根代理已实际查看 c02 正面与三分之四，批准作为运行候选，造型冻结。c02 自己的六动作回导、归一化权重、图集源重建及关键半帧穿插检查已通过；新增八张真实 3D 渲染已逐张实看，已审两图没有重新渲染且哈希未变。实际复制与冻结状态以 `promotion-manifest.json`、`promotion-verification.json` 为准。最终用户美术验收和真实 Cocos 验证仍待完成。

## 精确资源路径

运行目录：`game/assets/resources/models/spike-turtle/`，仅复制以下三份资源：

- `spike-turtle.fbx`：28,900 三角、15,086 加权顶点、10 骨骼、1 材质、1 UV 层，内嵌贴图。
- `spike-colour.png`：1024×1024 自有颜色图集。
- `spike-roughness.png`：1024×1024 自有粗糙度图集。

按当前同系列 FBX 流程，预期 `resources.load` 的 prefab 路径是 `models/spike-turtle/spike-turtle/spike-turtle`。这是导入前预期，须由根代理在 Cocos 首次构建后核对。新目录没有手写任何目录、文件或子资产 UUID；Cocos 自行生成 `.meta`，后续保持其引用。GLB 只保留在 art-source，不复制到 resources。

## 材质与尺度

材质名预期 `SpikeAtlas_01`，前缀 `SpikeAtlas_`。原生 Standard 桥接需要在接入点显式允许此新前缀。预期 importer 属性 `mainTexture` 对应 `spike-colour.png`，`shininessExponentMap` 对应 `spike-roughness.png`；沿现有桥接分别映射到原生 `mainTexture` 和 `pbrMap`。以上基于同一 FBX 流程，尚未由本任务启动 Cocos 验证。

Blender 源为 Z 上/-Y 前；FBX 导出 Y 上/-Z 前；同系列 Cocos 转换后预期 +Z 前。战斗实例 scale **0.65**，脚底 Y **0**。

回导静止姿态的预期 Cocos bounds（X/Y/Z；包含头、尾和尖刺）：

| 范围 | 最小坐标 | 最大坐标 | 尺寸 |
| --- | --- | --- | --- |
| 未缩放 | (-1.123720, 0, -1.273628) | (1.148959, 1.714023, 1.716785) | (2.272679, 1.714023, 2.990412) |
| scale 0.65 | (-0.730418, 0, -0.827858) | (0.746823, 1.114115, 1.115910) | (1.477241, 1.114115, 1.943768) |

Y 下界约 1.6e-9，表中四舍五入为 0。实际 Cocos 尺度与朝向由根代理复核。

## 六动作

保持骨骼名 `root/body/shell/neck/head/front_L/front_R/rear_L/rear_R/tail`；FBX action 名前缀预期 `SpikeTurtle_Rig|`。模型动画只表现蓄力和释放，没有制作飞刺弹体，弹体由后续视图实现。

| Clip | 30 fps 帧区间 | 时长 | 播放建议 |
| --- | --- | --- | --- |
| idle | 1–72 | 2.366667 秒 | 循环 |
| attack | 1–27 | 0.866667 秒 | 单次，低头和壳部短蓄力/释放 |
| skill | 1–42 | 1.366667 秒 | 单次，较长蓄力和壳部抬压/释放 |
| hit | 1–18 | 0.566667 秒 | 单次 |
| rest | 1–72 | 2.366667 秒 | 循环 |
| fusion | 1–60 | 1.966667 秒 | 单次，小跳 |

六 clip 回导均有真实加权顶点位移，首尾最大差为 0。逐半帧检查的最低高度约 -1.43e-6 m。attack/skill/hit 分别 53/83/35 个前脸 BVH 采样，共 171 个，前脸与壳/前腿均无交集。该检查排除正常后脑/脖颈嵌接，不证明任意连续时间点绝无穿插。

## 可编辑源与重建

`spike-turtle.blend` 是可编辑分部件、十骨架和六动作源，已核验两图集打包；`spike-turtle-review-scene.blend` 是导出 LOD 和摄影棚；`spike-turtle-keypose-review.blend` 保存动作检查摄影棚。完整脚本为 `game/art-source/build_spike_turtle_candidate02.py`，输入快照为本目录 `inputs/authored-c12b-foundation.blend`，来源和固定哈希见 `inputs/provenance.json`。

图集由脚本的数值调色板、固定种子 54123 和数学眼部 UV 方程全量生成，没有栅格图输入。独立重建两 PNG 与导出逐字节一致。c01 和全部石龟源/运行资源均保留；保护文件的哈希记录在 candidate/promotion manifest。

完整核验命令：`blender --background -t 2 --python-exit-code 1 --python review_candidate02.py -- --skip-approved-views`。本次正常退出 0；所有渲染 FIXED 2 线程、800×680、32 samples，本代理启动的 Blender 进程已结束。Blender 扩展缓存权限提示不影响源文件、导出和核验产物，未安装系统软件或寻求额外系统权限。

`runtime_promotion.py promote` 执行已授权晋升；`runtime_promotion.py verify` 检查冻结源、运行文件及保护文件。脚本不启动 Cocos，不改视图、共享 docs 或其他物种。

FBX SHA256：`5bc7d55d4a69ad8bb89af6637be30ff77024c30f51637490f684bd39abc3f26e`。源 blend SHA256：`9193078d649856f18c8ef3244c731480e00b86bc9ae000847cabb46fa38109ca`。

此前的 `REVIEW.md` 和 `manual-review.json` 为两视快审历史；当前技术状态见 `round-trip-check.json`、`animation-clearance.json`、`review-complete.json`、`technical-manual-review.json`。剩余美术取舍沿用已审 c02，未在检查时追加改型。
