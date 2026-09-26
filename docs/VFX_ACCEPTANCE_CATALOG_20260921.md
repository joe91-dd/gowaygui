# 特效逐项制作与验收清单

这份清单以 `data.ts`、`enemyG1Catalog.ts` 和 `BattleWorld.event()` 的实际触发链为准。后续每个特效都必须在对应角色或敌方模型上验收，不能只看脱离角色的中心特效。

## 验收对象覆盖

| 类别 | 覆盖数量 | 验收对象 |
|---|---:|---|
| 普通角色 | 5 | 石头龟、刺刺龟、水晶龟、叶子龟、泡泡龟 |
| 进阶角色 | 5 | 上述 5 个角色的进阶模型与进阶武器 |
| 小怪 | 19 | M01–M19，包含近战、远程、飞行、治疗、控制和特殊攻击模型 |
| 精英 | 9 | E01–E09 |
| Boss | 40 | B01–B40，按实际目录继续扩展时沿用同一验收项 |
| 世界 Boss | 4 | W01–W04 |

## 角色攻击与主动技能

| 角色 | 普通攻击 | 职业主动 | 专精主动 | 状态 |
|---|---|---|---|---|
| 石头龟 | 岩盾普攻 | 岩石风暴 `hold` | 碎岩天灾 `stoneMastery` | 待重做、逐项验收 |
| 刺刺龟 | 弓手普攻 | 穿甲弹 `piercingShot` | 箭雨风暴 `spikeMastery` | 待重做、逐项验收 |
| 水晶龟 | 冰系普攻 | 海霜风暴 `crystalCannon` | 极寒回响 `crystalMastery` | 待重做、逐项验收 |
| 叶子龟 | 治疗弹 | 大治疗 `greatHeal` | 曙光归来 `leafMastery` | 待重做、逐项验收 |
| 泡泡龟 | 召唤弹 | 潮灵召唤 `bubbleRing` | 通灵 `spirit` | 待重做、逐项验收 |

每个角色都要分别验收普通模型和进阶模型，至少检查：待机到施法动作、施法起点、武器/手部出手位置、持续动作、命中点、受击反应、结束收招和特效与角色体型的比例。

## 角色触发与通用反馈

### 需要独立视觉识别的触发

狂热 `fervor`、世事无常中的暴击与异常治疗 `caprice`、变羊 `polymorph`、变大 `giant`、迷糊/减速 `daze`、法术奥义命中 `arcane`、圣光 `holyLight`、冷静触发 `calm`、反击风暴 `counterStorm`、重生 `rebirth`、沉睡 `sleep`、多重攻击 `extraTarget`、追击 `pursuit`、挑衅 `taunt`、鼓劲 `encourage`、开场盾 `openingShield`、自保 `lastShield`、格挡 `block`、反伤 `reflect`、分担 `share`、吸血 `lifesteal`、破魔 `shredResist`、破甲 `shredArmor`、定身 `root`、虚弱 `weaken`、净化 `cleanse`、治疗盾 `healShield`。

### 全局反馈

施法起手、施法打断、命中、暴击、护盾生成、护盾破裂、控制开始、控制结束、治疗、复活、死亡/消散、波次开始、失败。胜利特效按当前要求取消，不纳入制作。

## 敌方普通攻击与技能

敌方每个个体都要至少验收一次普通近战或远程攻击；具有专属 `effect` 的个体还要验收专属技能。小怪和精英要检查体型差异，Boss 和世界 Boss 要检查大体型、飞行高度、施法动作和范围落点。

### 小怪 M01–M19

| 个体 | 名称 | 类型 | 专属效果 |
|---|---|---|---|
| M01 | 小墨团 | 小怪 | ink |
| M02 | 快跑蟹 | 小怪 | runner |
| M03 | 铁壳蟹 | 小怪 | armored |
| M04 | 雾泡怪 | 小怪 | frost |
| M05 | 吐墨螺 | 小怪 | mortar |
| M06 | 潮毒蛛 | 小怪 | web |
| M07 | 炮背螺兽 | 小怪 | mortar |
| M08 | 海萤医师 | 小怪 | heal |
| M09 | 帆翼蝠鱼 | 小怪 | ranged |
| M10 | 盾叶海胆 | 小怪 | armorBreak |
| M11 | 电须鳗 | 小怪 | focusFire |
| M12 | 爆盐河豚 | 小怪 | slow |
| M13 | 钻沙鼠 | 小怪 | anchor |
| M14 | 走根幼苗 | 小怪 | silence |
| M15 | 灯笼鮟仔 | 小怪 | shield |
| M16 | 盾珊卫 | 小怪 | shock |
| M17 | 墨泡潜贼 | 小怪 | shock |
| M18 | 棘籽射手 | 小怪 | shock |
| M19 | 潮钟侍者 | 小怪 | shock |

