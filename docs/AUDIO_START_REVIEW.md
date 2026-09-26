# 音乐启动超时专项核查

核查日期：2026-09-08。对象：旧浏览器日志 `2026-09-08T06:48:53Z [AUDIO_START_TIMEOUT] bgm_home`。根代理报告新 `152027` 构建暂未重复；本次没有运行浏览器或启动 Cocos，因此不把该观察升级为已修复。

结论：目前没有用回归证明 `IslandAudio.ts` 存在导致该旧警告的应用代码缺陷，生产控制器保持不变。补充实际 TypeScript 转译控制器的异步启动测试后，音频测试 **12/12 通过**，项目 `tsc --noEmit -p game/tsconfig.json` 退出码 **0**。这证明被测控制流程符合约定，不等于实际浏览器必定发声，也不等于人耳试听通过。

## 日志能说明什么

`IslandAudio.update` 第 105 行检查 `!music.started && now - createdAt > 5000`。计时起点是 `createVoice` 创建音乐声道，发生在 `resources.load` 回调取得 AudioClip 之后。计时使用单调时钟，依靠后续有效的 `update(dt)` 检查；不是准时在第 5 秒运行的独立定时器。

| 阶段 | 是否包含在该 5 秒窗口 | 能否仅凭旧警告确定失败于此 |
| --- | --- | --- |
| 本项目 `resources.load('audio/bgm_home', …)` | 否，尚未创建音乐声道 | 否；日志说明此轮已有可用 AudioClip |
| `AudioSource.clip` 设置后内部 `AudioPlayer.load` | 是 | 否 |
| 底层 `AudioPlayer.play()` 等待异步完成 | 是 | 否 |
| `AudioSource` 的 Promise 续接发出 `STARTED`，本项目收到事件 | 是，到此结束 | 只能确认检查时尚未收到 |

日志不能区分内部播放器加载、解码、AudioContext 等待或调度顺序，不能用它推断浏览器策略或外部工具延迟是原因。没有 `STARTED` 也没有底层阶段时间记录，不能反推它卡在哪一层。反过来，`STARTED` 是引擎事件，并非扬声器实际发声的测量结果。

## 本机 Cocos 3.8.8 源码依据

以下源码根目录均为 `C:/ProgramData/cocos/editors/Creator/3.8.8/resources/resources/3d/engine`，本次只读，没有修改引擎。

| 本地位置 | 确认的行为及含义 |
| --- | --- |
| `cocos/audio/audio-source.ts:121` | `_syncPlayer` 异步调用 `AudioPlayer.load`，完成后比对 `_lastSetClip`。已取消的旧 clip 对应 player 被销毁，不会回放排队的 PLAY；加载拒绝的 catch 不向本项目发出专用失败事件。 |
| `cocos/audio/audio-source.ts:366` | `play` 在播放器未加载时排队。已加载时调用 `player.play().then(...)`，在 Promise 完成之后才发 `STARTED`。调用 `AudioSource.play()` 本身不能证明启动完成。 |
| `pal/audio/web/player-web.ts:399` | Web Audio `_doPlay` 在上下文已运行时启动 buffer；否则注册 context-running 回调并请求引擎的 `runContext`，Promise 等待该回调。 |
| `pal/audio/web/player-web.ts:87` | `runContext` 尝试原生 `resume()`，并在 GameCanvas 上注册 `touchend` / `mouseup` 重试。它依靠正常用户手势，不提供绕过浏览器策略的保证。 |
| `pal/audio/operation-queue.ts:68`、`:101` | 底层操作串行，未完成的 play 可以阻塞其后的 stop。不能把单独调用 stop 当作所有等待均已取消。 |
| `cocos/audio/audio-source.ts:95`、`:126`；`pal/audio/web/player-web.ts:249` | 本项目随后设置 `clip=null`，触发 `_resetPlayer` / destroy。Web player 的 destroy 直接调用 `offRunning`，移除待启动回调；本项目也将音量归零并移除节点事件。 |
| `pal/audio/web/player.ts:66` | 指定 DOM_AUDIO 或不支持 AudioContext 时走 DOM 后端，否则走 Web Audio。该旧日志没有记录实际后端。 |
| `pal/audio/web/player-dom.ts:33` | DOM 后端首次 play 失败会等下一次手势；手势回调在第二次 play Promise 完成之前就 resolve 外层等待。因此 DOM 后端的 STARTED 不能严格当作成功发声凭据。本次 Web 取消模型测试没有宣称覆盖完整 DOM 后端。 |
| `pal/audio/web/player-web.ts:74`、`:284` | 解码相关路径存在只写错误日志、没有向外层完整传递拒绝的分支。这是源码中的潜在悬而未决路径，不是已证明该项目触发的错误。没有损坏音频/解码失败记录，不能据此归因。 |

首页 clip 的 `.ogg.meta` 为 `downloadMode: 0`；仅凭此导入字段不直接认定旧浏览器实际使用了哪个后端。

