import json, concurrent.futures, urllib.request
from collect_sources import ROOT, read
URLS={
 'bestiary':'https://quaternius.com/packs/bestiarydungeonmonsterskit.html',
 'nature':'https://quaternius.com/packs/stylizednaturemegakit.html',
 'props':'https://quaternius.com/packs/fantasypropsmegakit.html',
 'animations':'https://quaternius.com/packs/universalanimationlibrary.html',
 'turtle_humanoid':'https://www.blendkit.com/asset-gallery-detail/e7c81fed-3cc0-4d0f-aaa1-e8abbbf2f5e4/',
 'pok':'https://opengameart.org/content/pok',
}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: result=list(pool.map(read,URLS.items()))
old=json.loads((ROOT/'source-metadata.json').read_text(encoding='utf-8'))
lookup={r['id']:r for r in old};lookup.update({r['id']:r for r in result})
(ROOT/'source-metadata.json').write_text(json.dumps(list(lookup.values()),ensure_ascii=False,indent=2),encoding='utf-8')
for r in result:print(json.dumps({'id':r['id'],'preview':r.get('meta',{}).get('og:image'),'images':[i for i in r.get('images',[]) if 'fullres' in i.get('src','') or 'sites/default' in i.get('src','')],'error':r.get('error')},ensure_ascii=False))
for key,uid in [('crab','5bb75116e37d475abce48c9bb2d5a305'),('turtle_character','5d4e98364547419a9a8f6dd350e9526f')]:
 try:
  with urllib.request.urlopen('https://api.sketchfab.com/v3/models/'+uid,timeout=20) as r:d=json.load(r)
  (ROOT/(key+'.api.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps({'id':key,'name':d.get('name'),'license':d.get('license'),'downloadable':d.get('isDownloadable'),'images':d.get('thumbnails')},ensure_ascii=False))
 except Exception as e:print(key,str(e))
