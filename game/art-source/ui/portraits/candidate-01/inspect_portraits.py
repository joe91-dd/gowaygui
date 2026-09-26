"""Read finished PNGs, verify alpha/size/provenance, build true-size review HTML.
Does not render, alter PNG pixels, or touch original character assets.
"""
from pathlib import Path
import hashlib,json,html
from PIL import Image
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[4]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((HERE/'render-report.json').read_text(encoding='utf-8'))
assert len(report['roles'])==5
rows=[]
for role in report['roles']:
    for item in role['files']:
        path=HERE/item['file'];assert sha(path)==item['sha256']
        with Image.open(path) as image:
            assert image.mode=='RGBA' and image.size==(item['size'],item['size'])
            alpha=image.getchannel('A');assert alpha.getextrema()==(0,255),'Expected true transparent background and opaque model'
            bbox=alpha.getbbox();assert bbox is not None
            assert all(alpha.getpixel(p)==0 for p in ((0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1))),'Corner is not clear'
            rows.append({'file':item['file'],'size':item['size'],'sha256':item['sha256'],'alpha_bounds':bbox,'rgba':True,'transparent_corners':True})
for path,digest in report['protected_sha256'].items():assert sha(ROOT/path)==digest,'Character source modified '+path
check={'status':'five RGBA portraits and five true 64px previews passed metadata/alpha/source checks',
 'files':rows,'character_sources_unchanged':True,'subjective_review':'Actual image opening still required; these checks do not certify face readability or final art.'}
(HERE/'png-check.json').write_text(json.dumps(check,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
cards=[]
for role in report['roles']:
    name=role['role'];title=html.escape(role['title'])
    cards.append('<article><h2>'+title+'</h2><a href="portrait-'+name+'.png"><img class="main" src="portrait-'+name+'.png" alt="'+title+' 原始头像"></a><div class="samples"><div class="light"><img width="64" height="64" src="preview-'+name+'-64.png"><small>64px 真渲染 · 浅底</small></div><div class="dark"><img width="64" height="64" src="preview-'+name+'-64.png"><small>64px 真渲染 · 深底</small></div><div class="light"><img width="48" height="48" src="portrait-'+name+'.png"><small>48px 显示</small></div><div class="dark"><img width="96" height="96" src="portrait-'+name+'.png"><small>96px 显示</small></div></div><p>头部投影占宽 '+str(round(role['head_width_ratio']*100,1))+'%</p></article>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>五龟真实头像 · 小尺寸对照</title><style>body{max-width:1500px;margin:24px auto;padding:0 20px;font:16px/1.6 system-ui;background:#f5f1e6;color:#294244}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}article{background:#fffaf2;border:1px solid #d7d7c5;border-radius:12px;padding:16px}h2{font-size:20px;margin:4px 0}.main{display:block;width:192px;height:192px;margin:auto}.samples{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:stretch}.samples>div{min-height:106px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;padding:8px}.light{background:#fbf4df;color:#294244}.dark{background:#294b4c;color:#fff1d2}small{font-size:11px}img{object-fit:contain}p{font-size:13px}</style><h1>五只龟，来自同一套真实镜头</h1><p>原图 384px 透明 PNG；小图既有 64px 真实渲染，也有相同原图的 48/96px 显示对照。浏览器缩放保持 100%。先看眼神和头脸，再看上壳特征；浅深底检查边缘。图片不代表 Cocos 已接线。</p><main>'''+''.join(cards)+'</main></html>'
(HERE/'review.html').write_text(page,encoding='utf-8')
print(json.dumps({'images_checked':len(rows),'character_sources_unchanged':True,'image_pixels_modified':False}))
