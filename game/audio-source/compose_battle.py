"""Original battle music and effects, using the established project synthesis.

No imported recordings, melodies, SoundFonts or remote generation. JSON scores,
MIDI, aligned stems and 24-bit masters are editable project source deliverables.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

import compose_home as audio
import numpy as np
import soundfile as sf

SR, SOURCE, OUT, EXPORT = audio.SR, audio.SOURCE, audio.OUT, audio.EXPORT
SEED = 2026090802
PERCUSSION = {"shaker", "kick", "rim", "bongo", "brush", "low_drum"}
CHORDS = {
    **audio.CHORDS,
    "Em9": {"bass": "E2", "fifth": "B2", "notes": ["G3", "B3", "E4", "F#4"]},
    "C6": {"bass": "C3", "fifth": "G2", "notes": ["G3", "A3", "C4", "E4"]},
    "D/F#": {"bass": "F#2", "fifth": "A2", "notes": ["A3", "D4", "F#4", "A4"]},
}

# Deliberately authored phrases, including rests and call/answer contours.
# (Within-bar beat, pitch, held beats); the shared home motif is developed here.
BATTLE_PHRASES = [
    [(0,"G4",.45),(.75,"B4",.3),(1.25,"D5",.65),(2.25,"E5",.4),(3,"D5",.4),(3.5,"B4",.3)],
    [(.25,"G4",.4),(1,"B4",.4),(1.75,"E5",.75),(3,"D5",.4)],
    [(0,"E5",.65),(1,"G5",.4),(1.75,"E5",.45),(2.5,"D5",.4),(3.25,"C5",.45)],
    [(.25,"A4",.45),(1,"D5",.55),(2,"F#5",.7),(3.25,"E5",.35)],
    [(0,"D5",.45),(.75,"B4",.3),(1.25,"G4",.7),(2.5,"A4",.4),(3.25,"B4",.4)],
    [(0,"C5",.55),(1,"E5",.45),(1.75,"D5",.35),(2.5,"C5",.4),(3.25,"A4",.45)],
    [(.25,"G4",.6),(1.25,"C5",.4),(2,"E5",.7),(3.25,"D5",.45)],
    [(0,"A4",.35),(.5,"C5",.35),(1.25,"D5",.85),(2.5,"F#4",.4),(3.5,"A4",.3)],
    [(0,"B4",.45),(.75,"D5",.35),(1.25,"G5",.6),(2.25,"E5",.45),(3.25,"D5",.45)],
    [(.25,"B4",.55),(1.25,"G4",.55),(2.5,"E4",.9)],
    [(0,"G5",.6),(1,"E5",.45),(1.75,"D5",.4),(2.5,"C5",.85)],
    [(.25,"A4",.45),(1,"D5",.4),(1.75,"F#5",.4),(2.5,"E5",.4),(3.25,"D5",.4)],
    [(0,"B4",.65),(1,"D5",.5),(2,"G5",.8),(3.25,"D5",.35)],
    [(0,"E5",.7),(1,"C5",.5),(2,"A4",.6),(3.25,"C5",.35)],
    [(.25,"A4",.55),(1.25,"C5",.45),(2,"A4",.35),(2.75,"F#4",.5)],
    [(0,"G4",1.1),(2,"B4",.35),(2.75,"D5",.45)],
    [(.25,"B4",.85),(1.5,"G4",.55),(2.5,"E4",.9)],
    [(0,"F#4",.55),(1,"A4",.6),(2.25,"D#5",.9)],
    [(0,"E5",.6),(1,"D5",.4),(1.75,"C5",.6),(2.75,"G4",.8)],
    [(.25,"B4",.8),(1.5,"D5",.5),(2.5,"G5",.8)],
    [(0,"E5",.6),(1,"C5",.55),(2,"A4",.8)],
    [(.25,"G4",.55),(1.25,"B4",.5),(2.25,"E5",.85)],
    [(0,"C5",.7),(1.25,"E5",.5),(2.25,"G5",.6),(3.25,"E5",.4)],
    [(0,"D5",.55),(1,"A4",.45),(1.75,"F#4",.55),(2.75,"A4",.6)],
    [(0,"B4",.4),(.75,"D5",.3),(1.25,"E5",.65),(2.25,"D5",.35),(3,"G5",.5)],
    [(.25,"E5",.6),(1.25,"B4",.4),(2,"G4",.55),(3,"B4",.5)],
    [(0,"E5",.65),(1,"G5",.4),(1.75,"E5",.4),(2.5,"D5",.35),(3.25,"C5",.45)],
    [(.25,"A4",.45),(1,"D5",.55),(2,"F#5",.7),(3.25,"E5",.35)],
    [(0,"D5",.65),(1,"B4",.45),(1.75,"G4",.65),(3,"B4",.55)],
    [(0,"C5",.55),(1,"E5",.6),(2,"C5",.5),(3,"A4",.5)],
    [(.25,"D5",.55),(1.25,"C5",.4),(2,"A4",.5),(3,"F#4",.5)],
    [(0,"A4",.7),(1.25,"D5",.65),(2.25,"C5",.4),(3,"A4",.4),(3.5,"F#4",.3)],
]
BOSS_PHRASES = [
    [(0,"E4",.4),(.75,"G4",.3),(1.25,"B4",.65),(2.25,"D5",.45),(3.25,"B4",.45)],
    [(0,"G4",.45),(.75,"C5",.35),(1.5,"E5",.65),(2.75,"D5",.35),(3.25,"C5",.45)],
    [(.25,"A4",.55),(1.25,"C5",.45),(2.25,"B4",.35),(3,"A4",.5)],
    [(0,"F#4",.45),(.75,"A4",.4),(1.5,"B4",.7),(2.75,"D#5",.65)],
    [(0,"E5",.7),(1,"B4",.45),(1.75,"G4",.6),(3,"E4",.65)],
    [(.25,"F#4",.45),(1,"A4",.45),(1.75,"D5",.65),(3,"F#5",.45)],
    [(0,"E5",.6),(1,"D5",.35),(1.75,"C5",.55),(2.75,"G4",.8)],
    [(0,"F#4",.4),(.75,"A4",.35),(1.5,"D#5",.7),(2.75,"B4",.5),(3.5,"F#4",.3)],
    [(0,"B4",.4),(.75,"E5",.35),(1.5,"G5",.65),(2.75,"F#5",.35),(3.25,"E5",.45)],
    [(.25,"E5",.6),(1.25,"C5",.5),(2.25,"A4",.9)],
    [(0,"A4",.45),(.75,"D5",.3),(1.5,"F#5",.65),(2.75,"E5",.35),(3.25,"D5",.45)],
    [(0,"B4",.6),(1,"D5",.45),(1.75,"G5",.9)],
    [(.25,"E5",.7),(1.25,"B4",.45),(2,"G4",.6),(3.25,"B4",.4)],
    [(0,"C5",.5),(.75,"E5",.45),(1.75,"C5",.55),(2.75,"A4",.75)],
    [(0,"A4",.4),(.75,"F#4",.4),(1.5,"D#4",.65),(2.75,"F#4",.55)],
    [(.25,"B4",.65),(1.25,"A4",.45),(2,"F#4",.5),(3,"D#4",.55)],
    [(0,"G4",1),(1.5,"C5",.65),(2.75,"E5",.9)],
    [(.25,"D5",.8),(1.5,"B4",.65),(2.75,"G4",.85)],
    [(0,"A4",.85),(1.25,"C5",.7),(2.75,"E5",.8)],
    [(.25,"B4",.65),(1.5,"G4",.65),(2.75,"E4",.85)],
    [(0,"G4",.8),(1.25,"C5",.65),(2.5,"E5",1)],
    [(.25,"F#5",.85),(1.5,"E5",.65),(2.75,"D5",.85)],
    [(0,"A4",.65),(1.25,"B4",.65),(2.5,"D#5",1)],
    [(.25,"F#5",.7),(1.5,"D#5",.5),(2.5,"B4",.5),(3.25,"F#4",.45)],
    [(0,"E4",.4),(.75,"G4",.3),(1.25,"B4",.65),(2.25,"E5",.45),(3.25,"D5",.45)],
    [(0,"C5",.5),(.75,"E5",.4),(1.75,"G5",.6),(2.75,"E5",.35),(3.25,"D5",.4)],
    [(.25,"C5",.55),(1.25,"A4",.45),(2.25,"E5",.8)],
    [(0,"D#5",.55),(1,"B4",.4),(1.75,"A4",.45),(2.75,"F#4",.65)],
    [(0,"G4",.45),(.75,"B4",.35),(1.5,"E5",.65),(2.75,"G5",.7)],
    [(.25,"F#5",.55),(1.25,"D5",.45),(2.25,"A4",.8)],
    [(0,"E5",.65),(1,"D5",.35),(1.75,"C5",.6),(2.75,"G4",.7)],
    [(0,"F#4",.4),(.75,"A4",.35),(1.5,"D#5",.65),(2.75,"B4",.5)],
    [(0,"B4",.5),(.75,"D5",.35),(1.5,"G5",.75),(2.75,"E5",.6)],
    [(.25,"E5",.6),(1.25,"C5",.5),(2.25,"G4",.75)],
    [(0,"B4",.55),(1,"E5",.45),(1.75,"G5",.75),(3,"E5",.6)],
    [(.25,"D#5",.65),(1.25,"B4",.4),(2,"A4",.5),(3,"F#4",.55)],
    [(0,"G4",.5),(.75,"C5",.35),(1.5,"E5",.65),(2.75,"G5",.65)],
    [(0,"E5",.65),(1,"C5",.45),(1.75,"A4",.6),(3,"C5",.5)],
    [(.25,"B4",.55),(1.25,"A4",.4),(2,"F#4",.6),(3,"D#4",.5)],
    [(0,"F#4",.65),(1,"A4",.45),(1.75,"B4",.65),(2.75,"D#5",.45),(3.5,"F#4",.3)],
]
PROGRESSIONS = {
    "battle": ["G6","Em7","Cmaj7","Dadd9","G/B","Am7","Cmaj7","D7",
               "G6","Em7","Cmaj7","Dadd9","G/B","Am7","D7","G6",
               "Em7","B7","Cmaj7","G/B","Am7","Em7","Cmaj7","D7",
               "G6","Em7","Cmaj7","Dadd9","G/B","Am7","D7","D7"],
    "boss": ["Em9","Cmaj7","Am7","B7","Em7","D/F#","Cmaj7","B7",
             "Em7","C6","Dadd9","G6","Em7","Am7","B7","B7",
             "Cmaj7","G/B","Am7","Em7","Cmaj7","Dadd9","B7","B7",
             "Em9","Cmaj7","Am7","B7","Em7","D/F#","Cmaj7","B7",
             "G6","Cmaj7","Em7","B7","Cmaj7","Am7","B7","B7"],
}


def instrument(kind: str, pitch: int, duration: float, seed: int) -> np.ndarray:
    if kind == "reed":
        # Rounded short reed: subdued upper partials, breath attack, no brass rasp.
        t = np.arange(round((duration + .45) * SR)) / SR
        f = audio.hz(pitch)
        phase = np.cumsum(f * (1 + .0012 * np.sin(2 * np.pi * 4.8 * t))) / SR
        y = sum(amp * np.sin(2 * np.pi * phase * h) for h, amp in ((1,1),(2,.24),(3,.16),(4,.048),(5,.018)))
        y *= audio.smooth_gate(t, duration, .25, .028)
        return y.astype(np.float32)
    if kind == "low_drum":
        t = np.arange(round(.46 * SR)) / SR
        phase = np.cumsum(83 + 34 * np.exp(-t / .02)) / SR
        y = (np.sin(2 * np.pi * phase) + .23 * np.sin(2 * np.pi * 146 * t)) * np.exp(-t / .095)
        y *= 1 - np.exp(-t / .004)
        return y.astype(np.float32)
    if kind in PERCUSSION:
        return audio.percussion(kind, seed)
    return audio.tone(kind, pitch, duration, seed)


def create_score(which: str) -> dict:
    boss = which == "boss"
    bpm = 128 if boss else 112
    beat_seconds = 60 / bpm
    progression = PROGRESSIONS[which]
    melody = BOSS_PHRASES if boss else BATTLE_PHRASES
    rng = np.random.default_rng(SEED + int(boss))
    events = []

    def add(track: str, kind: str, bar: int, beat: float, pitch: str | int, held: float, gain: float, pan: float = 0) -> None:
        absolute = bar * 4 + beat
        events.append({"track":track,"instrument":kind,"beat":round(absolute,6),
                       "time":round(absolute * beat_seconds,9),"midi":audio.note_number(pitch),
                       "duration":round(held * beat_seconds,9),"gain":round(gain * rng.uniform(.94,1.06),6),
                       "pan":pan,"seed":int(rng.integers(1,2**31-1))})

    for bar, chord_id in enumerate(progression):
        chord = CHORDS[chord_id]
        notes = [audio.note_number(note) for note in chord["notes"]]
        section = bar // 8
        bridge = section == 2
        energy = .77 if bridge else 1.06 if section >= 3 else 1
        # Theme remains centered with contrasting breath/wood answers in the bridge.
        for index, (beat, pitch, held) in enumerate(melody[bar]):
            kind = "breath" if bridge else "wood"
            add("01_theme", kind, bar, beat, pitch, held, (.105 if bridge else .165) * energy, -.06)
            if boss and not bridge and index in (0,3):
                add("02_reed_answers", "reed", bar, beat + .008, audio.note_number(pitch)-12, min(.65,held), .039, .18)
        if bar % 2 == 1:
            for at, note in ((2.5,notes[1]),(3.25,notes[2])):
                add("02_reed_answers", "reed", bar, at, note, .45, .045 * energy, .25)
        # Alternating string shapes and offbeats keep a lilt rather than a rigid march.
        picking = [0,2,1,3,2,1] if bar % 2 == 0 else [0,1,3,2,1,2]
        times = [0,.75,1.5,2,2.75,3.5]
        for step, at in enumerate(times):
            add("03_picked_strings", "pluck", bar, at + .012, notes[picking[step]], .42, .070 * energy, -.32)
        for at in (1,3):
            for index, note in enumerate(notes[:3]):
                add("04_rhythm_strings", "pluck", bar, at + .018 + index * .018, note, .24, .035 * energy, .35)
        for at, note, held, gain in ((0,chord["bass"],.72,.155),(1.5,chord["fifth"],.36,.101),(2.5,chord["bass"],.58,.131),(3.5,chord["fifth"],.28,.076)):
            if bridge and at == 3.5:
                continue
            add("05_round_bass", "bass", bar, at, note, held, gain * energy)
        # Air voicing is sparse and stays below the theme to leave room for SFX.
        if bar % 2 == 0 or bridge:
            for index, note in enumerate(notes[:3]):
                add("06_warm_air", "breath", bar, .10 + index * .012, note, 2.8 if bridge else 1.8, .018 if bridge else .012, -.28 + index * .28)
        if bar % 4 in (0,3):
            add("07_shell_glints", "bells", bar, 2.75 if bar % 4 == 0 else 3.5, notes[2] + 12, .35, .022 * energy, .38 if bar % 4 == 0 else -.38)
        for half in range(8):
            if bridge and half % 2:
                continue
            add("08_percussion", "shaker", bar, half * .5 + (.023 if half % 2 else 0), 42, .12, (.019 if half % 2 else .028) * energy, -.35 if half % 2 else .3)
        for at, gain in ((0,.11),(2,.089)):
            add("08_percussion", "kick", bar, at, 36, .18, gain * energy)
        for at in (1,3):
            add("08_percussion", "rim", bar, at + .012, 37, .12, .027 * energy, .2)
        if bar % 4 == 3:
            for index, at in enumerate((2.75,3.25,3.75)):
                add("08_percussion", "bongo", bar, at, 60 + index * 2, .16, .048 * energy, -.22 + index * .22)
        if boss:
            for at in ([0,2.75] if not bridge else [0]):
                add("09_low_drums", "low_drum", bar, at, 41, .30, (.080 if at == 0 else .055) * energy, -.12 if at == 0 else .12)
            if bar % 8 == 7:
                for at in (3,3.5):
                    add("09_low_drums", "low_drum", bar, at, 43, .20, .052, .1)

    return {"title":"巨钳前的勇气" if boss else "守住潮汐小径", "english_title":"Courage at the Tidal Gate" if boss else "Keep the Tidepath",
            "status":"original composition; technical validation and listening acceptance recorded separately",
            "id":which,"bpm":bpm,"time_signature":"4/4","key":"E minor / G major relief" if boss else "G major / E minor bridge",
            "bars":len(progression),"duration_seconds":len(progression)*4*beat_seconds,
            "seed":SEED+int(boss),"progression":progression,
            "sections":[{"start_bar":s*8,"end_bar":s*8+8,"description":label} for s,label in enumerate(
                ["A: cautious resolve","A2: rising pressure","B: warm breathing space","A3: renewed resolve","C: shared island theme and dominant turnaround"] if boss else
                ["A: island theme in motion","A2: upper answer","B: lighter air bridge","A3: return and dominant turnaround"])],
            "events":events}


def write_midi(score: dict, path: Path) -> None:
    ticks, end_tick = 480, score["bars"] * 4 * 480
    def vlq(value: int) -> bytes:
        result = [value & 127]
        while value >> 7:
            value >>= 7; result.insert(0,(value & 127)|128)
        return bytes(result)
    def chunk(messages: list) -> bytes:
        body, last = bytearray(), 0
        for tick, payload in sorted(messages,key=lambda item:(item[0],item[1][0]&0xF0 != 0x80)):
            body += vlq(tick-last)+payload; last=tick
        body += vlq(end_tick-last)+b"\xff\x2f\x00"
        return b"MTrk"+struct.pack(">I",len(body))+body
    tempo = round(60_000_000/score["bpm"])
    tracks = [chunk([(0,b"\xff\x51\x03"+tempo.to_bytes(3,"big")),(0,b"\xff\x58\x04\x04\x02\x18\x08"),(0,b"\xff\x59\x02\x01"+bytes([int(score["id"]=="boss")]))])]
    programs = {"wood":12,"pluck":24,"bass":32,"breath":73,"bells":10,"reed":70}
    for index,name in enumerate(sorted({event["track"] for event in score["events"]})):
        members=sorted([event for event in score["events"] if event["track"]==name],key=lambda event:event["beat"])
        channel=9 if all(event["instrument"] in PERCUSSION for event in members) else index
        label=name.encode("utf8"); messages=[(0,b"\xff\x03"+vlq(len(label))+label)]
        if channel != 9:
            messages.append((0,bytes([0xC0|channel,programs[members[0]["instrument"]]])))
        current_program=members[0]["instrument"]
        for event in members:
            start=max(0,round(event["beat"]*ticks)); end=min(end_tick,start+max(1,round(event["duration"]*score["bpm"]/60*ticks)))
            if channel!=9 and event["instrument"]!=current_program:
                messages.append((start,bytes([0xC0|channel,programs[event["instrument"]]])))
                current_program=event["instrument"]
            velocity=min(116,max(22,round(45+event["gain"]*260)))
            messages.extend([(start,bytes([0x90|channel,event["midi"],velocity])),(end,bytes([0x80|channel,event["midi"],0]))])
        tracks.append(chunk(messages))
    path.write_bytes(b"MThd"+struct.pack(">IHHH",6,1,len(tracks),ticks)+b"".join(tracks))


def render_music(score: dict) -> dict:
    which=score["id"]; frames=round(score["duration_seconds"]*SR)
    names=sorted({event["track"] for event in score["events"]})
    stems={name:np.zeros((frames,2),dtype=np.float32) for name in names}
    for index,event in enumerate(score["events"]):
        sample=instrument(event["instrument"],event["midi"],event["duration"],event["seed"])
        audio.add_wrap(stems[event["track"]],sample,event["time"],event["gain"],event["pan"])
        if index%300==0:
            print(f"{which}: rendered {index}/{len(score['events'])}",flush=True)
    mix=np.zeros((frames,2),dtype=np.float32)
    for index,(name,stem) in enumerate(stems.items()):
        wet=.12 if any(part in name for part in ("bass","percussion","drums")) else .46 if "air" in name else .29
        stem=audio.room_periodic(stem,wet,score["seed"]+index)
        stem-=stem.mean(axis=0); stems[name]=stem; mix+=stem
    measured=audio.loudness(mix); target=-19 if which=="battle" else -18.5
    gain=min(10**((target-measured)/20),10**(-3/20)/max(audio.true_peak(mix),1e-9))
    mix=(mix*gain).astype(np.float32)
    for name,stem in stems.items():
        audio.write_wav(EXPORT/f"{which}_stems"/f"{name}.wav",stem*gain,pcm24=True)
    audio.write_wav(EXPORT/f"bgm_{which}_master.wav",mix,pcm24=True)
    audio.write_wav(EXPORT/f"{which}_loop_join_preview.wav",np.concatenate((mix[-4*SR:],mix[:4*SR])) )
    path=OUT/f"bgm_{which}.ogg"
    with sf.SoundFile(path,mode="w",samplerate=SR,channels=2,format="OGG",subtype="VORBIS") as encoder:
        for start in range(0,len(mix),16384):
            encoder.write(mix[start:start+16384])
    decoded,rate=sf.read(path,dtype="float32",always_2d=True)
    result={"master":audio.analyze(mix,True),"runtime":audio.analyze(decoded,True),"master_gain":gain,"target_lufs":target,
            "bytes":path.stat().st_size,"decoded_rate":rate,"round_trip_frames_equal":len(decoded)==frames,"stem_count":len(stems),"score_events":len(score["events"])}
    for record in (result["master"],result["runtime"]):
        record["loop_method"]=f"circular event tails and room convolution; exact {score['bars']*4}-beat loop"
    return result


def create_effects_score() -> dict:
    effects={}
    def add(name: str, duration: float, peak: float, layers: list, use: str) -> None:
        effects[name]={"duration":duration,"peak_dbfs":peak,"layers":layers,"use":use}
    def layer(kind: str, pitch="D4", at=0, duration=.15, gain=.18, pan=0, seed=1, **params) -> dict:
        return {"instrument":kind,"midi":audio.note_number(pitch),"at":at,"duration":duration,"gain":gain,"pan":pan,"seed":SEED+seed,**params}
    add("sfx_attack_melee",.26,-16,[layer("impact",duration=.15,gain=.27,seed=10),layer("sweep",at=.012,duration=.16,gain=.14,seed=11)],"Stone/enemy melee; throttle 90 ms")
    add("sfx_attack_projectile",.30,-17,[layer("sweep",duration=.20,gain=.27,seed=12),layer("pluck","D5",duration=.06,gain=.052,seed=13)],"Spike ranged attack; throttle 90 ms")
    add("sfx_attack_magic",.38,-17,[layer("bubble",duration=.22,gain=.17,seed=14,frequency=590),layer("wood","B4",duration=.07,gain=.10,seed=15)],"Crystal magic attack; throttle 100 ms")
    add("sfx_hit_soft",.20,-19,[layer("impact",duration=.16,gain=.25,seed=16,frequency=175)],"Incoming damage only; throttle global 110 ms")
    add("sfx_heal",.42,-19,[layer("wood","G5",duration=.07,gain=.09,seed=17),layer("wood","B5",at=.055,duration=.07,gain=.054,seed=18)],"Effective normal heal; throttle 180 ms, skip passive tiny heal")
    add("sfx_core_hit",.65,-13,[layer("low_drum",duration=.3,gain=.21,seed=19),layer("impact",at=.13,duration=.22,gain=.13,seed=20,frequency=145),layer("wood","D4",at=.08,duration=.1,gain=.055,seed=21)],"Enemy leak; once per leak event, throttle 160 ms")
    add("sfx_skill_stone",1.0,-12,[layer("low_drum",gain=.23,seed=30),layer("impact",at=.045,duration=.26,gain=.14,seed=31,frequency=210),layer("wood","D4",at=.08,duration=.35,gain=.09,seed=32),layer("bells","A4",at=.17,duration=.24,gain=.036,seed=33)],"hold: firm soft shell thump and shield resonance")
    add("sfx_skill_spike",.72,-12,[layer("sweep",duration=.29,gain=.23,seed=40),layer("sweep",at=.08,duration=.20,gain=.18,seed=41),layer("impact",at=.19,duration=.22,gain=.15,seed=42),layer("pluck","D5",at=.18,duration=.12,gain=.07,seed=43)],"piercingShot: focused air pass and warm impact")
    add("sfx_skill_crystal",1.12,-12,[layer("sweep",duration=.34,gain=.14,seed=50),layer("bells","E5",at=.08,duration=.25,gain=.07,pan=-.14,seed=51),layer("bells","B5",at=.18,duration=.30,gain=.047,pan=.14,seed=52),layer("bubble",at=.28,duration=.32,gain=.16,seed=53,frequency=370)],"crystalCannon: soft crystal charge and rounded pulse")
    add("sfx_skill_leaf",1.34,-13,[layer("breath","G4",duration=.55,gain=.07,pan=-.15,seed=60),layer("breath","D5",at=.08,duration=.53,gain=.05,pan=.15,seed=61),layer("wood","G5",at=.10,duration=.18,gain=.053,seed=62),layer("wood","B5",at=.23,duration=.18,gain=.036,seed=63)],"greatHeal / cleanse: breath bloom, distinct from collect chime")
    add("sfx_skill_bubble",1.08,-13,[layer("bubble",duration=.32,gain=.14,pan=-.25,seed=70,frequency=430),layer("bubble",at=.13,duration=.38,gain=.13,pan=.25,seed=71,frequency=580),layer("bubble",at=.26,duration=.44,gain=.10,seed=72,frequency=320),layer("breath","D4",at=.20,duration=.30,gain=.025,seed=73)],"bubbleRing: several rounded bubbles closing a ring")
    add("sfx_defeat",2.45,-14,[layer("wood","B4",duration=.17,gain=.12,seed=80),layer("wood","G4",at=.22,duration=.17,gain=.11,seed=81),layer("wood","E4",at=.47,duration=.24,gain=.10,seed=82),layer("wood","D4",at=.81,duration=.45,gain=.065,seed=83),layer("pluck","G3",at=.85,duration=.7,gain=.062,pan=-.15,seed=84),layer("pluck","B3",at=.87,duration=.7,gain=.052,pan=.15,seed=85),layer("breath","E4",at=.91,duration=.56,gain=.029,seed=86)],"Run failure: gentle descent and hopeful open ending; once per result")
    return {"version":1,"origin":"Original layered synthesis, no recordings or external sounds", "sample_rate":SR,"effects":effects}


def effect_signal(event: dict) -> np.ndarray:
    kind,duration=event["instrument"],event["duration"]
    if kind not in {"impact","sweep","bubble"}:
        return instrument(kind,event["midi"],duration,event["seed"])
    t=np.arange(round(duration*SR))/SR; rng=np.random.default_rng(event["seed"])
    if kind=="bubble":
        frequency=event.get("frequency",450)
        phase=np.cumsum(frequency+frequency*1.7*np.exp(-t/.025))/SR
        y=np.sin(2*np.pi*phase)*np.exp(-t/.075)*(1-np.exp(-t/.002))
    elif kind=="impact":
        frequency=event.get("frequency",245)
        noise=np.convolve(rng.normal(0,1,len(t)),np.ones(17)/17,mode="same")
        y=(np.sin(2*np.pi*frequency*t)+.27*np.sin(2*np.pi*frequency*1.71*t)+.3*noise)*np.exp(-t/.035)*(1-np.exp(-t/.002))
    else:
        noise=rng.normal(0,1,len(t))
        # Two low-pass bands keep the air pass below sharp hiss frequencies.
        noise=np.convolve(noise,np.ones(13)/13,mode="same")-np.convolve(noise,np.ones(89)/89,mode="same")
        y=noise*np.sin(np.minimum(1,t/duration)*np.pi)**1.6*(.75+.25*t/duration)
    return y.astype(np.float32)


def render_effects(score: dict) -> dict:
    report={}
    for name,spec in score["effects"].items():
        mix=np.zeros((round(spec["duration"]*SR),2),dtype=np.float32)
        for event in spec["layers"]:
            sample=effect_signal(event); start=round(event["at"]*SR); count=min(len(sample),len(mix)-start)
            if count<=0:
                continue
            weights=np.array([math.cos((event["pan"]+1)*np.pi/4),math.sin((event["pan"]+1)*np.pi/4)])
            mix[start:start+count]+=sample[:count,None]*event["gain"]*weights
        # A small room reflection, not circular: SFX must finish silently.
        delay=round(.041*SR); mix[delay:]+=mix[:-delay,::-1].copy()*.12
        edge=min(round(.065*SR),len(mix)//6)
        mix[-edge:]*=np.linspace(1,0,edge)[:,None]**2
        attack=round(.002*SR); mix[:attack]*=np.linspace(0,1,attack)[:,None]
        mix-=mix.mean(axis=0)*np.sin(np.linspace(0,np.pi,len(mix)))[:,None]
        mix*=10**(spec["peak_dbfs"]/20)/max(float(np.max(np.abs(mix))),1e-9)
        audio.write_wav(EXPORT/"battle_sfx_masters"/f"{name}_master.wav",mix,pcm24=True)
        audio.write_wav(OUT/f"{name}.wav",mix)
        decoded,_=sf.read(OUT/f"{name}.wav",dtype="float32",always_2d=True)
        report[name]=audio.analyze(decoded,False)
    return report


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--track",choices=["all","battle","boss","effects"],default="all")
    parser.add_argument("--score",type=Path,help="Edited score JSON for selected battle or boss track")
    parser.add_argument("--effects-score",type=Path,help="Edited layered effect score JSON")
    args=parser.parse_args()
    if args.score and args.track not in {"battle","boss"}:
        parser.error("--score requires --track battle or --track boss")
    OUT.mkdir(parents=True,exist_ok=True); EXPORT.mkdir(parents=True,exist_ok=True)
    report_path=EXPORT/"battle_audio_analysis.json"
    report=json.loads(report_path.read_text(encoding="utf8")) if report_path.exists() else {"origin":"Original project composition and synthesis; no imported audio", "music":{},"effects":{}}
    for which in ("battle","boss"):
        if args.track not in {"all",which}:
            continue
        score=json.loads(args.score.read_text(encoding="utf8")) if args.score else create_score(which)
        assert score["id"]==which
        (SOURCE/f"{which}_score.json").write_text(json.dumps(score,ensure_ascii=False,indent=2),encoding="utf8")
        write_midi(score,SOURCE/f"{which}_score.mid")
        report["music"][which]=render_music(score)
        report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    if args.track in {"all","effects"}:
        score=json.loads(args.effects_score.read_text(encoding="utf8")) if args.effects_score else create_effects_score()
        (SOURCE/"battle_effects.json").write_text(json.dumps(score,ensure_ascii=False,indent=2),encoding="utf8")
        report["effects"]=render_effects(score)
    names=[f"bgm_{which}.ogg" for which in report["music"]]+[f"{name}.wav" for name in report["effects"]]
    report["asset_sha256"]={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in names}
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)


if __name__=="__main__":
    main()
