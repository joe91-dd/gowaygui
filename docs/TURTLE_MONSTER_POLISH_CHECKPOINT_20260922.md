# 龟龟与怪物成品化检查点 · 2026-09-22

## 本次已完成

- 5 个 10 技能龟龟头像已更新：`game/assets/resources/ui/portraits/portrait-{stone,spike,crystal,leaf,bubble}-advanced.png`。
- 5 个 10 技能龟龟主页全身图已新增：`game/assets/resources/art-modern/home-advanced-{stone,spike,crystal,leaf,bubble}.png`，统一为 384×384 RGBA 透明画布，并保留职业动作、表情和对应光效。
- `ArtV2Assets` 已注册主页全身资源，`IslandUI` 与主页主角展示均会在 10 技能时切换到新全身图。
- 战斗飘字已加入：伤害、暴击、治疗、护盾、技能、被动和控制，增加描边、可读字号与更长的上浮淡出时间。
- 龟龟材质的法线强度和高光响应已提升；怪物 G1 材质统一增加涂层粗糙度、镜面高光和发光响应。
- 怪物图鉴陈列卡已加入品阶光环、识别徽记、空域/陆地标识，模型仍使用现有敌人资产和原有动画。

## 验证

- TypeScript：`game/tsconfig.json --noEmit` 通过。
- Cocos 3.8.8 Web Mobile 构建通过，输出：`game/build/map-themes-20260920`。
- 构建核心回归检查通过，覆盖真实双波战斗、技能校验和存档恢复。
- 当前试玩服务已同步到：`game/build/vfx-integrated-20260920`。
- 试玩地址：`http://127.0.0.1:7640/?preview=all-maps&appearance=advanced&all-modes=1&map=14&cache=20260922turtle`。

## 恢复方式

以后重新构建主题试玩时，以 `game/build/map-themes-20260920` 为源；若需要恢复当前服务版本，可将该目录复制到 `game/build/vfx-integrated-20260920`。不要删除 `game/temp/creator-turtle-polish-20260922f`，它是这次构建使用的独立 Cocos 用户数据目录。


## 2026-09-22 显示修复
- CompanionMotion 保留 10 技能独立全身 SpriteFrame，避免被基础 signature 图覆盖。
- 战斗数值改在 Canvas/UI 层按世界坐标投影，伤害、暴击、治疗、护盾及技能/被动/控制文字使用同一显示链路。
- 已实战验证伤害 -23、-41 可见；主页已验证新岩盾全身图。
- 新构建核心回归通过，已同步试玩服务。


## 2026-09-22 头像与竞技场显示修订
- 头像改用同一批进阶全身图作为唯一造型参考，重新裁成 384×384 头肩头像：岩盾金色岩晶冠、叶灵藤叶冠、霜歌冰晶冠、阳光日光叶冠、潮行潮汐王冠与全身图逐一对应。
- `CompanionMotion.ts` 保留独立主页全身帧，并为 5 个进阶全身图加入角色色装饰光环、5 个环绕光点和呼吸式亮度/轨道动画。
- `HonorBoard.ts` 展示位传入 10 技能标记，竞技场榜单/展示位会使用进阶全身图，不再回退基础款。
- `BattleScreen.ts` 飘字改为轻量单行文字：伤害/治疗/护盾直接显示，暴击使用红色文字，技能/被动/控制保留短标签并统一描边；竞技场战斗复用同一反馈链路。
- 已通过 Cocos 3.8.8 Web Mobile 构建并同步到 `game/build/vfx-integrated-20260920`。
- 实机预览已核对：主页进阶全身图、竞技场进阶展示、第一关头像头部细节、战斗普通伤害和红色暴击飘字均可见。
- 最新试玩：`http://127.0.0.1:7640/?preview=all-maps&appearance=advanced&all-modes=1&map=0&cache=20260922avatarfinal`。

