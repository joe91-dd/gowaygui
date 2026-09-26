# 本地浏览器验收记录

`game/assets/scripts/view/LocalDiagnostics.ts` 是独立的只读开发模块。它不导入 GameService、战斗规则、存档或平台时钟，不提供控制角色、跳关或修改状态的接口。普通 URL 不创建浮层、下载链接或事件监听。

## 开启和接入

必须同时满足 Cocos `cc/env` 的 `DEBUG=true`、本地地址（localhost、127.0.0.1、IPv6 loopback 或 file 协议）和明确的 `?qa=1`。当前 Web 构建配置使用 debug；远程域名、局域网 IP、发行构建和没有该参数的页面均保持关闭。游戏通过 HTTP 运行；支持 file 参数判断不代表 Cocos Web 构建可以从 file 正常加载。

接口由 GameEntry 接线，模块本身不修改入口：

```ts
import {LocalDiagnostics} from './LocalDiagnostics';
// 在初始化尽早创建，以包含游戏资源加载阶段。
this.diagnostics = new LocalDiagnostics(this.node);
// 每次真实 GameEntry.update 调用一次。不要为了诊断逐帧读取 service.snapshot。
this.diagnostics.recordFrame(dt, {screen: this.screen, levelId, wave});
// 所需画面资源已呈现、按钮可以正常操作时调用一次；不能只用加载函数返回代替。
this.diagnostics.markReady();
// 入口 onDestroy 调用；模块也监听 owner 的 NODE_DESTROYED 兜底，重复销毁安全。
this.diagnostics.destroy();
```

`levelId` 和 `wave` 可省略，必须使用调用方已经持有的轻量字段；上下文只用于标注记录。不要传整个 battle/save 对象。恢复、切屏、暂停都使用游戏原来的流程，诊断不调用任何游戏控制。

默认只有左下方安全边缘的 44×30 CSS 像素“验收”开关，避开右上资源和战斗暂停操作。点击后向上展开“保存当前截图 / 导出性能记录”，再次点击“收起”关闭；开关支持键盘操作并报告 aria-expanded。收起后操作区不参与显示和点击，不会因下载回调自动展开，帧采样仍照常进行。这个 DOM 浮层不进入 Cocos UI 树，不被游戏界面的清空或模态关闭销毁，也不包含在游戏 PNG 中。没有常驻帧率、内存或内部状态调试文字。所有数据只在点击时通过浏览器原生下载保存，没有网络上报。

## 记录口径

- `durationMs`：从诊断创建到导出的实际经过时间，包含后台。
- `foregroundDurationMs` / `hiddenDurationMs`：通过文档 visibilitychange 区分的前后台时长。
- `navigationToReadyMs`：首次 markReady 时的 performance.now，基于页面的时间原点；`diagnosticsToReadyMs` 则从模块创建开始。未标记时两个字段为 null。调用方负责“可操作”的产品定义，不能把这两个字段当作所有懒加载资源已完成的证明。
- `frameTiming`：实际 Cocos update 调用间的 performance.now 差值。平均值使用原始间隔，P95 使用稀疏 0.1 ms 直方图的上边界，误差小于 0.1 ms。记录帧数、最大值、超过约 33.33 ms 和 50 ms 的帧数。隐藏期间和刚回到前台的第一个间隔不计入；`sampledDurationMs` 是这些有效间隔之和。
- `cocosDeltaTiming`：另存调用方原样传入的 dt 统计；引擎可能对 dt 限幅，所以它不能代替真实帧间隔。
- `heap`：浏览器允许时读取 usedJSHeapSize / totalJSHeapSize / jsHeapSizeLimit，否则 null。它是可选的 Chromium JS 堆估计，不能用于声称游戏总内存、进程总内存或 GPU 占用。该 API 非标准且可能不准确。[MDN performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)
- `requestedFrameRate`：Cocos 请求的目标帧率，不是测得帧率。`graphics` 在导出时读取当前画布的 WebGL 版本、渲染器、厂商、抗锯齿及上下文状态；可选的真实渲染器扩展不可用时记 null，用来辅助区分硬件和软件渲染环境，不能据此单独解释性能。
- `timeline`：约每秒一条的区间统计、当前屏幕/关卡/波次和 JS 堆；最多保留 3600 条，超出时明确记录 droppedEntries。全程平均与 P95 不因时间线截断而清零。

