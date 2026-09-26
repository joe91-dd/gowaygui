"""Independent verification of delivered runtime audio, archived inputs and builds."""
from pathlib import Path
import hashlib,json,re,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.path.insert(0,str(ROOT/'tmp/tools/audio/python-libs'))
import numpy as np
import soundfile as sf
manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
controller=(ROOT/'game/assets/scripts/view/IslandAudio.ts').read_text(encoding='utf8')
expected=set(re.findall(r'(?:bgm|sfx)_[a-z_]*[a-z](?=[\'":])',controller))
expected.update('sfx_skill_'+role for role in ['stone','spike','crystal','leaf','bubble'])
by_key={a['key']:a for a in manifest['assets']}
assert expected == by_key.keys(),{'missing':sorted(expected-by_key.keys()),'unregistered':sorted(by_key.keys()-expected)}
checks=[]
for key,a in by_key.items():
 path=ROOT/a['runtime'];assert a['license']=='CC0-1.0'
 assert hashlib.sha256(path.read_bytes()).hexdigest()==a['sha256'],key
 assert len(list(path.parent.glob(key+'.*')))==2,'Resource must have only one audio format + metadata'
 for source in a['sources']:
  assert hashlib.sha256((HERE/source['file']).read_bytes()).hexdigest()==source['sha256']
 data,sr=sf.read(path,always_2d=True,dtype='float32')
 # UI clicks can intentionally be shorter than 23ms (1000 frames).
 assert sr==44100 and data.shape[1]==2 and len(data)>220,key
 assert np.isfinite(data).all() and .001<np.max(np.abs(data))<.99,key
 checks.append({'key':key,'frames':len(data),'duration':len(data)/sr,'peak':float(np.max(np.abs(data))),'sha256':a['sha256']})
for name in ['rpg-audio','impact-sounds','interface-sounds','music-jingles']:
 assert 'CC0' in (HERE/name/'License.txt').read_text(encoding='utf8')
selection=json.loads((HERE/'music-selection.json').read_text(encoding='utf8'))
for track in selection['tracks']:
 assert 'publicdomain/zero/1.0' in (HERE/track['licensePage']).read_text(encoding='utf8')
 assert by_key[track['key']]['sources'][0]['sha256']==track['sha256']
music_count=sum(key.startswith('bgm_') for key in by_key)
report={'status':'passed','assets':len(checks),'music':music_count,'effects':len(checks)-music_count,'bytes':sum(a['bytes'] for a in manifest['assets']),'checks':checks}
if len(sys.argv)>1:
 build=Path(sys.argv[1]);native=list((build/'assets/resources/native').rglob('*'))
 built_hashes={hashlib.sha256(p.read_bytes()).hexdigest() for p in native if p.suffix in ['.ogg','.wav']}
 assert {a['sha256'] for a in manifest['assets']}<=built_hashes,'Build is missing current audio bytes'
 bundle=(build/'assets/main/index.js').read_text(encoding='utf8')
 for cue in ['sfx_fusion_start','sfx_fusion_complete','sfx_purchase','sfx_learn','sfx_boss_arrive','battleEvents']:
  assert cue in bundle, 'Build missing event wiring: '+cue
 report['builtAudioPassed']=True
 report['build']=str(build)
(HERE/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='checks'}))
