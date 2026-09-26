"""Rebuild runtime audio from the archived CC0 originals. No generated notes/samples.
Run with the project's tmp/tools/audio/python-libs dependencies installed.
"""
from pathlib import Path
import hashlib, json, math, shutil, sys, uuid
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tmp/tools/audio/python-libs'))
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent
OUT = ROOT / 'game/assets/resources/audio'
SR = 44100
I = 'interface-sounds/Audio/'
R = 'rpg-audio/Audio/'
P = 'impact-sounds/Audio/'
J = 'music-jingles/Audio/Steel jingles/'
# source, offset seconds, linear gain, playback rate. All layers retain CC0.
CUES = {
 'sfx_panel_slide':[(I+'switch_003.ogg',0,1,.8),(I+'pluck_002.ogg',.05,.35,1.2)],
 'sfx_draw_tick':[(I+'click_003.ogg',0,.65,1.55),(I+'pluck_001.ogg',.015,.35,1.7)],
 'sfx_wish_start':[(I+'maximize_004.ogg',0,.8,.65),(I+'glass_004.ogg',.22,.6,.8)],
 'sfx_wish_gather':[(I+'glass_002.ogg',0,.6,1),(I+'glass_002.ogg',.15,.7,1.25),(I+'glass_002.ogg',.30,.8,1.5),(I+'maximize_003.ogg',.22,.7,.85)],
 'sfx_wish_burst':[(J+'jingles_STEEL00.ogg',0,1,1.2),(I+'glass_003.ogg',.05,.6,.7)],
 'sfx_boss_skill':[(P+'impactMining_000.ogg',0,.8,.6),(P+'impactBell_heavy_000.ogg',.07,.6,.85),(P+'impactPunch_heavy_000.ogg',.12,1,.7)],
 'sfx_ui_confirm': [(I+'click_003.ogg',0,1,1),(I+'pluck_001.ogg',.015,.3,1.5)],
 'sfx_ui_back': [(I+'back_001.ogg',0,1,1)],
 'sfx_ui_error': [(I+'error_004.ogg',0,1,1)],
 'sfx_upgrade': [(I+'maximize_003.ogg',0,.6,1),(J+'jingles_STEEL04.ogg',.10,1,1)],
 'sfx_equip': [(I+'switch_003.ogg',0,1,1),(R+'metalClick.ogg',.035,.3,1)],
 'sfx_chest': [(I+'maximize_003.ogg',0,.65,.85),(I+'glass_001.ogg',.12,.8,1.25),(J+'jingles_STEEL03.ogg',.18,.6,1.3)],
 'sfx_learn_complete': [(I+'glass_001.ogg',0,.5,1),(J+'jingles_STEEL03.ogg',.06,.8,1)],
 'sfx_bubble_pop': [(I+'pluck_001.ogg',0,1,1.25)],
 'sfx_bubble_rub': [(I+'scratch_001.ogg',0,1,1)],
 'sfx_collect': [(R+'handleCoins2.ogg',0,.5,1),(I+'confirmation_002.ogg',.08,1,1)],
 'sfx_rare_reveal': [(J+'jingles_STEEL00.ogg',0,1,1)],
 'sfx_victory': [(J+'jingles_STEEL01.ogg',0,1,1)],
 'sfx_defeat': [(I+'minimize_004.ogg',0,1,.7),(I+'back_002.ogg',.22,.5,.8)],
 'sfx_attack_melee': [(P+'impactPunch_medium_000.ogg',0,1,1)],
 'sfx_attack_projectile': [(R+'knifeSlice.ogg',0,1,1.2)],
 'sfx_attack_magic': [(I+'glass_002.ogg',0,1,1.15)],
 'sfx_hit_soft': [(P+'impactSoft_medium_001.ogg',0,1,1)],
 'sfx_heal': [(I+'pluck_002.ogg',0,1,1),(I+'pluck_002.ogg',.1,.5,1.25)],
 'sfx_core_hit': [(P+'impactMetal_heavy_000.ogg',0,.7,.8),(P+'impactSoft_heavy_000.ogg',0,1,1)],
 'sfx_skill_stone': [(P+'impactMining_000.ogg',0,.7,.8),(P+'impactPunch_heavy_000.ogg',.09,1,.7)],
 'sfx_skill_spike': [(R+'knifeSlice2.ogg',0,1,1.1),(R+'knifeSlice.ogg',.12,.7,1.4)],
 'sfx_skill_crystal': [(I+'glass_004.ogg',0,1,.8),(P+'impactGlass_light_000.ogg',.12,.6,1.3)],
 'sfx_skill_leaf': [(I+'pluck_002.ogg',0,1,1),(I+'pluck_002.ogg',.13,.8,1.25),(I+'pluck_002.ogg',.26,.7,1.5)],
 'sfx_skill_bubble': [(I+'pluck_001.ogg',0,1,.8),(I+'pluck_001.ogg',.1,.7,1),(I+'pluck_001.ogg',.2,.5,1.3)],
 'sfx_fusion_start': [(I+'maximize_004.ogg',0,1,.8),(I+'glass_001.ogg',.16,.65,1)],
 'sfx_fusion_complete': [(J+'jingles_STEEL02.ogg',0,1,1)],
 'sfx_purchase': [(R+'handleCoins.ogg',0,.6,1),(I+'confirmation_001.ogg',.18,1,1)],
 'sfx_learn': [(R+'bookFlip2.ogg',0,.6,1),(I+'confirmation_003.ogg',.17,1,1.1)],
 'sfx_wave_start': [(I+'confirmation_004.ogg',0,1,.8)],
 'sfx_boss_arrive': [(P+'impactBell_heavy_000.ogg',0,1,.65),(P+'impactSoft_heavy_000.ogg',.18,.6,.7)],
 'sfx_shield': [(P+'impactMetal_light_000.ogg',0,.6,1),(I+'glass_003.ogg',.06,.6,.9)],
 'sfx_revive': [(I+'maximize_003.ogg',0,.5,1),(J+'jingles_STEEL03.ogg',.1,.7,1)],
 'sfx_critical': [(P+'impactPunch_heavy_001.ogg',0,1,1.15)],
}

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path, rate=1):
    data,sr=sf.read(path,always_2d=True,dtype='float64')
    if data.shape[1]==1: data=np.repeat(data,2,axis=1)
    source_rate=round(sr*rate); g=math.gcd(SR,source_rate)
    return resample_poly(data,SR//g,source_rate//g,axis=0)

def export(key,data,sources,music=False):
    if music:
        loudness=pyln.Meter(SR).integrated_loudness(data)
        data*=10**((-20-loudness)/20)
        # Preserve the author's complete loop; only correct sub-millisecond edge clicks.
        n=88; data[:n]*=np.linspace(0,1,n)[:,None];data[-n:]*=np.linspace(1,0,n)[:,None]
    else:
        active=np.flatnonzero(np.max(np.abs(data),axis=1)>.0001)
        if len(active):data=data[max(0,active[0]-220):min(len(data),active[-1]+441)]
        n=min(220,len(data)//2);data[:n]*=np.linspace(0,1,n)[:,None];data[-n:]*=np.linspace(1,0,n)[:,None]
        # Normalize after the edge fades: short clicks otherwise lose most of their peak.
        data*=10**((-7 if key in ['sfx_ui_confirm','sfx_ui_back','sfx_draw_tick'] else -10)/20)/max(1e-8,float(np.max(np.abs(data))))
    peak=float(np.max(np.abs(data)))
    if peak>.7:data*=.7/peak
    target=OUT/(key+('.ogg' if music else '.wav'))
    backup=HERE/'previous-runtime'/target.name
    if target.exists() and not backup.exists():backup.parent.mkdir(exist_ok=True);shutil.copy2(target,backup)
    # libsndfile's Windows Vorbis encoder must receive bounded float32 blocks.
    # Publish atomically so an interrupted encode cannot corrupt a runtime file.
    staging=target.with_name(target.stem+'.encoding')
    with sf.SoundFile(staging,mode='w',samplerate=SR,channels=2,
                      format='OGG' if music else 'WAV',subtype='VORBIS' if music else 'PCM_16') as encoder:
        for start in range(0,len(data),16384):encoder.write(data[start:start+16384].astype(np.float32))
    staging.replace(target)
    meta=target.with_name(target.name+'.meta')
    if not meta.exists():meta.write_text(json.dumps({'ver':'1.0.0','importer':'audio-clip','imported':True,'uuid':str(uuid.uuid4()),'files':['.json',target.suffix],'subMetas':{},'userData':{'downloadMode':0}},indent=2)+'\n')
    decoded,sr=sf.read(target,always_2d=True)
    assert sr==SR and np.isfinite(decoded).all() and np.max(np.abs(decoded))<.99
    return {'key':key,'runtime':str(target.relative_to(ROOT)).replace('\\','/'),'license':'CC0-1.0','sha256':digest(target),'bytes':target.stat().st_size,'duration':len(decoded)/SR,'peakDb':float(20*np.log10(np.max(np.abs(decoded)))),'sources':sources,'integratedLUFS':float(pyln.Meter(SR).integrated_loudness(decoded)) if music else None}

def main():
    music_only='--music-only' in sys.argv
    effects_only='--effects-only' in sys.argv
    assert not (music_only and effects_only)
    assets=[a for a in json.loads((HERE/'manifest.json').read_text(encoding='utf8'))['assets'] if (not a['key'].startswith('bgm_') if music_only else a['key'].startswith('bgm_'))] if music_only or effects_only else []
    for key,layers in ([] if music_only else CUES.items()):
        pieces=[(read(HERE/name,rate)*gain,round(offset*SR)) for name,offset,gain,rate in layers]
        data=np.zeros((max(len(d)+o for d,o in pieces),2))
        for d,o in pieces:data[o:o+len(d)]+=d
        assets.append(export(key,data,[{'file':name,'sha256':digest(HERE/name),'offset':offset,'gain':gain,'rate':rate} for name,offset,gain,rate in layers]))
    selection=json.loads((HERE/'music-selection.json').read_text(encoding='utf8'))
    for track in ([] if effects_only else selection['tracks']):
        key,path=track['key'],HERE/track['file']
        assert digest(path)==track['sha256'], 'Selected original checksum mismatch: '+key
        print('Encoding '+key,flush=True)
        assets.append(export(key,read(path),[{k:track[k] for k in ['file','title','author','page','licensePage','sha256']}],True))
    manifest={'date':'2026-09-16','license':'https://creativecommons.org/publicdomain/zero/1.0/','effectsAuthor':'Kenney','effectsPages':['https://kenney.nl/assets/'+p for p in ['rpg-audio','interface-sounds','impact-sounds','music-jingles']],'processing':'44100Hz stereo; music -20 LUFS with peak ceiling; SFX peak -12dBFS, trimmed quiet edges, 5ms fades; layer offsets/rates/gains recorded below. Originals preserved.','assets':assets}
    (HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'assets':len(assets),'bytes':sum(a['bytes'] for a in assets),'music':[{k:a[k] for k in ['key','duration','peakDb','integratedLUFS']} for a in assets if a['key'].startswith('bgm')]}))

if __name__=='__main__': main()
