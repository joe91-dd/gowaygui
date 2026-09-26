# 快跑蟹 candidate-01

**当前状态：根代理已审查三分之四、战斗角度、五姿和真实海岛尺度图，批准 c01 晋升为运行候选。眼柄与腿形保持本版。** FBX 与两张图已复制到独立新路径；尚未启动 Cocos，实际导入、移动与光照检查由根代理继续完成，最终美术仍未验收。

## 运行晋升与接入

运行目录为 `game/assets/resources/models/enemies/runner-crab/`，只有以下三个源文件由本次工具创建。没有手写 `.meta` 或 FBX 子资产 UUID；它们应由 Cocos 正常导入生成。

| 精确运行文件 | SHA-256 |
| --- | --- |
| game/assets/resources/models/enemies/runner-crab/runner-crab.fbx | `9a881e9afd4f168f9af8348b4da47e95faa2bc46ed9c8705a479f69e99e55e14` |
| game/assets/resources/models/enemies/runner-crab/runner-colour.png | `18c46e33630712ce34b94add1703e880799d279b4a1f35e10cc03bd2b5b9a72d` |
| game/assets/resources/models/enemies/runner-crab/runner-roughness.png | `c2ca32a47a37f2ec0c42a3c3548cbe30208d0fccf91d48a93cd40a1e67fff48c` |

预期 `resources.load` 预制体路径：**`models/enemies/runner-crab/runner-crab/runner-crab`**。这是按小墨团的目录/FBX 导入层级推导的路径，首次构建时须检查生成的 importer metadata，不能把它表述成已经在 Cocos 中加载成功。

材质适配筛选前缀：**`RunnerCrab_Toy_Atlas`**；源图名称前缀分别为 `RunnerCrab_Colour_` 和 `RunnerCrab_Roughness_`。Native Standard 继续使用现有流程：主图绑定 `mainTexture`，粗糙图绑定 `pbrMap` 并读取 G；roughness=1、metallic=0、occlusion=0、specularIntensity=.5、mainColor 白色、albedoScale=1。实际灰度为 87/107，Alpha=255。FBX 内嵌 PNG 与并列外部 PNG 都已证实字节一致，适配时优先使用导入材质已经绑定的图，避免错选同名资源。

建议模型等比 `.83`，未缩放 actor 上血条相对脚底 Y 可先设 `.95`；当前道路示例 Y=.064。动作前缀 `RunnerCrab_Rig|`。`exit` 长度 `.8` 秒，应播完再移除节点，并避免同时套用临时模型的程序缩小/下沉。

本候选 `promotion-manifest.json` 记录本次晋升、源哈希、目录与接入约定。`promote_runtime.py` 是纯 Python 复制/核验脚本，不调用 Blender/Cocos；对已存在但哈希不同的目标文件会拒绝覆盖。原 `asset-manifest.json` 和 `REVIEW.md` 保留晋升前的交付历史，其中“未写 runtime”及当时 README 哈希属于原始时点；当前状态以本段和晋升清单为准。源模型、图像与五动作未在晋升时修改。

## 候选设计

原创 3D 敌人审查候选，对应 `core/data.ts` 的 `runner / 快跑蟹`。规则中的基础血量为 80、移速 1.6、攻击 10、间隔 1 秒、近战范围 0.8、漏怪扣 1 点；本目录不改规则和运行视图。轻巧圆壳、橘珊瑚与奶油配色、八条细短腿、短圆钳与机灵的眼柄用于区别更耐打的小墨团以及后续的铁壳蟹。

所有模型、UV 图案、骨骼和动作由本项目独立脚本制作。只参考项目内部的 A4 五龟、真实海岛与小墨团 c02 的玩具质感，没有引入外部模型、照片、动画或素材包。完整的源文件记录不等于对最终产品所有权利风险作绝对保证。

## 源与资源

