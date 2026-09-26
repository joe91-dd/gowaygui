> 2026-09-16：以下为历史原创样板记录；当前运行音频已更换为 CC0 素材，见 [当前音乐与音效说明](../../docs/AUDIO_CC0_20260916.md)。

# 声音来源与可编辑源文件

## 本次原创样板

作品名称：贝壳湾的早晨 / Morning at Shell Bay；守住潮汐小径 / Keep the Tidepath；巨钳前的勇气 / Courage at the Tidal Gate。

为《哥喂龟》本项目编写的三首原创乐谱（32、32、40 小节）、配器、节奏、程序化音色与十八个音效。没有导入任何外部歌曲、录音、声音字体、采样包或其他游戏素材，没有要求模仿具体作品或音乐家。音乐和音效由 `compose_home.py` 与 `compose_battle.py` 根据显式音符、和弦及合成参数离线渲染；战斗曲发展本项目自己主界面的旋律动机，未引用外部旋律。项目运行时播放已导出的音频文件。

源文件包括 `compose_home.py`、`home_score.json`、标准 MIDI `home_score.mid`、`exports/home_stems/` 中的七条 24-bit WAV 分轨和 `exports/bgm_home_master.wav` 的 24-bit 立体声母带。可以在 DAW 内直接修改 MIDI 或混合分轨，也可以编辑 JSON 后重新合成。MIDI 中的 GM 音色号用于编辑器定位；实际合成音色定义在 Python 脚本内，未依赖 GM 声音字体。

战斗新增源文件为 `compose_battle.py`、`battle_score.json/.mid`、`boss_score.json/.mid`、`battle_effects.json`、`exports/battle_stems/` 八条分轨、`exports/boss_stems/` 九条分轨、两首 `bgm_*_master.wav` 母带与 `exports/battle_sfx_masters/` 十二个音效母带。新增短簧管、低鼓、气流、撞击与泡泡层均为明确参数的合成，不含外部录音。无需新增工具、账户、插件或付费 API，沿用下列已验证版本。

本文件记录生成来源，不把 AI 辅助产出自动等同于已取得排他性版权，也不代替未来发行前的相似性与权利审查。当前为待试听样板，尚未获得用户音乐审美验收。

## 仅用于制作的工具

| 工具 | 使用版本 | 用途 | 上游来源与许可 |
|---|---|---|---|
| NumPy | 2.3.5 | 音色与阵列计算；使用现有 bundled runtime | https://numpy.org/ ，BSD-3-Clause |
| SciPy | 1.18.1 | 4 倍过采样峰值分析 | https://scipy.org/ ，BSD-3-Clause，随发行包保留依赖许可证 |
| python-soundfile | 0.14.0 | WAV、Ogg Vorbis 编解码 | https://python-soundfile.readthedocs.io/ ，BSD-3-Clause |
| libsndfile | 以 soundfile wheel 内版本为准 | 底层音频文件处理 | soundfile wheel 自带 COPYING，LGPL-2.1 文本已保留 |
| pyloudnorm | 0.2.0 | BS.1770 响度计算 | https://github.com/csteinmetz1/pyloudnorm ，MIT |
| CFFI | 2.1.1 | soundfile 的 Python/native 接口 | https://cffi.readthedocs.io/ ，MIT |
| pycparser | 3.0 | CFFI 依赖 | https://github.com/eliben/pycparser ，BSD-3-Clause |

新增工具从 `https://pypi.org/simple` 下载到工作区 `tmp/tools/audio/python-libs/`；没有系统级安装，没有注册服务。许可证原文与制作环境版本记录保留在 `tool-licenses/`。这些制作依赖和 DLL 不进入 Cocos 运行资源或游戏构建包。使用编码工具产生的音频不是工具代码分发。

最终游戏资产的许可台账仍由项目统一清单管理；本文件覆盖当前三首音乐、十八个音效及其制作过程。技术测试通过与试听审美验收分别记录，未把数值结果宣称为用户认可。

## 2026-09-19 免费商用备选

`compose_alternatives.py` 与 `exports/alternatives/` 新增六条试听候选，均为本项目确定性合成，无第三方录音、SoundFont 或远程生成素材。用途与商用来源说明见 [ALTERNATIVES_LICENSE.md](ALTERNATIVES_LICENSE.md)。它们暂不替换当前运行时曲目，待试听确认后再接入事件映射。
