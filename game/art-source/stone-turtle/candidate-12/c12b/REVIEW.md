# c12b 冻结样板与技术交接

根代理已实际查看最终正面和三分之四渲染，授权完成技术检查后晋升为下一次 Cocos 检查的运行候选。造型现已冻结。本目录七张最终渲染均已由模型代理打开检查；没有把 Blender 图当作 Cocos 验证或用户最终美术验收。执行结果以本目录 `promotion-manifest.json` 和 `promotion-verification.json` 为准。

## 源文件与重建

- `stone-turtle.blend`：分部件可编辑网格、原十骨架和六动作，两张图集已打包。
- `stone-turtle-review-scene.blend`：合并 LOD 与摄影棚；`stone-turtle-keypose-review.blend`：动作检查摄影棚。
- `export/`：FBX、1024×1024 色彩图集和粗糙度图集。GLB 仅保存在源目录，运行 resources 中仍只有 FBX。
- `../../../build_stone_turtle_candidate12b.py`：完整生成脚本；输入是保留的 c11 可编辑源、几何/UV、固定噪声种子与图集参数。
- `../../../stone_turtle_atlas.py`：自有图集生成函数，**没有栅格图输入**。从 16 格调色板、噪声种子 4127、数学矿纹及虹膜/瞳孔 UV 方程全量重建两图；琥珀虹膜是显式参数 `(0.320, 0.207, 0.080)`。详见 `atlas-parameters.json`。
- `review_candidate12b.py`：回导、网格、动作、图集再生成与姿态渲染检查。

图集独立再生成结果与导出 PNG 逐字节一致；非眼格颜色像素和整个 roughness PNG 与 c11 一致。这里的像素比较是检查，不是生成流程。旧 c12b 快图与脚本已保存在 `../iterations/c12b-quick-review/`，原 c11 与 c12a 也保留。

根目录 canonical 源保持既有 v10 归档状态，遵循 c11 晋升约定。当前可编辑源和当前生成脚本由 `../../promotion-manifest.json` 指向本候选；不要用旧 canonical v10 生成脚本重建本版本。

## 造型范围

c11 头部外宽 1.209724 m、高 0.775032 m 保持，头/主壳宽度为 0.599406。短吻、饱满两颊及后脑由同一闭合头网格过渡；嘴垫参数宽约 0.856 m、高约 0.188 m，保留短微笑和两个鼻孔。非 head 部件的源顶点、面、UV、权重以及十骨架与六动作曲线与 c11 一致，壳腿未改。

眼球是嵌入脸部的连续球面，虹膜、瞳孔和高光位于同一 UV；没有独立平面虹膜或厚圆柱外圈。末次授权的小修只恢复下眼缘弧形暴露，未改变头外宽高。剩余审美问题是眼睑衔接仍偏硬、嘴垫脸颊比 A4 简化；按根代理要求先冻结，留给真实 Cocos 灯光与手机视距检查。

## 已完成检查

FBX 回导为 **28,572 三角形、15,342 归一化权重点、10 骨骼、1 材质、1 UV 层**。头源网格闭合流形，源 blend 两张纹理均打包。所有六动作存在真实加权顶点运动，首尾差为 0；半帧采样的最低高度仅有约 1e-7 m 浮点误差。动作数据见 `round-trip-check.json`。

| 动作 | 帧区间（30 fps） | 时长 | 播放建议 |
| --- | --- | --- | --- |
| idle | 1–72 | 2.367 秒 | 循环 |
| attack | 1–27 | 0.867 秒 | 单次 |
| skill | 1–42 | 1.367 秒 | 单次 |
| hit | 1–18 | 0.567 秒 | 单次 |
| rest | 1–72 | 2.367 秒 | 循环 |
| fusion | 1–60 | 1.967 秒 | 单次 |

攻击和受击共 88 个半帧 BVH 采样中，前脸与壳/前腿无交集。检查限定前方头部面，不把正常后脑/脖颈嵌接当错误；离散采样不能证明任意时间点绝无穿插。正面、三分之四、侧面，以及 attack 07 侧面、attack 11 三分之四、hit 04 侧面和三分之四共七图均已实看，未见眼睛脱离、前脸穿壳或明显穿地。

所有最终图为真实 3D 渲染，800×680、32 samples、固定 2 CPU 线程。生成和验证命令使用 `--background -t 2 --python-exit-code 1`，均退出 0；模型代理启动的渲染进程已结束。Blender 扩展缓存写入出现 Windows 权限提示，但不影响源文件、导出与检查产物，未请求系统权限或安装。

## 运行晋升与导入注意

`runtime_promotion.py promote` 备份旧运行 c11（包括三个原 .meta、三份资源和旧晋升 manifest）到 `../../versions/c11/`，再复制新 FBX 和全量重建图集。原 .meta 内容与 FBX UUID `5d7d68a1-9672-41e8-a0ad-05d7a87185f7` 在晋升时保持不变。脚本不启动 Cocos、不手造 importer 子资源 UUID。

运行加载路径仍是 `models/stone-turtle/stone-turtle/stone-turtle`；六 clip 名称及坐标沿用 c11。Blender 为 Z 上/-Y 前；FBX 为 Y 上/-Z 前导出约定，既有 Cocos 实例转换后预期 +Z 前。战斗缩放仍建议 0.65，脚底 Y=0。材质 `StoneAtlas_` 前缀及原生 Standard 适配沿用现有流程。首次构建需核对 Cocos 重新导入后的实际三角数、六 clip、两纹理与朝向；这些仍由根代理验证。

- 旧运行 c11 FBX SHA256：`9bc1cc37580ad3cb1c9fb57e2f54bf574fc7bac129befb1f7b08f60027d836a7`
- 新 c12b FBX SHA256：`fd2dee9cf539ac5e9b73cfb21cdcac1fede7f25ff60934f68e078d288357ac3c`
- 新颜色 PNG SHA256：`3af9be17175d22b860fe9b7b4bdd3e3ee5a9d02fbea191b3b3a1d885506893b7`
- 粗糙度 PNG SHA256：`8fb7f0157aebcd620a6f6535ef04d7307412aea09c553b64e1957335b8b52434`

`runtime_promotion.py verify` 校验冻结源、运行文件和 c11 备份。`rollback` 为显式回退命令，只有确认没有资源写入中的 Cocos 构建且需要回退时才使用；本次未执行回退。
