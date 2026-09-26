# 潮汐小径代表海岛审查

当前版本：`tidal-island-sample-04`。这是可接入 Cocos 的第一张真实 3D 场景样板；未获得用户最终美术认可，未完成手机性能验收，也没有据此批量制作多张地图。

## 设计依据和内容

以原 A《潮汐玩具岛》的温暖石材、哑光玩具质感、草岛与海岸层次为依据。岛屿约 23.6×11.5 世界单位，包含连续起伏草地、实际砂路、砂岸与三层石崖、入口石龟拱门、出口贝壳与珍珠、五座石布阵台、棕榈、灌草、珊瑚、石灯、海星和近岸泡沫。

源工程保留独立可编辑物件。地形使用连续网格；拱门由有厚度的石拱块构成，贝壳有凹形下瓣和带厚度的放射上瓣；棕榈有弯曲树干、叶脉和弯曲叶片。没有将渲染图当作场景图板，也没有下载外部游戏模型或贴图。

## 路线和放置约定

路线和站位直接读取 `game/assets/scripts/core/data.ts` 的第 1 普通关“潮汐小径”。只平滑视觉道路拐角，并把路面延伸到门内和贝壳台下；不改变游戏导航数据。

路线的 `(x,z)` 依次为 `(-9,0) → (-4,0) → (-1,-2) → (3,-2) → (5,0) → (9,0)`。源 Blender 坐标为 `(x,-z,y)`，导入 Cocos 后恢复 Y 向上。Prefab 根应保持位置零、旋转零、缩放一。

| 导入锚点 | Cocos 世界坐标 x / y / z | 用途 |
| --- | --- | --- |
| `Slot_0` | -5 / 0.292 / 1 | 第 1 站位脚底 |
| `Slot_1` | -1 / 0.292 / 1 | 第 2 站位脚底 |
| `Slot_2` | 3 / 0.292 / 1 | 第 3 站位脚底 |
| `Slot_3` | 1 / 0.292 / -3 | 第 4 站位脚底 |
| `Slot_4` | 6 / 0.292 / -1 | 第 5 站位脚底 |
| `Enemy_entrance` | -9 / 0.064 / 0 | 敌人出现位置 |
| `Player_exit` | 9 / 0.064 / 0 | 游戏终点 |
| `Pearl_center` | 9.45 / 1.10 / -0.05 | 珍珠表现与特效中心 |
| `Island_origin` | 0 / 0 / 0 | 岛屿原点 |

路面中心高度为 0.064；海水高度建议 -1.06。五座石台最外半径约 0.96。Cocos 导入的 FBX 子节点可能带轴旋转和 100 倍局部缩放，这是导入器的单位转换；其世界坐标已经正确。角色应取锚点的世界位置，避免直接挂到锚点下继承其缩放和旋转。

## 资产与统计

| 文件 | 用途 |
| --- | --- |
| `game/art-source/environment/build_tidal_island.py` | 原创建模、布局、UV、图集和导出脚本 |
| `game/art-source/environment/tidal-island.blend` | 完整分件可编辑源工程 |
| `game/art-source/environment/tidal-island-review-scene.blend` | 对应运行网格的真实灯光与相机工程 |
| `game/art-source/environment/tidal-island.glb` | 兼容与交叉检查备份，不在 resources 中 |
| `game/art-source/environment/environment-manifest.json` | 路线、站位、数据来源哈希、面数和 FBX 哈希 |
| `game/art-source/environment/environment-round-trip.json` | 实际 FBX 回导和路径射线检查 |
| `game/assets/resources/environment/tidal-island/tidal-island.fbx` | 运行模型，3 个合并网格及命名空锚点 |
| `game/assets/resources/environment/tidal-island/island-colour.png` | 原创 2048×1024 色彩图集 |
| `game/assets/resources/environment/tidal-island/island-roughness.png` | 原创 2048×1024 粗糙度图集 |

