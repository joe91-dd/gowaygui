# 五龟头像资源与运行管理器

2026-09-08：根代理实际查看五张 384px 图后批准此候选。头像来自冻结的石头 c12b、刺刺 c02、水晶 c02、叶子 c04 runtime、泡泡 c02 runtime 的真实单网格/骨架；相同 idle 第 1 帧、镜头和灯光渲染。十张图由作者逐张打开，35 个角色源/运行文件前后 SHA 相等，原角色文件未修改。

源目录：`game/art-source/ui/portraits/candidate-01`，含五个可编辑 portrait-scene.blend、生成/检查脚本、PNG、技术与审图记录、27 文件 source-freeze。后续推广清单是独立补充，不覆盖原冻结记录。

## 实际推广

已按根代理授权逐字节复制以下五张图，没有转换 alpha、重采样或写 meta；没有复制 64px 审查图。总文件大小 **731,105 bytes**。每张为 **384×384、8-bit RGBA PNG、透明背景**，无 mip 的五张 RGBA8 GPU 纹理原始占用合计约 **2.8125 MiB**，不含引擎对象开销。

| Role | 实际资源路径（ImageAsset） | SHA-256 |
| --- | --- | --- |
| stone | `ui/portraits/portrait-stone` | `4fc832d4852a2864da1e1ddf0f99cd77bf4a3a24b6d264ae6e690944761999f4` |
| spike | `ui/portraits/portrait-spike` | `05b5ae9ecfca4c8d94a3a4a31fcab04fe35f8b32df08f72e4bc8061ce39d5792` |
| crystal | `ui/portraits/portrait-crystal` | `76814eb2a64a9089073501846a0a09f92d4117c378184ed3cf2ccef8f17ec54b` |
| leaf | `ui/portraits/portrait-leaf` | `778298aad923ad795ec70e05d606f45fb27149ac3926991368b09864b11d261e` |
| bubble | `ui/portraits/portrait-bubble` | `7c8b13d1ba19f61b59d61d4ac81ad322f4c8afdb3a49b33b9eba1757ea1a0411` |

对应文件位于 `game/assets/resources/ui/portraits/*.png`。实际复制记录为 `game/art-source/ui/portraits/runtime-promotion.json`，重现脚本 `promote-runtime.cjs` 会核对冻结记录、目标目录、源/目标哈希；若已有目标字节不同会拒绝覆盖。没有调用 Cocos 或 Blender，也没有自动生成资源 UUID。

## TurtlePortraits API

`game/assets/scripts/view/TurtlePortraits.ts` 独立管理加载与生命周期，没有修改 IslandUI/GameEntry/core。

```ts
const portraits = new TurtlePortraits();
portraits.preload();
// Read in the owning screen's existing readiness gate:
portraits.ready;        // boolean: all five frames are complete
portraits.state;        // idle | loading | ready | failed | destroyed
portraits.loadedCount;  // 0..5; released back to 0 on failure/destroy
portraits.error;        // string | null

// Caller creates a dedicated UI node with its square content size and x/y.
portraits.attach(node, turtle.role);
portraits.detach(node); // optional when reusing a live node for another purpose
portraits.retry();      // explicit retry only when state is failed
portraits.destroy();    // owning app ends; safe to repeat
```

- `attach(node, role)` 保留节点位置、尺寸、父子关系与交互。每个节点使用 SIMPLE/CUSTOM Sprite、trim=false、白色 tint；Frame 覆盖整个 384 方图，避免裁掉统一留白或壳顶。不在管理器里重设角色缩放或变更原图颜色。
- 由调用方设置 48–96px 等所需正方形显示尺寸；实际手机阅读性仍待 UI 构建验收。公共正交框幅为 2.791533，五种头像头宽约 42.66%，64px 真渲染中约 27.3px。壳较矮的角色上方留白较多，是相同框幅的结果。
- 预载只发一批五个请求，所有五帧齐备才启用绑定的 Sprite；失败会记录明确状态与原因，不把缺头像当完成。不会在每帧调用 preload 时无限重试。
- 同一角色共享一张 Texture2D 与 SpriteFrame。LINEAR/LINEAR、mip NONE、CLAMP_TO_EDGE，Frame packable=false。角色之间是五张原图片，不宣称一次合批；本轮不为了合批重采样已审源。
- 同节点换角色复用 Sprite，只保留一个 NODE_DESTROYED 监听。新增绑定/应用内容时用严格 `isValid(node,true)` 避开已请求销毁的节点；清理时使用非严格 `isValid(sprite)`，对仍有效但 pending 的 Sprite 也先清空 frame 并 disable。
- ImageAsset 到达并通过 384×384 检查后才 addRef。每个自有 Frame/Texture 与 Image 引用在失败或管理器销毁时释放；先清活跃 Sprite 的 frame，再销毁共享资源。已经销毁节点只解除绑定。
- generation 隔离失败重试/销毁后的旧回调。迟到的资源若从未由本管理器 addRef，就不对它擅自 decRef 或全局 resources.release，避免破坏资源缓存或其他拥有者。

## 验证

`game/tests/turtle-portraits.test.cjs` 使用本机 Cocos TypeScript 转译实际控制器，并用可控异步资源/节点销毁/引用计数 stub 验证。初始 7 项通过；补充 pending 销毁边界后，旧实现可复现 2 项失败，修复后 **9/9 通过**。覆盖乱序全量就绪、切屏迟到回调、同节点换角色、共享资源所有权、部分失败后重试隔离、加载中销毁、错尺寸/分配异常、pending Node/Sprite 和 NODE_DESTROYED 事件期间的资源释放顺序，以及五张运行 PNG 与已审源逐字节相等。`tsc --noEmit -p game/tsconfig.json` 通过。

本机销毁依据：`cocos/core/data/object.ts:300–309` 的 destroy 只设置 ToDestroy 并加入延迟队列；`:651–653` 的 isValid 仅检查对象自身标志，非 strict 时仍接受 ToDestroy。`cocos/scene-graph/node.ts:1367–1370` 请求销毁后立即 deactivate，但组件尚存；`:1527–1544` 先发 NODE_DESTROYED，再真正销毁组件。因此清理不能因为父 Node pending 就跳过仍有效 Sprite。监听现在调用 detach，在事件中也清引用；新增内容仍保留严格判定。回归在 Frame.destroy 的那一刻断言没有任何仍有效 Sprite 持有它，不能只靠最终节点销毁后的状态来通过。

技术测试不能替代真实 Cocos 资源导入、UI 位置、手机清晰度、颜色/透明边和实际页面切换验收。本模块未自行接入界面；后续由根代理接入现有资源准备 gate 与角色卡。
