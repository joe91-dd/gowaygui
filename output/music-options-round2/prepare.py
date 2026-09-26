"""Download CC0 audition candidates; retain originals and normalize listening copies."""
from pathlib import Path
import concurrent.futures, hashlib, json, os, sys, time, urllib.request
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['OMP_NUM_THREADS'] = '1'
sys.path.insert(0, str(ROOT / 'tmp/tools/audio/python-libs'))
TRACKS = [
 dict(id='a-home', group='A', role='战斗外', title='Town Theme RPG', author='cynicmusic', slug='town-theme-rpg', description='竖琴与木管，安静的城镇与休整氛围。'),
 dict(id='b-home', group='B', role='战斗外', title='Chill (Loopable)', author='Alex McCulloch / Pro Sensory', slug='chill-loopable', description='轻松的 lo-fi 电子节奏，偏现代、悠闲。'),
 dict(id='a-battle', group='A', role='普通战斗', title='Battle Theme A', author='cynicmusic', slug='battle-theme-a', description='弦乐与铜管，经典奇幻 RPG 战斗方向。'),
 dict(id='b-battle', group='B', role='普通战斗', title='Ocean Trance', author='MintoDog', slug='ocean-trance', description='140 BPM 合成器律动，推进感强的电子战斗方向。'),
 dict(id='a-boss', group='A', role='首领战', title='Epic Boss Battle', author='Juhani Junkala / SubspaceAudio', slug='boss-battle-music', description='史诗管弦与打击乐，用于大型首领的压迫感。'),
 dict(id='b-boss', group='B', role='首领战', title='The Rush', author='tebruno99', slug='the-rush', description='紧迫的电子动作氛围，面向决战与高强度场面。'),
]
URLS = json.loads((HERE / 'downloads.json').read_text(encoding='utf-8-sig'))
(HERE / 'originals').mkdir(exist_ok=True)
(HERE / 'listening').mkdir(exist_ok=True)

def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0', **(headers or {})})
    return urllib.request.urlopen(req, timeout=40)

def download(t):
    url = URLS[t['slug']][0]
    path = HERE / 'originals' / (t['id'] + Path(url).suffix)
    if not path.exists():
        for attempt in range(3):
            try:
                with fetch(url, {'Range':'bytes=0-0'}) as response:
                    range_header = response.headers.get('Content-Range', '')
                    if response.status != 206 or '/' not in range_header:
                        data = response.read()
                        path.with_suffix(path.suffix+'.part').write_bytes(data)
                        break
                    size = int(range_header.split('/')[-1])
                def part(span):
                    start,end = span
                    cached = HERE / 'originals' / (t['id']+f'.{start}.part')
                    if cached.exists() and cached.stat().st_size == end-start+1:
                        return cached.read_bytes()
                    for retry in range(3):
                        try:
                            with fetch(url, {'Range':f'bytes={start}-{end}'}) as r:
                                data = r.read()
                                if r.status != 206 or len(data) != end-start+1:
                                    raise ValueError('Incomplete range')
                                cached.write_bytes(data)
                                print('Range',t['id'],start,end,flush=True)
                                return data
                        except Exception:
                            if retry == 2: raise
                            time.sleep(1)
                spans = [(i,min(size-1,i+128*1024-1)) for i in range(0,size,128*1024)]
                with concurrent.futures.ThreadPoolExecutor(max_workers=24 if t['id']=='a-boss' else 8) as pool:
                    data = b''.join(pool.map(part,spans))
                assert len(data)==size
                path.with_suffix(path.suffix+'.part').write_bytes(data)
                break
            except Exception:
                if attempt==2: raise
                time.sleep(2)
        path.with_suffix(path.suffix+'.part').replace(path)
        for cached in (HERE/'originals').glob(t['id']+'.*.part'):
            cached.unlink()
    t.update(source='https://opengameart.org/content/'+t['slug'], download=url,
             license='CC0 1.0', license_url='https://creativecommons.org/publicdomain/zero/1.0/',
             original=str(path.relative_to(HERE)), sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    print('Downloaded',t['id'],path.stat().st_size,flush=True)

def normalize(t):
    import numpy as np, soundfile as sf, pyloudnorm as pyln
    data, sr = sf.read(HERE/t['original'],dtype='float32',always_2d=True)
    assert np.isfinite(data).all() and len(data)>sr
    loudness = pyln.Meter(sr).integrated_loudness(data)
    peak = float(np.abs(data).max())
    gain_db = min(-20-loudness, -2-20*np.log10(max(peak,1e-9)))
    data *= 10**(gain_db/20)
    path = HERE/'listening'/(t['id']+'.ogg')
    with sf.SoundFile(path,mode='w',samplerate=sr,channels=data.shape[1],format='OGG',subtype='VORBIS') as enc:
        for start in range(0,len(data),16384):
            enc.write(data[start:start+16384])
    decoded, check_sr = sf.read(path,dtype='float32',always_2d=True)
    assert check_sr==sr and len(decoded)==len(data) and np.isfinite(decoded).all()
    assert np.abs(decoded).max()<1
    t.update(duration=round(len(data)/sr,2), sample_rate=sr, listening=str(path.relative_to(HERE)),
             original_lufs=round(loudness,2), gain_db=round(gain_db,2),
             listening_lufs=round(pyln.Meter(sr).integrated_loudness(decoded),2),
             peak=round(float(np.abs(decoded).max()),5))
    print('Prepared',t['id'],t['duration'],'seconds',t['listening_lufs'],'LUFS',flush=True)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, TRACKS))
    (HERE/'manifest.json').write_text(json.dumps(TRACKS,ensure_ascii=False,indent=2),encoding='utf8')
    for track in TRACKS:
        normalize(track)
    (HERE/'manifest.json').write_text(json.dumps(TRACKS,ensure_ascii=False,indent=2),encoding='utf8')
