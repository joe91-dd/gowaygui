# 教学岛候选 01 · 初到龟岛

状态：**教学关独立三维场景首版，回导与坐标检查通过；主代理已审查三张预览，批准晋升为下一轮运行候选，实际 Cocos 检查待完成。** 已按批准范围复制 FBX 和两张图集到独立 resources 目录，没有修改任何 view / 玩法代码，也没有批量生成其他关卡。

## 场景与文件

- `tutorial-island.blend`：1,638 个独立可编辑网格，图集已打包。
- `tutorial-island.fbx`：导出候选，3 个网格组、2 个材质、66,670 个三角面，包含入口、5 站位、珍珠和出口锚点。
- `island-colour.png` / `island-roughness.png`：2048 × 1024 原创色彩/粗糙度图集，与已使用的 level 1 海岛 v04 图集 SHA 完全相同。
- `tutorial-island-review-scene.blend`：预览海水、灯光与相机；这些对象不在 FBX 中。
- `build_tutorial_island.py`：独立完整制造脚本，读取当前 `core/data.ts` 的 level 0 路线和共用五站位。
- `verify_tutorial_island.py`：在空场景实际重新导入候选 FBX 后核对路线、站位、UV、材质、三角数与 bounds。
- `check_editable_source.py`：重新打开可编辑 blend，核对未合并的零件与打包纹理。
- `render_tutorial_views.py`：仅渲染候选预览，不写运行资源。
- `environment-manifest.json` / `environment-round-trip.json` / `source-check.json` / `render-report.json`：构建、验证和渲染记录。

审查图片均为 **1000 × 700，Cycles CPU，2 线程，32 samples**：

1. `render-battle-overview.png`：正战斗镜头 `(0,15,18)`，看向 `(0,.2,0)`；使用 GameEntry 相同的宽高比补偿，保持 1280/720 设计水平取景。
2. `render-top-down.png`：正俯视，方便检查直路和五站位关系。
3. `render-sanctuary-detail.png`：终点贝壳核心近景。

## 与关卡数据的对应

路线从 `LEVELS[0]` 读取后重新生成完整沙路和依赖路线距离的草地地形，没有加载或贴放 level 1 的旧道路模型。

| 项目 | Cocos 世界坐标 |
| --- | --- |
| 路线 | `(-9,0) → (-4,0) → (0,0) → (4,0) → (9,0)`，格式为 X/Z |
| 路面 | Y = 0.064 |
| 站位 0 | `(-5, .292, 1)` |
| 站位 1 | `(-1, .292, 1)` |
| 站位 2 | `(3, .292, 1)` |
| 站位 3 | `(1, .292, -3)` |
| 站位 4 | `(6, .292, -1)` |
| 入口 | `(-9, .064, 0)` |
| 游戏终点 / 出口 | `(9, .064, 0)` |
| 珍珠中心 | `(9, 1.10, 0)`，与真实终点的 X/Z 一致 |
| 海面 | Y = -1.06，由运行时生成；FBX 不含海面 |

继续使用 v04 的名义 **22 × 12** 玩法占地和海岸模块。真实包含海岸岩石/泡沫外挑的总包围盒为 X `[-12.689,12.818]`、Z `[-6.563,6.163]`，即约 **25.51 × 12.73**；这不是声称几何严格限制在 22 × 12 内。正战斗预览已经检查，外围没有裁切。

## 教学场景的组成

- 一条左到右的短直沙路，入口石龟门、顶部小叶旗和终点贝壳核心形成两端标记。
- 4 株椰树集中在后景，避免从前景挡住站台与战斗区域。
- 40 簇灌木、2 座小灯；海星、小贝壳、珊瑚和浅滩岩石主要放在安静的海岸边。
- 五站台沿用同一材质/结构语言；中心可站立表面校准到 Y = .292。
- 与 v04 相同的 2 个图集材质，无额外下载模型、纹理或品牌元素。

## 已完成的技术验证

实际重导 FBX 后：

