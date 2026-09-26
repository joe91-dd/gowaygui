# 音频窗口统一交接 · 2026-09-17

## 结论

用户选择的 A 套 BGM 与本窗口原 33 个音效均保留在当前共享源码。其他窗口后来又加入 6 个音效，当前实际为 **3 首音乐 + 39 个音效 = 42 份运行资源**，不是 36 份。授权台账、源码注册和运行资源已重新校验一致。

| 场景 | 已选作品 | 作者 / 许可 |
| --- | --- | --- |
| 战斗外 | Town Theme RPG | cynicmusic / CC0 1.0 |
| 普通战斗 | Battle Theme A | cynicmusic / CC0 1.0 |
| 首领战 | Epic Boss Battle | Juhani Junkala（SubspaceAudio）/ CC0 1.0 |

音乐选择固定在 `game/audio-source/cc0-20260916/music-selection.json`，原曲及来源页面保存在 `music-a/`。所有音效来自已归档 Kenney 素材，逐层来源与 SHA-256 在 `manifest.json`，包内 `License.txt` 保留。

## 本次快速复核

- `audio-controller.test.cjs` 与 `pet-card-order.test.cjs`：**21/21 通过**，包含当前 39 个音效预加载、五职业与首领技能、暂停恢复、静音、同帧限频、旧回调取消及拖放反馈。
- `verify_audio.py`（源码资源模式）：**42/42 通过**，3 BGM / 39 SFX，合计 9,458,146 字节；检查注册键完全匹配、原始来源 SHA-256、CC0 页面/包内许可、双声道 44.1kHz、可解码及无削波。最新报告在 `game/audio-source/cc0-20260916/verification.json`。
- 复核 `GameEntry.bindUiAudio`、`IslandUI.feedback`、现有合宠与学习阶段回调，原接入仍在；新祈愿反馈映射也存在。
- 本次没有启动 Cocos，没有部署游戏包，没有删除或搬移目录。

## 本次修复的小余项

1. 原 `verify_audio.py` 硬编码 36 份资源，已改为以控制器注册键严格匹配台账，并动态统计音乐/音效数量，避免把新增 6 个音效误报为缺失或排除在校验外。
2. `build_review.py` 补齐上述新增 6 个声音的中文名称，避免生成试听页时 KeyError；已重新生成 `output/audio-cc0-review.html`，现含全部 42 份实际资源。
3. 两份授权/接入说明已注明当前 39 SFX 以及原构建记录属于历史验收。

## 交给统一窗口的剩余事项

- 按统一计划完成最终 Cocos 构建，然后运行 `game/audio-source/cc0-20260916/verify_audio.py <最终构建目录>`，核对最终包内全部 42 份音频；本次仅报告当前源码资源通过，未冒充最终构建通过。
- F 盘迁移时保留 `game/assets/resources/audio`（含 `.meta`）、`game/audio-source/cc0-20260916`（原曲、素材包许可、来源页、清单、脚本）和 `tmp/tools/audio/python-libs`（若需离线重制/核验）。制作脚本根目录相对自身定位，主工程盘符变化无需改音频资源 URL。
- 不要重跑历史 `output/audio-feedback-20260917/deploy_verified.py`：它固定上一轮 36 份资源及旧构建报告；统一窗口应使用最终构建的部署流程。
- `latest-build.json` 是多个窗口共享的指针，可能被其他构建覆盖。最终验收请保存本轮独立构建报告及实际 bundle SHA-256。
- 本窗口无尚未处理的音频源码阻塞项；最终设备外放与整体混音审美仍由统一验收确认。

已保存进度，等待统一验收；不再发起后台构建或轮询。