## 首次手势与恢复路径

`GameEntry.ts:64` 将按钮公共点击回调接到 `audio.unlock()`，`IslandUI.ts:37` 从 Cocos `TOUCH_END` 调用该回调。创建控制器只预载，不直接创建播放声道。`unlock` 是应用的“允许尝试播放”状态，不是浏览器原生 AudioContext 的解锁证明；首次播放还要经过上述异步链路。

确认的恢复行为：

1. 尚在等待 STARTED 时，重复手势和同曲请求保持一个声道，不重复 play、不重置 5 秒窗口。
2. 超时后，当前声道静音、stop、清空 clip、解绑事件并销毁节点。下一首有效请求若已备好，则立即开始下一首；没有待播请求时停止自动尝试，避免无限重试。
3. 超时后的下一次正常按钮点击会由 `unlock()` 重新请求当前曲目，复用缓存 AudioClip、创建全新的 AudioSource。主动切曲也可恢复。无需刷新页面；但浏览器是否允许此次实际播放仍要实机确认。
4. 暂停释放等待或播放中的声道。暂停期间的资源完成、旧 STARTED 和点击不会自动发声；`resume()` 才重新请求当前选择。切后台/回前台已在 `GameEntry.ts:265`、`:271` 接入 pause/resume。
5. stop 清掉持有的 clip 引用与旧加载世代；resume 不撤销 stop。新的正常手势可以重新开始；destroy 后均不可重新开始。

这里的“超时后没有新操作就保持静音”是当前明确行为，不是“永久不能恢复”。是否需要额外提示属于后续实际体验决策，未凭旧单条日志改变它。

## 本次回归范围与结果

修改仅限 `game/tests/audio-controller.test.cjs` 和本说明；`IslandAudio.ts` 没有修改。原有 8 个测试保留，新增 4 个测试：

- 区分“播放器已加载”与“底层 play 完成”，模拟 Promise 续接后 STARTED；完成之前保持零音乐增益，之后才淡入，已启动不再误报 5 秒超时。
- 控制时钟验证 5000 / 5001 毫秒边界、一次性清理、无自动重试，以及下一次手势使用缓存恢复；旧事件不能提前打开新声道音量。
- 超时同帧已有乱序切曲结果时只启动最新曲目；另一轮超时后主动切曲恢复，无旧曲重叠。
- 底层 play 等待期间 pause、stop、destroy 的取消，以及“play 已完成但 STARTED 微任务尚未执行”时销毁的事件隔离和引用释放。

测试每次读取并转译真实 `IslandAudio.ts`，没有重写一份控制器算法。fixture 按本机 Web Audio 的两级内部异步与销毁取消行为建模，不运行真实 Web Audio、不模拟浏览器用户激活策略、不保证 DOM 后端等价。

执行：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test 'game/tests/audio-controller.test.cjs'
# tests 12, pass 12, fail 0, exit 0
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'C:/ProgramData/cocos/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js' --noEmit -p 'game/tsconfig.json'
# exit 0
```

## 尚待实际浏览器复现的步骤

本次没有执行以下检查。它们用于根代理后续在真实构建中复现并区分原因，不要求改引擎或强制开启 autoplay。

1. 记录构建编号、浏览器版本、普通窗口/隐私窗口、站点声音权限、设备静音状态。使用正常网页导航打开同一构建，开启 Preserve log，先等待 8 秒不点击，确认没有播放尝试；再点击首页一个普通按钮，记录手势时间和是否听到音乐。分别跑正常缓存和清缓存后的首访。
2. 如出现旧警告，保存完整前后日志、资源请求状态与时间。先不刷新，再正常点击一次按钮，然后进入战斗/返回首页测试切曲。记录是否恢复、是否重叠、是否出现重复警告；不能只保存警告字符串。
3. 需要定位阶段时，在未改写代码的 DevTools Source logpoint 记录 `IslandAudio.createVoice`、`AudioSource._syncPlayer` 完成、底层 `_doPlay` 进入、context-running 回调及 `AudioSource` 发出 STARTED 的时刻和后端。用不暂停执行的 logpoint；人为打断点停住超过 5 秒会污染计时，不作为自然超时证据。
4. 在原先确实等待启动的情形切后台 6 秒再回前台，随后给一次正常按钮手势，检查旧声道是否残留和恢复行为。以手势、pause/resume、各阶段时刻对应起来，区分“没有收到原生启动完成”和“控制器收到了事件却未正确恢复”。
5. 可单独用网络限速复查冷启动资源阶段，但它不保证重现此警告：5 秒窗口在本项目资源回调之后才开始。不要将所有超过 5 秒的首页无声都标成 AUDIO_START_TIMEOUT。

若以上步骤自然重现，再按同一操作序列为确切应用缺陷加失败回归并做最小修复。当前证据不支持改超时值、重写声音系统或归咎于浏览器策略。
