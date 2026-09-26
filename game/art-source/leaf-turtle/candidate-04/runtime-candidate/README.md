# 叶子龟 c04 运行候选

根代理已实际查看最终正面与战斗角并批准 c04 LOD 作为运行候选。三份 FBX/颜色/粗糙度资源已复制到 `game/assets/resources/models/leaf-turtle/`，源与目标 SHA256 逐份一致，见 `promotion.json`。没有启动 Cocos、写 meta/UUID 或修改 view/core；最终 Cocos 观感及动画验收仍由根代理完成。c01–c04 源档案已冻结，外层 `source-freeze.json` 记录完整清单。

## 最终结果

运行网格 **29,560 三角、15,400 顶点、10 骨、1 个不透明图集材质、1 层 UV**。原 c04 高模（63,782 三角）及已审三分之四 PNG 保持原字节，c01–c03 也未改写。高模保持 116 个可编辑部件；本目录另有分部件 LOD 源和单网格运行源。

47 片叶只抽取批准位置中的纵向/截面采样，保留根、圆尖和三列中脉，不对叶片整体 collapse。叶片从每片 608 三角降为 284 三角。高模顶点到叶 LOD 表面的最大距离为 0.012210 m，单叶 bounds 最大差为 0.007496 m；这只是几何采样界限，观感另外实看核对。其他部件分别减面；眼球保留 80%，头面 40%，趾爪 55%。第一版趾爪过尖的 LOD 和三张图归档于 `iterations/lod01/`，最终趾爪已提高精度。

实看最终正面、三分之四、侧面、战斗角，以及攻击两帧、技能、休整、受击、融合关键帧：叶方向、中脉和圆短尖保持，趾爪恢复圆润，没有看到前脸穿壳。侧面可见自然白花。仍有已批准高模的轻微顶部分层节奏；原六动作幅度柔和，需要 Cocos 中的技能反馈、时钟和灯光检查，不能将本轮离线图当作最终运行验收。

## 文件和重建

- `leaf-turtle-lod-parts.blend`：分部件 LOD、原十骨/六动作和两张打包图集。
- `leaf-turtle-runtime.blend`：合并成一个蒙皮网格、一个图集材质的运行编辑源，保存为 idle 第 1 帧。
- `leaf-turtle-lod-review-scene.blend`：同棚灯光/相机，可切换原六动作查看；最后保存的是融合关键姿态。
- `export/leaf-turtle.fbx`、`leaf-colour.png`、`leaf-roughness.png`：已按原字节推广的三份源文件。
- `leaf-turtle.glb`：只供源交接检查，不与同名 FBX 一起放入 resources。
- `inputs/authored_leaf_atlas_source.py` 和 `atlas-parameters.json`：自有颜色/粗糙度的全部数值生成输入，固定种子 81207，没有栅格输入。
- `verification/atlas-rebuild/`：独立重建的两图集，与批准图集和 FBX 内嵌 PNG 均逐字节一致。

在项目根目录执行独立步骤，均不写已审高模或 resources：

```powershell
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --python-exit-code 1 --python 'game/art-source/leaf-turtle/candidate-04/build_runtime_lod.py'
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --python-exit-code 1 --python 'game/art-source/leaf-turtle/candidate-04/review_runtime_lod.py' -- --qa-only
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --python-exit-code 1 --python 'game/art-source/leaf-turtle/candidate-04/review_runtime_lod.py' -- --render-only
```

`inspect_export_payload.py` 用标准 Python 读取 FBX 二进制，核对真实 take 名和内嵌 PNG；`record_runtime_handoff.py` 在完成实际审图后登记哈希及推广提案，不执行推广。渲染为 800×680、32 samples、固定 2 CPU 线程。

## 技术检查证据

`round-trip-check.json`：六动作 FBX 回导后名称/帧区间、权重、10 骨、1 材质、1 UV、闭合头面与 47 片叶、双图集打包和不透明材质通过。六动作共 576 个半帧检查全部有有效运动；端点最大接缝为 0，最低点为 -0.000392 m，低于地面的数值偏差在 0.003 m 检查容差内。

`animation-clearance.json`：attack/skill/hit 的 171 个半帧，LOD 前脸与壳、前腿的相交对数均为 0。范围为原坐标 y<-1.20、z>.40、法线朝前的头面多边形，排除自然后脑/颈部嵌接；这不证明任意连续时刻都无穿插。

`export-payload-check.json`：FBX 实际 2,538,348 bytes，两张 PNG 均真实内嵌，与外部图集字节相同；材质通道为 DiffuseColor 与 ShininessExponent。Blender 导入时曾提示用户扩展缓存目录不可写，但 FBX 回导和全部检查正常退出 0；无需系统安装或更改该目录。

`technical-manual-review.json` 保存十张实际看过的最终图哈希、观察和限制。末次渲染及 QA 的 Blender 进程已退出 0，后续只做文档交接。

## 接入信息（尚待 Cocos 导入验证）

运行资源目录 `game/assets/resources/models/leaf-turtle/`，预计 prefab 为 `models/leaf-turtle/leaf-turtle/leaf-turtle`。新目录第一次 Cocos 导入后由根代理核对，禁止手写子资产 UUID。

材质名 **LeafAtlas_01**、匹配前缀 **LeafAtlas_**。FBX 的 DiffuseColor 预计转为 `mainTexture`，交给原生 Standard 的 `mainTexture`；ShininessExponent 预计转为 `shininessExponentMap`，交给 Standard 的 `pbrMap`。本轮未冒充已执行 Cocos 材质转译。

Blender 前方 -Y、上方 +Z；FBX 导出 -Z 前/Y 上，预期 Cocos 前方 +Z。建议模型 scale **0.65**，脚底 Y=0。此比例下静止 bounds 为 min `(-0.730412,0,-0.827858)`、max `(0.730412,1.010536,1.115910)`，尺寸 `(1.460824,1.010536,1.943768)`。

| FBX 中真实动作名 | 帧区间（30 fps） | 时长 | 播放建议 |
|---|---:|---:|---|
| LeafTurtle_Rig\|idle | 1–72 | 2.366667 s | 循环 |
| LeafTurtle_Rig\|attack | 1–27 | 0.866667 s | 单次 |
| LeafTurtle_Rig\|skill | 1–42 | 1.366667 s | 单次 |
| LeafTurtle_Rig\|hit | 1–18 | 0.566667 s | 单次 |
| LeafTurtle_Rig\|rest | 1–72 | 2.366667 s | 循环 |
| LeafTurtle_Rig\|fusion | 1–60 | 1.966667 s | 单次 |

Blender 回导会再次添加 Rig 前缀，因此回导报告名为 `LeafTurtle_Rig|LeafTurtle_Rig|idle` 等；上表是直接解析 FBX AnimationStack 得到的真实 take 名。

三份已推广文件共 3,530,561 bytes，精确源/目标路径、双方哈希及授权记录见 `promotion.json`。原审查提案另保留在 `promotion-proposal.json`：

- FBX：`c6abed3f0de639a37b80fdd0780c5474525f5b33f579a231bd3d0e6d4a44b74e`
- 颜色：`cfd607ce955c68af8cc0cd2a8e93b807d7a4335645349a6921cca56a486c4125`
- 粗糙度：`547e91c609c8e79518b1218336daf9f878fa041e9a1a9e453f15e78fb1b01269`

分部件 LOD 源 SHA256：`4519162da640637ae267ad72ed5b60b20a64b55ce5ced854b64d61e956e164fc`。
运行编辑源 SHA256：`61741063560a54ceda7ec90c13fede445f200191616d79c7b23094d36197bbce`。
