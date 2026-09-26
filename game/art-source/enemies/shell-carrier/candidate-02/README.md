# 搬壳大蟹 candidate-02

这是 c01 的唯一一轮贝壳圆润小修。主任务实际查看 c02 三分之四后认可圆边和浅褶，并授权晋升；当前已冻结为运行候选。查看 `review.html` 中的 c01 / c02 同角度对照；两张新图为 `render-three-quarter.png`、`render-battle-angle.png`。

已复制 FBX 与两张图集至 `game/assets/resources/models/enemies/shell-carrier`。预期资源路径为 `models/enemies/shell-carrier/shell-carrier/shell-carrier`，首个实际 Cocos 导入须确认该路径及 clip 名。建议配置 `scale: 1.0, height: 1.36, controlHeight: 1.26`；健康条在未缩放 actor 上，建议宽 `.80`。站立动作最高约 1.168273，足底 Y=0，沿现有道路 actor Y=.064 放置。动作位移与伤害仍由 core 驱动，退场 1.1 秒不要叠加占位模型缩小。

精确复制路径、三份 SHA、五动作、坐标及回滚说明见 `promotion-manifest.json`；晋升脚本为 `promote_runtime.py`。`asset-manifest.json` 与 `review.html` 保留晋升前候选记录，因此其“未晋升”状态及 README 哈希属于当时快照；当前状态以本段和 promotion manifest 为准。模型、图集与冻结源字节未因晋升改变。

仅替换可编辑部件 `Large_carried_fan_shell` 的几何与对应 UV：外缘采用前后壳面共享顶点的 6 段半椭圆圆弧边，原窄脊改为宽浅余弦褶皱。保留原扇贝总体轮廓，壳体包围盒逐轴误差为 0。其余 30 个部件的顶点、面、UV、权重、绑定、变换及材质槽完全一致；骨架与五个动作的关键帧、曲线和手柄完全一致。材质节点、灯光、曝光未改，两张图集与 c01 原字节相同。

15,088 三角、7,606 顶点、1 网格、1 材质、17 骨。比 c01 减少 596 三角：壳面从 4,420 变为 3,824 三角，采用规则圆边网格代替原自动倒角。原始宽 / 深 / 高为 `[1.358952, .835360, 1.157202]`，推荐 scale `1.0`，预期 Cocos 宽 / 高 / 深为 `[1.358952, 1.157202, .835360]`。不要叠加旧 elite 占位造型的 `1.3` 系数。

当前名称 / EnemyKind 仍为搬壳大蟹 / `elite`，外观小修没有新增机制。材质名 `ShellCarrier_Toy_Atlas`；内嵌图像 `ShellCarrier_Colour_512`、`ShellCarrier_Roughness_512`。512×512 不透明单图集，颜色 sRGB、粗糙度 Non-Color，非金属 F0 .04。

| 动作 | 源 take | 时长 |
| --- | --- | --- |
| idle | ShellCarrier_Rig\|idle | 2.8 秒 |
| walk | ShellCarrier_Rig\|walk | 1.0667 秒 |
| attack | ShellCarrier_Rig\|attack | 1.3 秒 |
| hit | ShellCarrier_Rig\|hit | .6 秒 |
| exit | ShellCarrier_Rig\|exit | 1.1 秒 |

idle / walk 循环，其余单次。Blender FBX 回导动作带双前缀，例如 `ShellCarrier_Rig|ShellCarrier_Rig|idle`；Cocos 子资产名称须待实际导入确认。本轮未生成或手写 .meta。

## 可编辑内容与检查

- `../../build_shell_carrier_candidate02.py`：独立脚本，从只读 c01 源加载，只替换贝壳网格。
- `shell-carrier.blend`：31 个可编辑部件、17 骨、五动作、两张内嵌图。
- `shell-carrier-review-scene.blend`：合并网格及与 c01 相同的工作室灯光。
- `shell-carrier.glb`、`export/shell-carrier.fbx`、`export/carrier-colour.png`、`export/carrier-roughness.png`：候选交换格式和图集。
- `round-trip-check.json`：真实 FBX 五动作共 417 个半帧样本检查。
- `source-check.json`：源内嵌图、31 部件、闭合流形、正体积、骨架绑定检查。
- `c01-comparison-check.json`：限定变更的逐项精确对比。
- `reference-preservation.json`：c01 所有文件与原生成脚本的原始 SHA 复核。
- `asset-manifest.json`：候选文件、生成脚本、内嵌图集字节及来源清单。

项目原创 c01 蟹类来源保持不变：项目自有快跑蟹 / 铁壳蟹的部分腿钳、球面眼、骨架与导出方法；此轮新增壳边曲面构造，无外部模型、贴图、动作或音乐素材。

## 重现

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/build_shell_carrier_candidate02.py
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/enemies/shell-carrier/candidate-02/verify_candidate.py
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' game/art-source/enemies/shell-carrier/candidate-02/package_candidate.py
```

两张新图均已实际查看。圆边高光与褶皱曲面过渡比 c01 更连续，仍保留扇贝外形和原有奶油放射纹。技术检查通过不等于最终美术验收。战斗角为匹配约 39.4° 俯仰的工作室近景，尚未检查 Cocos 中的全景可读性、遮挡、材质及实际性能。

本任务采用 2 CPU 线程、24 samples；构建渲染和独立检查均退出码 0，所启动 Blender 进程已全部退出。晋升阶段没有启动 Blender 或 Cocos，没有手写 meta、修改 core / view 或其他冻结资源；只在新的运行目录复制三份已核验资源。
