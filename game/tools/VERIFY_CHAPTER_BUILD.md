# 实际构建验收

在 Cocos 明确完成当前 `game/build/web-mobile` 构建、资源推广和导入停止变动后，从仓库根目录运行：

```powershell
node game/tools/verify-chapter-build.cjs docs/reports/chapter-build-YYYYMMDD-HHMMSS.json
```

原入口 `docs/reports/verify-chapter-build.cjs` 仍然有效。两者使用同一实现，仅在全部检查通过后创建新报告；已有目标会在读取资源前拒绝，最终写入也使用 `wx`，不会覆盖历史证据。失败不会留下通过报告。报告中的时间由执行时生成；文件名中的构建编号由调用者使用实际构建记录指定，不能用名称证明构建完成。

验收范围：

- 保留实际构建核心的第五关坐标和主档/备份旧布局恢复检查，不使用共享 `.test-build`。
- 校验已登记模型的三份推广文件与批准源文件逐字节一致、SHA/大小正确，以及真实 FBX metadata 网格/材质/预制体/动作信息。
- 首页 c02 增加实际 library 预制体、三个 MeshRenderer 与 mesh/material UUID 引用、五个展示锚点、38,988 三角形、实际 mesh 二进制范围和本次构建 native 二进制一致性。检查具体预制体/网格/材质打包条目的根类型。
- 首页两张纹理及 UI 六张 PNG 校验 image/texture 已完成导入的 metadata、真实 library 对象/原生 PNG、当前 resources 登记、本次导入条目、原生 PNG 字节和 Texture2D 到正确 ImageAsset 的引用。
- 面板来源与尺寸读取 `game/art-source/ui/panels/runtime-promotion.json`，不固定候选目录或高度。c01 的 512×1024 与后续 c02 的 512×1536 都必须匹配各自当时的推广记录和构建原生图片。五头像仍要求已批准的 384×384 RGBA8。

`chapter-asset-proof.cjs` 按已安装 Creator 3.8 的 JSON 序列化格式读取普通/自定义根对象、共享 class/mask 合并包，以及同类 Texture2D/ImageAsset 合并包。它检查指定 UUID 对应的具体成员，不能用包内其他成员的类型字符串冒充成功。未知序列化格式会拒绝，不能退回编译字符串搜索。

这是导入与打包证据。它不创建引擎场景、不调用 `resources.load`、不显示资产，不证明首页可见、九宫格接缝、触控、销毁、帧率、音频或完整通关。这些必须由对应构建的实际浏览器/设备检查另行记录。

轻量校验：

```powershell
node --test game/tests/chapter-build-assets.test.cjs
```

测试使用隔离临时目录，不写任何真实 `.meta`、library、资源或历史报告。
