# 原创图标接入原生 Cocos UI

状态：**20260908-141001已实际构建并运行；首页金币/体力/历史与详情四药/锁均显示，日志确认ready、8帧。** 图标加载失败后的文字界面不计作图标美术验收通过。实际窄窗口发现成长药瓶与锁按钮角稍近，已将四药统一右移28设计单位至x=-250并通过tsc；这项间距微调尚未进入上述构建，待下一构建复核。

## 资源方案

- 运行文件：`game/assets/resources/ui/island-icons.png`。
- `resources.load('ui/island-icons', ImageAsset, ...)` 加载一个 1024 × 512 RGBA 图集。
- 来源：`game/art-source/ui/icons/vector-01/icons-atlas.png`，逐字节复制已审查资源，没有改像素。
- SHA-256：`422cc6b40f689fcaebbb4a2fe2fd315ab9dfb27b7a15d485561b9102e34dd129`；185,233 字节。
- 一张 Texture2D、八个共享 SpriteFrame，4 列 × 2 行，每格 256 × 256。顺序与 `vector-01/layout.json` 一致。
- 显式 LINEAR 缩放、无 mip、CLAMP_TO_EDGE；不进入动态合图，避免对当前小图集重复分配纹理或修改帧坐标。
- 没有编造 `.meta` 或 UUID。新的 PNG、目录与 TypeScript 由主代理后续 Cocos 正常导入产生元数据。

## 接线位置

`IslandIcons.ts` 管理加载、切片与资源生命周期；`IslandUI.icon()` 创建普通 Cocos UI 节点和 Sprite；`IslandUI.button()` 新增可选 `icon` / `iconSize` 参数。

`GameEntry.ts`：

1. 初始化时创建并预加载 IslandIcons，再注入 IslandUI。
2. 非战斗页面顶部：金币 / 体力图标及两个独立文字 Label。为留出图标区域，原资源底板向左加宽 42 单位，右边界和补充体力按钮位置保持不变；30 秒资源刷新只更新两个 Label，不重建界面。
3. 首页“成长历史”入口：书册图标与原文字共存。原按钮中心、宽高、事件监听与动作不变。
4. 当前收藏伙伴详情：四种药在各对应属性行左侧显示；原属性文字、数值、培养价格、材料名称和数量保留。历史档案仍不可培养。
5. 当前收藏伙伴详情：“锁定伙伴 / 解锁伙伴”原按钮增加锁图标，动作与可点击范围不变。
6. GameEntry 销毁时先清理图标绑定，再清理自己创建的 UI 根节点与 UI 相机。对已进入销毁队列的节点使用 strict 有效性检查，避免重复操作。

没有修改 `BattleWorld.ts` 或 `BattleScreen.ts`；没有改玩法、存档、货币或培养规则。

## 生命周期

- 多个图标和重复预载共享同一次资源请求。
- 在资源回来前切屏：旧节点的 `NODE_DESTROYED` 监听移除等待绑定；即使节点刚调用 `destroy()`、尚未到帧尾，`isValid(node, true)` 也阻止迟到回调写入它。
- 新页面在等待期间加入的节点会使用同一张图集；加载完成后新节点同步绑定缓存帧。
- 所有者加载中销毁：回调不再创建纹理或帧，不持有新增 ImageAsset 引用。
- 所有者加载后销毁：先解除活跃 Sprite 的帧，再销毁八帧 / 纹理，最后 `decRef` 自己持有的一次 ImageAsset 引用。重复销毁不会重复释放。
- 资源错误、尺寸错误或部分分配失败进入明确 `failed` 状态，日志前缀 `[GOWAYGUI_UI_ICONS]`。图标保持禁用，原通俗文字持续可读；不会无限请求或把失败记录为成功。
- 成功资源准备日志也使用 `[GOWAYGUI_UI_ICONS]`，内容为 `state: ready`、尺寸、资源路径和 8 帧数量。这个日志仅表示加载成功，不代表最终视觉通过。

## 验证

`game/tests/island-icons.test.cjs`：9 项通过，包括单请求共享、整数格、切屏待销毁、实际销毁节点、所有者早销毁、重复释放保护、错误 / 错尺寸 / 分配中错误、同节点换图标，以及运行 PNG 与已审查 SHA 相同。测试通过 mock 验证时序和引用管理，不代替引擎实际 GPU / 导入测试。

已执行 Cocos 工程 `tsc --noEmit -p game/tsconfig.json`。没有启动 Cocos build。

主代理后续需统一构建，查看资源栏、四药、锁与历史按钮，确认图标上下顺序、边缘、缩放、文字间距和点击范围。HUD 图标 44、详情药 48、历史按钮 48、锁按钮 34 设计单位；后两种较小实际显示尺寸应在真实界面检查可辨识度。