- 66,670 三角，低于 80,000；3 网格组、每组 1 材质，共 2 材质。
- 94 个路线中心采样，路面高度范围 `0.0639992–0.0640011`，高度异常为 0。
- 5 个站台锚点与真实坐标一致；实际表面射线命中 `0.2919998–0.2920008`。
- 路径中央装饰障碍为 0。障碍检查区间为 `-8.85 < X < 7.55`，入口和终点核心结构按用途排除。
- UV 有效、导入纹理尺寸正确、导出/回导 bounds 一致；FBX 内没有预览海面、相机或灯。
- 实际重新打开可编辑 blend，确认 1,638 个独立网格、两张打包图集、CPU 2 线程与 32 samples 设置，`source-check.json` 为 pass。
- FBX 导入会给重复使用的图集生成多个图像数据块名称，但导出物体仍只有 2 材质；渲染用 PNG 源文件只有两张。

FBX SHA-256：`82220891750c69f8c00a88f99ca27efcb45b136fb8dbcfd02066591b994ce843`。

## 重现

使用已经下载的官方 Blender 4.5.13 LTS，所有写入仅限本候选目录：

```powershell
$blenderPath = 'tmp/tools/blender-4.5.13-windows-x64/blender.exe'
$candidateDir = 'game/art-source/environment/tutorial-island/candidate-01'
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/build_tutorial_island.py" -- --export-only
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/verify_tutorial_island.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/check_editable_source.py"
& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/render_tutorial_views.py"
```

根代理负责资源加载和 Cocos 导入。不要依据 FBX 内局部数值直接把战斗角色挂到缩放的导入锚点下面；使用已校验的世界坐标及运行时原有坐标流程。没有手写 `.meta` 或伪造导入 UUID。

## 运行候选晋升记录

已将以下三份候选逐字节复制到新目录 `game/assets/resources/environment/tutorial-island/`，没有覆盖 level 1 的 `tidal-island` 目录。每份源文件与目标文件的字节数和 SHA-256 均一致；精确绝对路径与校验记录见 `promotion-manifest.json`。

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `tutorial-island.fbx` | 4,644,652 | `82220891750c69f8c00a88f99ca27efcb45b136fb8dbcfd02066591b994ce843` |
| `island-colour.png` | 2,719,387 | `f7b85a470c42c58a29bb778d8dc73408f06e4f323074faf7d3507b3f1e5e4881` |
| `island-roughness.png` | 39,919 | `2447da099d262a3afdbf84673ea4d3b66101d31071d00fa7b27abcd75116a480` |

- FBX 的 resources 基础路径：`environment/tutorial-island/tutorial-island`。
- 沿用 level 1 导入命名模式，预计 Prefab 加载路径：`environment/tutorial-island/tutorial-island/tutorial-island`。这是预期路径，尚未检查本文件的实际 Cocos 导入子资产结果。
- 图集路径：`environment/tutorial-island/island-colour`、`environment/tutorial-island/island-roughness`。
- FBX 材质名：`Island_atlas`、`Warm_pearl_and_lamps`，可沿用现有海岛相应材质绑定处理。
- 此次晋升仅包含资源复制和候选记录；没有启动 Cocos、生成 build、手写 meta / UUID，或更改加载、战斗及共享文档代码。

根代理下一步需检查实际导入、材质绑定、教学关显示和移动性能；这次晋升不是最终美术验收。

## 首版美术意见 / 尚未通过

- 已实际看正战斗、俯视和核心近景三张图，直路、五站位、终点核心清楚，前景没有高树挡住区域；核心近景保留了分瓣贝壳、边缘厚度与珍珠体积。
- 门上的欢迎叶旗在正战斗视角比较小，石龟门偏侧面；“欢迎”的细节表达仍可由主代理决定是否加强。
- 海岸砂带和等间距路边石仍有规则排列感；首版保留 v04 的材料/模块一致性，尚未单独做更精细的海岸雕琢。
- 植物包含薄叶片，实际 Cocos 背面剔除、灯光、阴影与移动设备表现尚未验证。
- Blender 预览海水使用独立预览材质，不能据此声称游戏中的海水效果已完成。
- 本轮仅交首版供审查，没有把几何检查通过等同于最终美术、玩法或移动性能通过。

制作来源为本项目原创 v04 模块及本次独立场景代码，来源链见 `provenance.json`；记录不构成绝对版权或法律风险保证。
