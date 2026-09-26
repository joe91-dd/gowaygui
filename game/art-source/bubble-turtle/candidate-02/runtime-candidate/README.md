# 泡泡龟 c02 独立运行候选

已完成自身 LOD、六动作、回导、贴图重建和离线图像检查；等待主线程接入与实际 Cocos 验证。未复制到 resources，未写 meta。

- 29,604 三角 / 15,346 顶点 / 10 骨 / 1 个不透明图集材质。
- 单网格源：bubble-turtle-runtime.blend；分部编辑源：bubble-turtle-lod-parts.blend。
- 导入候选为 export/bubble-turtle.fbx，另有 bubble-colour.png 与 bubble-roughness.png；FBX 内嵌两张 PNG 已按字节核对。
- 材质前缀 BubbleAtlas_，实际名 BubbleAtlas_01；Base Color 使用 colour，Roughness 使用 roughness。FBX 实际连接见 handoff-manifest.json。
- 建议 Cocos scale 0.65；脚底 Y=0；Blender -Y 面前/+Z 向上，FBX -Z/+Y 导出，预期 Cocos +Z 面前。
- 六动作逐半帧最高 scaledY = 1.113681；建议血条 1.29、控制标记 1.22。数值为 FBX 实际顶点采样，非连续时间数学上界。

|动作|秒|循环|实际 FBX Stack|
|---|---:|---|---|
|idle|2.366667|是|BubbleTurtle_Rig|idle|
|attack|0.866667|否|BubbleTurtle_Rig|attack|
|skill|1.366667|否|BubbleTurtle_Rig|skill|
|hit|0.566667|否|BubbleTurtle_Rig|hit|
|rest|2.366667|是|BubbleTurtle_Rig|rest|
|fusion|1.966667|否|BubbleTurtle_Rig|fusion|

所有原 c01/c02 高模和已审图片均保持原字节。LOD 蓝带/壳缘按原纵向环采样，保留全部圆顺截面与端帽；其他部位按独立比例减面。自身六动作由参数重建，不继续使用高模中继承的石龟动作。

复现顺序（从仓库根目录，Blender -b -t 2 --python-exit-code 1）：build_runtime_lod.py → review_runtime_lod.py -- --qa-only → inspect_export_payload.py → review_runtime_lod.py -- --render-only。先协调唯一 Blender 槽，实际开图后才运行 record_runtime_handoff.py。

确切路径、SHA、骨名、材质连接、姿态高度和剩余观感事项见 handoff-manifest.json。