### 精英 E01–E09

| 个体 | 名称 | 专属效果 |
|---|---|---|
| E01 | 搬壳大蟹 | shock |
| E02 | 缚丝蛛卫 | web |
| E03 | 潮铃海马 | heal |
| E04 | 符潮乌贼 | magic |
| E05 | 阵鼓海象 | rally |
| E06 | 棱镜海胆 | magic |
| E07 | 掘礁穿山甲 | charge |
| E08 | 双镰螳虾 | slash |
| E09 | 风眼鸥 | ranged |

### Boss 与世界 Boss

Boss 需要全部覆盖，不能只挑一个代表模型。当前 44 个个体按技能族分组如下：

| 技能族 | 个体 |
|---|---|
| 破浪 `breakwater` | B01 礁钳统领、B07 铁吻鳄王、H01 苍潮龙王、B17 藤冠螳王、B23 锈帆锤鲨、B31 藤壳象王 |
| 震荡 `shock` | B02 荆背獠王、B06 晶核岩卫、H03 熔礁魔君、B19 雷喙翼王、B25 潮鼓蛙王、B33 锚臂龙虾 |
| 陨石/迫击 `mortar` | B03 珊脊蜥王、B10 孢冠长老、B18 铁帆蚌堡、B22 深灯鮟皇、B30 骨帆旗鱼 |
| 增援 `rally` | B04 苔角鹿王、B08 螺堡领主、B15 赤怒海狮、B27 贝冠鹦皇、B35 礁鬃狮王 |
| 汲取 `drain` | B05 墨潮祭司、H02 幽渊墨皇、B14 裂潮海蛇、B21 葬锚鳗王、B32 月刃蝙王 |
| 暴风雪 `frost` | B09 岚翼鳐王、H04 晶脊岩王、B20 镜潮水母、B28 巨吻海豹 |
| 蛛网 `web` | B11 织潮蛛后、B26 盐晶蝎皇、B34 潮砂蜈王 |
| 火雨 `fireRain` | B12 焰轮海星王、B13 陨火角鲸、B36 棘冠豪王 |
| 信标 `beacon` | B16 菌伞女王、B24 琥珀蜂后、B29 海参堡主 |
| 世界技能 | W01 负岳玄鳌 `worldMeteor`、W02 万触渊主 `worldBlaze`、W03 焚潮巨猿 `worldTide`、W04 星冠狮鹫 `worldGale` |

## 当前已发现的遗漏

下面这些效果在当前特效检视器中没有独立验收项，或在 `bossCast()` 中会落到通用冲击效果，必须补齐：

- 小怪/精英专属：`ink`、`runner`、`armored`、`ranged`、`heal`、`magic`、`charge`、`slash`、`armorBreak`、`focusFire`、`slow`、`anchor`、`silence`、`shield`。
- 世界 Boss：`worldMeteor`、`worldBlaze`、`worldTide`、`worldGale`。
- 角色通用触发：`caprice`、`polymorph`、`daze`、`arcane`、`holyLight`、`calm`、`rebirth`、`sleep`、`extraTarget`、`pursuit`、`block`、`share`、`lifesteal`、`shredResist`、`shredArmor`、`root`、`weaken`、`healShield`、`openingShield`、`lastShield`。
- 组合验收：普通角色与进阶角色的同一主动技能差异、角色动作与出手点、Boss 大体型/飞行模型的落点比例、连续技能的前后段衔接。

## 新验收模型

验收页面必须同时选择：

1. 施法者：五个普通角色或五个进阶角色。
2. 受击者：小怪、精英、Boss、世界 Boss 的实际模型。
3. 技能：只显示当前施法者或敌方个体可用的技能。
4. 时间：施法前、施法中、命中瞬间、持续中、结束后五个定格点，并支持连续播放。

每个条目按六项记录结果：动作协调、出手位置、特效形体、命中/受击反馈、角色与特效比例、性能与裁边。六项全部通过后才算验收完成。
