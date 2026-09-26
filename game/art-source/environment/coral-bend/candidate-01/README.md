# 珊瑚转角 · 场景候选 01

状态：**离线源候选与布局提案，未晋升 runtime，未进行 Cocos 验收。** 主代理要求保留真实路线，并先离线评估第三、第五站位的小幅移动；本 FBX 使用提案位置，不能直接接入仍使用原坐标的游戏。

## 场景与路线

同 A / v04 / 教学岛的玩具海岛材质。沿 level 2 的真实弯折路线重建地形和连续沙路，没有叠放旧道路。3 株低椰树集中后景；海岸使用 13 簇枝状珊瑚、8 个厚壁杯状珊瑚、低岩石与浅湾阶层，避免高装饰挡住中央战斗。

真实 X/Z 路线：`(-9,0) → (-4,0) → (-2,2) → (2,2) → (3,-2) → (6,-2) → (9,0)`。路面 Y `.064`，入口 `(-9,.064,0)`，出口 `(9,.064,0)`，珍珠 `(9,1.10,0)`，站台锚点 Y `.292`。

最终道路使用单个无叠面的闭合轮廓：急弯内侧取精确偏移交点，外侧圆接，再明确三角化。最初窄圆角丝带出现黑缝的版本仅归档在 `iterations/before-road-union/`，不是交付版本。

## 站位提案与脚底支撑

当前运行石龟 c11，战斗 scale `.65`。实际近地脚/趾顶点共 2068 个，完整全朝向外包半径 `.974647`；仅地面附近 `.005` 原始单位以内的接触点，半径仍 `.887467`。因此不能靠削掉旧石台的临路侧保持完整龟脚支撑。

| 站位（从 1 起） | 原 X/Z | 候选 X/Z | 移动距离 | 新距路线 | 脚底净空 |
| --- | --- | --- | ---: | ---: | ---: |
| 1 | (-5.000,1.000) | (-5.000,1.000) | 0.0000 | 1.0000 | 0.0254 |
| 2 | (-1.000,1.000) | (-1.000,1.000) | 0.0000 | 1.0000 | 0.0254 |
| 3 | (3.000,1.000) | (3.395,1.099) | 0.4072 | 1.1348 | 0.1602 |
| 4 | (1.000,-3.000) | (1.000,-3.000) | 0.0000 | 2.2361 | 1.2614 |
| 5 | (6.000,-1.000) | (5.832,-0.748) | 0.3029 | 1.1349 | 0.1603 |

第三和第五站位候选距路线约 1.135，仍在主代理给定的近战阻挡半径 1.2 内。没有为了整条视觉沙路净空把站位推到近战之外。**原第四站位 `(1,-3)` 距路线 2.236，本就不在石龟 1.2 阻挡范围内；本轮未移动它，需主代理评估远程/辅助用途。**

五个石台改为连续、平整承托面，48 边形外接半径 .995、内切半径 0.992870；比完整脚底全朝向包络多 0.018222。对实际回导 FBX 做 `2068 点 × 36 朝向 × 5 台 = 372,240` 次支撑射线，未支撑点为 0。

`layout-comparison.svg` / `.png` 是从实际模型顶点生成的可编辑对照图，不是描摹或修改截图。`proposal.json` 保存原值与候选值；`stone-footprint-audit.json`、`foot-support-check.json` 保留详细尺寸与逐台结果。静态脚底支撑与全朝向分析不等于动作动画、敌我接触及攻击覆盖验收。

## 文件与验证

- `coral-bend.blend`：1,459 个独立可编辑网格、9 个锚点、2 张已打包图集。
- `coral-bend.fbx`：63,866 三角 / 3 网格组 / 2 材质，低于 80,000。
- `island-colour.png` / `island-roughness.png`：2048×1024，与 v04 原创图集相同。材质名 `Island_atlas`、`Warm_pearl_and_lamps`。
- `coral-bend-review-scene.blend`：独立的预览海水、灯光和相机，均不在 FBX 中。
- 实际回导 121 个路线样本，高程 0.0639992–0.0640020，高程异常/中央障碍均 0；五台锚点、UV、有限坐标、纹理尺寸、三角数与 bounds 均通过。
- 障碍检查排除入口门与终点核心，内部区间为 `-8.85 < X < 7.55`。
- 真实几何 X bounds `[-12.428243,12.484183]`，Y `[-1.869999,2.498575]`，Z `[-6.119803,5.856790]`，X/Z 总跨度 **24.912 × 11.977**。共用名义玩法占地 22×12，不把海岸外挑隐藏掉。

三张最终预览均为 **1000×700 / Cycles CPU / 2 线程 / 32 samples**，已经逐张实际查看：正战斗 `render-battle-overview.png`、俯视 `render-top-down.png`、珊瑚湾近景 `render-coral-inlet-detail.png`。正战斗镜头采用 GameEntry 的 1280/720 水平取景保持规则。

## 重现

```powershell
$blenderPath = 'tmp/tools/blender-4.5.13-windows-x64/blender.exe'
$candidateDir = 'game/art-source/environment/coral-bend/candidate-01'
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/build_coral_bend.py" -- --export-only
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/verify_coral_bend.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/check_editable_source.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/measure_stone_footprint.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/verify_foot_support.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/render_coral_views.py"
```

图表使用现有 bundled Node + sharp 运行 `render_layout_comparison.cjs`。记录生成器 `finalize_records.py` 仅在作者实际看过最后渲染之后运行。

## 待主代理审查

- 第三、第五站位坐标变更需主代理批准；随后一并处理关卡数据、恢复中的战斗存档、近战覆盖和实际角色交汇。当前 FBX 不能直接晋升。
- 拓宽的平整石台承托面比 v04 更整洁，装饰分块较淡；保留材料一致性，但不声称完成最终美术风格验收。
- 修正叠面后的沙路轮廓较规整，近景仍有平面边缘感，可在后续美术打磨时优化草地与沙路交界过渡。
- 岛岸模块仍有规则排列感，珊瑚弯湾属于首版构图。
- 薄叶、珊瑚杯内壁在实际 Cocos 的剔除/灯光/阴影与移动性能尚未检查。
- 动画脚底运动和近战敌我接触需运行检查；预览海水不代表游戏海水已完成。
- 没有修改 core、runtime、view 或共享 docs，没有启动 Cocos 或写 meta/UUID。

完整来源链、SHA-256、尺寸及剩余限制见 `provenance.json`。来源记录不构成绝对版权/法律风险保证。
