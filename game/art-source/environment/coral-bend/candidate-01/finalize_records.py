"""Write provenance and measured handoff after the author actually reviews final renders."""
import json, hashlib, datetime
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=read('environment-manifest.json');rt=read('environment-round-trip.json');src=read('source-check.json');feet=read('foot-support-check.json');renders=read('render-report.json');proposal=read('proposal.json')
assert rt['fbx_round_trip']=='pass' and src['status']=='pass' and feet['status']=='pass'
assert rt['fbx_sha256']==feet['candidateFbxSha256']==manifest['fbxSha256']==sha(OUT/'coral-bend.fbx')
files=[]
for name in ['coral-bend.fbx','coral-bend.blend','coral-bend-review-scene.blend','island-colour.png','island-roughness.png','render-battle-overview.png','render-top-down.png','render-coral-inlet-detail.png','layout-comparison.png','layout-comparison.svg','build_coral_bend.py','verify_coral_bend.py','measure_stone_footprint.py','verify_foot_support.py','render_layout_comparison.cjs','proposal.json']:
    p=OUT/name;files.append({'path':name,'bytes':p.stat().st_size,'sha256':sha(p)})
sources=[]
for path,role in [
 ('game/art-source/environment/build_tidal_island.py','Project original v04 procedural geometry and materials'),
 ('game/art-source/environment/tutorial-island/candidate-01/build_tutorial_island.py','Original tutorial module and export/preview pipeline'),
 ('game/assets/scripts/core/data.ts','Unchanged current level2 navigation and source station positions'),
 ('game/art-source/stone-turtle/candidate-11/stone-turtle.blend','Current runtime-matching stone turtle editable geometry; read-only sole measurement'),
 ('game/assets/resources/models/stone-turtle/stone-turtle.fbx','Current runtime turtle hash only; not modified')]:
    sources.append({'path':path,'role':role,'sha256':sha(ROOT/path)})
report={'schemaVersion':1,'createdAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':'哥喂龟','asset':'珊瑚转角 · level2','version':manifest['version'],
 'status':'source-candidate-with-explicit-layout-proposal-pending-root-and-runtime-review',
 'authorship':{'method':'Project-authored procedural geometry, planar road polygon triangulation, low coral cups/branches, layered coast; no downloaded models/textures. Diagram rendered from original SVG built from measured coordinates.','externalModels':[],'externalTextures':[],'existingRasterPixelsEdited':False,'runtimeOrViewFilesModified':False},
 'sources':sources,'files':files,'tools':{'blender':'4.5.13 LTS','threads':2,'samples':32,'resolution':[1000,700],'engine':'CYCLES','device':'CPU','pythonExitCode':1,'newSoftwareInstalled':False},
 'verification':{'fbxRoundTrip':'environment-round-trip.json','sourcePacking':'source-check.json','soleSupport':'foot-support-check.json','renderReport':'render-report.json','actualViewImageReviewed':['render-battle-overview.png','render-top-down.png','render-coral-inlet-detail.png','layout-comparison.png'],'triangles':manifest['totalTriangles'],'meshes':3,'materials':2,'routeSamples':rt['route_samples'],'routeHeightProblems':len(rt['route_height_problems']),'routeCenterObstacles':len(rt['route_center_obstacles']),'soleRays':sum(p['surfaceRays'] for p in feet['slots']),'soleUnsupported':sum(len(p['unsupportedSamples']) for p in feet['slots']),'runtimeImportPerformed':False},
 'layout':{'proposal':'proposal.json','liveDataModified':False,'routeMatchesLive':True,'changedSlotIndices':[2,4],'approvalRequiredBeforeIntegration':True},
 'geometryBoundsCocos':manifest['geometryBoundsCocos'],
 'limits':['Slots2/4 differ from current gameplay data, so source candidate cannot be promoted as-is without root coordinated layout/save handling.','Unchanged slot3 (1,-3) is2.236 from route: stone melee blocking1.2 does not reach; root must assess ranged/support placement.','Source sole support audit uses REST-pose geometry at all-yaw envelope; action animation and defender/enemy contact require runtime checks.','Roadside sand can extend under platform edges; exact live route centers are clear.','Thin leaves and cups need Cocos culling/lighting/shadow review.','Preview ocean is excluded from FBX and is not proof of completed game ocean or mobile performance.'],
 'revisionNotes':['Initial ribbon had black overlap seams at acute bends. Those failed previews and model are archived in iterations/before-road-union. Final path is one explicitly triangulated non-overlapping polygon with sparse corner-border stones.'],
 'rightsRecord':'Original project provenance record; not an absolute guarantee against all copyright or legal disputes.'}
