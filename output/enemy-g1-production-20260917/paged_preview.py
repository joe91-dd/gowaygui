"""A companion low-memory index; preserves the full self-contained delivery untouched."""
from pathlib import Path
import sys,json,copy,html,shutil
R=Path(__file__).resolve().parent;D=R/'source-delivery-recovered'
sys.path.insert(0,r'C:/Users/Administrator/.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.1/skills/lux3d/core/runtime')
import offline_preview
manifest=json.loads((D/'lux3d-delivery.json').read_text('utf8'));buttons=[]
for item in manifest['items']:
 ID=item['id'];page=D/'pages'/ID;page.mkdir(parents=True,exist_ok=True)
 m=copy.deepcopy(manifest);m['title']=item['label']+' · G1 源模型';m['items']=[copy.deepcopy(item)]
 m['artifacts']=[a for a in m['artifacts'] if a['id'] in item['artifactIds'] and a['format']=='glb']
 keep={a['id'] for a in m['artifacts']};m['items'][0]['artifactIds']=list(keep)
 m['attempts']=[a for a in m['attempts'] if a['id'] in item['attemptIds']]
 for a in m['attempts']:a['artifactIds']=[i for i in a['artifactIds'] if i in keep]
 refs={a['taskRef'] for a in m['artifacts']};m['tasks']=[t for t in m['tasks'] if t['id'] in refs]
 for a in m['artifacts']:a['path']='../../'+a['path']
 if not (page/'preview.html').exists():offline_preview.write_preview(page,m,'zh-CN')
 label=html.escape(ID+' '+item['label']);src='pages/'+ID+'/preview.html#item-'+ID
 buttons.append(f'<button data-src="{src}">{label}</button>')
 print('PAGED_PREVIEW',ID,flush=True)
document='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>哥喂龟 · 20只 G1 模型</title><style>
*{box-sizing:border-box}body{margin:0;background:#132b30;color:#f6f0dc;font:15px system-ui}header{height:84px;padding:14px 22px;border-bottom:1px solid #477075}h1{font-size:21px;margin:0 0 6px}p{margin:0;color:#b3ceca}main{display:flex;height:calc(100vh - 84px)}nav{width:195px;overflow:auto;padding:8px}button{width:100%;padding:12px 8px;margin:3px 0;border:1px solid #496e70;border-radius:7px;background:#25454b;color:#e6eee3;text-align:left;cursor:pointer}button[aria-current=true]{background:#097f89;color:white}iframe{flex:1;border:0;background:#eee;min-width:0}.links{font-size:12px;padding:12px;color:#b3ceca}.links a{color:#9eddd3}@media(max-width:650px){nav{width:142px}header{height:100px}main{height:calc(100vh - 100px)}}
</style><header><h1>哥喂龟 · 20只 G1 源模型</h1><p>每次载入一只，可旋转、缩放。这里展示 Aholo 原始造型；战斗动作、变异与光效在游戏中验收。</p></header><main><nav>'''+''.join(buttons)+'''<div class="links"><a href="lux3d-delivery.json" download>下载源文件清单</a><br><a href="preview.html" download>下载完整单文件预览</a></div></nav><iframe title="G1源模型预览" src="pages/B01/preview.html"></iframe></main><script>
const frame=document.querySelector('iframe');for(const b of document.querySelectorAll('button'))b.onclick=()=>{for(const x of document.querySelectorAll('button'))x.setAttribute('aria-current',String(x===b));frame.src=b.dataset.src};document.querySelector('button').setAttribute('aria-current','true');
</script></html>'''
(D/'index.html').write_text(document,'utf8');print('LOW_MEMORY_INDEX_READY',flush=True)
