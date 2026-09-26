# 哥喂龟音频制作管线

状态：已导出主界面、普通战斗、首领战三首原创循环音乐，以及六个交互音效和十二个战斗音效。谱面、MIDI、分轨、母带和技术检查均可追溯；实际游戏混音与人耳审美验收仍需单独完成。

## 可复现制作

在工作区根目录运行：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'game/audio-source/compose_home.py'
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'game/audio-source/compose_battle.py'
```

脚本使用工作区 `tmp/tools/audio/python-libs/` 和 bundled NumPy，不要求安装 DAW。完整固定版本依赖位于 `game/audio-source/requirements.txt`。重建该目录时使用官方 PyPI 源：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -m pip install --index-url https://pypi.org/simple --target 'tmp/tools/audio/python-libs' -r 'game/audio-source/requirements.txt'
```

导出后执行独立文件级验证：

```powershell
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'game/audio-source/check_audio.py'
& 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' 'game/audio-source/check_battle_audio.py'
```

验证直接重新解析 MIDI 与实际 WAV/Ogg 文件，检查音符闭合、分轨重建误差、精确时长、循环接点、响度、削波、音效终点和资源哈希；结果保存在 `exports/audio_validation.json` 和 `exports/battle_audio_validation.json`。它不会把离线数值通过当作人耳审美通过。两个报告各自校验本批资产；加入战斗资源不会要求重写主界面音乐的来源哈希。

编辑乐谱可修改脚本内 `PROGRESSION` 与 `MELODY`，或编辑导出的 `home_score.json` 后执行 `compose_home.py --score <JSON 路径>`。音色的模式频率、衰减、拨弦位置、气声和混响参数直接可编辑。`--reuse-master` 用已有 24-bit 母带重新编码和分析；`--effects-only` 仅重新制作音效。不要把后一选项输出的局部报告误认为整首音乐已经重新验证。

战斗脚本支持 `compose_battle.py --track battle`、`--track boss`、`--track effects` 单独重建；默认 `--track all`。修改 `battle_score.json` 或 `boss_score.json` 后，使用 `--track battle --score <JSON>` 或对应首领选项。十二个战斗音效的分层配方也可编辑：`--track effects --effects-score <battle_effects.json>`。MIDI 包含各段音色切换；GM 音色号只是编辑器中的定位音色，实际成品合成参数在脚本中。

## 工程文件与运行资产

| 位置 | 内容 |
|---|---|
| `game/audio-source/compose_home.py` | 完整原创作曲、配器、音色、音效、混音、编码与分析源脚本 |
| `game/audio-source/home_score.json` | 1,125 个可编辑事件，包括音高、时值、力度、声像与确定性随机种子 |
| `game/audio-source/home_score.mid` | 8 条 MIDI 轨（1 条速度轨，7 条乐器轨），可导入 DAW |
| `game/audio-source/exports/home_stems/` | 7 条等长、同起点的 44.1 kHz / 24-bit 立体声分轨 |
| `game/audio-source/exports/bgm_home_master.wav` | 44.1 kHz / 24-bit 立体声母带 |
| `game/audio-source/exports/bgm_home_pcm16.wav` | 16-bit WAV 试听与兼容性备用，放在源目录避免 Cocos 同名资源冲突 |
| `game/audio-source/exports/home_loop_join_preview.wav` | 末尾 4 秒加开头 4 秒，便于检查循环接点 |
| `game/assets/resources/audio/bgm_home.ogg` | 约 0.94 MiB 的运行版本，80 秒精确循环 |
| `game/assets/resources/audio/sfx_*.wav` | 6 个短音效的运行版本 |
| `game/audio-source/exports/audio_analysis.json` | 真实导出文件的测量与 SHA-256 记录 |
| `game/audio-source/compose_battle.py` | 两首战斗曲的独立旋律、和声、配器及十二个音效的分层制作脚本；调用已有通用音色与编码管线 |
| `game/audio-source/battle_score.json / .mid` | 普通战斗 1,120 个事件；8 条乐器轨，加速度轨的 MIDI 共 9 轨 |
| `game/audio-source/boss_score.json / .mid` | 首领战 1,539 个事件；9 条乐器轨，加速度轨的 MIDI 共 10 轨 |
| `game/audio-source/exports/battle_stems/`、`boss_stems/` | 分别 8 / 9 条等长同起点 24-bit 分轨 |
| `game/audio-source/exports/bgm_battle_master.wav`、`bgm_boss_master.wav` | 两首曲目的 44.1 kHz / 24-bit 立体声母带 |
| `game/audio-source/exports/battle_loop_join_preview.wav`、`boss_loop_join_preview.wav` | 各自末尾 4 秒加开头 4 秒的接缝检查音频 |
| `game/assets/resources/audio/bgm_battle.ogg`、`bgm_boss.ogg` | 普通战斗与首领战的循环运行资源 |
| `game/audio-source/battle_effects.json`、`exports/battle_sfx_masters/` | 十二个战斗音效的可编辑配方和 24-bit 母带 |
| `game/audio-source/exports/battle_audio_analysis.json` | 两首战斗曲与十二个新音效的实际测量及运行资产 SHA-256 |
| `game/audio-source/SOURCES.md` | 资产来源、工具来源、许可证说明 |

主旋律是木质模态打击乐，和声使用具有拨弦位置频谱、色散和琴体共鸣的弦音，配合圆润低音、轻气声、副旋律、细小贝壳铃与柔打击。七条分轨均含各自空间效果，按原始增益相加即可复现混音。禁止把分轨再次自动响度归一化后叠加，否则会改变混音。

## 循环和响度策略

主界面音乐为 96 BPM、4/4、32 小节，共 128 拍、3,528,000 帧、80 秒。普通战斗为 112 BPM、32 小节、3,024,000 帧、68.5714286 秒；首领为 128 BPM、40 小节、3,307,500 帧、75 秒。三曲音符尾部和混响均以周期卷积跨接末尾与开头；没有在结尾添加额外空白，也没有使用循环时突然淡出的方式。WAV 与 Ogg 解码后的帧数相同。Ogg 编码按 16,384 帧分块写入，以规避当前 libsndfile 一次写入长数组时发生的 native 编码失败。

主界面和普通战斗母带目标为 -19 LUFS，首领为 -18.5 LUFS，保留瞬态和游戏音效混音余量；不使用强限幅拉平瞬态。高频能量比例和单声道兼容性作为辅助检查，不等于已经听起来舒服。短于 400 毫秒的音效不报告标准整合响度，使用峰值与 RMS。对资源导入、循环和音量控制还必须在实际 Cocos/浏览器中验证，离线检查不能代替运行试听。

## 接入建议

使用两个独立总线或音量参数控制音乐与音效；音乐循环播放，页面切换约 300–600 毫秒渐变。首次播放应跟随用户手势，处理浏览器后台与恢复状态。收录或稀有结果演出期间可将音乐暂降约 3–6 dB，让庆祝声音更清楚，结束后平滑恢复。短音效限制并发和触发频率：擦泡泡持续音至少间隔约 120 毫秒，轻泡泡爆裂约 45 毫秒，收录与稀有结果每次事务只播放一次。尚未写入游戏核心或音频控制器，以免与主任务改动冲突。

战斗事件与资源的详细映射位于 `docs/AUDIO_EVENT_MAP.md`。下一步在实际游戏中分别连续播放两轮，叠加五龟与敌人音效，检查角色动作反馈、音乐段落、普通战斗到首领转换及手机外放。按人耳听感调整后再记录审美验收。
