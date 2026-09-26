"""Archive the user-approved A originals and preserve the previous runtime selection."""
from pathlib import Path
import hashlib,json,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
archive=ROOT/'game/audio-source/cc0-20260916'
destination=archive/'music-a'
destination.mkdir(exist_ok=True)
backup=archive/'before-music-a'
backup.mkdir(exist_ok=True)
manifest=archive/'manifest.json'
if not (backup/'manifest.json').exists(): shutil.copy2(manifest,backup/'manifest.json')
tracks=[]
for t in json.loads((HERE/'manifest.json').read_text(encoding='utf8')):
    if t['group']!='A':continue
    key='bgm_'+t['id'].split('-')[1]
    original=HERE/t['original']
    assert hashlib.sha256(original.read_bytes()).hexdigest()==t['sha256']
    filename=t['id']+original.suffix
    shutil.copy2(original,destination/filename)
    page=t['slug']+'.source.html'
    shutil.copy2(HERE/page,destination/page)
    runtime=ROOT/'game/assets/resources/audio'/(key+'.ogg')
    if not (backup/runtime.name).exists():shutil.copy2(runtime,backup/runtime.name)
    tracks.append(dict(key=key,file='music-a/'+filename,title=t['title'],author=t['author'],page=t['source'],licensePage='music-a/'+page,sha256=t['sha256']))
assert len(tracks)==3
(archive/'music-selection.json').write_text(json.dumps(dict(selection='A · 奇幻管弦',approvedByUser=True,license='CC0-1.0',tracks=tracks),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Archived and selected A: home, battle, boss')
