"""Independent decode, MIDI, stem and resource checks for exported battle audio."""
from __future__ import annotations

import hashlib
import json
import struct

import compose_home as audio
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly, welch

SOURCE, OUT, EXPORT, SR = audio.SOURCE, audio.OUT, audio.EXPORT, audio.SR


def midi_info(path, bars: int, expected_tracks: int, expected_notes: int, bpm: float) -> dict:
    raw=path.read_bytes()
    assert raw[:4]==b"MThd"
    assert struct.unpack(">IHHH",raw[4:14])==(6,1,expected_tracks,480)
    position=14; count=0; ends=[]; tempos=[]; programs=0
    def vlq(data: bytes, offset: int) -> tuple[int,int]:
        value=0
        for _ in range(4):
            byte=data[offset]; offset+=1; value=(value<<7)|(byte&127)
            if byte<128:
                return value,offset
        raise AssertionError("MIDI invalid VLQ")
    for _ in range(expected_tracks):
        assert raw[position:position+4]==b"MTrk"
        length=struct.unpack(">I",raw[position+4:position+8])[0]
        data=raw[position+8:position+8+length]; position+=8+length
        offset=tick=0; active={}
        while offset<len(data):
            delta,offset=vlq(data,offset); tick+=delta
            status=data[offset]; offset+=1
            if status==255:
                meta=data[offset]; offset+=1
                size,offset=vlq(data,offset); payload=data[offset:offset+size]; offset+=size
                if meta==0x2f:
                    assert not active,"Hanging MIDI note"; ends.append(tick)
                elif meta==0x51:
                    tempos.append(int.from_bytes(payload,"big"))
            elif status&0xf0 in (0x80,0x90):
                key,velocity=data[offset:offset+2]; offset+=2; handle=(status&15,key)
                if status&0xf0==0x90 and velocity:
                    count+=1; active[handle]=active.get(handle,0)+1
                else:
                    assert active.get(handle,0)>0,"Unmatched MIDI note off"
                    active[handle]-=1
                    if active[handle]==0:
                        del active[handle]
            elif status&0xf0==0xc0:
                offset+=1; programs+=1
            else:
                raise AssertionError(f"Unexpected MIDI event {status:x}")
    assert position==len(raw) and count==expected_notes
    assert len(ends)==expected_tracks and all(end==bars*4*480 for end in ends)
    assert tempos==[round(60_000_000/bpm)]
    assert programs>=expected_tracks-2,"Missing instrument program assignments"
    return {"tracks":expected_tracks,"paired_notes":count,"end_beat":bars*4,"tempo_microseconds":tempos[0],"program_events":programs}


def decoded(path):
    samples,rate=sf.read(path,dtype="float32",always_2d=True)
    assert rate==SR and samples.shape[1]==2 and np.isfinite(samples).all()
    assert .005<float(np.max(np.abs(samples)))<.8
    return samples


