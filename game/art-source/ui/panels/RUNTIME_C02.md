# 当前面板接线：c02

当前资源仍为 `ui/panels/panels-atlas`，PNG SHA256 为 `79fe5dd948b2cfb703d94efe8239183c27ac895ede1db9206600adf88ca2c1e7`。

- 尺寸512×1536、单张RGBA8纹理约3 MiB、30个共享帧。
- 半径按图集行顺序为10、14、18、21、22、24、16、19、20、21.5；前六行保持c01原位，后四行补齐既有小按钮。
- `IslandPanels.preload(): Promise<boolean>`、`retry()`、`state`、`destroy()`接口不变。
- 四层Sprite保留填充、阴影、金线和奶油细线；父位置、尺寸、文字坐标、点击回调不变。
- 动态方向提示的非标准圆角，以及 `line/progress/modal` 中另外的 Graphics 绘制仍存在。不能把这次修改描述为完全移除 Graphics。

当前推广记录为 `runtime-promotion.json`。原 c01 记录完整保存在 `runtime-promotion-c01.json`，对应此前214818构建；不可拿当前c02资源重新验证并覆盖旧报告。

30格已完成SVG与RGBA技术检查，新增四圆角的离线对照已实际查看，10项面板回归通过。实际Cocos纹理采样、按钮点击和内存改善留给新构建验证。`RUNTIME_INTEGRATION.md`保留c01首次接线的记录，不再作为当前尺寸依据。
