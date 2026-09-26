const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../output/release-polish-20260915');
const core=name=>require('../.test-build/core/'+name+'.js');
const {ROLES,SKILLS,BATTLE_MAPS,ECONOMY}=core('data'),{BOSSES,TIER_NAMES}=core('bossCatalog'),{BOOK_WEIGHTS,PROTOTYPE,QUALITY_NAMES}=core('prototypeConfig'),{SHOP_PACKS,SHOP_CONFIG}=core('shop'),{RAIDS,RAID_BALANCE}=core('raids'),{RELEASE_BALANCE}=core('releaseBalance'),policy=core('taskPolicy'),{levelCost}=core('development');
const names={stone:'岩盾',spike:'叶灵',crystal:'珊歌',leaf:'阳光',bubble:'潮行'};
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(v=>String(v??'—').replaceAll('|','／').replaceAll('\n','；')).join(' | ')+' |').join('\n');
const category=s=>s.active?'职业主动':s.specialization?'职业专精':s.precious?'珍贵通用':'通用';
const simulations=JSON.parse(fs.readFileSync(path.join(root,'balance-simulation.json'),'utf8'));
const pvp=JSON.parse(fs.readFileSync(path.join(root,'pvp-simulation.json'),'utf8'));
const pct=(x,total)=>(100*x/total).toFixed(3)+'%';
let xp=0;const levels=Array.from({length:50},(_,i)=>{const l=i+1,row=[l,xp,l===50?'满级':levelCost(l),(l-1)*3];if(l<50)xp+=levelCost(l);return row;});
const write=(name,text)=>fs.writeFileSync(path.join(root,name),text,'utf8');
write('数值策划与技能机制.md',`# 哥喂龟 · 数值策划与技能机制（2026-09-15）

本表对应本轮实际代码；金额均为当前游戏显示金币（economyVersion 3）。保留旧存档、正在进行的历史战斗和已生成奖励，不重新抽取、不回收旧收益。当前为可试玩候选版本，数值经过自动战斗基线验证；真实玩家的长期留存、真人 PvP 公平性仍需要上线前的小规模测试。

## 1. 核心循环与成长目的

打一关 → 获得金币、材料、首领掉落和解救伙伴 → 合宠或打书 → 下一关体验清群、坚守或控场能力的变化。3～4个相互配合的技能就应有作用；6～8技能补齐弱点，12技能是长期目标。技能数量奖励不保证天赋、技能搭配或职业主动；避免一次邀请直接送满养成。

- 连击清群：连击＋多重攻击／散射，范围清怪；面对反射、重甲要换法系或控场。
- 坚守反击：嘲讽＋硬壳＋反伤／反击风暴，配治疗；远程绕行、破甲和法伤是反制。
- 控制接力：定身／海霜风暴＋追击，控制后集中输出；首领控制抗性防止无限站桩。
- 危机恢复：治疗盾、重生、曙光归来；受范围压血和分路压力限制。

12技能同时生效，不采用12层同尺寸大特效。核心主动占主要视觉层，触发被动用短促命中光、护盾、控制状态表示。职业专精占用现有技能位并要求对应主动；学习专精时保护前置主动，其他打书仍按现有技能位随机覆盖，已有同名技能不可再学。

## 2. 基础属性与自由加点

${table(['伙伴','职业','基础生命','基础攻击／治疗','间隔秒','护甲','法抗','现代基础射程'],Object.values(ROLES).map(r=>[names[r.id],r.id==='bubble'?'召唤':r.job,r.health,r.attack,r.interval,r.armor,r.resist,r.id==='stone'?2.8:r.id==='spike'?4.6:r.range]))}

表内是角色模板，不等于当前宠物面板。射手与法师基础射程均4.6，部分现代地图统一乘0.9适配世界比例；远望另加0.3。战士提高到2.8。

每级3个自由点，50级共147点。记 L=等级，P=该项加点，A/H/D=对应天赋值，G=成长天赋÷100：

- 天赋倍率：0.8＋0.2×天赋÷100。
- 攻击成长倍率：1＋0.005×(L−1)＋P攻击×0.01×(0.75＋0.25×A÷100)×G。
- 生命成长倍率：1＋0.004×(L−1)＋P生命×0.009×(0.75＋0.25×H÷100)×G。
- 防御加点增加护甲：P防御×0.4×(0.75＋0.25×D÷100)×G；法抗系数为0.32。
- 面板攻击=基础攻击×天赋倍率×攻击成长倍率。生命另计强壮12%；护甲、法抗另计硬壳／抗魔。
- 局内临时等级仍独立，局内1～10级的成长倍率为1＋0.1×(局内等级−1)×G。
- 防御减伤基本形式：伤害×100÷(100＋有效护甲或法抗)，穿甲、破甲在对应伤害计算前应用。
- 洗点费用=(20＋2×等级)×100金币，返还全部已分配点；不改等级和天赋。

天赋面板为50个刻度，10刻度=一星；基础资质显示起点50、成长显示起点60。每份对应培养材料只增加1刻度。培养费用随已有星级递增，修复原来低星单次费用过高的问题：

${table(['已满星级','攻击／生命／防御每刻度','成长每刻度'],[0,1,2,3,4].map(star=>[star,(5+star*3)*100,(12+star*4)*100]))}

## 3. 经验速度

升到下一级需求：60＋12L＋2L²。50级累计98,490经验。上阵伙伴各自得到完整经验，不在五只之间平分。日常材料、登录8技能宠不直接送等级，避免礼包绕过成长。

- 关卡每波：22＋2×关卡索引＋3×波次；胜利再加50。第1关全通205经验，第50关695经验。
- 无尽每波：10＋2×min(波次,60)。
- 副本：完成波数×(16＋8×副本索引)，胜利加60。
- 竞技场胜65、负32，主动放弃0。
- 以每局约300经验估算，单队满级约329局；这是公式估算，不是留存实测。前期几局即可升级，中后期培养与技能质量比单纯刷等级更重要。

${table(['等级','累计经验','下一级经验','累计自由点'],levels)}

## 4. 普通关卡节奏

每关5波，每波一个首领，末波大首领。第一关保持已确认路线和教学配置。第2～50关取消怪物生命与首领等级的多次倍率叠加，改为可读的独立预算。以下 k=关卡索引（第2关k=1），w=1～5：

- 出怪时长：32＋2w秒；普通怪数量：16＋floor(k÷10)＋3w。
- 小怪生命倍率：(0.60＋0.019k)×1.08^(w−1)；伤害倍率=sqrt(生命倍率)×0.95。
- 首领生命：(850＋30k)×末波系数×[1＋0.06(w−1)]；末波系数1.75，否则1。
- 首领伤害倍率：(0.28＋0.0055k)×末波1.3，否则1。
- 首领在本波出怪结束前7秒入场。新关卡首领未受控制时约34秒通过所属路线；小怪在现有现代移动基准上加快12%。路线加长后不靠一味加血拖时间。
- 分路、护甲、法抗、快跑、远程、治疗等组合按波次战术表变化；高阶首领有预警和控制抗性。反制以位置、伤害类型和留技能为主。

本轮135次固定站位自动战斗覆盖9关、5种成长阵容、3个种子。不调位、不换宠，天赋统一80/80/80/100，角色按相互配合的技能排序取前N个。胜利局秒数是战斗模拟时间，不包括人类思考和波间操作；失败局秒数不可当成完整关卡时长。

${table(['关卡','阵容','胜／样本','平均守护生命','模拟秒数','各次完成波数'],simulations.report.map(r=>[r.level,r.profile,r.wins+'/'+r.seeds,r.meanHp,r.seconds,r.cleared]))}

实测结论：第一关初始阵容约261秒；第2关4技能/L10约323秒；第25关6技能/L20约266秒；第50关12技能/L50约358秒。固定站位的8技能/L30在第50关仍失败，不能声称所有8技能阵容都可无操作通关。初始弱队打第2关可超过6分钟，需在试玩观察中继续检查；强队重刷前期更快，不强行等待补满时长。

## 5. 无尽、副本与竞技场

无尽初始每波7怪，每2波加1，上限24；出怪22秒；生命倍率0.85×1.07^(min(w,60)−1)，60波后额外乘[1＋0.07(w−60)]。每5波奖励节点、每10波首领，首领波普通怪约减半。30/60/90波后的技能礼包分别提升为珍贵／主动／专精。已有连续刷怪和结算宝箱保留。

${table(['副本','波数','基础金币','各材料','精品技能书','生命修正','首领修正'],RAIDS.map((r,i)=>[r.name,r.waves,r.gold*100,r.food,r.books,RAID_BALANCE[i].health,RAID_BALANCE[i].boss]))}

双环潮狱180秒，240只分批连续入场，每约0.707秒1只；每60只1首领，强度按50只为一档递增。结束剩余≤5为3星、≤10为2星、≤15为1星，超过15失败。其余副本按守护生命20／≥12／不足12区分3／2／1星。当地AI补位是测试队伍，不进入掉落池。

竞技场本轮将整队入场间隔由2.5秒缩为0.4秒，现代规则双方最大生命及初始护盾均乘1.75，宠物背包面板和PvE不变。仍采用相近排名匹配、进攻／防守两套阵容和最大120秒保护；3名进攻方抵达终点或消灭防守方获胜。超时是平局，不伪造失败。周积分胜+48、负−18、平+8；青铜0、白银120、黄金300、铂金550、钻石850、王者1200。周日22点结算后暂停挑战，周一重新开始，周奖励进邮箱。

${table(['进攻','防守','进攻胜／样本','平局','平均秒'],pvp.rows.map(r=>[r.attack,r.defense,r.wins+'/'+r.seeds,r.draws,r.seconds]))}

这48次是本地AI规则验证，当前竞技场没有接入真人对战后端。固定站位同档高技能队仍明显偏向防守，差距过大的阵容会很快结束；这两项需要在真人匹配的实力区间、阵容选择和对局回放数据上继续校准，不能用这一小组样本宣称PvP已经完全平衡。

## 6. 金币、掉落与消耗

- 初始30,000金币。关卡每波800、胜利2,000、首次再加10,000；首领额外1,000＋600×品阶索引，材料1＋floor(品阶索引÷2)。第1关全通仅基础结算6,000，计5只绿色首领约11,000，首通约21,000；高阶首领关更多。
- 日活全领6,000、周活全领27,000；分别附材料和礼包。广告补给1,200金币＋海参1；每天最多6次，每个入口最多3次。分享不直接发金币，避免反复点分享制造通胀。
- 交易成交税20%；租赁和挂单按玩家报价。旧金币缩小10倍的迁移保持余额、价格和未领取回执同比变化，本轮不再缩一次。
- 一次普通完整关卡可以支撑几次低星培养或约3本基础技能招募；高级礼包需积累，不替代合宠。

${table(['商店礼包','价格金币','概率与内容'],SHOP_PACKS.map(p=>[p.name,p.price*100,p.description]))}

普通招募配置见随附JSON的shopConfig。分类技能礼包在该分类可用技能中等概率；普通／精品技能书抽取按下表权重除以该列总权重计算。广告不进入必做每日任务，不把必要养成资源锁在广告后。

## 7. 全部技能机制与抽取概率

护盾上限最大生命40%；额外目标总上限5；常规攻速增益80%、减速60%、暴击触发率60%。同类减速取最大；额外目标、连锁、反伤不递归制造无限触发。首领控制抗性、连续控制衰减以及被动内置冷却照常生效。

${table(['技能','分类','职业／前置','主动或独立CD秒','实际机制','普通书池','精品书池'],SKILLS.map(s=>[s.name,category(s),(s.role?names[s.role]:'通用')+(s.requires?'／'+SKILLS.find(x=>x.id===s.requires).name:''),s.cooldown??'见机制',s.description,pct(BOOK_WEIGHTS[s.id].ordinary,SKILLS.reduce((n,t)=>n+BOOK_WEIGHTS[t.id].ordinary,0)),pct(BOOK_WEIGHTS[s.id].fine,SKILLS.reduce((n,t)=>n+BOOK_WEIGHTS[t.id].fine,0))]))}

## 8. 首领与配置附件

共48只首领，绿10、蓝10、紫8、黄8、红6、金6。完整外形、技能、特性和掉落配置在“全部数值配置.json”及游戏图鉴。地图坐标、技能权重、商店配置也一并导出，便于后续按关卡验证，不只给策划口号。

${table(['首领','品阶','特性技能','机制','重要技能掉落'],BOSSES.map(b=>[b.name,TIER_NAMES[b.tier],b.skill,b.detail,SKILLS.find(s=>s.id===b.dropBook)?.name]))}
`);
write('奖励广告分享与账号接入.md',`# 好礼、广告、分享与账号接入（2026-09-15）

## 游戏里的入口

| 位置 | 操作和奖励 | 当前状态 |
| --- | --- | --- |
| 主页右侧「好礼」 | 七日登录、邀请、广告累计、日活、周活、待领取六页 | 配套账号服务已实现 |
| 好礼→广告好礼 | 自愿看广告，1200金币＋海参1 | 真实广告服务未配置时明确提示 |
| 主页体力＋ | 自愿观看，最多恢复5体力 | 服务端验证完成才发放 |
| 关卡结算 | 基础金币再领一份；不翻倍首通、首领或其他奖励 | 同一结算只允许一次 |
| 战斗招募／换一批 | 自愿观看刷新候选 | 遵循原有每局刷新限制 |
| 好礼→分享给好友 | 系统分享；不支持时复制邀请内容和链接 | 不自动发送消息 |
| 伙伴详情→分享伙伴 | 分享名字、技能数和等级 | 带当前账号邀请码 |
| 首领详情→分享图鉴 | 分享首领及其特性 | 玩家主动触发 |
| 现代战斗结算→分享战绩 | 分享关卡、波次、守护生命 | 玩家主动触发 |

每天最多6次已完成广告，各入口最多3次。关闭、中断、失败不计数；服务端验证回调有独立流水，重复回调不重复奖励。不同页面异步返回不会把新页面覆盖成旧页面。

## 固定累计政策

${table(['有效邀请人数','技能数','随机伙伴数量'],policy.INVITE_MILESTONES.map(x=>[x.at,x.skills,x.count]))}

${table(['累计有效广告次数','技能数','随机伙伴数量'],policy.AD_MILESTONES.map(x=>[x.at,x.skills,x.count]))}

${table(['累计登录天数','金币','四类材料各份数','伙伴'],policy.LOGIN_GIFTS.map((g,i)=>[i+1,g.gold,g.material,g.skills?g.skills+'技能×1':'—']))}

这三类每档奖励全账号只领一次，切区不重置。邀请要求新账号填写邀请码注册且完成首次登录；只注册不计数。七日为累计登录，断签不清零。随机宠物保技能数量，天赋和具体组合随机。背包不足时奖励留在「待领取」，不会重抽，需回原领取区服接收。

## 日活与周活

${table(['每日任务','目标','活跃'],policy.ACTIVITY_TASKS.map(t=>[t.name,t.target,t.points]))}

日活上限100；总任务120点，允许玩家少做一项20点任务。房间副本完成一次按5波计入挑战任务。每日北京时间00点更新，周一00点更换周活周期。

${table(['日活门槛','金币','四类材料各份','额外'],policy.DAILY_ACTIVITY.map(g=>[g.at,g.gold,g.materials,g.pack==='common'?'通用技能礼包1':'—']))}

${table(['周活门槛','金币','四类材料各份','额外'],policy.WEEKLY_ACTIVITY.map(g=>[g.at,g.gold,g.materials,g.pack==='common'?'通用技能礼包1':g.pack==='precious'?'珍贵技能礼包1':'—']))}

## 账号与配套服务

设置→账号与服务包含：注册／登录、切换账号、切区、修改密码、反馈、保存并退出。游客存档单独保留；首次注册可接管当前游客进度，该游客进度不会被重复复制给多个新账号。各账号／区服分别保存。当前正式配置仅「晴湾一区」，不展示无法进入的假区服。

密码使用带随机盐的scrypt摘要，令牌服务端只保存摘要。修改密码撤销其他会话。云存档使用版本检查，防止不同设备静默互相覆盖。奖励先在账号服务生成固定回执，再写入游戏和云存档，确认后才标记接收。

运行入口：game/server/Start-RoomService.ps1；数据：game/server/data/rooms.json及对应.accounts.json。反馈生成GW工单号，保存在配套服务的feedback队列。当前没有实际客服人员或外部客服系统接收工单。

## 上线还需要你提供的配置

1. 发布平台（网页、微信小游戏、安卓／iOS）及正式HTTPS域名。127.0.0.1仅本机可访问，分享给外部好友不能打开。
2. 广告平台账号和激励视频广告位。后端使用REWARDED_AD_URL和REWARDED_AD_SECRET；由平台适配服务在确认观看后调用POST /api/account/ad-callback，字段nonce、transactionId、signature。signature为HMAC-SHA256(secret, nonce + ':' + transactionId)。密钥只能放服务器。
3. 客服联系渠道和服务人员；GAME_SUPPORT可配置客服信息。当前反馈已保存，但不应承诺有人实时回复。
4. 真人线上竞技场、正式身份认证和邀请反作弊。当前注册是本地配套账号，不是微信／手机实名登录；需要正式平台身份和风控，才能可靠地阻止批量小号刷邀请。日活目前由客户端验证过的存档汇总，正式运营需要服务端权威战斗／活动流水。

这些外部接入没有用模拟广告或假玩家冒充。奖励政策及本地持久化流程可试玩，正式商业接入应在小范围测试和配置验证后开放。
`);
write('全部数值配置.json',JSON.stringify({version:RELEASE_BALANCE.version,release:RELEASE_BALANCE,roles:ROLES,skills:SKILLS,bookWeights:BOOK_WEIGHTS,shopConfig:SHOP_CONFIG,shopPacks:SHOP_PACKS,economy:ECONOMY,prototype:PROTOTYPE,qualityNames:QUALITY_NAMES,levels:BATTLE_MAPS,bosses:BOSSES,raids:RAIDS,raidBalance:RAID_BALANCE,rewards:{invite:policy.INVITE_MILESTONES,ads:policy.AD_MILESTONES,login:policy.LOGIN_GIFTS,daily:policy.DAILY_ACTIVITY,weekly:policy.WEEKLY_ACTIVITY}},null,2));
write('美术素材来源.md',`# 本轮美术素材

四张新位图均由内置图像生成工具按已确认图稿编辑。原稿和旧资源保留；PNG兼容化仅重新编码，不进行程序重绘。

| 游戏资源 | 生成原文件 | 修改意图 |
| --- | --- | --- |
| companion-signatures-refined.png | exec-2e89709e-e588-4ff6-9687-8f86b31ec752.png | 保留岩盾；叶灵深翡翠，阳光铜金琥珀，珊歌冰白蓝，潮行靛蓝紫晶；保留几何和品味 |
| combat-main-poses-refined.png | exec-aaa82f74-e62b-41ea-8c35-2a2df6c0f371.png | 战斗主要角色姿态统一新配色，保留切片布局及武器锚点 |
| combat-support-poses-refined.png | exec-e5a8df34-2485-41e1-9482-482647b4da48.png | 治疗与召唤战斗姿态统一新配色 |
| portraits-clean-refined.png | exec-3eff2930-eb97-49c1-bc89-859930a733a2.png | 头像颜色与完整角色一致，便于职业识别 |

生成原文件目录：C:/Users/Administrator/.codex/generated_images/01a07c91-e0c7-7823-94f5-a4a7384b1a14/ 。运行资源目录：game/assets/resources/art-modern/ 。

藤蔓、晶体、水面和战斗持续技能为运行时着色器动画；不是在主页面加一张静态效果图。叶灵藤蔓采用约9秒生长、流光、消退循环，茎与叶分层；战斗动作采用预备、释放、回收曲线。当前角色仍为分区变形的2.5D绘制，无法等同完整3D骨骼和任意角度动作。
`);
console.log('Exported design, reward policy, full data and art provenance to '+root);
