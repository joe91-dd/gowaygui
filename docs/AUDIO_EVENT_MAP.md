> 2026-09-16：以下为历史原创样板记录；当前运行音频已更换为 CC0 素材，见 [当前音乐与音效说明](AUDIO_CC0_20260916.md)。

# 战斗声音接入映射

所有下表路径均为 Cocos `resources.load` 使用的无扩展名路径。物理文件位于 `game/assets/resources/audio/`。音乐只有 Ogg 运行版本，WAV 母带留在源目录，避免同名资源解析冲突。音频控制器、事件消费和页面状态由主任务负责，本次音频制作没有修改它们。

## 音乐

| 场景 | 资源路径 | 循环 / 建议切换 |
| --- | --- | --- |
| 主界面、收藏、培养、合成主流程 | `audio/bgm_home` | 80 秒循环 |
| 普通战斗与首领关前段波次 | `audio/bgm_battle` | 68.571429 秒循环；无需每波重新开始 |
| 首领正式出现，或首领最终波进入战斗 | `audio/bgm_boss` | 75 秒循环；同一最终波只切换一次 |

建议页面切换淡出／淡入 300–600 毫秒。首领音乐比普通战斗母带仅高 0.5 LU；不要再额外大幅提高音量。暂停和后台恢复保持当前曲目位置；恢复存档直接选择当前阶段的曲目，不重放历史胜负音效。

## 已有六个交互音效

确认使用 `audio/sfx_ui_confirm`；普通泡泡轻破裂使用 `audio/sfx_bubble_pop`；擦泡泡过程使用 `audio/sfx_bubble_rub`；确认收录使用 `audio/sfx_collect`；稀有揭晓使用 `audio/sfx_rare_reveal`；整局胜利用 `audio/sfx_victory`。本批未重新制作或覆盖这些文件。

## 新增十二个战斗音效

| 触发语义 | 资源路径 | 时长 | 建议节流 |
| --- | --- | ---: | --- |
| 石头龟近战普攻、近战敌人攻击 | `audio/sfx_attack_melee` | 0.26 s | 同类至少 90 ms |
| 刺刺龟普通远程攻击 | `audio/sfx_attack_projectile` | 0.30 s | 同类至少 90 ms |
| 水晶龟普通法术攻击、吐墨螺远程吐墨 | `audio/sfx_attack_magic` | 0.38 s | 同类至少 100 ms |
| 我方实际受到伤害且 `amount > 0` | `audio/sfx_hit_soft` | 0.20 s | 全局至少 110 ms；不为每只敌人受击再叠一层 |
| 普通有效治疗 | `audio/sfx_heal` | 0.42 s | 至少 180 ms；跳过细小自愈和吸血，群疗不逐只播放 |
| 敌人漏过，珍珠损失耐久 | `audio/sfx_core_hit` | 0.65 s | 至少 160 ms |
| `skillId: hold` 守住 | `audio/sfx_skill_stone` | 1.00 s | 每次技能事件一次 |
| `skillId: piercingShot` 穿甲弹 | `audio/sfx_skill_spike` | 0.72 s | 每次技能事件一次 |
| `skillId: crystalCannon` 水晶炮 | `audio/sfx_skill_crystal` | 1.12 s | 每次技能事件一次 |
| `skillId: greatHeal` 大治疗 | `audio/sfx_skill_leaf` | 1.34 s | 每次施法一次，避免五个 heal 事件各播放 |
| `skillId: bubbleRing` 泡泡圈 | `audio/sfx_skill_bubble` | 1.08 s | 每次施法一次，避免多个 control 事件重播 |
| 整局失败结果首次显示 | `audio/sfx_defeat` | 2.45 s | 每个 runId 的结果仅一次 |

泡泡龟普通攻击可轻用已有 `sfx_bubble_pop`，不再建立一个几乎相同的新文件。`cleanse` 净化可选用较轻的普通治疗音；若控制器支持单次增益，也可用 `sfx_skill_leaf` 的较低增益，避免和大治疗同帧重叠。胜利或失败只在整局结果播放，不在每波结束播放长旋律。

音频事件应与视图一样按当前局、波次和递增事件 ID 去重；暂停恢复丢弃过旧的纯视听事件。建议同时播放的短音效不超过 6 个，优先保留主动技能、珍珠受损与结果声音。技能短暂把音乐压低约 2–3 dB，收录或胜负可压低约 4 dB，恢复约 300–500 ms。强度最终以实际试听为准。

`IslandAudio` 已在构造时预载全部 18 个音效，提供六路音效上限、按类节流、优先级、约 400 ms 的音乐顺序淡变，以及暂停和销毁时的异步取消。上层需每帧调用 `audio.update(dt)`；参见 `AUDIO_CONTROLLER.md`。尚未加载完成的旧音效不补播。短时音乐压低尚未加入，以上压低数值仍为后续实际试听的混音建议。

## 检查用文件

普通战斗母带：`game/audio-source/exports/bgm_battle_master.wav`。

首领母带：`game/audio-source/exports/bgm_boss_master.wav`。

对应接缝试听：`battle_loop_join_preview.wav` 与 `boss_loop_join_preview.wav`，均为结尾 4 秒接开头 4 秒。要判断整曲耐听程度，还应把完整曲目连续听两轮。
