# 单阳光级联阴影与帧率只读核查

核查日期：2026-09-08。对象为本机 Cocos Creator 3.8.8 源码与 `200216` Web Mobile 构建。此次没有修改生产代码、meta、模型或材质，没有启动 Cocos、Blender 或浏览器。根代理后续执行的一层阴影 A/B 尚未包含在本报告中。

## 已确认结论

1. **单盏太阳仍会配置四级 CSM。** `Main.scene` 没有序列化覆盖级数；Cocos DirectionalLight 组件默认四级，`WorldLighting` 仅启用阴影并改为 SOFT PCF。四级是四个阴影场景绘制阶段，和光源数量不是同一件事。
2. **200216 启动目标是 60 FPS，未发现 30 FPS 限帧设置。** 构建 screen 配置未写 frameRate，应用启动没有覆盖它；引擎缺省值是 60。截图中 23–29 FPS 不能解释为项目主动限 30 帧。
3. **调试面板三角数是所有 draw/pass 的提交总量，不是资产独立三角数。** 重复阴影提交会抬高它；PCF 四次滤波采样本身不会把顶点/三角数乘四。
4. 四级共用一张 **1024×1024 阴影 atlas**，每级占 512×512 区域。因此关闭多级主要减少 draw 和重复顶点处理；不能据此声称 93.72 MiB 纹理或 53.56 MiB buffer 会缩减四倍。

## 可追溯依据

本机引擎根目录：`C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine`。下表引擎路径均相对该目录。行号对应本次核查版本；后续工程编辑可能移动行号。

| 文件与行 | 实际内容与含义 |
| --- | --- |
| `game/assets/scenes/Main.scene:40` | DirectionalLight 只显式设置颜色、色温、LDR 光强等；没有 `csmLevel`、`shadowFixedArea`、`shadowDistance`。相机 near 0.1、far 100。 |
| `game/assets/scripts/view/WorldLighting.ts:5`、`:8`、`:10` | 开启 shadow map，尺寸 1024，单太阳启用投影，PCF 设为 SOFT；本次核查版本没有 CSM 覆盖。 |
| `cocos/3d/lights/directional-light-component.ts:67`、`:71`、`:75`、`:86` | 组件缺省 shadowDistance=50、CSM LEVEL_4、RemoveDuplicates 优化、shadowFixedArea=false。`:547` 起初始化会把这些值同步到渲染灯。 |
| 同文件 `:313` | `enableCSM=false` 的 setter 明确映射为 LEVEL_1，true 映射 LEVEL_4，并更新渲染灯与级联状态。 |
| `game/build/web-mobile/src/settings.json:89` | 当前产物 `customPipeline=true`；应优先沿 custom 管线追踪，而非只看 legacy shadow-flow。 |
| `cocos/rendering/custom/define.ts:329` | 未启用 fixed area 时，按支持情况使用 `mainLight.csmLevel`，逐级调用 `buildShadowPass`；不支持 CSM 的设备回退一级。本次未读取实际 GPU 的 csmSupported 值。 |
| 同文件 `:167` | 四级各使用同一 shadow map 的半宽、半高视口；一级使用完整视口。 |
| `cocos/rendering/custom/scene-culling.ts:504`、`:543` | 根据当前级别构造 frustum 并分别 sceneCulling。组件默认已是 RemoveDuplicates，不能把再设一次该值当作已证明有效的修复；当前 custom 路径未发现与 legacy 同名优化开关的显式分支。 |
| `cocos/render-scene/scene/shadows.ts:97` | HARD 为一次采样；SOFT 为四次 PCF 采样。这是片元阴影滤波成本，不是四次几何提交。 |
| `cocos/gfx/webgl2/webgl2-primary-command-buffer.ts:95` | 每次 draw 累加 drawCalls，并按 indexCount/3 与 instanceCount 累加 numTris。 |
| `cocos/profiler/profiler.ts:588`、`:592` | 调试面板读取设备累计 drawCalls 与 numTris。 |
| `game/assets/scripts/view/WorldLighting.ts:16` | `receiveIslandShadows(root, cast=true)` 会让子 MeshRenderer 同时接收并投射阴影，环境大合并网格也会成为投射者。 |
| `game/build/web-mobile/src/settings.json:80` | screen 配置无 frameRate。 |
| `game/build/web-mobile/application.js:41` | `cc.game.init` 只覆盖 profiling.showFPS，没有覆盖帧率。工程脚本检索也没有主动设置 frameRate，LocalDiagnostics 只读取。 |
| `cocos/game/game.ts:1091`、`:1095` | 从 screen/frameRate 读取配置，缺省使用 60，再写入游戏帧率。 |
| `pal/pacer/pacer-web.ts:34`、`:42`、`:112` | Web pacer 缺省目标 60，按目标周期和 RAF 节奏跳过过早的回调，没有项目隐含的固定 30 帧分支。 |

构建关联：`game/temp/build-logs/latest-build.json` 指向 2026-09-08T12:02:16Z 启动、12:04:56Z 写出的成功构建，bundle SHA-256 为 `00a914b9abbac8f787351ad74ca48299c3fd01b7b4d1968e367d7d9cebaea029`。它将上述产物与 200216 对照关联；不是只检查编辑器缺省设置。

## 截图数字的解释边界

- 首页石龟 c12b 是 28,572 独立三角。`118,794 − 4 × 28,572 = 4,506`，与重复绘制主体的量级一致；但没有逐 pass capture，**不能以这个算式声称已经测出石龟恰好经过四个 pass**。四级加主画面理论上可有五次提交，实际各级裁剪、UI 和底盘都会影响总数。
- 第五关源清单包括地面 9,340、地标植被 43,484、珍珠灯 2,304，共 55,128 三角；加单只水晶 28,899 是 84,027。截图 369,477 约为其 4.4 倍，也符合多次阴影提交量级，但不能替代逐 pass 归因。
- 当前还有 Blender CPU2 并行。23–29 FPS 不作为稳定性能基线，也尚不足判断 CPU、GPU、RAF 或机器共享负载哪项是瓶颈。
- 纹理与 buffer 占用需要独立资源分配核查；仅凭这两项总量不能归因级联阴影。

## 下一构建的最小 A/B

只在阳光配置处设置 `sun.enableCSM = false`，保留单光源、1024 阴影、SOFT PCF、光强、材质、分辨率、shadowDistance=50 和相机。该 API 直接使用一级；先隔离级联提交这个变量。

预期收益是减少阴影 pass 及重复投射者 draw/顶点处理，实际降幅和 FPS 均待同机空闲采样验证。不能事先保证帧率提升比例。

画质代价是失去近远分层的阴影精度分配，可能在近景接触阴影、龟脚底、叶影或镜头移动时出现较软、锯齿或抖动。一级使用整个 1024 atlas，四级各用 512 tile，因此也不能简单断言一级处处比四级差四倍。应对照首页、第五关全景、角色脚底与边缘物体，确认阴影没有消失或明显跳动。

本阶段不建议同时开 fixed area：其默认 orthoSize=5、far=10 对宽 22、深 12 的岛可能裁掉投影，需要独立设定覆盖范围。也不建议同时缩短 shadowDistance 或改材质提亮，否则难以判断改动来源。

若一级对照通过后仍需优化，可另做地面/水面只接收不投射的独立测试；保留龟和关键地标投影。当前地面 9,340 三角属于可核查对象。代价是静态地形自身阴影可能减少，不能把整组植被或地标统一关掉后直接宣称画质无损。

**状态：源码核查完成；一级阴影的实际画面、逐 pass 数字、空闲机器 FPS 对照尚未实测。**
