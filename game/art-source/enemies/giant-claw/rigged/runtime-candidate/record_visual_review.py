"""Record authoring-agent observations after opening all seven unchanged renders."""
from pathlib import Path
import json,hashlib,html
HERE=Path(__file__).resolve().parent
notes={
 'render-idle.png':('待机','整体保持已审宽壳、大钳和奶油脸；眼脸清楚，近侧站立脚接地。'),
 'render-walk.png':('走路','远侧足小幅抬起，近侧站立足接地；足端和中間腿没有可见交叉，原根部接合仍较紧密。'),
 'render-attack.png':('攻击','大钳前送、钳指有收拢，正向面部和双眼仍清楚；未看到钳指穿脸。'),
 'render-hit.png':('受击','身体轻微后缩，腿根连接连续；没有明显拉裂或脚底离地。'),
 'render-exit.png':('退场中段','以 80% 体积继续收缩，角色轮廓保持，足底接地；该帧不是退场末帧。'),
 'render-attack-front.png':('攻击正面','大钳与脸/眼保持间距，两侧前足接地；不对称钳轮廓明确。'),
 'render-hit-side.png':('受击侧面','四个近侧足端可区分且接地；壳下腿根存在原样板接合，未读成足端互穿。纯侧视自然被大钳挡住部分脸，不等同于几何穿插。'),
}
frames=json.loads((HERE/'review-frames.json').read_text(encoding='utf-8'))
images=[]
for file,(title,note) in notes.items():
    path=HERE/file;assert path.exists()
    images.append({'file':file,'title':title,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'observation':note})
report={'status':'agent viewed all seven rendered keyframes','reviewer':'authoring agent /root/audio_sample',
 'not_a_human_or_cocos_acceptance':True,'images':images,
 'boundary':'Original rendered images opened using view_image. This is a static keyframe review, not continuous runtime motion or final user art acceptance. Existing neighboring leg-root surface contacts remain documented in collision-check.json.',
 'render_settings':{'threads':2,'samples':24,'width':900,'height':760},'review_scene_sha256':frames['review_scene_sha256']}
(HERE/'visual-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
cards='\n'.join('<figure><a href="'+i['file']+'"><img src="'+i['file']+'" alt="'+html.escape(i['title'])+'"></a><figcaption><b>'+html.escape(i['title'])+'</b> '+html.escape(i['observation'])+'</figcaption></figure>' for i in images)
page='''<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>巨钳蟹五动作候选</title><style>body{margin:24px auto;padding:0 20px;max-width:1200px;background:#f5eee0;color:#363428;font:16px/1.6 system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}figure{margin:0;background:#fffaf0;border-radius:12px;overflow:hidden}img{display:block;width:100%}figcaption{padding:12px}a{color:inherit}</style><h1>巨钳蟹：五动作运行候选</h1><p>单骨架 / 16 骨 / 21,208 三角 / 单材质。保留已审 c01 网格与材质。七张均是实际骨骼姿态的 Blender 渲染，非 Cocos 截图。已逐张打开检查，仍待根代理审图与实际游戏连续运动验收。</p><p><a href="README.md">技术与接入记录</a> · <a href="round-trip-check.json">377 半帧回导检查</a> · <a href="collision-check.json">穿插范围与现有腿根接合边界</a></p><main>'''+cards+'</main></html>'
(HERE/'review.html').write_text(page,encoding='utf-8')
print('VISUAL_REVIEW_RECORDED '+str(len(images)))
