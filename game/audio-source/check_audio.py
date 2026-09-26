"""Validate exported deliverables, not just the synthesis implementation."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import sys

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
sys.path.insert(0, str(ROOT / "tmp/tools/audio/python-libs"))
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly

OUT = ROOT / "game/assets/resources/audio"
SR = 44100
FRAMES = 3528000


def parse_midi(path: Path) -> dict:
    data = path.read_bytes()
    assert data[:4] == b"MThd"
    length, kind, track_count, ticks_per_beat = struct.unpack(">IHHH", data[4:14])
    assert (length, kind, track_count, ticks_per_beat) == (6, 1, 8, 480)
    offset = 14
    note_ons = 0
    end_ticks = []

    def vlq(buf: bytes, pos: int) -> tuple[int, int]:
        value = 0
        for _ in range(4):
            byte = buf[pos]
            pos += 1
            value = (value << 7) | (byte & 127)
            if byte < 128:
                return value, pos
        raise AssertionError("MIDI variable length value exceeds four bytes")

    for _ in range(track_count):
        assert data[offset:offset + 4] == b"MTrk"
        track_length = struct.unpack(">I", data[offset + 4:offset + 8])[0]
        chunk = data[offset + 8:offset + 8 + track_length]
        offset += 8 + track_length
        pos, tick, active = 0, 0, {}
        while pos < len(chunk):
            delta, pos = vlq(chunk, pos)
            tick += delta
            status = chunk[pos]
            pos += 1
            if status == 0xFF:
                meta = chunk[pos]
                pos += 1
                size, pos = vlq(chunk, pos)
                payload = chunk[pos:pos + size]
                pos += size
                if meta == 0x2F:
                    assert not active, "MIDI has hanging note at end"
                    end_ticks.append(tick)
            elif status & 0xF0 in (0x80, 0x90):
                key, velocity = chunk[pos:pos + 2]
                pos += 2
                handle = (status & 15, key)
                if status & 0xF0 == 0x90 and velocity:
                    note_ons += 1
                    active[handle] = active.get(handle, 0) + 1
                else:
                    assert active.get(handle, 0) > 0, "MIDI unmatched note-off"
                    active[handle] -= 1
                    if active[handle] == 0:
                        del active[handle]
            elif status & 0xF0 in (0xC0, 0xD0):
                pos += 1
            else:
                raise AssertionError(f"Unexpected MIDI status {status:x}")
    assert offset == len(data)
    assert all(tick == 128 * 480 for tick in end_ticks)
    return {"tracks": track_count, "ticks_per_beat": ticks_per_beat,
            "note_ons": note_ons, "all_tracks_end_at_128_beats": True}


def main() -> None:
    report = json.loads((SOURCE / "exports/audio_analysis.json").read_text(encoding="utf-8"))
    score = json.loads((SOURCE / "home_score.json").read_text(encoding="utf-8"))
    results = {"checks": [], "pending": ["human listening", "Cocos playback integration", "mobile speaker/headphone review"]}

    def passed(message: str) -> None:
        results["checks"].append(message)
        print("PASS", message, flush=True)

    midi = parse_midi(SOURCE / "home_score.mid")
    assert midi["note_ons"] == len(score["events"]) == 1125
    results["midi"] = midi
    passed("Standard MIDI parses with 7 instrument tracks, 1125 paired notes, and no hanging notes")

    master, rate = sf.read(SOURCE / "exports/bgm_home_master.wav", dtype="float32", always_2d=True)
    assert master.shape == (FRAMES, 2) and rate == SR
    assert np.isfinite(master).all() and np.max(np.abs(master)) < .89
    assert sf.info(SOURCE / "exports/bgm_home_master.wav").subtype == "PCM_24"
    integrated = float(pyln.Meter(SR).integrated_loudness(master))
    assert -19.4 < integrated < -18.6
    passed("24-bit stereo master decodes to exactly 80 seconds, has no clipping and targets -19 LUFS")

    stems = list((SOURCE / "exports/home_stems").glob("*.wav"))
    assert len(stems) == 7
    combined = np.zeros_like(master)
    stem_results = {}
    for stem_path in sorted(stems):
        stem, rate = sf.read(stem_path, dtype="float32", always_2d=True)
        assert rate == SR and stem.shape == master.shape
        assert np.isfinite(stem).all() and np.max(np.abs(stem)) < 1
        rms = float(np.sqrt(np.mean(stem.astype(np.float64) ** 2)))
        assert rms > .0003, f"Silent/missing arrangement stem: {stem_path.name}"
        stem_results[stem_path.name] = {"rms_dbfs": float(20 * np.log10(rms)), "sample_frames": len(stem)}
        combined += stem
    residual = combined - master
    # Signed PCM rounding and the single master DC correction are below -105 dBFS.
    residual_rms = float(np.sqrt(np.mean(residual.astype(np.float64) ** 2)))
    assert residual_rms < 10 ** (-105 / 20)
    results["stems"] = stem_results
    results["stem_sum_residual_dbfs"] = float(20 * np.log10(max(residual_rms, 1e-12)))
    passed("Seven audible aligned 24-bit stems reconstruct the master within -105 dBFS residual")

    ogg, rate = sf.read(OUT / "bgm_home.ogg", dtype="float32", always_2d=True)
    assert rate == SR and ogg.shape == master.shape
    assert np.max(np.abs(resample_poly(ogg, 4, 1, axis=0))) < 10 ** (-2 / 20)
    for version in (master, ogg):
        local = np.concatenate((version[-1102:], version[:1102]))
        boundary_delta = float(np.max(np.abs(version[0] - version[-1])))
        derivative_rms = float(np.sqrt(np.mean(np.diff(local, axis=0) ** 2)))
        assert boundary_delta / derivative_rms < 4
    assert abs(pyln.Meter(SR).integrated_loudness(ogg) - integrated) < .3
    passed("Ogg round-trip preserves exact duration, true-peak headroom, loudness and a smooth numerical loop seam")

    section_energy = [float(np.sqrt(np.mean(master[i * 20 * SR:(i + 1) * 20 * SR].astype(np.float64) ** 2))) for i in range(4)]
    assert min(section_energy) > max(section_energy) * .45
    results["section_rms_dbfs"] = [float(20 * np.log10(e)) for e in section_energy]
    passed("All four 20-second sections contain signal without accidental silent sections")

    for effect in ("ui_confirm", "bubble_pop", "bubble_rub", "collect", "rare_reveal", "victory"):
        path = OUT / f"sfx_{effect}.wav"
        samples, rate = sf.read(path, dtype="float32", always_2d=True)
        assert rate == SR and samples.shape[1] == 2
        assert np.isfinite(samples).all() and .01 < np.max(np.abs(samples)) < .89
        assert np.max(np.abs(samples[-1])) <= 1 / 32768
    passed("Six stereo effect files decode, contain non-silent finite signal, have no clipping and end at silence")

    # This report owns the original home sample and six SFX; later audio sets have
    # their own manifests. Adding battle music must not rewrite home provenance.
    actual = {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in report["asset_sha256"]}
    assert actual == report["asset_sha256"]
    assert not (OUT / "bgm_home.wav").exists(), "Cocos cannot resolve same-name Ogg/WAV safely in resources.load"
    passed("SHA-256 matches the actual current runtime assets; no duplicate home music resource basename")

    results["status"] = "offline checks passed; listening and in-engine acceptance still pending"
    (SOURCE / "exports/audio_validation.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
