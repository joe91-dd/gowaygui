# Art / UI V2 素材来源与状态

正式视觉依据来自用户确认的 00–13 参考图，项目内原图位于 `docs/art-v2/references`。图 09 只作为功能基线。

`login`、`home`、`arena`、`fusion`、`heroes`、`ui`、`skills`、`shop`、`logo`、`quality` 保存本轮 ImageGen 提示词、结果信息及相关源图。实际使用的独立素材位于 `game/assets/resources/art-v2`，没有覆盖旧资源路径。

SpriteFrame 切片坐标由源图尺寸测量得出，运行时创建；没有把整张带文字的界面参考图作为不可编辑的 UI 使用。角色立绘保持透明背景，文本、资源数量、品质边框、点击区域由游戏界面分别绘制。

## 未采用的 3D 候选

`build_cast.py`、`models`、`first-model-export` 和 `runtime-model-candidates` 是本轮可回退的站立模型试制文件。**这些模型没有通过与 04 正式角色设定的质量对照，不是正式运行素材。** 保留源工程、纹理与导出，供后续继续修正。生成器默认也只写入该源文件区域。

当前战斗仍加载旧的真实 3D 模型；主页面的站立形象是单独的透明立绘。不得把立绘替换完成解释为正式 3D 模型、骨骼动画或战斗场景已经完成。