(OUT/'provenance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
bounds=manifest['geometryBoundsCocos'];span=[bounds['max'][i]-bounds['min'][i] for i in [0,2]]
lines=['# 珊瑚转角 · 场景候选 01','',
'状态：**离线源候选与布局提案，未晋升 runtime，未进行 Cocos 验收。** 主代理要求保留真实路线，并先离线评估第三、第五站位的小幅移动；本 FBX 使用提案位置，不能直接接入仍使用原坐标的游戏。','',
'## 场景与路线','',
'同 A / v04 / 教学岛的玩具海岛材质。沿 level 2 的真实弯折路线重建地形和连续沙路，没有叠放旧道路。3 株低椰树集中后景；海岸使用 13 簇枝状珊瑚、8 个厚壁杯状珊瑚、低岩石与浅湾阶层，避免高装饰挡住中央战斗。','',
'真实 X/Z 路线：`(-9,0) → (-4,0) → (-2,2) → (2,2) → (3,-2) → (6,-2) → (9,0)`。路面 Y `.064`，入口 `(-9,.064,0)`，出口 `(9,.064,0)`，珍珠 `(9,1.10,0)`，站台锚点 Y `.292`。','',
'最终道路使用单个无叠面的闭合轮廓：急弯内侧取精确偏移交点，外侧圆接，再明确三角化。最初窄圆角丝带出现黑缝的版本仅归档在 `iterations/before-road-union/`，不是交付版本。','',
'## 站位提案与脚底支撑','',
'当前运行石龟 c11，战斗 scale `.65`。实际近地脚/趾顶点共 2068 个，完整全朝向外包半径 `.974647`；仅地面附近 `.005` 原始单位以内的接触点，半径仍 `.887467`。因此不能靠削掉旧石台的临路侧保持完整龟脚支撑。','',
'| 站位（从 1 起） | 原 X/Z | 候选 X/Z | 移动距离 | 新距路线 | 脚底净空 |','| --- | --- | --- | ---: | ---: | ---: |']
for p in feet['slots']:
    lines.append(f"| {p['slot']+1} | ({p['original'][0]:.3f},{p['original'][1]:.3f}) | ({p['candidate'][0]:.3f},{p['candidate'][1]:.3f}) | {p['movement']:.4f} | {p['candidateRouteDistance']:.4f} | {p['candidateFullSoleClearance']:.4f} |")
lines += ['',
'第三和第五站位候选距路线约 1.135，仍在主代理给定的近战阻挡半径 1.2 内。没有为了整条视觉沙路净空把站位推到近战之外。**原第四站位 `(1,-3)` 距路线 2.236，本就不在石龟 1.2 阻挡范围内；本轮未移动它，需主代理评估远程/辅助用途。**','',
f"五个石台改为连续、平整承托面，48 边形外接半径 .995、内切半径 {feet['continuousPlatformTopInradius']:.6f}；比完整脚底全朝向包络多 {feet['analyticAllYawSupportMargin']:.6f}。对实际回导 FBX 做 `2068 点 × 36 朝向 × 5 台 = {sum(p['surfaceRays'] for p in feet['slots']):,}` 次支撑射线，未支撑点为 0。",'',
'`layout-comparison.svg` / `.png` 是从实际模型顶点生成的可编辑对照图，不是描摹或修改截图。`proposal.json` 保存原值与候选值；`stone-footprint-audit.json`、`foot-support-check.json` 保留详细尺寸与逐台结果。静态脚底支撑与全朝向分析不等于动作动画、敌我接触及攻击覆盖验收。','',
'## 文件与验证','',
f"- `coral-bend.blend`：{src['editableMeshes']:,} 个独立可编辑网格、9 个锚点、2 张已打包图集。",
f"- `coral-bend.fbx`：{manifest['totalTriangles']:,} 三角 / 3 网格组 / 2 材质，低于 80,000。",
'- `island-colour.png` / `island-roughness.png`：2048×1024，与 v04 原创图集相同。材质名 `Island_atlas`、`Warm_pearl_and_lamps`。',
'- `coral-bend-review-scene.blend`：独立的预览海水、灯光和相机，均不在 FBX 中。',
f"- 实际回导 {rt['route_samples']} 个路线样本，高程 {rt['route_min_y']:.7f}–{rt['route_max_y']:.7f}，高程异常/中央障碍均 0；五台锚点、UV、有限坐标、纹理尺寸、三角数与 bounds 均通过。",
'- 障碍检查排除入口门与终点核心，内部区间为 `-8.85 < X < 7.55`。',
f"- 真实几何 X bounds `[{bounds['min'][0]:.6f},{bounds['max'][0]:.6f}]`，Y `[{bounds['min'][1]:.6f},{bounds['max'][1]:.6f}]`，Z `[{bounds['min'][2]:.6f},{bounds['max'][2]:.6f}]`，X/Z 总跨度 **{span[0]:.3f} × {span[1]:.3f}**。共用名义玩法占地 22×12，不把海岸外挑隐藏掉。",'',
'三张最终预览均为 **1000×700 / Cycles CPU / 2 线程 / 32 samples**，已经逐张实际查看：正战斗 `render-battle-overview.png`、俯视 `render-top-down.png`、珊瑚湾近景 `render-coral-inlet-detail.png`。正战斗镜头采用 GameEntry 的 1280/720 水平取景保持规则。','',
'## 重现','',
'```powershell',"$blenderPath = 'tmp/tools/blender-4.5.13-windows-x64/blender.exe'","$candidateDir = 'game/art-source/environment/coral-bend/candidate-01'",'& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/build_coral_bend.py" -- --export-only','& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/verify_coral_bend.py"','& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/check_editable_source.py"','& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/measure_stone_footprint.py"','& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/verify_foot_support.py"','& $blenderPath --background --threads 2 --python-exit-code 1 --python "$candidateDir/render_coral_views.py"','```','',
'图表使用现有 bundled Node + sharp 运行 `render_layout_comparison.cjs`。记录生成器 `finalize_records.py` 仅在作者实际看过最后渲染之后运行。','',
'## 待主代理审查','',
'- 第三、第五站位坐标变更需主代理批准；随后一并处理关卡数据、恢复中的战斗存档、近战覆盖和实际角色交汇。当前 FBX 不能直接晋升。',
'- 拓宽的平整石台承托面比 v04 更整洁，装饰分块较淡；保留材料一致性，但不声称完成最终美术风格验收。',
'- 修正叠面后的沙路轮廓较规整，近景仍有平面边缘感，可在后续美术打磨时优化草地与沙路交界过渡。',
'- 岛岸模块仍有规则排列感，珊瑚弯湾属于首版构图。',
'- 薄叶、珊瑚杯内壁在实际 Cocos 的剔除/灯光/阴影与移动性能尚未检查。',
'- 动画脚底运动和近战敌我接触需运行检查；预览海水不代表游戏海水已完成。',
'- 没有修改 core、runtime、view 或共享 docs，没有启动 Cocos 或写 meta/UUID。','',
'完整来源链、SHA-256、尺寸及剩余限制见 `provenance.json`。来源记录不构成绝对版权/法律风险保证。','']
(OUT/'README.md').write_text('\n'.join(lines),encoding='utf-8')
print('Wrote candidate README and provenance with measured values and current artifact SHA-256.')
