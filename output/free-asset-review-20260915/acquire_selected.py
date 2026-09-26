"""Acquire only observed public free downloads; keep origin, hashes and licenses."""
import argparse,hashlib,json,re,zipfile
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parent
DEST=ROOT.parent/'free-assets-20260916'
DEST.mkdir(exist_ok=True)
CAT=json.loads((ROOT/'catalog.json').read_text(encoding='utf8'))
CARDS={c['key']:c for c in CAT['cards']}
def download(key,url):
 d=DEST/key;d.mkdir(exist_ok=True)
 path=d/'source.zip';record=d/'source.json'
 if not path.exists():
  response=requests.get(url,timeout=(20,180));response.raise_for_status()
  if not response.content.startswith(b'PK'):raise RuntimeError('Response is not a ZIP archive')
  path.write_bytes(response.content)
 with zipfile.ZipFile(path) as archive:
  bad=archive.testzip()
  if bad:raise RuntimeError('ZIP checksum failure')
  folder=(d/'source').resolve();folder.mkdir(exist_ok=True)
  for info in archive.infolist():
   target=(folder/info.filename).resolve()
   if not target.is_relative_to(folder):raise RuntimeError('Unsafe ZIP path')
  archive.extractall(folder)
  files=archive.namelist()
 card=CARDS[key].copy();card.update(downloaded=True,download_url=url,archive=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,files=files)
 record.write_text(json.dumps(card,ensure_ascii=False,indent=2),encoding='utf8')
 (d/'LICENSE-SOURCE.md').write_text(f"# {card['title']}\n\nAuthor: {card['author']}\n\nSource: {card['source']}\n\nLicense: {card['license']} — {card['license_url']}\n\nFree scope: {card['scope']}\n\nOriginal archive preserved; adaptation is tracked separately.\n",encoding='utf8')
 print(json.dumps({'asset':key,'bytes':path.stat().st_size,'files':len(files),'models':[s for s in files if s.lower().endswith(('.blend','.fbx','.glb','.gltf'))][:18]},ensure_ascii=False),flush=True)
def folder(key):
 html=(ROOT/(key+'.source.html')).read_text(encoding='utf8')
 url=re.search(r"https://drive.google.com/drive/folders/[^'\"]+",html).group()
 r=requests.get(url,timeout=45);r.raise_for_status();(DEST/(key+'-folder.html')).write_text(r.text,encoding='utf8')
 from bs4 import BeautifulSoup
 soup=BeautifulSoup(r.text,'html.parser')
 print(key,soup.get_text(' ',strip=True)[-15000:])
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action');p.add_argument('key');p.add_argument('url',nargs='?');a=p.parse_args()
 if a.action=='download':download(a.key,a.url)
 else:folder(a.key)
