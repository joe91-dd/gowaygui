# 五龟头像候选 c01：真实运行模型渲染

五种已冻结运行源与实际资源的 SHA 已一致核对，35 份角色源/运行文件在渲染前后保持原字节。经根代理安排首页之后的唯一 Blender 槽，已经完成 5 张 384×384 透明 PNG 和 5 张真正 64×64 小图。**作者已逐张实看十图，Blender 退出 0；候选待根代理与实际 UI 审查，未推广 resources。**

头像为五张 384×384 透明 RGBA PNG，以及五张真正以 64×64 渲染的小尺寸检查图。头脸和上壳保持真实几何，不用职业符号、其他游戏图片或 AI 重绘替代；未修改角色源、运行模型、材质/纹理，未在本任务写 resources 或 UI。

## 固定来源

- 石头龟：`stone-turtle/candidate-12/c12b/stone-turtle-review-scene.blend`，28,572 三角。
- 刺刺龟：`spike-turtle/candidate-02/spike-turtle-review-scene.blend`，28,900 三角。
- 水晶龟：`crystal-turtle/candidate-02/crystal-turtle-review-scene.blend`，28,899 三角。
- 叶子龟：`leaf-turtle/candidate-04/runtime-candidate/leaf-turtle-runtime.blend`，29,560 三角。
- 泡泡龟：`bubble-turtle/candidate-02/runtime-candidate/bubble-turtle-runtime.blend`，29,604 三角，已通过 turtle_art 的运行 LOD/六动作/回导和冻结，不使用静态高模顶替。

前三个 review-scene 含实际导出 LOD，脚本只加载其单蒙皮网格与骨架，不复用摄影棚。叶子、泡泡直接加载单网格运行编辑源。已核对实际三角数、十骨、单材质、真实 idle 第 1 帧、两张打包 PNG 字节；这些内部结构检查在 Blender 中通过。`prepare_sources.py` 核对源 blend、FBX、图集与资源目录文件的冻结 SHA。

## 统一镜头和用光

全部使用同一个近正面镜头：方位角 12°、俯角 18°、正交投影，目标为 Blender 坐标 `(0,-0.38,0.96)`。五只 head/shell/neck 加权顶点整体包围范围共同决定唯一正交宽度 **2.7915330773**；没有为某只单独缩放脸或放大镜头。所有头/上壳在投影范围 4%–96% 内，头宽不少于 35%，实际比例记录在 render-report.json。壳较矮的角色上方留白更多，是统一框幅的结果。

统一三盏大面积柔光与中性环境光，保持原非金属图集材质，AgX、曝光 0、gamma 1。不做单只颜色修图或各自提亮。透明背景，无地面/圆台/阴影贴片。每只保存本目录自己的可编辑头像场景，绝不覆盖角色原场景。

渲染为单 Blender、2 CPU、24 samples。主图 384px 供头像卡；64px 真渲染仅供阅读性检查，不作为新的角色源。小尺寸对照页提供浅/深卡底、64px 实际像素与 48/96px 显示；十张原图已经逐张打开。对照 HTML 本轮尚未通过浏览器操作，因此未把浅深底或 48/96px 视图写成浏览器通过。

## 后续入口

运行标准 Python `prepare_sources.py`，此操作不启动 Blender。泡泡的冻结路径/哈希/三角数已登记到本目录 `bubble-input.json`，其运行目录三文件推广完成后再重新准备；该程序要求源与实际资源字节完全一致，全部五种齐备后方可执行渲染。

根代理明确安排渲染时段后：

```powershell
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python 'game/art-source/ui/portraits/candidate-01/render_portraits.py' -- --slot-authorized
```

渲染结束后运行标准 Python `inspect_portraits.py`。它只读取 PNG，核对 RGBA/透明角落/尺寸/哈希，生成 `png-check.json` 与小尺寸 `review.html`，不修改图像像素；检查页可同时对照浅深底、64px 实际渲染、48/96px 显示。

`render-report.json` 记录五角色来源保护、相同镜头和用光、实际头像头宽、PNG/场景哈希；`png-check.json` 记录尺寸/alpha/边缘；`visual-review.json` 记录十张图的实际审看与边界；`source-freeze.json` 冻结本候选。原始角色来源前后各核对一次。技术渲染和作者审图不等于最终用户美术通过。

冻结后不要原地重跑渲染；需要调整镜头时新建候选目录。渲染脚本也会检测 source-freeze.json 并拒绝覆盖。
