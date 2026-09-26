# 敌人样板源工程

当前只制作 `ink`「小墨团」单个隔离样板。`core/battle.ts` 从 `core/data.ts` 读取敌人定义；最基础敌人为小墨团（生命 120、移速 1），现有定义没有“寄居蟹”。本次没有改名、增加敌人类型或修改玩法。其他敌人和五龟不据此批量制作。

## 当前文件

当前改进样板产物位于 `ink-blob/candidate-02/`。`candidate-01/` 保留原版本，未覆盖；当前审查见 `ink-blob/candidate-02/REVIEW.md`。

- `ink-blob.blend`：分件模型、连续身体表面、UV、9 骨骼、5 动作，两张 PNG 均已打包。
- `ink-blob-review-scene.blend`：实际导出用的合并网格、同一骨骼和动作、摄影棚灯光与相机，贴图已打包。
- `export/ink-blob.fbx`：冻结的 Cocos 导入候选；candidate-02 已按根代理离线审查意见原字节复制到 `game/assets/resources/models/enemies/ink-blob/ink-blob.fbx`。未手造 importer UUID 或 metadata，尚待第一次 Cocos 构建核对。
- `export/ink-colour.png`、`export/ink-roughness.png`：512×512 原创图集。
- `ink-blob.glb`：辅助交换格式，仅保留在源目录，不与 FBX 同名放入运行资源。
- `render-close-up.png`、`render-front.png`、`render-battle-angle.png`：真实网格的近景、正面和俯视。
- `render-five-poses.png`、`ink-blob-poses.blend`：同棚呈现五个动作关键姿态的真实模型和可编辑场景。
- `render-island-battle-context.png`、`ink-blob-island-context.blend`：现有 levelId=1 海岛、石龟 v10 和小墨团的比例示意。是离线 Blender 渲染，不是 Cocos 运行截图。
- `model-stats.json`、`round-trip-check.json`、`source-check.json`、`context-manifest.json`：资源统计和证据。

## 重建与检查

在工作区根目录执行，使用已校验的官方 Blender 4.5.13 LTS 便携版。默认仅覆盖此敌人隔离候选，不修改石龟、海岛源或游戏视图。

```powershell
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --factory-startup --python-exit-code 1 --python game/art-source/enemies/build_ink_blob.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --factory-startup --python-exit-code 1 --python game/art-source/enemies/verify_ink_blob.py -- --candidate-dir game/art-source/enemies/ink-blob/candidate-02
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --factory-startup --python-exit-code 1 --python game/art-source/enemies/render_ink_review.py
& 'tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background -t 2 --factory-startup --python-exit-code 1 --python game/art-source/enemies/render_ink_review.py -- --context
```

生成器接受 `-- --no-render`，用于只重建源和导出。渲染器的 `--no-render` 会只保存相应可编辑评审场景。几何或材质改动后必须重新渲染；不能用旧图作新版本的美术证据。

生成器和渲染器默认写 candidate-02。`--candidate-01` 会选择历史目录，当前不应执行以免覆盖保留的历史证据。渲染显式限制为 2 个 CPU 线程并顺序执行，实际游戏性能采样前等待所有离线渲染退出。

## 原创来源

几何、拓扑、UV 图集、骨骼和关键帧均在本目录脚本中原创制作。依据项目 A 概念参考的圆润海岛玩具方向，没有提取其他游戏的模型、纹理或动作，没有将图片铺成图板充当模型。图集是可编辑的颜色/粗糙度分区；没有用表面噪点掩盖形体。项目既有概念图的最终商业权利审查仍属于发布准备，不能由这份制作记录替代。

本样板的剩余问题、导入约定和验证范围见 `ink-blob/REVIEW.md`。

## 运行候选晋升

`promote_ink_blob.py` 只读取冻结源、测量几何/动作、核对 FBX 内嵌 PNG 并复制运行 FBX，既不渲染也不启动 Cocos。完整来源、源和运行哈希、尺寸、动作和预期材质属性写入 `ink-blob/promotion-manifest.json`。它拒绝覆盖内容不同的已有运行目标，也不创建 `.meta`。首次导入后的资源路径、材质和 Take 名应以 Cocos 实际生成结果为准。
