"""Record a completed human-visible agent review; never claims runtime acceptance."""
import json,hashlib,struct,datetime
from pathlib import Path
OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
def load(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
manifest=load('environment-manifest.json');roundtrip=load('environment-round-trip.json')
source=load('source-check.json');support=load('foot-support-check.json');preflight=load('layout-preflight.json')
render=load('render-report.json');review=load('manual-review.json');audit=load('stone-footprint-audit.json');vegetation=load('vegetation-support-check.json')
assert review['actuallyViewed'] is True
required=['render-battle-overview.png','render-top-down.png','render-dusk-beacon-detail.png','layout-review.png']
assert sorted(review['images'])==sorted(required)
assert all(review['imageSha256'][name]==sha(OUT/name) for name in required),'Review must refer to current exact images'
assert roundtrip['fbx_round_trip']=='pass' and source['status']=='pass' and support['status']=='pass' and vegetation['status']=='pass'
assert roundtrip['liveSlotCoordinatesMatchCandidate'] and roundtrip['routeMatchesLiveData']
assert render['threads']==2 and render['samples']<=32 and render['device']=='CPU'
assert manifest['totalTriangles']<=80000 and len(manifest['runtimeMeshes'])==3 and manifest['materials']==2
assert sha(OUT/'dusk-bay.fbx')==manifest['fbxSha256']==roundtrip['fbx_sha256']==support['candidateFbxSha256']
assert sha(OUT/'dusk-bay.blend')==source['sourceBlendSha256']
assert sha(OUT/'dusk-bay.blend')==vegetation['sourceBlendSha256']
files=['build_dusk_bay.py','author_dusk_candidate.py','prepare_dusk_layout.py','measure_stone_footprint.py',
 'verify_dusk_bay.py','verify_foot_support.py','verify_vegetation_support.py','check_editable_source.py','render_dusk_views.py','render_layout_review.cjs','finalize_records.py',
 'dusk-bay.blend','dusk-bay-review-scene.blend','dusk-bay.fbx','island-colour.png','island-roughness.png',
 'environment-manifest.json','environment-round-trip.json','source-check.json','foot-support-check.json','vegetation-support-check.json','stone-footprint-audit.json',
 'layout-preflight.json','proposal.json','derivation-record.json','stone-version-foot-comparison.json','render-report.json','manual-review.json','layout-review.svg']+required
records=[]
for name in files:
    p=OUT/name;row={'path':name,'bytes':p.stat().st_size,'sha256':sha(p)}
    if p.suffix=='.png':
        with p.open('rb') as f:header=f.read(24)
        assert header[:8]==b'\x89PNG\r\n\x1a\n';row['dimensions']=list(struct.unpack('>II',header[16:24]))
    records.append(row)
provenance={'schemaVersion':1,'status':'offline-source-candidate-reviewed-not-runtime-accepted',
 'title':'薄暮海湾 candidate-01','levelId':3,'recordedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'authorship':'Original project procedural meshes, UVs, palette, lighting, composition and editable numeric layout diagram. Reuses project-owned A/v04/coral modules; no downloaded game/stock geometry, textures, branding or raster edits.',
 'upstream':load('derivation-record.json'),'scope':'Writes only this independent candidate directory; no core/view/runtime changes or Cocos startup.',
 'materials':['Island_atlas','Warm_pearl_and_lamps'],'renderSettings':{k:render[k] for k in ['engine','device','threads','samples','width','height']},
 'technical':{'totalTriangles':manifest['totalTriangles'],'meshCount':3,'materials':2,'editableMeshes':source['editableMeshes'],
 'packedAtlasCount':len(source['packedImages']),'geometryBoundsCocos':roundtrip['geometry_bounds_cocos'],
 'routeSamples':roundtrip['route_samples'],'routeHeightProblems':len(roundtrip['route_height_problems']),
 'routeCenterObstacles':len(roundtrip['route_center_obstacles']),'footSupportRays':sum(s['surfaceRays'] for s in support['slots']),
 'unsupportedSamples':sum(len(s['unsupportedSamples']) for s in support['slots']),
 'vegetationRootParts':vegetation['checkedRootParts'],'unsupportedVegetationRoots':len(vegetation['unsupportedRoots'])},
 'coordinates':'Original level3 route and all slots unchanged, road Y=.064, station top Y=.292.',
 'meleeCoverage':'Original station indices1 and2 at distances3.0 andsqrt2 do not have stone base1.2 blocking coverage; root explicitly retained ranged/support uses.',
 'currentStone':{k:audit[k] for k in ['source','sourceSha256','runtimeFbxSha256','scale','solePoints','allYawSoleRadius','strictContactAllYawRadius']},
 'manualReview':review,'files':records,
 'limits':['Offline rendering and support checks do not certify Cocos import, material culling, animation/contact, mobile performance, gameplay balance or final artistic acceptance.',
 'Authorship provenance is recorded evidence, not an absolute copyright or legal-risk guarantee.']}
(OUT/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf-8')
b=roundtrip['geometry_bounds_cocos'];span=[b['max'][i]-b['min'][i] for i in range(3)]
table='\n'.join(f"| {r['slot']+1} | ({r['position']['x']:g},{r['position']['z']:g}) | {r['routeDistance']:.6f} | {r['fullSoleToRouteCenterClearance']:.6f} | {'有' if r['withinStoneBlockingRadius'] else '无（原布局）'} |" for r in preflight['slots'])
notes='\n'.join('- '+note for note in review['remainingArtIssues'])
readme=f'''# 薄暮海湾 · 场景候选 01

状态：**离线源候选，三视及几何图已实际查看，未晋升 runtime，未进行 Cocos 验收。** 第四关真实路线和五个原站位全部保留；没有修改 core、view、其他场景或共享进度。

## 场景构图

沿 A / v04 玩具海岛的材质和模块扩展：重新生成路线相关地形、单面连续沙路和右前方浅湾，保留完整五站台及贝壳核心。黄昏通过柔暖沙色、灰绿草地、海岸暖灯与小珍珠灯台表达；高装饰集中后岸，中央保持可辨。

新海岸有 3 株低椰树、5 盏路径外灯笼、1 座后岸小灯台、低珊瑚与海草。预览黄昏灯光和海水只在 review-scene.blend 中，未并入 FBX。主代理接入时仍需单独确定实际环境光和材质纹理。

真实 X/Z 路线：`(-9,-1) → (-5,0) → (-2,-2) → (2,-2) → (4,0) → (7,0) → (9,1)`。路面 Y `.064`；入口 `(-9,.064,-1)`、终点 `(9,.064,1)`、珍珠 `(9,1.10,1)`；站台锚点和连续承托面 Y `.292`。

## 原站位、脚支撑与石龟覆盖

| 玩家站位 | X/Z | 距路线中心 | 完整脚底净空 | 基础 1.2 阻挡 |
| --- | --- | ---: | ---: | --- |
{table}

当前运行石龟为 c12b，scale `.65`。重新打开实际源测量 2068 个近地脚/趾顶点，完整全朝向半径 `.9746471943`、严格触地点半径 `.8874670246`，与 c11 对应包络数值相同；本次记录当前模型真实 SHA，没有把旧文件身份沿用为新模型证据。

五台均使用 48 边连续顶面，外接半径 `.995`、内切半径 `.992869629`，比完整脚底包络多 `.018222434`。真实回导 FBX 上 `2068 × 36 朝向 × 5 台 = 372,240` 条支撑射线全部通过。原第 1/4/5 站位距路线中心 1，完整脚底净空仅约 .02535；视觉沙带可以延至台边，但没有以削台使龟脚悬空。

无需为路线中心或脚底支撑提出移动方案，proposal.json 的 changedSlotIndices 为空。第 2/3 站位原本超出石龟基础阻挡 1.2，主代理明确保留远程/辅助用途；没有为全格近战改动站位或路线。几何覆盖不代替实际敌我接触及动作验证。

`layout-review.svg` / `.png` 是从真实路线、站位和模型脚底顶点生成的原创可编辑示意图，包含每格覆盖路线长度；没有描摹或修改已有截图。

## 文件与技术结果

- `build_dusk_bay.py`：独立完整场景生成器；可直接重建，不依赖重新生成上游岛屿。`author_dusk_candidate.py` 仅保存本次模块继承的制作记录。
- `dusk-bay.blend`：{source['editableMeshes']:,} 个独立可编辑网格、9 个锚点、2 张打包图集；相机/海水/灯光在单独 `dusk-bay-review-scene.blend`。
- `dusk-bay.fbx`：**{manifest['totalTriangles']:,} 三角 / 3 网格 / 2 材质**。材质名 `Island_atlas`、`Warm_pearl_and_lamps`。
- `island-colour.png` / `island-roughness.png`：2048×1024。本候选颜色图集为原创 A 配色的黄昏变体，粗糙度沿用同工艺。
- 实际 FBX 回导 {roundtrip['route_samples']} 个路线样本，高程 {roundtrip['route_min_y']:.7f}–{roundtrip['route_max_y']:.7f}，高程异常 0、中央障碍 0；站位、入口/终点、UV、三角数、材质、有限坐标与 bounds 均通过。
- 首轮近景发现岸外悬空草，已收紧随机植被真实边界并移回两簇固定海草；最终 {vegetation['checkedRootParts']} 个草/灌木/海草部件根部对真实草地网格射线全部命中。失败预览与中间根部检查留在 iterations，未计作通过。
- 装饰中央障碍检查区间 `-8.85 < X < 7.55`，入口门和终点核心保留其功能形体；不声称整条路线除外部空气外完全空白。
- 真实 bounds：X `[{b['min'][0]:.6f},{b['max'][0]:.6f}]`，Y `[{b['min'][1]:.6f},{b['max'][1]:.6f}]`，Z `[{b['min'][2]:.6f},{b['max'][2]:.6f}]`；X/Z 跨度 **{span[0]:.3f} × {span[2]:.3f}**。22×12 为共同名义玩法占地，海岸外挑未隐藏。
- FBX SHA-256：`{sha(OUT/'dusk-bay.fbx')}`。

三视为 `render-battle-overview.png`、`render-top-down.png`、`render-dusk-beacon-detail.png`，均 **1000×700 / Cycles CPU / 2 线程 / 32 samples**，已经实际逐张查看。战斗相机遵循现有 1280/720 水平取景保持规则。

## 剩余美术与运行事项

{notes}

- Cocos 中图集绑定、薄叶剔除、灯光/阴影、灯台高光和实际手机视线仍需检查；预览效果不代表运行效果。
- 未晋升 runtime，未启动 Cocos，没有写 meta、导入 UUID 或 view 接线。
- 来源、生成脚本、验证报告及当前输出的完整 SHA 见 provenance.json；来源记录不构成绝对法律风险保证。

## 重现

在项目根目录使用本机 portable Blender，全部加 `--background --threads 2 --python-exit-code 1`：依次运行本目录 `measure_stone_footprint.py`、bundled Python `prepare_dusk_layout.py`、Blender `build_dusk_bay.py -- --export-only`、`verify_dusk_bay.py`、`check_editable_source.py`、`verify_foot_support.py`、`verify_vegetation_support.py`、`render_dusk_views.py`。

布局图由 bundled Node + 现有 sharp 运行 `render_layout_review.cjs`。完成实际图像审查后更新 manual-review.json 并运行 bundled Python `finalize_records.py`；后者会验证手工审图记录对应的精确图像 SHA，不自动假定已通过。
'''
(OUT/'README.md').write_text(readme,encoding='utf-8')
print('Dusk source candidate records finalized; Cocos/runtime still pending.')
