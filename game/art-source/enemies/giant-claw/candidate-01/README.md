# 巨钳蟹 c01 造型原型

当前仅为可编辑静态造型样板，不是运行敌人。没有骨架、五动作、FBX / GLB 导出或资源晋升。主任务查看初次预览后认可巨钳轮廓、脸型和家族材质方向，并授权两项局部修正：大钳指曲线与端口圆顺，以及正面摄影棚远端边线。两项均已完成，当前两张图已实际查看；待主任务审阅修正结果后，再安排骨架与五动作。

## 角色与设计来源

对应现有 `ENEMIES.boss` / 巨钳蟹：血量 2400、护甲 20、抗性 20、速度 .45、攻击 60、间隔 1.8 秒、范围 3、漏怪伤害 10。本原型只做外观，不改变规则，也不把大钳造型解释为新增投掷或范围技能。

主要识别来自真实不对称双钳：大钳掌宽约小钳的 1.96 倍，配合宽厚整体壳、八条短粗腿和宽软脸颊。两侧眉形略有高低差，延续项目自有蟹类的球面 UV 眼睛、奶油色钳指和圆润玩具材质。没有尖刺堆叠、王冠、文字装饰或其他游戏的角色参照。

几何、图集与参数为本项目制作。独立脚本复用本项目 `build_shell_carrier.py` 中的部分闭合网格、曲线截面和 UV 构造方法；巨钳、身体和脸采用新的尺寸与结构。风格只参考内部 A4、海岛及已审快跑蟹 / 铁壳蟹 / 搬壳大蟹。来源 SHA 在 `model-stats.json`，不引用外部模型、纹理、动作包或其他游戏素材。

## 源文件

- `../../build_giant_claw_prototype.py`：独立生成脚本，只写本候选目录。
- `giant-claw-prototype.blend`：36 个独立可编辑部件、单图集材质、两张打包图。
- `giant-claw-review-scene.blend`：上述部件及摄影棚灯光、相机。
- `textures/giant-colour.png`、`textures/giant-roughness.png`：512×512 单图集，材质 `GiantClaw_Toy_Atlas`；原色 sRGB，粗糙度 Non-Color，完全不透明。
- `model-stats.json`：实际网格统计、bounds、预期尺度、逐部件数据和来源哈希。
- `verify_prototype.py` / `source-check.json`：已实际只读打开两份 blend，核验拓扑、UV、内嵌图、无骨架动作，以及局部修正范围，结果通过。
- `package_prototype.py` / `asset-manifest.json`：最终图像、来源、文件哈希及静态样板范围记录。
- `iterations/before-finger-rounding`：第一次预览与对应生成脚本 / blend 原字节备份。

所有部件的 `planned_joint` 仅是未来关节分组提示，没有生成骨骼、权重或动作。本轮不验证攻击时的穿模、步行接缝、真实 FBX 轴向或引擎加载。

## 最终测量与验收边界

最终造型 21,208 三角、10,674 顶点、36 部件、1 模型材质，脚底 Blender Z=0，前方 -Y。宽 / 高 / 深约 `[2.443697, 1.276003, 1.357442]`，暂建议后续模型 scale `1.0`；宽约搬壳大蟹 c02 的 1.80 倍。

相较已审初次造型，两只大钳指增加 1,256 三角，用连续半径曲线、20 面截面和真实半球端帽消除折角；宽增加约 3.14 毫米、高增加约 2.88 毫米、深度不变。真实 blend 对比确认仅 `Dominant_fixed_round_finger` 与 `Dominant_moving_round_finger` 两网格变化，其余 34 部件的顶点、面、UV、关节提示和变换精确一致，两张内嵌图集原字节一致。

已实际查看修正后的三分之四和正面图。大钳、眼睛与宽脸没有明显相互遮挡，具有区别于普通和精英蟹的不对称外轮廓；大钳奶油指的曲线和端口更加连续，正面摄影棚远端直线已消除。没有追加提亮、改色或装饰。初次图和对应源仍完整保留在 iterations 目录。

正面镜头正对角色、约 9° 俯视，保留脚底和面部可见性。三分之四镜头与同系列摄影棚使用原有灯光和曝光。预览图不是 Cocos 战斗截图，手机俯视缩小后的可读性、路面遮挡和性能仍需实际接入验证。

重建使用 Blender `--background --factory-startup -t 2 --python-exit-code 1`，固定 2 CPU 线程、24 samples。与主任务构建、叶龟渲染串行执行。修正构建和独立源检查均退出码 0，所有本任务启动的 Blender 进程均已退出，未启动 Cocos。已读取的七份冻结蟹类源文件 SHA 均复核未变。

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_giant_claw_prototype.py
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/giant-claw/candidate-01/verify_prototype.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' game/art-source/enemies/giant-claw/candidate-01/package_prototype.py
```
