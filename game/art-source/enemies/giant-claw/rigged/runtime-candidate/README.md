# 巨钳蟹：独立骨骼运行候选

本目录在根代理已审的 `giant-claw/candidate-01` 静态造型上添加单骨架和五动作。根代理实际查看走路和攻击正面后批准运行候选推广；三文件复制与冻结状态以 `promotion-manifest.json`、`source-freeze.json` 为准。此任务未启动 Cocos；离线检查和动作关键帧审查不等于实际游戏或最终美术验收。图片检查记录见 `visual-review.json`，技术证据见三个 `*-check.json`。

## 交付文件

- `giant-claw.blend`：36 个原始可编辑网格及权重、16 骨、五动作，图集打包在源内。
- `giant-claw-review-scene.blend`：一网格蒙皮版本及审图摄影棚，摄影棚不导出游戏。
- `export/giant-claw.fbx`、`export/giant-colour.png`、`export/giant-roughness.png`：独立运行候选。
- 上级原创脚本 `enemies/build_giant_claw_rigged.py`；本目录 `verify_candidate.py`、`render_actions.py`、`package_candidate.py` 可重做检查、渲染和来源清单。
- `review.html` 可查看五动作与攻击正面、受击侧面原始渲染。

## 保留与来源

仅使用本项目原创的巨钳蟹 c01；没有外部模型、图片贴片、动作库或其他游戏内容。原脚本和 c01 全目录逐文件 SHA-256 保留证明见 `prototype-preservation.json`。原样板 blend 为 `cd579fb4c56cf276d9a02dec9267a354e0442e4875683d0a7ae48de3704924e0`。

36 个网格的全部顶点、面索引、UV、对象矩阵、材质节点/连接/数值、打包 PNG 与已审原样板逐项一致；没有通过缩放网格或调整灯光改变造型。新增内容仅骨架、权重、动作、运行导出和独立审图场景。各腿前四圈原有顶点采用 body→leg 平滑权重，其余部位为明确的刚性玩具关节。

## 规格与将来接入

| 项目 | 候选值 |
|---|---|
| 网格/材质/骨架 | 1 / 1 / 1，16 骨 |
| 顶点/三角 | 10,674 / 21,208，等于已审几何 |
| 材质 | `GiantClaw_Toy_Atlas` |
| 内部图集名 | `GiantClaw_Colour_512`、`GiantClaw_Roughness_512` |
| 贴图 | 两张 512×512 PNG，颜色 sRGB，粗糙度 Non-Color |
| 静止宽/高/深，scale 1 | 2.443697 / 1.276003 / 1.357442 |
| 全动作最高点，scale 1 | 1.331703，攻击时出现 |
| 朝向 | Blender Z-up、面向 -Y；FBX -Z forward / Y-up，沿用已有敌人导出约定；Cocos 实际 +Z 朝向仍须导入核验 |
| 推荐运行缩放 | 1.0；不要再次乘临时首领几何使用的 1.7 |
| 建议血条/控制标记高度 | 根节点相对高度约 1.52 / 1.43；路面根节点高度由视图沿用现有道路设置 |
| 建议血条宽度 | 约 1.05，实际俯视遮挡后再确认 |

运行目录为 `resources/models/enemies/giant-claw`，预期 prefab 加载路径为 `models/enemies/giant-claw/giant-claw/giant-claw`；准确子资产路径仍须 Cocos 首次导入确认，此任务未手写 `.meta`。继续使用工程已验证的 Standard 材质适配，并显式绑定本候选颜色与粗糙图；FBX 自带通道存在不代表 Cocos 原生导入的材质语义自动正确。

| FBX take | 时长 | 用途 |
|---|---:|---|
| `GiantClaw_Rig\|idle` | 2.8 秒 | 轻微呼吸，循环 |
| `GiantClaw_Rig\|walk` | 1.2 秒 | 同侧短腿小幅挪步、左右交替，循环；无根位移 |
| `GiantClaw_Rig\|attack` | 0.5 秒 | 短促定向钳击后归位 |
| `GiantClaw_Rig\|hit` | 0.5 秒 | 小幅后缩后归位 |
| `GiantClaw_Rig\|exit` | 1.2 秒 | 收缩退场，不循环 |

真实 Blender 回导的 action 名附加导入 rig 前缀，例如 `GiantClaw_Rig|GiantClaw_Rig|attack`；实际 Cocos 子资产名必须读取导入结果确认，不能据此手写 UUID。

## 动作与战斗规则

现有 `ENEMIES.boss` 是范围 3、间隔 1.8 秒、攻击 60 的巨钳蟹。真实核心在攻击事件当帧结算伤害，暂停移动 0.3 秒；视图已有普通攻击弹道。候选在第 6 帧（0.167 秒）达到钳击主要姿态，第 10 帧（0.3 秒）已明显收回，第 16 帧回到待机。动画不会延后伤害或重设间隔。

每三次攻击的 `crabSlam` 和半血一次的 `crabSummon` 由核心及已有视图特效处理；本候选没有新技能、没有第六个 `skill` 动作，也没有把每次普通攻击做成砸地或召唤。特殊效果及三次节奏需在游戏内核验。整个模型不含地面移动关键帧。

## 已执行检查及边界

实际 FBX 回导得到一骨架、一蒙皮网格、16 骨、五个非空动作和一套 UV/材质；所有顶点权重归一化。五动作共 377 个半帧样本检查有限坐标、脚底、动作范围和返回接点。待机/走路首末顶点差为 0，攻击/受击结束也精确归位；退场末尾收至 2%。全动作最低点约 -0.00000618，属于 0.0062 毫米的数值误差。

直接解析 FBX 7400 的连接，确认 `DiffuseColor → base_color_texture → giant-colour.png`、`ShininessExponent → roughness_texture → giant-roughness.png`；两张 FBX 内嵌 PNG 与旁置 PNG、源文件打包 PNG 和原样板 PNG 字节一致。这里的 `ShininessExponent` 是本机 Blender 导出器实际通道名，并非声称它是 Cocos 原生 roughness 属性。

针对六组大钳/脸/眼安全对与六组相邻腿对执行 377 半帧 BVH 三角交叉检查。六组钳脸安全对没有交叉；原本分离的左右中间腿对保持无交叉。原样板已有的前后腿根嵌接被明确保留：可检测到壳外的局部根部接触，因此**不宣称全模型零穿插**。最终走路在这些既有接合处的可见三角对数是 34/17/37/15，静止基线为 31/12/32/12；没有因此继续改已审几何。数量不是面积或审美分数，须结合渲染判断是否读成错误穿腿。

该检查没有穷举所有部件包含关系或物理碰撞，不取代实际战斗俯视、连续运动、伤害中断、模型遮挡与运行光照检查。`iterations/quarter-phase-gait` 保留早期步序及发现问题时的报告，当前运行候选只使用最终小幅同侧步序。