- `../../build_runner_crab.py`：独立生成脚本；不会执行或修改 `build_ink_blob.py`，输出固定在当前候选目录。
- `runner-crab.blend`：独立可编辑部件、UV、打包的两张图、16 骨和五个动作。
- `runner-crab-review-scene.blend`：合并后的实际运行网格，加仅用于审查的灯光、地面与摄影机。
- `export/runner-crab.fbx`：单网格、单材质的骨骼模型；没有背景平面或摄影机。
- `export/runner-colour.png`、`export/runner-roughness.png`：512×512 UV 色彩图与粗糙图；粗糙图按 Non-Color 处理，RGB 灰度、Alpha=1。
- `runner-crab.glb`：辅助交换格式；Cocos 候选入口是 FBX。
- `verify_and_review.py`：真实 FBX 重导入、逐半帧变形和打包源检查，另制作实际骨骼姿势的联系图与岛上尺度图。
- `iterations/first-pass/`：最初折线钳指的对照图、源和脚本快照，不是当前导出版本。

当前材质名为 `RunnerCrab_Toy_Atlas`，非金属；Principled Specular IOR Level=0.5 对应默认 F0=0.04，粗糙图约 0.34–0.42。眼白、虹膜、瞳孔和画出的两处小亮点属于同一个闭合椭球表面的 UV 图案，没有叠加瞳孔薄片。三维灯光仍提供真实高光。

## 导入约定

Blender 采用 Z-up、角色正面朝 -Y；FBX 导出使用 `axis_forward=-Z / axis_up=Y`，与小墨团的既有约定一致。预期 Cocos 运行正面为 +Z、脚底 Y=0；真实 Cocos 导入确认留给运行接入步骤，本候选没有启动 Cocos。

建议起始等比缩放 `.83`，高度约 `.775`、全宽约 `.886`，包括全部小腿；精确 bounds 以 `model-stats.json` 为准。这个比例优先满足 0.75–0.9 的运行高度，宽度略高于 0.8 的预估值。若必须严格宽 0.8，应重新调整源模型的横向展开，不应随意做非等比运行缩放。

一个运行网格、一个 UV 层、一个材质；当前统计以 `model-stats.json` 和重导入报告为准。16 骨包括 root/body、8 条腿、2 个钳臂、2 个活动钳指和 2 个眼柄。全部顶点有归一化权重，没有依赖物体替换来实现动作。

| 动作 | 预期 Cocos clip 名 | 帧范围 / 30 fps | 时长 | 播放方式 |
| --- | --- | --- | --- | --- |
| idle | RunnerCrab_Rig\|idle | 1–61 | 2.0 秒 | 循环 |
| walk | RunnerCrab_Rig\|walk | 1–13 | 0.4 秒 | 循环 |
| attack | RunnerCrab_Rig\|attack | 1–22 | 0.7 秒 | 单次，随后回待机/行走 |
| hit | RunnerCrab_Rig\|hit | 1–16 | 0.5 秒 | 单次 |
| exit | RunnerCrab_Rig\|exit | 1–25 | 0.8 秒 | 单次，随后移除 |

这是原地动作，路径移动由游戏视图根据核心状态处理；不含根节点平移。`attack` 在第 5 帧张钳蓄力、第 9 帧前探夹击；`hit` 是整体向后弹动；`exit` 先弹起再缩小撤场。Blender 的 FBX 重导入可能给动作显示名额外添加对象前缀，不能把这个显示名当作已经读取到的 Cocos clip 名。

## 重建与检查

从项目根目录顺序运行；每个渲染进程固定 2 CPU 线程，24 或 20 samples，上限低于 32。

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_runner_crab.py
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/runner-crab/candidate-01/verify_and_review.py
```

第二条追加 `-- --no-render` 可只验证 FBX 与源，不重新渲染。`round-trip-check.json` 检查每半帧的实际顶点运动、非有限值、地面穿透与循环接点；`source-check.json` 检查打包纹理、八条可编辑腿、闭合表面、朝外法线及源文件哈希不变。碰撞、灯光和审美仍需实际图片与后续游戏画面检查，数值通过不能替代这些验收。

审查图为 `render-front.png`、`render-three-quarter.png`、`render-battle-angle.png`、`render-five-poses.png`、`render-attack-side.png`、`render-island-battle-context.png`。岛上图使用真实海岛和石龟 c11 作为尺度参照，属于离线 Blender 合成场景，绝不是 Cocos 游戏截图。

本版已获准晋升 runtime 候选；没有改视图，实际接入与最终是否采用由根代理和用户的后续验收决定。
