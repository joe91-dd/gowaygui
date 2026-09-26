# 搬壳大蟹 candidate-01

单一源候选，未晋升运行资源、未启动 Cocos，未改 core / view / 其他冻结模型。两图入口为 `review.html`，实际观察见 `REVIEW.md`，FBX 与源检查见 `round-trip-check.json` / `source-check.json`。

## 角色与轮廓

沿用当前 `core/data.ts` 的 EnemyKind `elite` / 搬壳大蟹：血量 900、护甲 25、抗性 25、速度 .6、攻击 40、间隔 1.5 秒、近战范围 .9、漏怪伤害 3。背负贝壳是外观设定，没有新增投掷、格挡、反伤或新种类。

暖红蟹身、八条圆润短腿和收拢双钳，背负一枚桃色与奶油色的放射纹大贝壳。壳是前后面封合的真实厚实体，边缘带圆角，独立 `carried_shell` 骨骼产生轻微负重摇摆；没有用透明层或图片冒充壳。相较铁壳蟹，轮廓重点由低矮甲片转为高出的单枚贝壳；相较快跑蟹，步伐更慢、体量更稳。没有制作首领式巨钳。

## 实际参数

15,684 三角、7,904 顶点、1 运行网格、1 UV、1 材质、17 骨、8 条腿。本候选将几何预算限定为 16,000；初次壳面采样产生 16,624 三角而中止导出，之后只减少壳面内部采样至 15,684，保留圆边和主要放射纹。初次预算日志保留，不作为成功验收证据。

原始宽 / 深 / 高为 `[1.358952, .835360, 1.157202]`。建议模型等比 scale=`1.0`；预期 Cocos 宽 / 高 / 长为 `[1.358952, 1.157202, .835360]`。宽度约比当前 `.90` 铁壳蟹大 11%，贝壳带来额外高度。不要叠加旧占位 elite 的 `1.3` 放大系数；实际与首领的尺寸关系在首领模型完成及游戏接入后再核验。

Blender Z-up、前方 -Y；FBX `axis_forward=-Z / axis_up=Y`，沿用已审敌人的轴向约定，预期 Cocos 正面 +Z、脚底 Y=0。动作原地播放，位移和命中仍由现有战斗逻辑控制。本轮没有实际 importer、材质、性能或全景战斗验收。

材质名 `ShellCarrier_Toy_Atlas`，图像前缀 `ShellCarrier_Colour_` / `ShellCarrier_Roughness_`。512×512 RGBA，Alpha=1；原色按 sRGB，粗糙图按 Non-Color 灰度 .38–.45。非金属 F0=.04，不使用透明度、透射或外部贴图。

| 动作 | 预期名称 | 帧 / 30 fps | 时长 |
| --- | --- | --- | --- |
| idle | ShellCarrier_Rig\|idle | 1–85 | 2.8 秒 |
| walk | ShellCarrier_Rig\|walk | 1–33 | 1.0667 秒 |
| attack | ShellCarrier_Rig\|attack | 1–40 | 1.3 秒 |
| hit | ShellCarrier_Rig\|hit | 1–19 | .6 秒 |
| exit | ShellCarrier_Rig\|exit | 1–34 | 1.1 秒 |

idle / walk 循环，其余单次。walk 有交错步伐和壳的轻晃；attack 是双钳蓄势夹击；hit 为小幅回弹；exit 缩小退场。这里只建立五动作框架，没有写入伤害或新机制。

## 可编辑源与来源

- `../../build_shell_carrier.py`：独立生成脚本，仅写本候选目录。
- `shell-carrier.blend`：可编辑部件、骨架、五动作和两张内嵌图。
- `shell-carrier-review-scene.blend`：合并后的导出网格与工作室灯光。
- `shell-carrier.glb`：辅助交换格式。
- `export/shell-carrier.fbx`、`export/carrier-colour.png`、`export/carrier-roughness.png`：尚未晋升的导出候选。
- `verify_candidate.py`、`package_candidate.py`：真实回导和源打包检查。

项目自有的快跑蟹 / 铁壳蟹提供闭合几何、腿钳与眼部构造、UV、骨架和导出方法。此版重做裸露蟹身、独立放射纹贝壳、曲线生成、暖色图集和负重时序；未修改参考源。A 方向仅用作内部视觉参考，没有外部模型、纹理或动作包。参考源的原始 SHA-256 保存在 `model-stats.json`，最终检查在 `reference-preservation.json`。

## 重建与验收边界

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_shell_carrier.py
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/shell-carrier/candidate-01/verify_candidate.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' game/art-source/enemies/shell-carrier/candidate-01/package_candidate.py
```

渲染固定 2 CPU 线程、24 samples。三分之四为近景造型图；战斗角图匹配当前战斗相机约 39.4° 俯仰，采用工作室正交放大构图，便于查看脸和贝壳，不是 Cocos 截图或实际全景尺寸证明。实际回导五动作按半帧采样，共 417 个样本；技术检查不代表最终美术接受。
