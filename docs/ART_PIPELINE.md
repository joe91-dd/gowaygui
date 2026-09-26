# 原创 3D 资产管线

## 当前范围与依据

当前角色只制作石头龟样板，供 Cocos 渲染、动画和风格验证。当前运行检查版本为 v10，尚未完成最终美术验收。旧 v07、v09 分别归档至 `game/art-source/stone-turtle/versions/v07/` 和 `versions/v09/`。另制作一张代表海岛，见 `docs/ENVIRONMENT_REVIEW.md`。没有开始五只批量建模，也没有宣称用户已通过美术验收。比例和玩具质感以 `output/art/A-潮汐玩具岛.png` 为准，A3 场景参考和 A4 三男两女角色图辅助确定五官。A4 中更大的头部不能反向替代 A 原图比例。

## 便携工具

- 工具：Blender 4.5.13 LTS，官方 Windows x64 ZIP，实际运行显示构建哈希 `daeeeca98fb0`。
- 下载源：https://download.blender.org/release/Blender4.5/blender-4.5.13-windows-x64.zip
- 校验源：https://download.blender.org/release/Blender4.5/blender-4.5.13.sha256
- 官方与本地 SHA256 均为 `b5fdf800ce65fa2f209e8f68d02667e4d720fa1c42f247c72d1882ab04decba6`。
- 可执行文件：`tmp/tools/blender-4.5.13-windows-x64/blender.exe`。
- 无系统安装、驱动、服务、默认程序修改。工具及下载包只放 `tmp/tools`，不加入 Git。

## 重建和验证

在工作区 PowerShell 执行：

```powershell
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 4 --factory-startup --python game/art-source/build_stone_turtle.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 2 --factory-startup --python game/art-source/verify_stone_turtle.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 3 --factory-startup --python game/art-source/render_stone_views.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 3 --factory-startup --python game/art-source/render_stone_poses.py
```

在第一条命令后追加 `-- --fast-review` 可只生成快速三分之四视角渲染。快速模式仍重建源模型与导出文件。第三、四条命令读取已有摄影棚工程，只渲染四视角或六动作关键姿态，不改写运行资产，可在 Cocos 导入期间安全检查。脚本及配置是本项目原创可编辑源文件，所有模型、贴图和关键帧均可从头重建。

默认生成命令现在重建 v10。`-- --fast-review --candidate-10` 只写独立 `game/art-source/stone-turtle/candidate-10/`；该目录保留本次晋升所用的冻结资产，未经后续任务要求不应重建覆盖。独立回导和动作渲染也支持 `-- --candidate-10`。`render_stone_comparison.py` 从归档的 `versions/v09/` 读取旧模型，与 v10 候选生成同棚并列图，避免晋升后错误比较两个 v10。`verify_stone_sources.py` 检查归档 v09、冻结 v10 与 canonical v10 已打包贴图，并将结果写入正式源目录的 `source-check.json`。需要历史 v09 造型时可显式传入 `--version-09`，但这会改写标准运行目录，不可在当前接入验证期间随意执行。

## 源文件与运行文件

| 文件 | 用途 |
| --- | --- |
| `game/art-source/build_stone_turtle.py` | 参数曲面、甲片、五官、UV 图集、骨骼和六动作重建源 |
| `game/art-source/stone-turtle/stone-turtle.blend` | 完整分件、UV、材质、骨骼、动作的可编辑源模型 |
| `game/art-source/stone-turtle/stone-turtle-review-scene.blend` | 与运行 LOD 对应的摄影棚灯光和相机工程 |
| `game/art-source/stone-turtle/render-*.png` | 真正模型的三分之四、正面、侧面和战斗俯视渲染 |
| `game/assets/resources/models/stone-turtle/stone-turtle.fbx` | Cocos 优先导入文件，包含蒙皮与六动作 |
| `game/art-source/stone-turtle/stone-turtle.glb` | 自包含的交叉校验与兼容备份格式；不放 resources，防止与 FBX 子资源路径冲突 |
| `game/assets/resources/models/stone-turtle/stone-colour.png` | 原创 1024×1024 色彩图集，图集生成算法在源脚本 |
| `game/assets/resources/models/stone-turtle/stone-roughness.png` | 独立粗糙度图集，石甲、皮肤和眼睛不同表面响应 |
| `game/art-source/stone-turtle/model-stats.json` | 当次生成的面数、骨骼、纹理、动作清单 |
| `game/art-source/stone-turtle/round-trip-check.json` | FBX 独立回导后，每一动作的实际网格移动量 |
| `game/art-source/stone-turtle/promotion-manifest.json` | v10 晋升记录、前后 FBX 哈希、原 UUID、已打包源工程校验与待审状态 |
| `game/art-source/stone-turtle/versions/v09/archive-manifest.json` | 晋升前完整 v09 源和 runtime 子目录的归档记录 |

## 建模与动画约定

头、颈、躯干和四肢使用单独设计的截面曲线构成闭合网格，石壳由圆顶基底、按曲面弧长排布的独立圆角石片与叠层下缘构成。眼睛、嘴线、眉毛、脚趾和腿部鳞片均为真实几何。不能把本源文件中的低层几何构造工具称为用户已通过的正式资产质量。

Blender 坐标为 Z 向上、面向 -Y；FBX 使用 Y 向上导出，实际 Cocos 导入几何的前方为 +Z。根位于地面，源单位为米。10 根命名骨骼：root、body、shell、neck、head、front_L、front_R、rear_L、rear_R、tail。动作：idle、attack、skill、hit、rest、fusion。idle 与 rest 是循环动作，其余为一次播放，运行时交叉淡入。

实际 Cocos 构建 `resources/config.json` 已核对的 Prefab 路径为 `models/stone-turtle/stone-turtle/stone-turtle`，以 `resources.load(path, Prefab)` 加载。六个导入动作名分别为 `StoneTurtle_Rig|idle`、`StoneTurtle_Rig|attack`、`StoneTurtle_Rig|skill`、`StoneTurtle_Rig|hit`、`StoneTurtle_Rig|rest`、`StoneTurtle_Rig|fusion`。不能把 glTF 备份的简短动作名误用于 FBX。完整动作加载路径为 `models/stone-turtle/stone-turtle/` 加上述动作名。Cocos meta 的默认 wrapMode 需要在运行时明确设置：idle/rest 循环，其余一次播放。

每个可见顶点都有蒙皮权重。FBX 回导检查会绑定正确的 Blender Action Slot，再检查每个动作是否真正使网格变形；不能仅根据文件里有动作名字判为成功。已发现并修复过局部骨骼坐标与世界移动方向混淆。运行时合并为一个网格、一个色彩图集材质；源工程保留完整分件。运行模型经过保留蒙皮的面数精简，实际面数以 JSON 为准。

## 来源与权利记录

几何、贴图像素算法、骨骼、关键帧及脚本由本项目制作，没有使用外部游戏、下载模型、图片贴图或第三方动画。设计依据是用户当前工程的 A/A3/A4 概念图，概念图由内置图像生成工具形成，其提示词和原图均保留。这样的来源记录不代表已经完成排他性版权、商标或整体近似性法律审查。

Blender 本身是制作工具，不作为游戏发行资产。程序化图集不是从别的图片修改而来。后续如加入购买或外部授权资源，必须新增逐项来源和许可记录。
