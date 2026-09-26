"""After real image review, record read-only runtime handoff; never promotes.
Uses Python standard library only, no Blender or Cocos startup.
"""
import hashlib,json,math
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OUT=HERE/'runtime-candidate'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(name):return json.loads((OUT/name).read_text(encoding='utf-8'))
def write(name,v):(OUT/name).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lod=read('lod-manifest.json');qa=read('round-trip-check.json');payload=read('export-payload-check.json')
complete=read('technical-complete.json');review=read('manual-review.json')
assert complete['six_clips_reimported'] and review['actual_images_reviewed']
for path,digest in lod['protected_inputs'].items():assert sha(ROOT/path)==digest,('Protected input changed',path)
for name,digest in review['image_sha256'].items():assert sha(OUT/name)==digest,('Reviewed image changed',name)
files={}
for name in ['bubble-turtle.fbx','bubble-colour.png','bubble-roughness.png']:
    p=OUT/'export'/name;files[name]={'source':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)}
assert files['bubble-turtle.fbx']['sha256']==qa['fbx_sha256']==lod['fbx_sha256']
clips={name:{'fbx_stack':next(s for s in payload['fbx_animation_stack_names'] if s.split('|')[-1]==name),
    'frames':[v['first'],v['last']],'seconds':v['seconds'],'loop':v['loop_recommended'],
    'maximum_cocos_y_scale_065':v['maximum_cocos_y_scale_065'],'max_height_frame':v['maximum_z_frame']} for name,v in qa['clips'].items()}
peak=qa['maximum_cocos_y_scale_065_all_clips']
handoff={'status':'Own technical QA and actual offline image review complete; ready for parent runtime review. Not promoted or Cocos-validated.',
    'species':'bubble','candidate':'02','files':files,
    'editable_source':str((OUT/'bubble-turtle-lod-parts.blend').relative_to(ROOT)).replace('\\','/'),
    'single_mesh_source':str((OUT/'bubble-turtle-runtime.blend').relative_to(ROOT)).replace('\\','/'),
    'source_sha256':{p.name:sha(p) for p in OUT.glob('*.blend')},
    'original_high_source_sha256':lod['source_high_sha256'],'approved_high_images_sha256':lod['source_high_previews_sha256'],
    'triangles':qa['triangles'],'vertices':qa['vertices'],'bones':qa['bones'],'material_name':'BubbleAtlas_01','material_prefix':'BubbleAtlas_',
    'texture_mapping':payload['texture_connections'],'opaque':True,'cocos_scale':.65,
    'blender_forward':'-Y','blender_up':'+Z','export_forward':'-Z','export_up':'+Y','expected_cocos_forward':'+Z','foot_plane':0,
    'rest_bounds':qa['expected_rest_bounds_cocos_xyz_scale_065'],'maximum_animation_y_scaled':peak,
    'height_measurement':qa['maximum_height_sampling_note'],
    'suggested_healthbar_height':math.ceil((peak+.17)*100)/100,'suggested_control_marker_height':math.ceil((peak+.10)*100)/100,
    'clips':clips,'image_review':review,'runtime_written':False,'meta_written':False,'cocos_started':False}
write('handoff-manifest.json',handoff)
lines=['# 泡泡龟 c02 独立运行候选','',
    '已完成自身 LOD、六动作、回导、贴图重建和离线图像检查；等待主线程接入与实际 Cocos 验证。未复制到 resources，未写 meta。','',
    f'- {qa["triangles"]:,} 三角 / {qa["vertices"]:,} 顶点 / 10 骨 / 1 个不透明图集材质。',
    '- 单网格源：bubble-turtle-runtime.blend；分部编辑源：bubble-turtle-lod-parts.blend。',
    '- 导入候选为 export/bubble-turtle.fbx，另有 bubble-colour.png 与 bubble-roughness.png；FBX 内嵌两张 PNG 已按字节核对。',
    '- 材质前缀 BubbleAtlas_，实际名 BubbleAtlas_01；Base Color 使用 colour，Roughness 使用 roughness。FBX 实际连接见 handoff-manifest.json。',
    '- 建议 Cocos scale 0.65；脚底 Y=0；Blender -Y 面前/+Z 向上，FBX -Z/+Y 导出，预期 Cocos +Z 面前。',
    f'- 六动作逐半帧最高 scaledY = {peak:.6f}；建议血条 {handoff["suggested_healthbar_height"]:.2f}、控制标记 {handoff["suggested_control_marker_height"]:.2f}。数值为 FBX 实际顶点采样，非连续时间数学上界。','',
    '|动作|秒|循环|实际 FBX Stack|','|---|---:|---|---|']
for name,v in clips.items():lines.append(f'|{name}|{v["seconds"]:.6f}|{"是" if v["loop"] else "否"}|{v["fbx_stack"]}|')
lines += ['','所有原 c01/c02 高模和已审图片均保持原字节。LOD 蓝带/壳缘按原纵向环采样，保留全部圆顺截面与端帽；其他部位按独立比例减面。自身六动作由参数重建，不继续使用高模中继承的石龟动作。','',
    '复现顺序（从仓库根目录，Blender -b -t 2 --python-exit-code 1）：build_runtime_lod.py → review_runtime_lod.py -- --qa-only → inspect_export_payload.py → review_runtime_lod.py -- --render-only。先协调唯一 Blender 槽，实际开图后才运行 record_runtime_handoff.py。','',
    '确切路径、SHA、骨名、材质连接、姿态高度和剩余观感事项见 handoff-manifest.json。']
(OUT/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'handoff_ready':True,'files':files,'peak_scaled_y':peak,'runtime_written':False},ensure_ascii=False))
