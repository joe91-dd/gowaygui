# UI 绘制与缓存的本机源码核查

2026-09-08，只读核查 Cocos Creator 3.8.8 及当前 `IslandUI.ts`。本报告不代表实际分配器采样或 FPS 对照，没有改引擎、生产 UI 或字体缓存。

## 最相关发现：Graphics 的固定 GPU Buffer

引擎根目录为 `C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine`。

- `cocos/2d/components/graphics.ts:629–647`：每个 Graphics 新 submodel 分配 `65535 * stride` 字节顶点缓冲，以及 `65535 * 2 * 2` 字节索引缓冲。
- 同文件 `:43–49`：格式为 `vfmtPosColor` 加一个 R32F；`cocos/2d/renderer/vertex-format.ts:49–52` 中 position 为 3×float32、color 为 4×float32，因此 stride 为 **32 bytes**。
- 每个 Graphics submodel 共 **2,359,260 bytes，约 2.25 MiB** GPU Buffer。18 个约 40.50 MiB。`graphics.ts:269–285` 销毁时销毁 model 与所持子网格，不应仅因弹窗打开时增量就判定泄漏。
- `game/assets/scripts/view/IslandUI.ts:17–23` 每调用 `panel` 都新建一个 Graphics；按钮 `:27–36` 和技能牌 `:55–56` 又各自调用 panel。每张卡内文字自身不是这个 2.25 MiB 分配的来源。
- 引擎 `graphics.ts:614–623` 还为 Graphics 取材质实例并用本地坐标绘制。当前卡底/文字交错的节点顺序也会影响合批。

弹窗从约 60→100 MiB 的 Buffer 增量，与新增约 18 个 Graphics 的分配量级吻合。**还没有逐对象 live capture，属于有直接分配代码支持的优先归因，不能写成已经测出的完整分配账本。** 后续 Sprite 九宫格 A/B 应同一存档、同一页面、相同开关步骤记录 Buffer、Texture、draw 与关闭后状态；不能用不同关卡截图的差值作严格对照。

## Label 当前路径及销毁

`IslandUI.ts:12–15` 使用系统字体 Microsoft YaHei，多字号/多颜色，24px 起加粗，所有标签设 SHRINK，没有设置 CacheMode。

| 本机源码 | 实际行为 |
| --- | --- |
| `cocos/2d/components/label.ts:826`、`:1062–1068` | 默认 CacheMode.NONE；每个普通标签拥有自己的 canvas/ImageAsset/Texture2D。NONE 不代表每帧无条件重绘，渲染数据仍有 dirty 控制。 |
| `cocos/2d/assembler/label/text-processing.ts:232–236` | SHRINK 计算拟合与换行，纹理宽高按 UI 控件宽高乘实际 fontScale 生成。大而空的标签也可能占较宽画布。 |
| `cocos/2d/components/label.ts:901–914`、`:927–940` | 标签销毁释放自己的 SpriteFrame、ImageAsset、Texture，并清 assembler/字形纹理引用。 |
| `cocos/2d/assembler/label/font-utils.ts:43–80`、`cocos/core/platform/macro.ts:1134` | canvas 复用池最大 20。它是 canvas 池，不等于 GFX Buffer 的 40 MiB 增量。 |

## BITMAP 与动态图集

不要只沿用 Label 注释中的“Chrome 关闭”描述。本机实际初始化在 `cocos/core/platform/macro.ts:1132–1146`：普通 Web 的 CLEANUP_IMAGE_CACHE=false，NATIVE/MINIGAME/RUNTIME_BASED 才默认改为 true；`cocos/2d/utils/dynamic-atlas/atlas-manager.ts:169–171` 设置 `enabled = !macro.CLEANUP_IMAGE_CACHE`。项目没有搜索到覆盖。当前普通 Web 默认开启，未来小游戏缺省不同。

BITMAP 将整句纹理送入 dynamic atlas（`ttfUtils.ts:209–219`），保留普通 TTF 的粗体/SHRINK。默认限制为每帧图片实际宽高不超过 512，图集 2048×2048，最多 5 张（`atlas-manager.ts:51–56`、`:189–197`；`sprite-frame.ts:1188`），采样器要求 LINEAR、无 mip。一个 RGBA8888 图集约 **16 MiB**，且原句纹理仍是 Label 所有。它可能减少纹理切换，但可能增加峰值纹理占用，不等于降低 Graphics Buffer。

动态图集删除成员时释放相关引用，空图集销毁，切场景 reset（`atlas-manager.ts:162–170`、`:222–227`、`:240–270`）。atlas 的排布游标没有在删除一个成员后压紧；反复生成不同内容不能假定始终复用同一小块位置（`atlas.ts:168–185`）。

## CHAR 的具体限制

- `letter-font.ts:30–42`：独立共享 1024×1024 字形 atlas；`font-utils.ts:232` RGBA8888，约 **4 MiB**，不依赖普通动态图集开关。
- `font-utils.ts:453–461`：字号、字体族、颜色、描边进入 hash，同一中文字的不同样式会分别占空间；不能假定五种颜色共用同一个字形。
- `letter-font.ts:32`、`:81–87`：该实现 `_isBold=false`，直接把全部 Label 改 CHAR 会改变现有大字粗体外观。
- `label.ts:159–162` 公开约束写明不支持 SHRINK。当前共享 BMFont 排版代码虽然存在缩放路径，也不能据此承诺全局替换的兼容性；需要明确固定字号的局部样本才有意义。
- `font-utils.ts:316–318` 图集满会警告 12100 并返回 null；`text-processing.ts:853–861` 记录占位后跳过，没有可靠整句纹理回退。可能出现新字缺失。
- atlas 的 FontAtlas 自身保留纹理引用（`bitmap-font.ts:61–72`），Label 只减自己的引用（`label.ts:945–953`）；不逐标签回收已写字形。场景启动时重新清 atlas（`font-utils.ts:390–400`）。系统本身没有该字形时，依旧受浏览器字体回退/缺字影响。
- CHAR 按字符生成多个 quad（`bmfontUtils.ts:136–149`），普通 TTF 是整句一个 quad；共享纹理并不意味着顶点总量也更小。

共享 atlas 只有在相邻提交、材质/纹理相关 hash、stencil 等一致时才可合批（`cocos/2d/renderer/batcher-2d.ts:429–466`）。卡底 Graphics 或其他纹理交错会中断，不保证几十个 Label 一次 draw。

## 本轮决定与验证边界

根代理决定先保留所有字体行为，**不做 CHAR 实验**。准备共享图集的可着色九宫格面板，优先替换高频 Graphics 卡底/按钮背景，保持布局、文案、交互不变。它针对的是已找到的 Buffer 固定分配路径，不以调字体来掩盖其他分配。

候选资产准备、源码算式与技术检查都不能代替 Cocos 实际画面或内存对照。本轮不承诺 FPS 提升、不宣称消除泄漏，也不调整字体、材质、相机或分辨率。
