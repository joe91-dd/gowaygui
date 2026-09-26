# Cocos 声音控制器

实现：`game/assets/scripts/view/IslandAudio.ts`。适配本机 Cocos Creator 3.8.8；不修改游戏规则、存档或战斗事件生成。

## 上层接口

```ts
const audio = new IslandAudio(parent, settings);
audio.unlock();                       // 首次用户手势；重复点击不会重启音乐。
void audio.playMusic('bgm_battle');     // 可先于 unlock 选择曲目。
audio.update(dt);                      // GameEntry.update 每帧调用，不依赖战斗是否推进。
audio.effect('sfx_skill_stone');
audio.effect('sfx_heal', 180, .65);     // 可选更长节流和单次增益（0–1）。
audio.apply(updatedSettings);          // 音乐和音效独立音量，正在播放的音效即时更新。
audio.pause();                        // 后台 / 需要停声的游戏暂停。
audio.resume();                       // 保留音乐位置；不重播旧音效。
audio.stop();                         // 停止并释放持有的资源引用；不会因 resume 自动再响。
audio.destroy();                      // GameEntry.onDestroy；幂等。
```

构造时预载主界面音乐和全部 18 个音效；战斗、首领曲目按首次选择加载。未加载完成的音效只触发预载，不在稍后补播过时反馈。音乐预载不等于播放；首次实际播放仍受用户手势与暂停状态约束。

`stop` 可通过之后明确的 `unlock` 或 `playMusic` 重新启用；`destroy` 后所有接口停止工作。只释放本实例 `addRef` 持有的引用，不调用会影响其他资源使用者的全局资源清空。

## 核验过的引擎语义

核验文件：本机引擎 `cocos/audio/audio-source.ts`，以及 `cocos/audio/audio-clip.ts`。

- `AudioSource.playOneShot` 在引擎中将 source 音量乘以 `volumeScale` 后传入 `AudioPlayer.loadOneShotAudio`。若把设置音量同时写入 source 又作为参数传入，会重复相乘。
- `playOneShot` 创建独立播放器并在异步加载完成后直接播放；它不返回可管理的播放实例。`AudioSource.stop` 只停止 `_player`，不能可靠取消这些独立短音效。
- `AudioSource.clip` 自身还会异步创建 `AudioPlayer`。`play` 在此期间会排入待执行队列；仅在资源加载回调前判断一次暂停状态不够。
- 设 `clip = null` 会让未完成的旧播放器加载失效。新播放使用新组件，避免同一组件先设 A、清空、再设 A 时，旧 A 回调通过引擎仅比较 clip 对象的检查。
- `AudioSource.play` 对已在播放的音源会重启，因此同曲请求只更新选择状态，不重复调用它。暂停恢复使用记录的 `currentTime` 恢复位置。

因此本控制器使用可停止的普通 `AudioSource` 播放音效，不使用 `playOneShot`。每条音效实际音量只设置为 `settings.effects × 单次 gain` 一次。音乐音量为 `settings.music × 当前淡变系数`，两者互不覆盖。

## 切换与资源生命周期

音乐切换正常为约 200 ms 淡出、停旧曲、约 200 ms 淡入。新曲底层真正发出 STARTED 前保持音量为零；音乐始终最多一条，无两曲音量叠加。新曲仍在资源加载时保留旧曲。快速 A→B→A 在旧 A 尚未停下时直接撤销淡出，保留位置。

每次选择保留版本号；资源加载回调必须仍匹配最新选择才可播放。暂停、停止和销毁会使旧请求失效。暂停销毁当前可管理声道并保存音乐位置，底层晚到的 PLAY 不会自行恢复声音；由 `resume` 创建新声道后继续。

音效同时最多 6 条，包括尚在底层加载的声道。各类最小触发间隔为 65–600 ms；调用方只能增加该间隔。满额时，结果、主动技能和珍珠受损等较重要提示可替换更低优先级的旧声道；同等或更低优先级的新声被丢弃。自然结束立即释放声道。底层加载或播放失败未发 ENDED 时，超时清理避免占满名额。音乐底层启动超过五秒则释放声道，下一次用户操作可重试。

短音效节点按被接受的声音创建，活动声道数严格有界；已解码的 AudioClip 使用实例缓存。所有创建的节点先关闭自动播放，退出时音量归零、停止、解绑 clip 与事件后销毁。暂停或音效静音会取消正在播及尚在底层加载的短音效。

## 验证

`game/tests/audio-controller.test.cjs` 使用两层独立可控的异步桩：一层 `resources.load`，一层引擎内部播放器加载。八项测试已实际通过：

1. 18 音效预载、同曲多次请求只播放一次、首帧静音淡入。
2. 音乐资源乱序完成时只播放最新选择。
3. 暂停覆盖两层加载，恢复才播放并保留音乐位置。
4. A→B→A 撤销淡出、慢 C 保留旧曲、切曲不重叠。
5. 六路上限、优先级、节流、音量只相乘一次、静音取消待播音效。
6. stop 释放引用、旧加载不删除新请求、destroy 幂等。
7. 加载失败重试、旧音效不补播、未知资源不加载。
8. 正常结束和无结束事件的超时清理。

运行：`node --test game/tests/audio-controller.test.cjs`。测试可使用已安装的 Cocos TypeScript 编译器，或通过 `GOWAYGUI_TYPESCRIPT` 指定路径。另以实际 Cocos 声明执行 `tsc --noEmit -p game/tsconfig.json` 通过。

这些检查验证调度和生命周期，不能证明手机扬声器听感、浏览器实际底层解码和最终混音已经通过。整合后仍需检查切曲、后台恢复、静音、密集战斗与真机表现。
