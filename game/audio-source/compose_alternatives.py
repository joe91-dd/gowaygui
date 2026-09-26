"""Generate editable, original music candidates for Go Away Turtle.

The candidates use only deterministic synthesis (no samples, SoundFonts or
remote services). They are review assets: they stay under audio-source until
one version is approved for runtime integration.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44_100
ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUT = SOURCE / "exports" / "alternatives"
OUT.mkdir(parents=True, exist_ok=True)

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(note: str | int) -> int:
    if isinstance(note, int):
        return note
    accidental = 1 if "#" in note else -1 if "b" in note else 0
    return (int(note[-1]) + 1) * 12 + NAMES[note[0]] + accidental


def hz(note: str | int) -> float:
    return 440.0 * 2 ** ((midi(note) - 69) / 12)


def envelope(length: int, attack: float, release: float) -> np.ndarray:
    a = max(1, round(attack * SR))
    r = max(1, round(release * SR))
    e = np.ones(length, dtype=np.float32)
    e[: min(a, length)] = np.sin(np.linspace(0, math.pi / 2, min(a, length))) ** 2
    e[max(0, length - r) :] *= np.sin(np.linspace(math.pi / 2, 0, min(r, length))) ** 2
    return e


def tone(note: str | int, seconds: float, kind: str = "pad", seed: int = 1) -> np.ndarray:
    n = max(1, round(seconds * SR))
    t = np.arange(n, dtype=np.float64) / SR
    f = hz(note)
    rng = np.random.default_rng(seed)
    if kind == "pad":
        vibrato = 1 + 0.002 * np.sin(2 * np.pi * 4.1 * t)
        phase = 2 * np.pi * np.cumsum(f * vibrato) / SR
        y = sum(a * np.sin(phase * h) for h, a in ((1, .80), (2, .16), (3, .055)))
        y *= envelope(n, .18, .45) * .34
    elif kind == "pluck":
        y = sum(np.sin(2 * np.pi * f * h * t) * (1 / h**1.4) for h in range(1, 12) if f * h < SR * .43)
        y *= envelope(n, .006, min(.40, seconds * .6)) * np.exp(-t / max(.15, seconds * .62)) * .52
    elif kind == "reed":
        phase = 2 * np.pi * np.cumsum(f * (1 + .0012 * np.sin(2 * np.pi * 4.8 * t))) / SR
        y = sum(a * np.sin(phase * h) for h, a in ((1, .82), (2, .23), (3, .11), (4, .035)))
        y *= envelope(n, .025, .18) * .30
    elif kind == "bell":
        y = sum(a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / decay)
                for ratio, a, decay in ((1, .8, 1.0), (2.01, .2, .50), (3.9, .08, .27)))
        y *= envelope(n, .004, min(.9, seconds)) * .30
    elif kind == "air":
        noise = np.convolve(rng.normal(0, 1, n), np.ones(19) / 19, mode="same")
        y = .45 * np.sin(2 * np.pi * f * t) + .05 * noise
        y *= envelope(n, .16, .35) * .18
    else:
        raise ValueError(kind)
    return y.astype(np.float32)


def drum(kind: str, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    if kind == "kick":
        n = round(.22 * SR); t = np.arange(n) / SR
        phase = np.cumsum(72 + 48 * np.exp(-t / .025)) / SR
        return (np.sin(2 * np.pi * phase) * np.exp(-t / .075) * (1 - np.exp(-t / .002)) * .72).astype(np.float32)
    if kind == "low":
        n = round(.46 * SR); t = np.arange(n) / SR
        phase = np.cumsum(54 + 26 * np.exp(-t / .035)) / SR
        return (np.sin(2 * np.pi * phase) * np.exp(-t / .15) * .72).astype(np.float32)
    if kind == "snare":
        n = round(.16 * SR); t = np.arange(n) / SR
        noise = rng.normal(0, 1, n)
        noise = noise - np.convolve(noise, np.ones(21) / 21, mode="same")
        return (noise * np.exp(-t / .035) * (1 - np.exp(-t / .003)) * .20).astype(np.float32)
    if kind == "hat":
        n = round(.07 * SR); t = np.arange(n) / SR
        noise = rng.normal(0, 1, n)
        return (noise * np.exp(-t / .012) * .045).astype(np.float32)
    raise ValueError(kind)


def add(dst: np.ndarray, sample: np.ndarray, at: float, gain: float, pan: float = 0.0) -> None:
    start = max(0, round(at * SR))
    if start >= len(dst):
        return
    end = min(len(dst), start + len(sample))
    if end <= start:
        return
    left = math.sqrt((1 - pan) * .5)
    right = math.sqrt((1 + pan) * .5)
    dst[start:end, 0] += sample[: end - start] * gain * left
    dst[start:end, 1] += sample[: end - start] * gain * right


def render(spec: dict) -> dict:
    beat = 60.0 / spec["bpm"]
    bars = spec["bars"]
    seconds = bars * 4 * beat
    audio = np.zeros((round(seconds * SR), 2), dtype=np.float32)
    rng = np.random.default_rng(spec["seed"])
    scale = [0, 2, 4, 7, 9, 11]
    roots = [midi(x) for x in spec["roots"]]
    chords = [[root, root + 4, root + 7, root + 11] for root in roots]
    for bar in range(bars):
        root = roots[bar % len(roots)]
        chord = chords[bar % len(chords)]
        start = bar * 4 * beat
        # A soft bed keeps the game readable under dialogue and combat SFX.
        for i, note in enumerate(chord[:3]):
            add(audio, tone(note, 4 * beat, "pad", spec["seed"] + bar * 11 + i), start, spec["pad_gain"], (-.30, 0, .30)[i])
        for beat_i in range(4):
            bass_kind = "low" if spec["style"] in ("boss", "world") else "kick"
            add(audio, drum(bass_kind, spec["seed"] + bar * 19 + beat_i), start + beat_i * beat, spec["drum_gain"])
            add(audio, tone(root - 12, .66 * beat, "bass" if False else "pluck", spec["seed"] + bar + beat_i), start + beat_i * beat, spec["bass_gain"], -.08)
        if spec["style"] not in ("home", "cue"):
            for half in range(8):
                if spec["style"] == "world" and half % 2:
                    continue
                add(audio, drum("hat", spec["seed"] + bar * 17 + half), start + half * beat / 2, spec["hat_gain"], .25 if half % 2 else -.25)
            if bar % 2:
                add(audio, drum("snare", spec["seed"] + bar), start + 2 * beat, spec["snare_gain"], .12)
        # The lead alternates between a memorable line and breathing answer bars.
        motif = spec["motif"]
        for j, (offset, degree, held) in enumerate(motif):
            note = root + scale[(degree + bar + spec["motif_shift"]) % len(scale)] + 12
            kind = "bell" if spec["style"] in ("home", "cue") else "reed"
            add(audio, tone(note, held * beat, kind, spec["seed"] + bar * 23 + j), start + offset * beat, spec["lead_gain"], -.18 if j % 2 else .18)
        if spec["style"] in ("home", "world") and bar % 2 == 0:
            for i, note in enumerate(chord):
                add(audio, tone(note + 12, .55 * beat, "bell", spec["seed"] + bar * 31 + i), start + (2.5 + i * .08) * beat, spec["spark_gain"], .35 - i * .22)
    # Loop-friendly tails and headroom for mobile playback.
    audio[: round(.04 * SR)] *= np.linspace(0, 1, round(.04 * SR))[:, None]
    audio[-round(.08 * SR) :] *= np.linspace(1, 0, round(.08 * SR))[:, None]
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio * audio)))
    if peak and rms:
        # Bring the quietest candidates up to a comfortable review level while
        # keeping enough true-peak headroom for mobile speakers.
        audio *= min(.14 / rms, .86 / peak)
    wav = OUT / f"{spec['id']}.wav"
    ogg = OUT / f"{spec['id']}.ogg"
    sf.write(wav, audio, SR, subtype="PCM_24")
    # libsndfile's Vorbis encoder must receive bounded blocks on Windows.
    with sf.SoundFile(ogg, mode="w", samplerate=SR, channels=2, format="OGG", subtype="VORBIS") as encoder:
        for start in range(0, len(audio), 16_384):
            encoder.write(audio[start:start + 16_384])
    return {**{k: v for k, v in spec.items() if k not in {"motif"}}, "duration_seconds": round(seconds, 3), "wav": wav.name, "ogg": ogg.name}


MOTIF = [(0, 0, .55), (.75, 2, .35), (1.5, 4, .65), (2.5, 2, .40), (3.25, 0, .45)]
SPECS = [
    dict(id="alt_home_sunlit", title="海岛晨光", purpose="主页/海岛待机", style="home", bpm=92, bars=24, roots=["G2", "E2", "C3", "D3"], motif=MOTIF, motif_shift=0, pad_gain=.20, drum_gain=.40, bass_gain=.10, hat_gain=.0, snare_gain=.0, lead_gain=.17, spark_gain=.045, seed=26091901),
    dict(id="alt_battle_tide", title="潮汐前线", purpose="普通关卡/持续战斗", style="battle", bpm=120, bars=24, roots=["D2", "A2", "B2", "G2"], motif=MOTIF, motif_shift=1, pad_gain=.17, drum_gain=.45, bass_gain=.11, hat_gain=.60, snare_gain=.52, lead_gain=.12, spark_gain=.0, seed=26091902),
    dict(id="alt_boss_abyss", title="深渊来潮", purpose="普通BOSS/高压战斗", style="boss", bpm=84, bars=20, roots=["E2", "C2", "A2", "B2"], motif=[(0, 0, .8), (1.25, 2, .5), (2.5, 4, .85)], motif_shift=2, pad_gain=.24, drum_gain=.70, bass_gain=.16, hat_gain=.36, snare_gain=.55, lead_gain=.11, spark_gain=.0, seed=26091903),
    dict(id="alt_world_boss", title="海神降临", purpose="世界首领/排行榜挑战", style="world", bpm=76, bars=20, roots=["C2", "G2", "A2", "E2"], motif=[(0, 0, .9), (1.5, 3, .55), (2.5, 5, .9)], motif_shift=0, pad_gain=.27, drum_gain=.76, bass_gain=.20, hat_gain=.20, snare_gain=.68, lead_gain=.10, spark_gain=.0, seed=26091904),
    dict(id="alt_endless_drive", title="无尽航线", purpose="无尽模式/加速循环", style="battle", bpm=132, bars=24, roots=["A2", "F#2", "D2", "E2"], motif=[(0, 0, .35), (.5, 2, .30), (1.25, 4, .50), (2.25, 2, .35), (3, 5, .45)], motif_shift=3, pad_gain=.14, drum_gain=.46, bass_gain=.12, hat_gain=.70, snare_gain=.55, lead_gain=.13, spark_gain=.0, seed=26091905),
    dict(id="alt_reveal_starlight", title="星光揭晓", purpose="抽奖/合成揭晓/稀有奖励", style="cue", bpm=100, bars=12, roots=["C3", "G2", "A2", "F2"], motif=[(0, 0, .40), (.5, 2, .32), (1.25, 4, .42), (2, 5, .7), (3.25, 4, .45)], motif_shift=0, pad_gain=.18, drum_gain=.24, bass_gain=.06, hat_gain=.0, snare_gain=.0, lead_gain=.20, spark_gain=.11, seed=26091906),
]


def main() -> None:
    manifest = {"status": "review candidates; not runtime-selected", "sample_rate": SR, "license": "original deterministic synthesis", "tracks": [render(spec) for spec in SPECS]}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
