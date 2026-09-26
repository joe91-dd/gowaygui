# 五角色三维制作候选 · 2026-09-15

本目录按照用户确认的五角色 v2 三视图建立可继续编辑的 Blender 源文件、蒙皮与动作。**确认的是三视图，不代表这里的三维模型已通过造型验收。当前仍是制作中间版。**

## 基准与文件

原画基准位于 `output/character-turnarounds-20260915/01~05-*-turnaround-v2.png`。每个 `.blend` 内都打包了相应原画，仅作为隐藏参考，不作为角色图片面片。正面、背面的装备方向按三视图对齐。

|目录|角色|视觉基准|
|---|---|---|
|stone|岩盾|暖金皮肤、宽厚岩甲、蓝水晶，沉稳眉眼|
|spike|叶灵|松针绿、玉石绿、胡桃木弓，敏锐神情|
|crystal|珊歌|海蓝、象牙白法袍，平静眉眼与水浪杖|
|leaf|阳光|暖橙叶披风、草帽、铜提灯，亲和笑脸|
|bubble|潮行|靛蓝甲、淡紫肤色、紫晶杖，不对称俏皮眉眼|

每个角色目录：

- `<role>.blend`：分件可编辑模型、骨骼、约束、动作、隐藏原画。
- `<role>.glb`：蒙皮及动作导出，供其他三维工具查看。
- `<role>-studio.blend`：渲染场景与导出用简化模型。
- `manifest.json`：实际顶点、三角面、骨骼、动作与事件记录。
- `front.png`、`three-quarter.png`、`back.png`：实际模型渲染，不是概念图；重建后应一并刷新。

游戏用 FBX 在 `game/assets/resources/models-approved/<role>/<role>.fbx`。正式游戏仍使用原资产命名空间。只有 `?review=3d&cast=v2` 启用此候选。

## 已实现的制作基础

连续身体蒙皮、手指关节、眼睑关节、脚部 IK、分离的武器骨骼、提灯摆动骨骼与装备挂点。五只各含 14 段实际关节动画：待机、行走、三段普攻、施法、技能起手/循环/收招、受击、倒下、登场、左右转身。转向由游戏中的方向节点平滑处理，动作用交叉混合连接。

运行端采用新建的实时 `Animation` 驱动这些骨骼曲线，同时保持 `SkinnedMeshRenderer` 的真实蒙皮。导入预制体原有的烘焙动画组件停用，避免动画时间推进但关节节点不随之变化，导致武器挂点停留在原地。已通过实际关节位置采样复核三段普攻。

装备能量线条在武器的绑定坐标中生成，粗细也经过同一个单位变换，随骨骼运动并受三维深度遮挡。技能演示包括岩石风暴、箭雨、海霜、治疗与召唤。专精按钮目前是**视觉演示**；完整的专精条件、伤害与收益仍由正式战斗系统控制。

预览中的战场调用现有战斗核心，但使用独立的临时数据和展示参数，不写存档、不发奖励，不作为数值平衡验证。

## 当前未达到的要求

目前的脸部雕刻、手部轮廓、衣甲层次及材质细节仍与确认三视图有明显距离，不能标为商业成品或宣称一比一还原。还需要逐角色进行轮廓与五官对照、精修拓扑与权重、纹理/法线制作、动作接触与穿插修正，以及真机性能测试。

正式关卡批量替换应等造型相似度、手部持握、脚部接触、转身遮挡及技能可读性均通过视觉复核。当前保留独立预览，避免覆盖用户认可的原角色。

## 构建与验证

2026-09-15 岩盾单体精修另存于 `output/stone-blender-r02/stone-sculpt-r02.blend`，脚本为本目录 `refine_stone_sculpt.py`。按用户最新要求继续使用项目内 Blender 4.5.13。该研究稿未导出到游戏，完整状态见 `output/stone-blender-r02/制作状态.md`；不要将它与五角色既有 FBX 预览混为一版。

```powershell
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 2 --python-exit-code 1 --python 'game/art-source/approved-cast/build_cast.py' -- stone spike crystal leaf bubble
& './tmp/tools/blender-4.5.13-windows-x64/blender.exe' --background --threads 2 --python-exit-code 1 --python 'game/art-source/approved-cast/verify_cast.py'
& './game/tools/build-web.ps1' -ConfigName 'build-config.approved-cast.json'
```

`--quick` 只更新正面渲染，不能把旧的其他角度当作最新版交付。生成器会重建相应角色目录；开始手工雕刻前应另存版本，避免下次生成覆盖。

验证导出的 FBX 是否含正确蒙皮、武器挂点和有实际变化的 14 段动作；引擎构建检查另见 `game/temp/build-logs/latest-build.json`。这些技术检查通过不代表美术已达到原画标准。