def main() -> None:
    manifest=json.loads((EXPORT/"battle_audio_analysis.json").read_text(encoding="utf8"))
    result={"checks":[],"music":{},"effects":{},"pending":["human musical acceptance","actual Cocos looping and mix","mobile speaker and headphone review"]}
    def passed(message):
        result["checks"].append(message); print("PASS",message,flush=True)
    for which,bars,bpm,tracks,target in (("battle",32,112,8,-19),("boss",40,128,9,-18.5)):
        score=json.loads((SOURCE/f"{which}_score.json").read_text(encoding="utf8"))
        assert (score["id"],score["bars"],score["bpm"])==(which,bars,bpm)
        frames=round(bars*4*60/bpm*SR)
        midi=midi_info(SOURCE/f"{which}_score.mid",bars,tracks+1,len(score["events"]),bpm)
        assert len(score["events"])>1000
        for event in score["events"]:
            assert 0<=event["beat"]<bars*4 and 0<event["duration"]<4
            assert abs(event["time"]-event["beat"]*60/bpm)<1e-7
        passed(f"{which}: MIDI and editable score agree, correct tempo/length, all notes close")
        master_path=EXPORT/f"bgm_{which}_master.wav"
        master=decoded(master_path); runtime=decoded(OUT/f"bgm_{which}.ogg")
        assert master.shape==runtime.shape==(frames,2)
        assert sf.info(master_path).subtype=="PCM_24"
        loudness=float(pyln.Meter(SR).integrated_loudness(master))
        runtime_loudness=float(pyln.Meter(SR).integrated_loudness(runtime))
        assert abs(loudness-target)<.35 and abs(loudness-runtime_loudness)<.3
        measurements=[]
        for samples in (master,runtime):
            true_peak=float(np.max(np.abs(resample_poly(samples,4,1,axis=0))))
            assert true_peak<10**(-3/20)
            local=np.concatenate((samples[-1102:],samples[:1102]))
            boundary=float(np.max(np.abs(samples[0]-samples[-1])))
            derivative=float(np.sqrt(np.mean(np.diff(local,axis=0)**2)))
            assert boundary/max(derivative,1e-9)<4
            rms=float(np.sqrt(np.mean(samples.astype(np.float64)**2)))
            crest=audio.db(float(np.max(np.abs(samples)))/rms)
            assert 8<crest<24
            measurements.append({"true_peak_dbtp":audio.db(true_peak),"rms_dbfs":audio.db(rms),"crest_db":crest,"seam_delta_dbfs":audio.db(boundary),"seam_derivative_ratio":boundary/derivative})
        passed(f"{which}: actual WAV/Ogg decode, exact frames, target loudness, dynamic headroom and loop seam")
        stems=sorted((EXPORT/f"{which}_stems").glob("*.wav")); assert len(stems)==tracks
        combined=np.zeros_like(master); stem_measurements={}
        for path in stems:
            stem,rate=sf.read(path,dtype="float32",always_2d=True)
            assert rate==SR and stem.shape==master.shape and sf.info(path).subtype=="PCM_24"
            assert np.isfinite(stem).all() and np.max(np.abs(stem))<1
            rms=float(np.sqrt(np.mean(stem.astype(np.float64)**2)))
            assert rms>.00015,f"Silent stem: {path.name}"
            combined+=stem; stem_measurements[path.name]=audio.db(rms)
        residual=float(np.sqrt(np.mean((combined-master).astype(np.float64)**2)))
        assert residual<10**(-105/20)
        passed(f"{which}: {tracks} aligned audible 24-bit stems reconstruct master below -105 dBFS error")
        section_rms=[float(np.sqrt(np.mean(section.astype(np.float64)**2))) for section in np.array_split(master,bars//8)]
        assert min(section_rms)>max(section_rms)*.45
        mono=master.mean(axis=1)
        frequencies,power=welch(mono,SR,nperseg=4096)
        high_fraction=float(power[frequencies>=6000].sum()/power.sum())
        correlation=float(np.corrcoef(master.T)[0,1])
        assert correlation>.3 and high_fraction<.12
        preview=decoded(EXPORT/f"{which}_loop_join_preview.wav")
        assert len(preview)==8*SR
        expected=np.concatenate((master[-4*SR:],master[:4*SR]))
        assert np.max(np.abs(preview-expected))<1/16384
        result["music"][which]={"midi":midi,"frames":frames,"duration_seconds":frames/SR,"integrated_lufs":loudness,"runtime_lufs":runtime_loudness,"master":measurements[0],"runtime":measurements[1],"stem_rms_dbfs":stem_measurements,"stem_residual_dbfs":audio.db(residual),"section_rms_dbfs":[audio.db(rms) for rms in section_rms],"above_6khz_power_fraction":high_fraction,"stereo_correlation":correlation}
        passed(f"{which}: continuous sections, mono-compatible stereo, moderated high-frequency energy and seam preview")
    effects_score=json.loads((SOURCE/"battle_effects.json").read_text(encoding="utf8"))
    assert len(effects_score["effects"])==12
    for name,spec in effects_score["effects"].items():
        samples=decoded(OUT/f"{name}.wav"); master=decoded(EXPORT/"battle_sfx_masters"/f"{name}_master.wav")
        assert samples.shape==master.shape==(round(spec["duration"]*SR),2)
        assert sf.info(EXPORT/"battle_sfx_masters"/f"{name}_master.wav").subtype=="PCM_24"
        assert np.max(np.abs(samples-master))<1/16384
        assert np.max(np.abs(samples[0]))<=1/32768 and np.max(np.abs(samples[-1]))<=1/32768
        peak=audio.db(float(np.max(np.abs(samples))))
        assert abs(peak-spec["peak_dbfs"])<.02
        assert np.max(np.abs(resample_poly(samples,4,1,axis=0)))<.5
        assert spec["layers"] and all("seed" in layer for layer in spec["layers"])
        result["effects"][name]={"duration_seconds":len(samples)/SR,"peak_dbfs":peak,"rms_dbfs":audio.db(float(np.sqrt(np.mean(samples.astype(np.float64)**2))))}
    passed("12 distinct layered battle SFX: editable recipes, 24-bit masters, finite stereo, capped peaks, silence at both ends")
    hashes={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in manifest["asset_sha256"]}
    assert hashes==manifest["asset_sha256"] and len(hashes)==14
    assert len(set(hashes.values()))==len(hashes)
    resources=[path for path in OUT.iterdir() if path.suffix in (".ogg",".wav",".mp3")]
    assert len({path.stem for path in resources})==len(resources),"Duplicate audio resource basename"
    passed("14 new runtime asset hashes match; all resource basenames are unambiguous")
    result["status"]="offline checks passed; listening and in-engine acceptance still pending"
    (EXPORT/"battle_audio_validation.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)


if __name__=="__main__":
    main()
