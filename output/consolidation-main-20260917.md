# 加载页与荣耀榜窗口：统一整合交接

日期：2026-09-17。源码核对、类型检查、定向回归已完成；本窗口可进入迁移静默阶段。本次协调未启动 Cocos、未迁移或删除目录。

## 最后用户要求

用户先要求加载船与游戏统一；宠物、关卡、无尽、竞技场和世界首领榜增加前三名龟龟展示、详细查看、自选轮换展示和登榜荣誉感。用户批准画面稿后要求带入游戏并加入合适动画和光效。主页布局不属于本轮修改范围。

## 已完成源码

- IslandArrival：启航帆船背景，复用原游戏字标，船帆/旗帜轻摆、海面流动、武器局部光效；不定进度动画避免虚构百分比。最后修正加载副标题的深色半透明衬底。
- HonorBoard/HonorMotion：三名领奖台、名牌、金银铜排名、角色与主页共用 CompanionDisplay/CompanionMotion，冠冕粒子/局部金光、海面动画；5名之后列表滚动。减少动态效果设置和隐藏页面停止更新。
- ShowcaseMenu/core honor：1–5只自有公开龟龟可选、顺序与轮换开关持久化，8秒轮换；仅展示，不改变战力、分数、战斗阵容。排除隐藏、已消耗、非自有、重复宠物。
- CommunityMenus：宠物/关卡/无尽榜和竞技场主榜接入，使用真实存档分数、进度、通关秒数；竞技场顶部倒计时、下方进攻/防守/匹配/奖励入口保留。AI使用真实AI记录，不为视觉效果修改排名。
- WorldBossMenus/RoomClient/server：世界榜使用真实服务数据与展示阵容；旧记录没有展示时保留空位。世界展示更新不改变伤害、次数和奖励。登录用户展示资产经服务器保存数据核验。
- PetDetails：外部宠物详情只读，防止同ID误读/修改本地宠物；保留原详情UI。
- 最后一处实机发现的阵容详情文字重叠已修正：CommunityMenus 当前展示文字 y 从185改为-143；已包含在最终成功包中。
- 竞技场倒计时移到顶部；关卡及世界榜底部多余说明移除，避免压住详情/展示按钮。

主要文件：game/assets/scripts/view/{HonorBoard,ShowcaseMenu,IslandArrival,CommunityMenus,WorldBossMenus,RoomClient,PetDetails,GameEntry,ArtV2Assets}.ts；core/{honor,community,communityTypes,worldBoss}.ts；game/server/{world-boss-service,lobby-server}.cjs。
新增素材：game/assets/resources/art-modern/{sailing-honor,honor-terrace,honor-pet-terrace}.png；动画shader为 sailing-arrival.effect、sea-chart.effect 的局部效果。

## 已完成检查

- 迁移前重新运行项目 tsc --noEmit：成功，output/honor-release-20260917/consolidation-typecheck.log 为空。
- 重新编译 core/game.ts、core/honor.ts 到现有 .test-build 后，执行 honor.test.cjs、world-boss.test.cjs、pet-details-ui.test.cjs：15/15通过，退出0。日志 output/honor-release-20260917/consolidation-tests.log。
- 既有最终 Cocos 包 BUILD_SUCCESS，内置核心回归通过；此次协调没有再次构建。
- 浏览器实际验证过加载页及返回、宠物榜、关卡榜初版、竞技场主榜、选展示龟龟→宠物详情→加入→保存返回、竞技场前三名阵容详情、世界首领服务连接及备战页。
- 实机对照图：output/honor-release-20260917/{loading,pet-final,arena}.png；compare-{loading,pet,arena}.jpg 已与批准稿并排检查。

## 遗留限制：不能标记全部视觉验收通过

浏览器自动化曾持续超时，连新tab也无法附着。未完成世界榜空态及奖励返回、小横屏844×390、最终加载字幕衬底及阵容文字修正重拍、最终控制台检查。世界榜代码/服务测试通过，但这不等于实机验收。
设计仍沿用游戏实际字体与按钮，批准稿中的复杂标题金饰和部分标签小图标有简化差异；未宣称逐像素还原。原模型/原图标保持不变。
详情记录见 output/honor-release-20260917/design-qa.md（final result: blocked），根 design-qa.md 顶部也记录，不能在统一交付时误称已全部通过。

## 最终成功包、入口与数据

- 最终目录：game/build/honor-final-20260917（不要使用中途失败且被部分清空的 honor-release-20260917）。
- 成功日志：game/temp/build-logs/20260917-163723.creator.log；output/honor-release-20260917/build-final5.log。
- 当时已HTTP核验7493服务主包与最终本地包一致，SHA256：0dfd391fdb6924c352fc5dbc2b10276aeb27353a8edad92880869953e39b6f1b。
- 独立试玩入口：http://127.0.0.1:7493/?preview=all-maps&v=honor-release-final
- 加载画面验收入口：同URL加 &arrival=review，限本地全地图预览，返回按钮退出。
- 启动脚本：game/tools/start-honor-preview.ps1，项目路径由脚本相对位置解析；Node运行时仍指向用户 C 盘缓存。
- 上次服务进程PID 10148，端口7493；迁移前由整合任务核验进程身份后停用，勿只按旧PID直接杀。
- ROOM_DATA：output/honor-release-20260917/preview-rooms.json。与7492的旧试玩数据分开，保留两份；不要覆盖正式账号。
- 迁移后统一重新编译 game/tsconfig.server.json；同时构建新前端，以包含其他窗口当前源码。

## 静默状态

本窗口已经落盘，没有待运行的构建/测试工具；已有预览服务按上文交给统一任务处理。接下来不再编辑、不迁移、不启动新构建，等待统一任务迁移与验收。
