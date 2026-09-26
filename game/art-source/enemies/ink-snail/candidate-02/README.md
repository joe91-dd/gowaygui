# 吐墨螺 candidate-02

本版只修正 c01 壳部曲线的折痕与接缝。已先实看侧面、三分之四两张同相机同灯光渲染，再执行 FBX / 源 / c01 对比 QA。2026-09-08 根代理实看 c02 三分之四图后批准运行候选；最终复核源、419 个回导样本对应的 FBX、五动作、图集与 c01 原字节记录后，将三份冻结导出复制到 `game/assets/resources/models/enemies/ink-snail`。未启动 Cocos，实际运行验收仍待完成。

晋升记录、精确 SHA-256、动画和坐标交接见 `promotion-manifest.json`。预期加载路径 `models/enemies/ink-snail/ink-snail/ink-snail`，待首次 Cocos 导入元数据确认。`promote_runtime.py` 可幂等复核，不覆盖不同版本、不生成 meta/UUID。原 `asset-manifest.json`、`REVIEW.md` 与图集页面保留为晋升前的历史审查记录。

运行交接：模型子节点 scale `.93`，按既有轴向映射，Cocos 局部 bounds 约 min `[-.256680,0,-.556140]` / max `[.256675,.855600,.518940]`；宽 / 高 / 长 `.513355 / .855600 / 1.075080`。脚底 Y=0、路径 actor Y=.064；血条建议挂未缩放 actor 的 `(0,1.02,0)`、宽 `.65`。站立动作最高约 `.859320`。walk 保持原地滑动，路径与 `.8` 移速由 core 驱动；attack 只响应现有事件，保持远程范围 3.5 / 间隔 2 秒；exit 1.1 秒完成再移除，避免叠加旧占位模型的缩小动画。

图集：`review.html`。逐部件对比：`c01-comparison-check.json`。c01 原字节保护：`c01-preservation.json`。最终文件哈希：`asset-manifest.json`。

## 改动与保留

c01 的管状曲线在切线接近固定参考轴时切换截面方向，壳纹和壳缘出现局部扭结。c02 用连续平行传输的截面替换了两条螺旋纹和两条壳缘；开放螺旋用半球封端，闭合壳缘焊接首尾。螺旋截面 8→10 边，壳缘沿路径 48→64 段。

`Raised_spiral_L/R`、`Thick_rolled_shell_lip_L/R` 是唯一改变的四个网格。其余 11 个网格的顶点、面、UV、权重、骨骼绑定和材质名与 c01 完全相同；包括厚壳主体、软体、脚缘、头、眼睛、眉、喷口。骨架、五动作关键帧、两张图集 SHA-256 也完全相同。整体包围盒未变，没有调亮灯光、改比例或改机制。

| 项目 | c01 | c02 |
| --- | --- | --- |
| 三角 | 12,396 | 13,956 |
| 顶点 | 6,228 | 7,004 |
| 运行网格 / 材质 / 骨骼 | 1 / 1 / 9 | 1 / 1 / 9 |
| 原始宽 / 深 / 高 | .551995 / 1.156 / .920 | 相同 |
| 建议 scale | .93 | .93 |

加面集中于壳纹圆角与壳缘，仍低于本候选 14,000 三角预算。实际 Cocos 材质、移动、遮挡与性能尚未验证。

## 资产与接口

展示名沿用 core 的“吐墨螺”，EnemyKind=`snail`：血量 150、移速 .8、攻击 18、间隔 2 秒、范围 3.5；没有改为喷砂，也没有新增能力。软体滑行动画原地播放，吐墨弹道和命中由既有战斗逻辑负责。

- `../../build_ink_snail_candidate02.py`：独立生成脚本；c01 原生成脚本保留不变。
- `ink-snail.blend`：15 个可编辑部件、9 骨、五动作、两张内嵌图。
- `ink-snail-review-scene.blend`：单网格导出版本与工作室灯光。
- `export/ink-snail.fbx`、`export/snail-colour.png`、`export/snail-roughness.png`：已冻结晋升的运行导出候选，源文件保留不变。
- `ink-snail.glb`：辅助交换格式。
- `verify_candidate.py`：实际 FBX 回导、每半帧检查、c01 逐部件和哈希对比。
- `package_candidate.py`：独立文件、图集嵌入、历史源不变检查并写最终清单。

材质 `InkSnail_Toy_Atlas`；图像前缀 `InkSnail_Colour_` / `InkSnail_Roughness_`。512×512 RGBA，原色 sRGB；粗糙图线性灰度 .31 / .38 / .43，Alpha=1，非金属 F0=.04。没有透明叠层。Blender Z-up、前方 -Y；FBX `axis_forward=-Z / axis_up=Y`，预期 Cocos 正面 +Z、脚底 Y=0，实际导入后再确认 prefab 路径，不手写 meta / UUID。

| 动作 | 预期 clip | 帧 / 30 fps | 时长 |
| --- | --- | --- | --- |
| idle | InkSnail_Rig\|idle | 1–85 | 2.8 秒 |
| walk | InkSnail_Rig\|walk | 1–37 | 1.2 秒 |
| attack | InkSnail_Rig\|attack | 1–37 | 1.2 秒 |
| hit | InkSnail_Rig\|hit | 1–19 | .6 秒 |
| exit | InkSnail_Rig\|exit | 1–34 | 1.1 秒 |

idle / walk 循环，其余单次。建议等比 `.93` 后宽 .513355、长 1.075080、高 .855600。喷口源坐标约 `(0,-.56,.29)`；仅供视图定位，不在源动画生成额外弹丸。

## 验证结果

五动作实际回导共 **419 个半帧样本**通过，均有真实顶点位移；idle / walk 循环和 attack / hit 归位首末差为 0。最小地面值约 `-0.000000132 m`，是小于一微米的数值误差。所有闭合部件朝外、权重归一化；两条闭合壳缘的 Euler 特征为 0，验证首尾为焊接环；两条圆封端螺旋为 2。

c01 所有记录文件在生成前后、对比检查前后均保持 SHA-256 不变；c02 的两张 PNG 已实际查看。仅执行一轮造型修正，没有继续扩展造型内容。生成与 QA 两个 Blender 进程均正常退出；2 CPU 线程、24 samples。技术检查和离线图片不等于最终美术或 Cocos 实机通过。

## 重建

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_ink_snail_candidate02.py
# 先查看本候选两张 PNG，再运行 QA。
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/ink-snail/candidate-02/verify_candidate.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' game/art-source/enemies/ink-snail/candidate-02/package_candidate.py
```

全部几何、UV 绘制、骨架和动作沿用项目自有原创源，没有外部模型或图片。生成器记录 c01 原字节，并仅写 c02 目录。重建会产生新的二进制哈希，须重新验收后再冻结。
