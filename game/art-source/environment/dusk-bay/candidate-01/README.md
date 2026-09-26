# 薄暮海湾 · 场景候选 01

状态：**三视及几何图已实际查看，经主代理批准，FBX 与两张图集已晋升为冻结的运行候选，仍未进行 Cocos 验收。** 第四关真实路线和五个原站位全部保留；没有修改 core、view、其他场景或共享进度。

## 场景构图

沿 A / v04 玩具海岛的材质和模块扩展：重新生成路线相关地形、单面连续沙路和右前方浅湾，保留完整五站台及贝壳核心。黄昏通过柔暖沙色、灰绿草地、海岸暖灯与小珍珠灯台表达；高装饰集中后岸，中央保持可辨。

新海岸有 3 株低椰树、5 盏路径外灯笼、1 座后岸小灯台、低珊瑚与海草。预览黄昏灯光和海水只在 review-scene.blend 中，未并入 FBX。主代理接入时仍需单独确定实际环境光和材质纹理。

真实 X/Z 路线：`(-9,-1) → (-5,0) → (-2,-2) → (2,-2) → (4,0) → (7,0) → (9,1)`。路面 Y `.064`；入口 `(-9,.064,-1)`、终点 `(9,.064,1)`、珍珠 `(9,1.10,1)`；站台锚点和连续承托面 Y `.292`。

## 原站位、脚支撑与石龟覆盖

| 玩家站位 | X/Z | 距路线中心 | 完整脚底净空 | 基础 1.2 阻挡 |
| --- | --- | ---: | ---: | --- |
| 1 | (-5,1) | 1.000000 | 0.025353 | 有 |
| 2 | (-1,1) | 3.000000 | 2.025353 | 无（原布局） |
| 3 | (3,1) | 1.414214 | 0.439566 | 无（原布局） |
| 4 | (1,-3) | 1.000000 | 0.025353 | 有 |
| 5 | (6,-1) | 1.000000 | 0.025353 | 有 |

当前运行石龟为 c12b，scale `.65`。重新打开实际源测量 2068 个近地脚/趾顶点，完整全朝向半径 `.9746471943`、严格触地点半径 `.8874670246`，与 c11 对应包络数值相同；本次记录当前模型真实 SHA，没有把旧文件身份沿用为新模型证据。

五台均使用 48 边连续顶面，外接半径 `.995`、内切半径 `.992869629`，比完整脚底包络多 `.018222434`。真实回导 FBX 上 `2068 × 36 朝向 × 5 台 = 372,240` 条支撑射线全部通过。原第 1/4/5 站位距路线中心 1，完整脚底净空仅约 .02535；视觉沙带可以延至台边，但没有以削台使龟脚悬空。

无需为路线中心或脚底支撑提出移动方案，proposal.json 的 changedSlotIndices 为空。第 2/3 站位原本超出石龟基础阻挡 1.2，主代理明确保留远程/辅助用途；没有为全格近战改动站位或路线。几何覆盖不代替实际敌我接触及动作验证。

`layout-review.svg` / `.png` 是从真实路线、站位和模型脚底顶点生成的原创可编辑示意图，包含每格覆盖路线长度；没有描摹或修改已有截图。

## 文件与技术结果

