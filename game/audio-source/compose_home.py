"""Original, reproducible Go Away Turtle audio sample.

All notes, synthesis, rhythms and effects are authored for this project. No
sampled recordings, SoundFonts, existing melodies, or generative audio service
are used. This script and the MIDI/JSON exports remain editable source assets.
Run from any directory; dependencies live in tmp/tools/audio/python-libs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import wave

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tmp/tools/audio/python-libs"))
import numpy as np

SR = 44100
BPM = 96
BEAT = 60.0 / BPM
BARS = 32
DURATION = BARS * 4 * BEAT
N = round(DURATION * SR)
SOURCE = Path(__file__).resolve().parent
OUT = ROOT / "game/assets/resources/audio"
EXPORT = SOURCE / "exports"
SEED = 20260908

NOTE_NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_number(name: str | int) -> int:
    if isinstance(name, int):
        return name
    accidental = (1 if "#" in name else -1 if "b" in name else 0)
    return (int(name[-1]) + 1) * 12 + NOTE_NAMES[name[0]] + accidental


def hz(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def smooth_gate(t: np.ndarray, held: float, release: float, attack: float) -> np.ndarray:
    envelope = np.minimum(t / max(attack, 1 / SR), 1.0)
    envelope = np.sin(envelope * np.pi / 2) ** 2
    tail = np.maximum((t - held) / release, 0)
    return envelope * np.exp(-5.5 * tail)


def tone(kind: str, pitch: int, duration: float, seed: int) -> np.ndarray:
    """Modal percussion, dispersive string modes, breath and body resonances."""
    rng = np.random.default_rng(seed)
    freq = hz(pitch)
    tail = {"wood": 1.35, "pluck": 0.65, "bass": 0.30,
            "breath": 0.50, "bells": 2.20}.get(kind, 0.50)
    t = np.arange(round((duration + tail) * SR), dtype=np.float64) / SR
    y = np.zeros(t.shape, dtype=np.float64)
    if kind == "wood":
        # Wooden bar modes: soft fundamental, quickly decaying nonharmonic strike.
        ratios = (1.0, 4.01, 9.94, 15.96)
        amplitudes = (1.0, 0.24, 0.075, 0.019)
        decays = (0.66, 0.15, 0.065, 0.035)
        for ratio, amplitude, decay in zip(ratios, amplitudes, decays):
            if freq * ratio < SR * 0.43:
                y += amplitude * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay)
        y *= smooth_gate(t, duration, 0.35, 0.004)
        # Very soft damped wooden contact, not a hard electronic transient.
        strike = rng.normal(0, 1, len(t))
        strike = np.convolve(strike, np.ones(11) / 11, mode="same")
        y += 0.055 * strike * np.exp(-t / 0.009) * (1 - np.exp(-t / 0.001))
    elif kind == "pluck":
        # Nylon-like harmonic string with pluck-position spectral nulls.
        for harmonic in range(1, 23):
            f = freq * harmonic * np.sqrt(1 + 0.000018 * harmonic ** 2)
            if f >= SR * 0.43:
                break
            amplitude = math.sin(harmonic * math.pi * 0.22) / harmonic ** 1.38
            decay = 0.75 / harmonic ** 0.43
            y += amplitude * np.sin(2 * np.pi * f * t) * np.exp(-t / decay)
        # Low-level soundboard modes add a wooden body to individual strings.
        for body_freq, body_amp in ((196, 0.038), (340, 0.024), (510, 0.013)):
            y += body_amp * np.sin(2 * np.pi * body_freq * t) * np.exp(-t / 0.065)
        y *= smooth_gate(t, duration, 0.22, 0.006)
    elif kind == "bass":
        for harmonic, amplitude in ((1, 1.0), (2, 0.32), (3, 0.14), (4, 0.04)):
            y += amplitude * np.sin(2 * np.pi * freq * harmonic * t) * np.exp(-t / (1.15 / harmonic ** .3))
        y *= smooth_gate(t, duration, 0.20, 0.015)
    elif kind == "breath":
        # Quiet flute/air layer. Delayed vibrato avoids a constant synth wobble.
        vibrato_depth = np.minimum(t / 0.65, 1) * 0.0017
        phase = np.cumsum(freq * (1 + vibrato_depth * np.sin(2 * np.pi * 4.4 * t))) / SR
        for harmonic, amplitude in ((1, 1), (2, .10), (3, .07), (4, .012)):
            y += amplitude * np.sin(2 * np.pi * phase * harmonic)
        noise = np.convolve(rng.normal(0, 1, len(t)), np.ones(15) / 15, mode="same")
        y += .045 * noise
        y *= smooth_gate(t, duration, .46, .13) * (.91 + .035 * np.sin(2 * np.pi * .77 * t))
    elif kind == "bells":
        for ratio, amplitude, decay in ((1, 1, .95), (2.01, .22, .56), (3.97, .12, .34), (6.05, .035, .15)):
            if freq * ratio < SR * .43:
                y += amplitude * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / decay)
        y *= smooth_gate(t, duration, .85, .008)
    else:
        raise ValueError(kind)
    return y.astype(np.float32)


def percussion(kind: str, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    length = {"shaker": .105, "kick": .20, "rim": .11, "bongo": .21, "brush": .22}[kind]
    t = np.arange(round(length * SR)) / SR
    noise = rng.normal(0, 1, len(t))
    if kind == "shaker":
        noise -= np.convolve(noise, np.ones(11) / 11, mode="same")
        y = noise * (1 - np.exp(-t / .004)) * np.exp(-t / .018) * .43
    elif kind == "kick":
        phase = np.cumsum(59 + 54 * np.exp(-t / .011)) / SR
        y = np.sin(2 * np.pi * phase) * np.exp(-t / .060) * (1 - np.exp(-t / .002))
    elif kind == "rim":
        y = (np.sin(2 * np.pi * 785 * t) + .42 * np.sin(2 * np.pi * 1223 * t)) * np.exp(-t / .012)
        y += noise * np.exp(-t / .003) * .16
        y *= (1 - np.exp(-t / .0008))
    elif kind == "bongo":
        y = (np.sin(2 * np.pi * 208 * t + .22 * np.exp(-t / .022)) + .35 * np.sin(2 * np.pi * 353 * t)) * np.exp(-t / .052)
        y *= 1 - np.exp(-t / .002)
    else:
        noise = np.convolve(noise, np.ones(7) / 7, mode="same")
        y = noise * np.sin(np.minimum(t / .06, 1) * np.pi / 2) * np.exp(-t / .058)
    return y.astype(np.float32)


def add_wrap(target: np.ndarray, sample: np.ndarray, at: float, amplitude: float, pan: float) -> None:
    """Wrap event tails into the start, creating an actual periodic arrangement."""
    start = round(at * SR) % len(target)
    weights = (math.cos((pan + 1) * np.pi / 4), math.sin((pan + 1) * np.pi / 4))
    stereo = sample[:, None] * np.array(weights, dtype=np.float32)[None, :] * amplitude
    first = min(len(target) - start, len(stereo))
    target[start:start + first] += stereo[:first]
    offset = first
    while offset < len(stereo):
        count = min(len(stereo) - offset, len(target))
        target[:count] += stereo[offset:offset + count]
        offset += count


def room_periodic(audio: np.ndarray, wet: float, seed: int) -> np.ndarray:
    """Small warm stereo space. Circular convolution also wraps the room tail."""
    rng = np.random.default_rng(seed)
    response_len = round(1.05 * SR)
    tt = np.arange(response_len) / SR
    result = audio.copy()
    for channel in (0, 1):
        impulse = np.zeros(len(audio), dtype=np.float32)
        # Sparse, decorrelated diffusive room response, mostly below 4 kHz.
        diffuse = rng.normal(0, 1, response_len) * np.exp(-tt / .20)
        diffuse *= np.minimum(tt / .025, 1)
        diffuse = np.convolve(diffuse, np.ones(19) / 19, mode="same")
        diffuse /= max(np.sqrt(np.sum(diffuse ** 2)), .0001)
        impulse[:response_len] = diffuse * .28
        for delay, amplitude in ((.031 + channel * .007, .22), (.067 - channel * .005, .16), (.119 + channel * .003, .075)):
            impulse[round(delay * SR)] += amplitude
        # A little opposite-channel source widens the room, not the direct sound.
        source = audio[:, channel] * .8 + audio[:, 1 - channel] * .2
        room = np.fft.irfft(np.fft.rfft(source) * np.fft.rfft(impulse), n=len(audio))
        result[:, channel] += (room * wet).astype(np.float32)
    return result


CHORDS = {
    "G6": {"bass": "G2", "fifth": "D3", "notes": ["G3", "B3", "D4", "E4"]},
    "Em7": {"bass": "E2", "fifth": "B2", "notes": ["G3", "B3", "D4", "E4"]},
    "Cmaj7": {"bass": "C3", "fifth": "G2", "notes": ["G3", "B3", "C4", "E4"]},
    "Dadd9": {"bass": "D3", "fifth": "A2", "notes": ["A3", "D4", "E4", "F#4"]},
    "Am7": {"bass": "A2", "fifth": "E3", "notes": ["G3", "A3", "C4", "E4"]},
    "G/B": {"bass": "B2", "fifth": "D3", "notes": ["G3", "B3", "D4", "G4"]},
    "D7": {"bass": "D3", "fifth": "A2", "notes": ["A3", "C4", "D4", "F#4"]},
    "B7": {"bass": "B2", "fifth": "F#3", "notes": ["A3", "B3", "D#4", "F#4"]},
}

PROGRESSION = [
    "G6", "Em7", "Cmaj7", "Dadd9", "G/B", "Am7", "Cmaj7", "D7",
    "G6", "Em7", "Cmaj7", "Dadd9", "G/B", "Am7", "D7", "G6",
    "Em7", "B7", "Cmaj7", "G/B", "Am7", "Em7", "Cmaj7", "D7",
    "G6", "Em7", "Cmaj7", "Dadd9", "G/B", "Am7", "D7", "D7",
]

# Each tuple is (beat within bar, pitch, note duration in beats).
# Deliberate breathing space is part of the melody, including two answer-only bars.
MELODY = [
    [(0, "B4", .65), (.75, "D5", .4), (1.5, "E5", .7), (2.5, "D5", .4), (3.25, "B4", .55)],
    [(.25, "G4", .7), (1.25, "B4", .4), (2, "D5", .65), (3, "B4", .55)],
    [(0, "E5", .85), (1.25, "G5", .45), (2, "E5", .5), (2.75, "D5", .35), (3.25, "C5", .6)],
    [(.25, "A4", .6), (1, "D5", .6), (2, "F#5", .9)],
    [(0, "D5", .6), (.75, "B4", .4), (1.5, "G4", .75), (2.75, "A4", .4), (3.25, "B4", .5)],
    [(.5, "C5", .65), (1.5, "E5", .65), (2.5, "C5", .4), (3.25, "A4", .5)],
    [(0, "G4", .55), (.75, "C5", .55), (1.75, "B4", .55), (2.75, "A4", .7)],
    [(0, "F#4", .6), (.75, "A4", .4), (1.5, "D5", 1.15), (3.5, "A4", .35)],
    [(0, "B4", .65), (.75, "D5", .4), (1.5, "G5", .7), (2.5, "E5", .4), (3.25, "D5", .55)],
    [(.25, "B4", .65), (1.25, "G4", .5), (2, "E4", 1.3)],
    [(0, "E5", .85), (1.25, "G5", .45), (2, "E5", .5), (2.75, "D5", .35), (3.25, "C5", .6)],
    [(.25, "A4", .6), (1, "D5", .55), (2, "F#5", .45), (2.75, "E5", .45), (3.5, "D5", .4)],
    [(0, "B4", 1.0), (1.5, "D5", .65), (2.5, "G5", .7)],
    [(0, "E5", .7), (1, "C5", .6), (2, "A4", 1.1)],
    [(.25, "A4", .6), (1.25, "C5", .5), (2, "A4", .4), (2.75, "F#4", .6)],
    [(0, "G4", 1.6)],
    [(.25, "B4", 1.15), (1.75, "G4", .65), (2.75, "E4", .65)],
    [(.25, "F#4", .65), (1.25, "A4", .65), (2.25, "D#5", 1.0)],
    [(0, "E5", .75), (1, "D5", .5), (1.75, "C5", .6), (2.75, "G4", .7)],
    [(0, "B4", 1.25), (1.75, "D5", .65), (2.75, "B4", .65)],
    [(.25, "A4", .75), (1.25, "C5", .65), (2.25, "E5", .9)],
    [(0, "G5", .75), (1, "E5", .65), (2, "D5", .55), (2.75, "B4", .7)],
    [(0, "C5", 1.15), (1.5, "E5", .6), (2.5, "D5", .6)],
    [(0, "A4", .65), (1, "F#4", .65), (2.25, "A4", .55), (3.25, "D5", .5)],
    [(0, "B4", .65), (.75, "D5", .4), (1.5, "E5", .7), (2.5, "D5", .4), (3.25, "B4", .55)],
    [(.25, "G4", .7), (1.25, "B4", .4), (2, "D5", .65), (3, "B4", .55)],
    [(0, "E5", .85), (1.25, "G5", .45), (2, "E5", .5), (2.75, "D5", .35), (3.25, "C5", .6)],
    [(.25, "A4", .6), (1, "D5", .6), (2, "F#5", .9)],
    [(0, "D5", .6), (.75, "B4", .4), (1.5, "G4", .75), (2.75, "A4", .4), (3.25, "B4", .5)],
    [(.5, "C5", .65), (1.5, "E5", .65), (2.5, "C5", .4), (3.25, "A4", .5)],
    [(0, "F#4", .65), (1, "A4", .55), (2, "C5", .6), (3, "D5", .65)],
    [(0, "A4", .9), (1.5, "F#4", .7), (3, "A4", .45), (3.5, "D5", .35)],
]


def create_score() -> dict:
    rng = np.random.default_rng(SEED)
    events: list[dict] = []

    def event(track: str, instrument: str, bar: int, beat: float, pitch: str | int,
              beats: float, velocity: float, pan: float) -> None:
        jitter = float(rng.uniform(-.008, .008))
        # Melody phrasing, quiet downbeats for backing, no random tempo drift.
        events.append({"track": track, "instrument": instrument,
                       "time": round((bar * 4 + beat) * BEAT + jitter, 6),
                       "beat": bar * 4 + beat, "midi": note_number(pitch),
                       "duration": round(beats * BEAT, 6),
                       "gain": round(velocity * float(rng.uniform(.91, 1.06)), 6),
                       "pan": pan, "seed": SEED + len(events) * 17})

    for bar, chord_name in enumerate(PROGRESSION):
        chord = CHORDS[chord_name]
        section = bar // 8
        for beat, pitch, beats in MELODY[bar]:
            event("01_wood_melody", "wood", bar, beat, pitch, beats,
                  .145 if section != 2 else .092, -.09)
            if section == 2:
                event("05_air_response", "breath", bar, beat + .035, pitch, beats,
                      .082, .13)
        # Offbeat strums. Upstrokes reverse string order and have a lighter touch.
        pattern = [(0, .043), (1.5, .039), (2.5, .037), (3.5, .026)]
        if section == 2:
            pattern = [(0, .035), (2.0, .030)]
        for strike, amount in pattern:
            notes = chord["notes"] if strike in (0, 2) else list(reversed(chord["notes"]))
            for index, pitch in enumerate(notes):
                event("02_nylon_chords", "pluck", bar, strike + index * .018, pitch,
                      .64, amount, -.32 + index * .018)
        # Quieter high string answering line at the end of a phrase.
        if bar % 4 in (1, 3):
            for beat, index in [(2.5, 1), (3.0, 2), (3.5, 3)]:
                event("03_string_answers", "pluck", bar, beat, note_number(chord["notes"][index]) + 12,
                      .42, .032, .37)
        for beat, pitch, length, level in [(0, chord["bass"], 1.3, .13), (2, chord["fifth"], .9, .10),
                                          (3.5, chord["bass"], .34, .073)]:
            event("04_round_bass", "bass", bar, beat, pitch, length, level, 0)
        if bar in (3, 7, 11, 15, 23, 27, 31):
            for beat, pitch in [(2.75, "D6"), (3.5, "A5")]:
                event("06_shell_sparkles", "bells", bar, beat, pitch, .32, .023, .46)
        # Half-open brush texture and alternating side shaker, no heavy club beat.
        for half in range(8):
            if section == 2 and half % 2 == 1:
                continue
            event("07_soft_percussion", "shaker", bar, half * .5 + (.035 if half % 2 else 0), 42,
                  .10, .017 if half % 2 else .023, -.44 if half % 2 else .34)
        event("07_soft_percussion", "kick", bar, 0, 36, .12, .081 if section != 2 else .056, 0)
        event("07_soft_percussion", "kick", bar, 2.0, 36, .12, .064, 0)
        for beat in (1, 3):
            event("07_soft_percussion", "rim", bar, beat + .02, 37, .1, .024, .22)
        if bar % 4 == 3:
            event("07_soft_percussion", "bongo", bar, 3.25, 60, .12, .037, -.21)
            event("07_soft_percussion", "bongo", bar, 3.75, 64, .12, .027, .25)

    return {"title": "贝壳湾的早晨", "english_title": "Morning at Shell Bay",
            "status": "original home-screen audio sample awaiting listening approval",
            "bpm": BPM, "time_signature": "4/4", "key": "G major / E minor bridge",
            "bars": BARS, "duration_seconds": DURATION, "seed": SEED,
            "sections": ["A: 0-20 s", "A variation: 20-40 s", "B: 40-60 s", "A return: 60-80 s"],
            "progression": PROGRESSION, "events": events}


def write_midi(score: dict, path: Path) -> None:
    """Write a format-1 standard MIDI without depending on a DAW or sound bank."""
    ticks = 480

    def vlq(value: int) -> bytes:
        values = [value & 127]
        value >>= 7
        while value:
            values.insert(0, (value & 127) | 128)
            value >>= 7
        return bytes(values)

    def track_bytes(messages: list[tuple[int, bytes]]) -> bytes:
        content = bytearray()
        last = 0
        for tick, data in sorted(messages, key=lambda item: item[0]):
            content += vlq(tick - last) + data
            last = tick
        content += vlq(max(0, BARS * 4 * ticks - last)) + b"\xff\x2f\x00"
        return b"MTrk" + struct.pack(">I", len(content)) + content

    tempo = round(60_000_000 / BPM)
    conductor = [(0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
                 (0, b"\xff\x58\x04\x04\x02\x18\x08"),
                 (0, b"\xff\x59\x02\x01\x00")]
    tracks = [track_bytes(conductor)]
    programs = {"wood": 12, "pluck": 24, "bass": 32, "breath": 73, "bells": 10}
    for index, name in enumerate(sorted({e["track"] for e in score["events"]})):
        members = [e for e in score["events"] if e["track"] == name]
        channel = 9 if "percussion" in name else index
        label = name.encode("utf-8")
        messages = [(0, b"\xff\x03" + vlq(len(label)) + label)]
        if channel != 9:
            messages.append((0, bytes([0xC0 | channel, programs[members[0]["instrument"]]])))
        for e in members:
            start = max(0, round(e["beat"] * ticks))
            end = min(BARS * 4 * ticks, start + max(1, round(e["duration"] / BEAT * ticks)))
            velocity = min(116, max(28, round(58 + 140 * e["gain"])))
            messages.append((start, bytes([0x90 | channel, e["midi"], velocity])))
            messages.append((end, bytes([0x80 | channel, e["midi"], 0])))
        tracks.append(track_bytes(messages))
    path.write_bytes(b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), ticks) + b"".join(tracks))


def write_wav(path: Path, samples: np.ndarray, pcm24: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        import soundfile as sf
        sf.write(path, samples, SR, subtype="PCM_24" if pcm24 else "PCM_16")
    except ImportError:
        # 16-bit fallback still provides usable samples if the encoder is unavailable.
        with wave.open(str(path), "wb") as w:
            w.setnchannels(samples.shape[1] if samples.ndim == 2 else 1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())


def true_peak(audio: np.ndarray) -> float:
    try:
        from scipy.signal import resample_poly
        return float(np.max(np.abs(resample_poly(audio, 4, 1, axis=0))))
    except ImportError:
        return float(np.max(np.abs(audio)))


def loudness(audio: np.ndarray) -> float | None:
    if len(audio) < round(.4 * SR):
        return None
    try:
        import pyloudnorm as pyln
        return float(pyln.Meter(SR).integrated_loudness(audio))
    except ImportError:
        return None


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def analyze(audio: np.ndarray, loop: bool) -> dict:
    rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))
    peak = float(np.max(np.abs(audio)))
    result = {"sample_rate": SR, "channels": audio.shape[1],
              "frames": len(audio), "duration_seconds": len(audio) / SR,
              "sample_peak_dbfs": round(db(peak), 3),
              "true_peak_4x_dbtp": round(db(true_peak(audio)), 3),
              "rms_dbfs": round(db(rms), 3),
              "integrated_lufs": loudness(audio),
              "crest_factor_db": round(db(peak / rms), 3),
              "dc_offset": [float(x) for x in audio.mean(axis=0)],
              "clipped_samples": int(np.count_nonzero(np.abs(audio) >= 1.0)),
              "finite": bool(np.isfinite(audio).all()),
              "listening_review": "not yet completed; numerical checks are not an auditory approval"}
    if loop:
        boundary = audio[0] - audio[-1]
        local = np.concatenate((audio[-round(.025 * SR):], audio[:round(.025 * SR)]))
        local_delta_rms = float(np.sqrt(np.mean(np.diff(local, axis=0) ** 2)))
        result["loop_boundary_delta_dbfs"] = round(db(float(np.max(np.abs(boundary)))), 3)
        result["boundary_to_local_derivative_ratio"] = round(float(np.max(np.abs(boundary))) / max(local_delta_rms, 1e-9), 3)
        result["loop_method"] = "circular event tails and circular room convolution; exact 128-beat PCM loop"
    return result


def normalize_music(audio: np.ndarray) -> tuple[np.ndarray, float]:
    # Loudness gain with true-peak headroom; no flattened transients or limiter.
    audio -= audio.mean(axis=0)
    measured = loudness(audio)
    gain = 10 ** ((-19.0 - measured) / 20) if measured is not None else .10 / np.sqrt(np.mean(audio ** 2))
    gain = min(gain, 10 ** (-2.0 / 20) / max(true_peak(audio), 1e-9))
    return (audio * gain).astype(np.float32), gain


def encode_and_analyze(mix: np.ndarray, gain: float | None) -> dict:
    encodings = {}
    try:
        import soundfile as sf
        # libsndfile Vorbis is fed bounded blocks rather than one giant buffer.
        with sf.SoundFile(OUT / "bgm_home.ogg", mode="w", samplerate=SR, channels=2,
                          format="OGG", subtype="VORBIS") as encoder:
            for start in range(0, len(mix), 16384):
                encoder.write(mix[start:start + 16384])
        decoded, rate = sf.read(OUT / "bgm_home.ogg", dtype="float32", always_2d=True)
        encodings["ogg"] = {**analyze(decoded, True), "bytes": (OUT / "bgm_home.ogg").stat().st_size,
                            "round_trip_frames_equal": len(decoded) == N, "decoded_rate": rate}
    except ImportError:
        encodings["ogg"] = {"status": "encoder dependency missing; not delivered"}
    seam = np.concatenate((mix[-4 * SR:], mix[:4 * SR]))
    write_wav(EXPORT / "home_loop_join_preview.wav", seam)
    return {"home": analyze(mix, True), "master_gain": gain, "encodings": encodings}


def render_home(score: dict) -> dict:
    stems = {name: np.zeros((N, 2), dtype=np.float32) for name in sorted({e["track"] for e in score["events"]})}
    for i, e in enumerate(score["events"]):
        if e["instrument"] in {"shaker", "kick", "rim", "bongo", "brush"}:
            sample = percussion(e["instrument"], e["seed"])
        else:
            sample = tone(e["instrument"], e["midi"], e["duration"], e["seed"])
        add_wrap(stems[e["track"]], sample, e["time"], e["gain"], e["pan"])
        if i % 250 == 0:
            print(f"rendered {i}/{len(score['events'])} events", flush=True)
    mix = np.zeros((N, 2), dtype=np.float32)
    for i, (name, stem) in enumerate(stems.items()):
        wet = .66 if "air" in name else .43 if "wood" in name else .34
        if "bass" in name or "percussion" in name:
            wet = .12
        stem = room_periodic(stem, wet, SEED + i)
        stem -= stem.mean(axis=0)
        stems[name] = stem
        mix += stem
    mix, gain = normalize_music(mix)
    EXPORT.mkdir(parents=True, exist_ok=True)
    for name, stem in stems.items():
        write_wav(EXPORT / "home_stems" / f"{name}.wav", stem * gain, pcm24=True)
    write_wav(EXPORT / "bgm_home_master.wav", mix, pcm24=True)
    write_wav(EXPORT / "bgm_home_pcm16.wav", mix)
    return encode_and_analyze(mix, gain)


def render_effects() -> dict:
    effects: dict[str, np.ndarray] = {}

    def canvas(seconds: float) -> np.ndarray:
        return np.zeros((round(seconds * SR), 2), dtype=np.float32)

    def put(target: np.ndarray, signal: np.ndarray, at: float, gain: float, pan: float = 0) -> None:
        start = round(at * SR)
        count = min(len(signal), len(target) - start)
        if count > 0:
            gains = np.array([math.cos((pan + 1) * np.pi / 4), math.sin((pan + 1) * np.pi / 4)])
            target[start:start + count] += signal[:count, None] * gain * gains

    click = canvas(.25)
    put(click, tone("wood", note_number("D6"), .03, 800), 0, .19)
    put(click, percussion("rim", 801), 0, .045)
    effects["sfx_ui_confirm"] = click

    pop = canvas(.38)
    t = np.arange(round(.24 * SR)) / SR
    # Bubble resonance falls rapidly after its initial tiny pressure release.
    phase = np.cumsum(490 + 1250 * np.exp(-t / .022)) / SR
    bubble = np.sin(2 * np.pi * phase) * np.exp(-t / .055) * (1 - np.exp(-t / .0015))
    put(pop, bubble.astype(np.float32), 0, .27)
    effects["sfx_bubble_pop"] = pop

    rub = canvas(.52)
    rng = np.random.default_rng(904)
    t = np.arange(round(.45 * SR)) / SR
    white = rng.normal(0, 1, len(t))
    noise = np.convolve(white, np.ones(29) / 29, mode="same") - np.convolve(white, np.ones(107) / 107, mode="same")
    envelope = np.sin(np.pi * np.minimum(t / .45, 1)) ** 1.8
    signal = noise * envelope * (.70 + .18 * np.sin(2 * np.pi * 17 * t))
    put(rub, signal.astype(np.float32), 0, .41)
    effects["sfx_bubble_rub"] = rub

    collect = canvas(1.75)
    for index, pitch in enumerate(("G4", "B4", "D5", "G5")):
        put(collect, tone("bells", note_number(pitch), .35, 920 + index), index * .10, .102, -.18 + index * .12)
    put(collect, tone("pluck", note_number("G3"), .60, 921), 0, .09)
    effects["sfx_collect"] = collect

    rare = canvas(3.0)
    for index, pitch in enumerate(("G4", "D5", "B5", "D6", "G6")):
        put(rare, tone("bells", note_number(pitch), .50, 930 + index), index * .14, .073, -.35 + index * .17)
    for index, pitch in enumerate(("G3", "B3", "D4", "E4")):
        put(rare, tone("breath", note_number(pitch), .8, 940 + index), .26, .053, -.20 + index * .13)
    effects["sfx_rare_reveal"] = rare

    victory = canvas(2.6)
    for index, (pitch, at, held) in enumerate((("G4", 0, .12), ("B4", .18, .12), ("D5", .36, .21), ("G5", .66, .58))):
        put(victory, tone("wood", note_number(pitch), held, 970 + index), at, .14)
    for index, pitch in enumerate(("G3", "B3", "D4")):
        put(victory, tone("pluck", note_number(pitch), .8, 980 + index), .68 + index * .015, .10, -.20 + index * .20)
    effects["sfx_victory"] = victory

    report = {}
    for name, effect in effects.items():
        # Short assets explicitly fade to silence; never truncate a modal tail.
        edge = min(round(.065 * SR), len(effect) // 8)
        effect[-edge:] *= np.linspace(1, 0, edge)[:, None] ** 2
        peak = float(np.max(np.abs(effect)))
        if peak > .75:
            effect *= .75 / peak
        write_wav(OUT / f"{name}.wav", effect)
        report[name] = analyze(effect, False)
        # A 250 ms effect cannot support the standard 400 ms LUFS measurement.
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--score", type=Path, help="Optional edited exported score JSON to render")
    parser.add_argument("--effects-only", action="store_true")
    parser.add_argument("--reuse-master", action="store_true", help="Re-encode/analyze the existing 24-bit master")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    EXPORT.mkdir(parents=True, exist_ok=True)
    report = {"origin": "Original project-specific composition and procedural instruments; no imported audio", "seed": SEED}
    if args.reuse_master:
        import soundfile as sf
        mix, rate = sf.read(EXPORT / "bgm_home_master.wav", dtype="float32", always_2d=True)
        assert rate == SR and len(mix) == N
        report.update(encode_and_analyze(mix, None))
    elif not args.effects_only:
        score = json.loads(args.score.read_text(encoding="utf-8")) if args.score else create_score()
        (SOURCE / "home_score.json").write_text(json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8")
        write_midi(score, SOURCE / "home_score.mid")
        report.update(render_home(score))
    report["effects"] = render_effects()
    report["asset_sha256"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob("*")) if p.suffix in {".wav", ".ogg"}}
    (EXPORT / "audio_analysis.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
