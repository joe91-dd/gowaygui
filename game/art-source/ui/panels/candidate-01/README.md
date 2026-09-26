# 可着色九宫格面板 c01

沿本项目 `IslandUI.panel` 原有圆角、阴影、外金线与内奶油细线制作的原创 SVG 候选。没有下载素材、没有图片生成或修改其他源。本目录只交资产，尚未推广到 resources、没有写 meta 或修改 UI。

## 文件与来源

- `svg/*.svg`：18 个独立白色 alpha 蒙版，六种圆角 × 填充/外边/内细线，全部可编辑。内线单独一格是为了保留原有奶油色；若与外金线合成一个可着色蒙版，会丢失两种颜色。
- `panels-atlas.svg/png`：18 格共用一张 **512×1024 RGBA8** 图集，未压缩 GPU 纹理约 **2 MiB**。阴影直接复用 fill，不再增加纹理。
- `layout.json`：精确 rect、insets、颜色、尺寸、顺序；原点为图像左上角。
- `make-panels.cjs`：新建 SVG 与布局/预览源；`render-panels.cjs`：使用项目已有 sharp/librsvg 渲染并核对 alpha、白色 RGB、隔离间距和源格像素一致性。
- `review.html`、`review-original-size.png`、`review-small.png`、`review-comparison.png`：原尺寸、手机缩放与旧函数等效路径对照。全部是离线预览，不是实际 Cocos 截图。
- `inspection.json`：18 格像素检查、工具版本及所有源/图集/预览 SHA。预览文字仅用于评审，不进入运行图集。

渲染使用已捆绑 Node + 已有 **sharp / librsvg**，线程 2，未安装新软件、未使用 Blender。fontconfig 在无法写用户级缓存时发出提示；渲染退出 0，预览中文字已实际查看可读，没有通过安装字体解决。

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'game/art-source/ui/panels/candidate-01/make-panels.cjs'
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'game/art-source/ui/panels/candidate-01/render-panels.cjs'
```

## Cocos 3.8.8 接线建议

保留原有 panel 父 Node 的位置、`UITransform(w,h)`、名字、子文字位置、点击事件和 tween。仅替换它的 Graphics 背景。所有装饰节点放在文字/图标之前，四层按顺序连续创建：

1. 阴影：fill 蒙版，颜色 `#132D30`、alpha 90，位置 `(3,-5)`。
2. 填充：fill 蒙版，使用原调用的 hex 和 opacity。
3. 外金线：border 蒙版，`#B4874D`、alpha 255。
4. 内细线：highlight 蒙版，`#FFF2CF`、alpha 65。

这些是可着色白色 alpha 帧。通过 `Sprite.color` 传颜色，**不要为每个面板新建 Material/Texture2D**。同一 atlas、共享材质、相邻层有机会合批；不保证跨越 Label/其他纹理或 stencil 的组件也能合批。

纹理保持 LINEAR/LINEAR、mip NONE、CLAMP_TO_EDGE；SpriteFrame `packable=false`，使用 layout.rect、originalSize 128×128、offset 0、不旋转。所有 18 帧共享一张 Texture2D。`Sprite.type = Sprite.Type.SLICED`、`sizeMode=CUSTOM`、`trim=false`。每个圆角的四边 inset 相同，值见下表。不要临时修改全局共享帧的 inset 去适应某个实例。

图源按 **2 倍像素** 制作。每个装饰子 Node 设置 `UITransform` 为 `2*(w+4)` × `2*(h+4)`，local scale 为 `(0.5,0.5,1)`，anchor `(0.5,0.5)`。外扩 2 个逻辑像素是透明余量，不改变父 Node 的布局或触摸范围。白色填充可见范围正好 w×h，外线仍比原填充向外延伸 1px，内线仍距原填充边 5px。

```ts
// Illustrative wiring only; this candidate does not edit a production .ts file.
const framePart = part === 'shadow' ? 'fill' : part;
const frame = sharedFrames.get(`r${radius}-${framePart}`)!;
const node = new Node(`面板装饰:${part}`);
node.layer = parent.layer;
node.setParent(parent); // Create all decorations before existing text/icon children.
node.setPosition(part === 'shadow' ? 3 : 0, part === 'shadow' ? -5 : 0, 0);
node.setScale(0.5, 0.5, 1);
node.addComponent(UITransform).setContentSize(2 * (w + 4), 2 * (h + 4));
const sprite = node.addComponent(Sprite);
sprite.type = Sprite.Type.SLICED;
sprite.sizeMode = Sprite.SizeMode.CUSTOM;
sprite.trim = false;
sprite.spriteFrame = frame;
sprite.color = layerColor;
```

示例中的 shadow 应查询对应 fill 帧，不是额外名为 shadow 的帧。生产适配层应保存资源所有权：只加载一次 ImageAsset 并 addRef，一张 Texture2D 和 18 帧；清理一个面板只销毁它的节点，不释放共享 atlas；应用销毁时先解绑节点，再销毁共享帧/纹理，最后 ImageAsset.decRef。异步加载回调必须检查拥有者与目标 Node 是否仍有效。

本机 `cocos/2d/assembler/sprite/sliced.ts:120–139` 按帧 inset 布局。当目标尺寸小于左右/上下 inset 之和时会压缩两边，而不是保护圆角。因此不能拿大圆角帧硬套 34px 技能牌。

| 原逻辑圆角 | 每边 source inset | 典型用途 |
| --- | ---: | --- |
| 10 | 24 | 34px 高技能牌 |
| 14 | 32 | 小型提示的设计圆角 |
| 18 | 40 | 36px 高按钮、收录比较卡 |
| 21 | 46 | 42px 高返回按钮 |
| 22 | 48 | 44px 及以上普通按钮、战斗底栏 |
| 24 | 52 | 默认面板、卡片、主弹窗 |

这些尺寸都满足 `h >= 2*radius`。36px 高按钮的中心竖条可以为零，四角不会被挤扁。未枚举的动态圆角不要静默套最近值：普通 A/B 可先保持那一个特殊方向提示的旧实现；若要覆盖 `14/scale` 之类动态圆角，应新增明确变体或按整体装饰缩放并承认线宽也会缩放。不要改变父布局来补偿。

## 检查与边界

原尺寸与对照图使用真正按九区域切分的 SVG 模拟，边缘在整数尺寸下连续。首次 0.67 倍 SVG 嵌套视口产生裁切抗锯齿伪细线；这不是 PNG atlas 内的线，也不是 Cocos 实测。小尺寸阅读图改用与九宫格数学等价的完整连续圆角轮廓，并在图中标注。Cocos 的真实共享顶点、双线性采样与缩放接缝仍需根代理构建验收。

已核对每格 PNG 与 atlas 对应格逐通道相等，alpha 非零处 RGB 全白，透明外边与格间空隙无侵入。预览只证明源轮廓和尺寸方向，不宣称降低多少 FPS、draw 或内存。GFX Buffer 固定分配依据见 `docs/UI_RENDER_COST_REVIEW.md`。
