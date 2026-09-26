# 石龟 candidate-11：独立造型候选

根代理已审查三分之四、战斗、攻击侧面和受击图，并授权晋升为运行候选；仍不代表最终美术或用户验收通过。当前 runtime 使用 c11；v10 运行 FBX、原纹理及全部 meta 已备份至 `../versions/v10/runtime/`。canonical 生成脚本和 canonical Blender 源仍为 v10，未修改。晋升、哈希和回滚入口见 `RUNTIME_PROMOTION.md`。

集中查看入口：`review.html`；完成后的逐图判断与技术结论：`MANUAL_REVIEW.md`。全部渲染已退出。侧面面盘感仍是待根代理判断的审美余量。

## 本轮改变

- 头脸横向加宽，短吻收至约 y=-1.552，颈根仍接合原骨骼；反馈后脸高再增加 15%，眼球本身不随脸高拉伸。
- 眼白沿用真实椭球体，虹膜、瞳孔和小高光直接写入该眼球 UV 的 tile 9，没有新增叠加的虹膜或瞳孔网格。深色区约扩大 1.3 倍，保留窄白眼缘。
- 浅色宽眉梁和眼睑使用独立面部 tile 12，脸色 RGB=(.77,.73,.565)；身体、腿和光源亮度没有随之提亮。
- 主壳由 32 片增加到 48 片，另保留 18 片下摆；盖面深度范围改为 .043–.059，浅缝底色独立调整。
- 原 10 骨架、6 动作名称/帧范围、FBX 导出轴约定保留。导出合并为一个材质；源 Blender 保留可编辑部件。

## 文件与重建

- `../../build_stone_turtle_candidate11.py`：实际独立生成脚本，输出硬限制在当前目录；不调用 canonical 脚本，不向 runtime 写资源。
- `stone-turtle.blend`：独立可编辑部件、骨骼、UV、打包纹理和六动作。
- `stone-turtle-review-scene.blend`：实际运行 LOD 加摄影机、灯光。
- `export/stone-turtle.fbx`、`export/stone-colour.png`、`export/stone-roughness.png`：已获准晋升的导出候选；runtime 与这些文件逐字节一致。
- `stone-turtle.glb`：可交换的辅助预览格式。
- `render-front.png`、`render-three-quarter.png`、`render-battle.png`：最终候选三视图。
- `v10-control-*.png`、`v10-matched-review-scene.blend`：对 v10 应用候选的同一摄影机、灯光、地面与色彩管理后生成的对照，不改 v10 源。
- `animation-*.png`：攻击和受击关键帧，包含侧面检查。
- `review_candidate11.py`：重复生成 v10 对照、半帧几何检查、FBX 重导入与动作证据。
- `iterations/`：较早候选图和源快照，避免与最终图混淆。

从项目根目录运行：

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/build_stone_turtle_candidate11.py
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python game/art-source/stone-turtle/candidate-11/review_candidate11.py
```

两条命令依次执行。代码内固定最多 2 个渲染线程，避免和游戏性能采样争用过多 CPU。快速正面检查可在第一条末尾加 `-- --fast-review --front-only`，但该方式会覆盖当前候选导出和正面图，不能与最终三视图混作同一轮证据。

## 测量与技术验收说明

初始最终几何统计：头宽 1.209724、深 .600732、高 .775032；头/主壳=.599406，头/含下摆壳=.569629，头/含脚全宽=.538267，头宽高比=1.56087。运行导出为 22,986 三角形、12,581 顶点、1 材质、10 骨。精确统计以 `model-stats.json` / `proportion-stats.json` 和重导入检查文件为准。

这些是静止几何的 X/Y/Z 范围，不是图像的自动分割结果。A4 是角色参考，并非正交蓝图；同灯光图片用于比较形状、脸色和表情，不代表 Blender 和 Cocos 的渲染会完全相同。

`matched-lighting.json` 记录实际灯光、相机、AgX/曝光、地面和采样设置。正式静态对照使用 1000×850、32 次采样上限、降噪、自适应采样；动作诊断使用更小分辨率，不能当作材质细节最终图。

`animation-clearance.json` 以每半帧的 BVH 重叠候选检查攻击/受击的前脸与龟壳、前腿；排除刻意嵌入的后脑/颈根，不把连接处重叠误报为脸部穿模。BVH 数值只是定位疑点，须结合关键帧图片；这不是连续时间碰撞证明。`round-trip-check.json` 另检查导出的皮肤权重、单 UV/材质、六动作运动、首尾衔接和地面最低点。

`review-complete.json` 与 `protected-inputs.json` 保留候选生成时的原始技术证据，记录晋升之前的 v10 运行哈希；没有改写这些历史记录。随后实际图片审查见 `MANUAL_REVIEW.md`，获准晋升及当前运行资源状态以 `promotion-manifest.json` 为准。`verify_files.py` 在晋升后对照 v10 归档校验历史运行哈希，并另外校验当前 c11 运行哈希；canonical 源仍必须保持原样。Cocos 实际画面与最终美术验收仍须单独完成。