## 2026-09-22 全身参考头像与角色专属动效
- 重新用 5 张 `home-advanced-{role}.png` 全身图作为唯一参考生成头像，裁切为基础款同类的满框头肩构图：减少顶部空白、脸部占比提高、只保留必要头肩装饰；坦克头像的橙金色宝石与全身图严格一致。
- `CompanionMotion.ts` 增加按角色绘制并运动的装饰层：stone 岩块慢速环绕，spike 叶片/绿带轨迹，crystal 菱形水晶与蓝色轨迹，leaf 叶片/金色光点，bubble 紫色水珠/潮汐轨迹；每个装饰有独立相位、速度、旋转和呼吸透明度。
- 主页底部伙伴头像继续通过 `skills.length>=10` 实时选择 `advanced-portrait-*`，与主页当前进阶全身角色保持一致。
- 已再次 Cocos 构建并同步试玩服务；最终 cache 参数为 `20260922avatarfinal2`。

## 2026-09-22 头像切换与竞技场反馈修订
- 修复 `GameEntry.home()` 主页五个圆形队伍头像资源键写死为基础款的问题：现在每只队伍龟按自身 `skills.length>=10` 实时选择 `advanced-portrait-*`，头像框内不再统一显示基础头像。
- `ChallengeScreen`（副本/竞技场实际战斗控制器）接入与主战斗相同的数值反馈链路，伤害、治疗、护盾和红色暴击文字按战斗单位世界坐标投影到竞技场画面。
- 新头像全部以 5 张进阶全身图为唯一参考，按脸部满框比例重新裁切，严格保留对应头饰和宝石颜色。
- 重新构建并同步试玩服务，构建状态 passed；最新缓存参数 `20260922arenaavatars`。

## 2026-09-22 最终验收修订
- 头像已进一步按基础头像构图裁切：减少顶部空白并放大面部，头饰只露出与全身图一致的关键部分。
- 主页五个队伍头像已改为按每只龟实际技能数动态选择基础/进阶头像。
- 进阶全身动效改为角色专属装饰层：石块、叶片、绿带、水晶、蓝带、光点、紫水珠和潮带均独立运动，不再依赖静态贴图观感。
- 竞技场 `ChallengeScreen` 已加入伤害/治疗/护盾/暴击飘字投影，和主战斗使用同样的简洁样式；第一关实机已看到普通数字与红色暴击数字。
- 最终构建通过并同步至试玩服务，最新试玩缓存参数：`20260922avatarfinal3`。

## 2026-09-22 眨眼、详情位置与装饰层修订
- 为 5 个进阶全身角色增加独立眼睛坐标与眼睛尺寸，眨眼遮罩不再沿用基础签名图坐标。
- 主页展示角色详情卡整体下移约 10 个 UI 单位。
- 修复装饰节点层级被角色精灵遮挡的问题；装饰节点每帧保持在角色精灵上层，并按角色独立更新轨迹、相位、旋转、缩放和透明度。
- 已重新构建并同步试玩服务，构建状态 passed；最新缓存参数 `20260922blinkfix`。

## 2026-09-22 blinkfix verification
- Latest web build served with cache `20260922blinkfix`.
- Homepage visual check passed: advanced five portraits are present; stone fullbody blink alternates against the calibrated eye anchors; latest screenshots captured at two time points.
- Companion ornaments remain independent animated nodes above the advanced fullbody sprite, with per-role orbital/twirl timing in `CompanionMotion.ts`.

## 2026-09-22 final animation correction
- Advanced full-body sprites now pass a `staticPaint` rig flag: authored proportions stay rigid, while calibrated eyelids remain animated.
- Advanced eye anchors use the SpriteFrame UV orientation and were checked across a live blink cycle.
- Legacy signature padding no longer changes the authored full-body shape through deformation; display scale remains consistent with the prior homepage layout.
- Advanced accents are separate foreground nodes with stronger motion: orbiting stones, green leaves, blue crystals, yellow leaves, purple crystals, and ribbons. 阳光 also has a lamp-anchored glow node at the left-side lantern position.
- Final build passed and was synced to the preview server under cache `20260922deliver`.