采样、PNG 编码和 JSON 导出本身也有开销，点击导出的临近帧可能变慢。工具没有主动丢弃这些慢帧；做正式性能比较时应保持相同采样设置，并在稳定运行后导出。

## 截图和下载机制

点击截图后注册一次 `Director.EVENT_AFTER_DRAW`。在该绘制回调的同一同步调用栈内，用 `drawImage(game.canvas, 0, 0)` 复制真实 WebGL 画布到临时 2D canvas。复制完成后才调用临时画布的异步 toBlob；因此不会在浏览器清空非保留 WebGL 缓冲后才读取游戏画面。没有渲染替身、拼接 UI、改写场景或更改 preserveDrawingBuffer 设置。

本机 Cocos Creator 3.8.8 源码依据：`cocos/game/director.ts` 的 `frameMove` 后立即 emit AFTER_DRAW；`cocos/root.ts` 完成渲染后调用 present；`cocos/gfx/webgl/webgl-device.ts` 与 `webgl2/webgl2-device.ts` 的 present 只收集统计并清理提交队列，不主动清理 framebuffer。WebGL 默认非保留缓冲在渲染任务返回后可能丢失，不能先 await / Promise / setTimeout 再读取它。[Khronos WebGL Drawing Buffer](https://registry.khronos.org/webgl/specs/latest/1.0/index.html#2.2)

等待绘制超过 5 秒会解绑并给出重试提示。画布尺寸为零、上下文丢失、没有 2D context、受跨域污染或 toBlob 返回 null 均显示失败，绝不用替代图冒充成功。PNG 为浏览器要求支持的格式。[MDN toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)

文件名为 `gowaygui-qa-时间.png` / `.json`（UTC 时间及毫秒）。Blob object URL 配合 `a.download` 请求原生下载，并提供 60 秒的可见备用保存链接。浏览器仍有最终决定权，界面只提示“请求保存”，不会声称已写入磁盘。[MDN download](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download)

销毁时取消等待绘制、超时器和 URL 回收计时器，解绑 owner/visibility 事件，回收 object URL 并移除面板；晚到的 PNG 回调不会下载或重新创建 UI。

## 验证与发行剔除

2026-09-08：`game/tests/local-diagnostics.test.cjs` 的 8 项测试全部通过，包含原有 7 项测试和 1 项默认收起/展开/收起状态检查，验证门禁、真实时间统计与后台排除、只读输入、同步复制顺序、超时和销毁清理。状态检查还覆盖隐藏操作不能点击、采样不被开关影响，以及截图迟到回调不能自动重开面板。模块也使用本机 Cocos 3.8.8 的 `cc.d.ts` / `cc.env.d.ts` 独立 strict TypeScript 检查通过。测试命令：bundled Node 执行 `--test game/tests/local-diagnostics.test.cjs`。

这些检查不等价于实际浏览器得到正确 PNG。接入后的真实 Cocos 构建还需人工点击两按钮，打开下载文件核对画面、尺寸、P95/持续时长和 heap/null，并在无 qa 参数下确认浮层消失。

### 实际浏览器记录（2026 年 9 月 8 日）

构建 20260908-123410 中实际点击截图，浏览器 Downloads 生成 `gowaygui-qa-20260908-044144-616.png`，239,554 字节。已打开检查：1280×720，与当前石龟主界面一致，没有验收 DOM 浮层。复制归档到 `docs/reports/screenshots/cocos-v10-home.png`，未修改图片内容。

同页约 332 秒的首页采样原始 JSON 已归档为 `docs/reports/qa-home-20260908.json`。共 6149 个有效帧间隔，平均 53.98 ms（换算约 18.5 FPS），P95 为 66.3 ms，最长 344.9 ms；后台记录为 0。页面起点至标记可操作 3.56 秒，诊断创建至可操作 1.49 秒。导出时 JS 堆估计 168,776,983 字节（约 161 MiB），不代表总内存。此性能尚未达标，且这是首页记录，不能当作完整战斗性能结果；原报告还没有图形设备信息，原因待新构建与场景对照查明。

发行时最直接的剔除方式是移除入口的 import、字段及四处调用，再删除此模块及 meta。即使模块暂时保留，非 DEBUG 构建也拒绝开启；不要为了 QA 改发行 DEBUG 设置。本模块不要求修改引擎、全局浏览器选项或安装额外软件。
