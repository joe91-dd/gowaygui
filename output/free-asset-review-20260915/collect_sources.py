import json, re, urllib.request, urllib.parse, concurrent.futures
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent
URLS = {
 'turtle_rig':'https://www.blendkit.com/asset-gallery-detail/8b5e0bab-4716-4f95-a79a-e5964d7e5cea/',
 'turtle_character':'https://sketchfab.com/3d-models/turtle-character-5d4e98364547419a9a8f6dd350e9526f',
 'crab':'https://sketchfab.com/3d-models/cartoon-crab-animated-5bb75116e37d475abce48c9bb2d5a305',
 'monsters':'https://quaternius.com/packs/ultimatemonsters.html',
 'bestiary':'https://quaternius.itch.io/bestiary-dungeon-monsters-kit',
 'pirates':'https://quaternius.com/packs/piratekit.html',
 'fish':'https://quaternius.com/packs/animatedfish.html',
 'cute_fish':'https://quaternius.com/packs/cutefish.html',
 'nature':'https://quaternius.itch.io/stylized-nature-megakit',
 'ruins':'https://quaternius.com/packs/ultimatemodularruins.html',
 'rpg':'https://quaternius.com/packs/ultimaterpg.html',
 'props':'https://quaternius.itch.io/fantasy-props-megakit',
 'adventurers':'https://kaylousberg.itch.io/kaykit-adventurers',
 'skeletons':'https://kaylousberg.itch.io/kaykit-skeletons',
 'kenney_pirate':'https://kenney.nl/assets/pirate-kit',
 'animations':'https://quaternius.itch.io/universal-animation-library',
 'particles':'https://kenney.nl/assets/particle-pack',
 'qal_license':'https://quaternius.com/license.html',
 'blendkit_license':'https://www.blendkit.com/docs/licenses/',
}

class Parser(HTMLParser):
 def __init__(self, url):
  super().__init__(); self.url=url; self.meta={}; self.images=[]; self.links=[]; self.text=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta': self.meta[a.get('property',a.get('name',''))]=a.get('content','')
  if tag=='img': self.images.append({k:urllib.parse.urljoin(self.url,v) if k in ['src','data-src'] else v for k,v in a.items()})
  if tag=='a' and 'href' in a:self.links.append(urllib.parse.urljoin(self.url,a['href']))
 def handle_data(self,data):
  if data.strip():self.text.append(data.strip())

def read(item):
 key,url=item
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=25) as response:
   body=response.read().decode('utf-8','replace'); final=response.url
  p=Parser(final);p.feed(body)
  out={'id':key,'url':url,'final_url':final,'meta':p.meta,'images':p.images,'links':p.links}
  (ROOT/(key+'.source.html')).write_text(body,encoding='utf-8')
  (ROOT/(key+'.source.txt')).write_text('\n'.join(p.text),encoding='utf-8')
  return out
 except Exception as e:return {'id':key,'url':url,'error':str(e)}

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: result=list(pool.map(read,URLS.items()))
 (ROOT/'source-metadata.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 for r in result:
  print(json.dumps({'id':r['id'],'error':r.get('error'),'preview':r.get('meta',{}).get('og:image'),'images':[i for i in r.get('images',[]) if not any(t in i.get('src','') for t in ['icon','Icon','logo','Logo'])][:4]},ensure_ascii=False))