- `build_dusk_bay.py`：独立完整场景生成器；可直接重建，不依赖重新生成上游岛屿。`author_dusk_candidate.py` 仅保存本次模块继承的制作记录。
- `dusk-bay.blend`：1,474 个独立可编辑网格、9 个锚点、2 张打包图集；相机/海水/灯光在单独 `dusk-bay-review-scene.blend`。
- `dusk-bay.fbx`：**65,066 三角 / 3 网格 / 2 材质**。材质名 `Island_atlas`、`Warm_pearl_and_lamps`。
- `island-colour.png` / `island-roughness.png`：2048×1024。本候选颜色图集为原创 A 配色的黄昏变体，粗糙度沿用同工艺。
- 实际 FBX 回导 108 个路线样本，高程 0.0639973–0.0640020，高程异常 0、中央障碍 0；站位、入口/终点、UV、三角数、材质、有限坐标与 bounds 均通过。
- 首轮近景发现岸外悬空草，已收紧随机植被真实边界并移回两簇固定海草；最终 473 个草/灌木/海草部件根部对真实草地网格射线全部命中。失败预览与中间根部检查留在 iterations，未计作通过。
- 装饰中央障碍检查区间 `-8.85 < X < 7.55`，入口门和终点核心保留其功能形体；不声称整条路线除外部空气外完全空白。
- 真实 bounds：X `[-11.976146,12.252266]`，Y `[-1.869999,2.754116]`，Z `[-6.048586,5.567645]`；X/Z 跨度 **24.228 × 11.616**。22×12 为共同名义玩法占地，海岸外挑未隐藏。
- FBX SHA-256：`55ffe57152c8de18146b1bcb94550ff515b6a4c720e5da2f77c9fa4e3e606675`。

三视为 `render-battle-overview.png`、`render-top-down.png`、`render-dusk-beacon-detail.png`，均 **1000×700 / Cycles CPU / 2 线程 / 32 samples**，已经实际逐张查看。战斗相机遵循现有 1280/720 水平取景保持规则。

## 剩余美术与运行事项

- 黄昏感目前较柔和，属于暖色傍晚候选；正式环境光和天空需在 Cocos 里一起确定。
- 沙路与草地交界仍偏规整，近景石台和灯台保留低多边形分面；可在后续美术打磨中统一边缘细节。
- 海岸石块仍有模块重复感，灯笼和草团的散布属于首版构图。
- 三视是无战斗角色的离线舞台预览，尚未验证实际手机 UI、角色动作、技能效果和战斗遮挡。

- Cocos 中图集绑定、薄叶剔除、灯光/阴影、灯台高光和实际手机视线仍需检查；预览效果不代表运行效果。
- 本次只晋升 FBX 与两张图集，未启动 Cocos，没有写 meta、导入 UUID 或 view 接线。
- 来源、生成脚本、验证报告及当前输出的完整 SHA 见 provenance.json；来源记录不构成绝对法律风险保证。

## 重现

在项目根目录使用本机 portable Blender，全部加 `--background --threads 2 --python-exit-code 1`：依次运行本目录 `measure_stone_footprint.py`、bundled Python `prepare_dusk_layout.py`、Blender `build_dusk_bay.py -- --export-only`、`verify_dusk_bay.py`、`check_editable_source.py`、`verify_foot_support.py`、`verify_vegetation_support.py`、`render_dusk_views.py`。

布局图由 bundled Node + 现有 sharp 运行 `render_layout_review.cjs`。完成实际图像审查后更新 manual-review.json 并运行 bundled Python `finalize_records.py`；后者会验证手工审图记录对应的精确图像 SHA，不自动假定已通过。

## 运行候选晋升

主代理实际查看最终战斗全景后批准当前布局和柔和黄昏配色。`promote_runtime.py` 在复制前核验 provenance 中全部 33 项文件的大小/SHA、最终俯视/近景与审图记录的一致性、四份几何报告、真实 level3 路线和五站位；晋升后三文件与源逐字节一致。

目标目录：`game/assets/resources/environment/dusk-bay/`，仅 `dusk-bay.fbx`、`island-colour.png`、`island-roughness.png`。完整路径与 SHA 见 `promotion-manifest.json`。按现有 FBX 导入命名约定，预期 resources prefab 路径为 `environment/dusk-bay/dusk-bay/dusk-bay`，材质仍为 `Island_atlas`、`Warm_pearl_and_lamps`；实际导入由主代理统一完成。

provenance.json 保留源候选审查完成时的原始记录，晋升事实单独记于 promotion-manifest.json，不倒写历史审图证据。资源现已冻结；尚未编写导入 meta/UUID、修改 GameEntry/core 或启动 Cocos。