运行总计 78,370 三角、50,650 顶点、2 个材质、3 个静态网格。每个网格单材质，不使用透明排序或图片切片植物。纯不透明主渲染预计 3 次绘制；阴影、其他角色、水面、特效和 UI 的额外绘制不包括在此数内。

| 运行网格 | 三角数 | 顶点数 | 材质 |
| --- | --- | --- | --- |
| `Ground` | 8,388 | 4,738 | `Island_atlas` |
| `Landmarks_and_nature` | 67,934 | 44,808 | `Island_atlas` |
| `Pearl_and_lamps` | 2,048 | 1,104 | `Warm_pearl_and_lamps` |

本次 FBX SHA256：`c8046dbc11fadc038259c02b28d8d6c426aeaa4e84b3d4de60411f3622b40e5e`。

## 已有检查与接入说明

- 对实际 FBX 做独立空场景回导，确认 3 网格、2 材质、UV 完整、9 个命名锚点的坐标和预览水面未混入运行模型。
- 对游戏路线作 73 次竖直射线检查，实测路面高度 0.063503～0.064001，路径中央没有静态道具阻挡。检查覆盖中心线，不能替代敌人宽度、特效遮挡或手机点击范围验证。
- Cocos 已生成 `tidal-island.fbx.meta`，UUID 为 `ec4d9a65-3b4d-4573-97bd-13bf72e8e174`；场景子资源为 `@5da7f`。直接读取 `game/library/ec/…@5da7f.json`，五个站位和珍珠坐标与清单吻合。
- 实际 `game/build/web-mobile/assets/resources/config.json` 已核实 `resources.load` 的 Prefab 路径为 `environment/tidal-island/tidal-island/tidal-island`。
- 世界水面只在 Blender 预览中，名为 `PREVIEW_ONLY_OCEAN`，不在 FBX。Cocos 应创建动态海水；不能把预览图当作水面实现。
- 草、棕榈等叶片使用薄曲面。Cocos 当前导入材质没有显式背面剔除覆盖，需要在真实视角中检查；如有缺叶，应为环境材质启用双面渲染或进一步给叶片补厚度。
- FBX 导入器为两个材质生成了各自的嵌入纹理资源。移动端验收需核对实际纹理驻留、压缩、复用和重复资源，不能根据 PNG 文件大小推断显存。

## 实际渲染与改进记录

已实际查看 `render-battle-overview.png`。早期发现草地与石岸之间存在间隙、棕榈过细、海岸边缘像规则花坛，现已封闭地形边缘、增加树叶宽度、改变砂岸过渡和顶部岩石分布。v04 修正了终点恰好落在道路边界时射线漏掉道路的问题。

代表全景的道路、五台和入口/出口可以区分。仍需在 Cocos 灯光与手机实际画幅下检查植被层次、岛岸自然程度、站位大小、阴影和材质明暗。当前地图的细节密度和原 A 概念图还有差距，不能将“有真实模型”视为已达到发行美术品质。

俯视、贝壳和拱门近景已使用 `render_tidal_views.py` 生成并实际查看，只读取既有工程，不改写运行资产。俯视确认路面与五个站位可区分；近景还暴露拱门龟脸表达较直白、局部棕榈叶根连接不够自然的问题，后续需结合 Cocos 实景改进。所有渲染均来自同一真实 3D 场景。

## 重建与验证

在工作区 PowerShell 执行：

```powershell
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 3 --factory-startup --python-exit-code 1 --python game/art-source/environment/build_tidal_island.py -- --fast-review
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 2 --factory-startup --python-exit-code 1 --python game/art-source/environment/verify_tidal_island.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 3 --factory-startup --python-exit-code 1 --python game/art-source/environment/render_tidal_views.py
```

去掉第一条中的 `-- --fast-review` 会生成更多高采样预览。重建会重新写入运行 FBX 和图集，保留 `.meta`；接入时应协调导入时机。来源均为本项目原创程序化几何、像素算法及布局，没有引入外部授权素材；这不等于完成游戏名称、整体相似性或其他法律审查。
