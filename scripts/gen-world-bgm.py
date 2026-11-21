"""
scripts/gen-world-bgm.py
Generador dual de música retro estilo City Connection en Python puro (wave, struct, math, random):
- Serie 1 ('8bit'): Ondas cuadrada / pulso / triangular / ruido blanco (bgm_<pais>.wav)
- Serie 2 ('fm90'): Síntesis FM estilo Yamaha YM2151 / Sega Genesis 44100 Hz (bgm_<pais>_fm90.wav)

Ambas series se generan lado a lado en public/sounds/ sin sobrescribirse entre sí.
"""

import math
import os
import random
import struct
import wave

SR = 44100
TWO_PI = 2.0 * math.pi
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "sounds")

NOTES = {
    "REST": 0.0,
    "E1": 41.20, "F1": 43.65, "G1": 49.00, "G#1": 51.91, "A1": 55.00, "Bb1": 58.27, "B1": 61.74,
    "C2": 65.41, "Db2": 69.30, "C#2": 69.30, "D2": 73.42, "Eb2": 77.78, "E2": 82.41, "F2": 87.31,
    "F#2": 92.50, "G2": 98.00, "Ab2": 103.83, "G#2": 103.83, "A2": 110.00, "Bb2": 116.54, "B2": 123.47,
    "C3": 130.81, "Db3": 138.59, "C#3": 138.59, "D3": 146.83, "Eb3": 155.56, "E3": 164.81, "F3": 174.61,
    "F#3": 185.00, "G3": 196.00, "Ab3": 207.65, "G#3": 207.65, "A3": 220.00, "Bb3": 233.08, "B3": 246.94,
    "C4": 261.63, "Db4": 277.18, "C#4": 277.18, "D4": 293.66, "Eb4": 311.13, "E4": 329.63, "F4": 349.23,
    "F#4": 369.99, "G4": 392.00, "Ab4": 415.30, "G#4": 415.30, "A4": 440.00, "Bb4": 466.16, "B4": 493.88,
    "C5": 523.25, "Db5": 554.37, "C#5": 554.37, "D5": 587.33, "Eb5": 622.25, "E5": 659.25, "F5": 698.46,
    "F#5": 739.99, "G5": 783.99, "Ab5": 830.61, "G#5": 830.61, "A5": 880.00, "Bb5": 932.33, "B5": 987.77,
    "C6": 1046.50, "Db6": 1108.73, "C#6": 1108.73, "D6": 1174.66, "E6": 1318.51,
}

# Patches FM: (c_ratio, m_ratio, i_attack, i_sustain, m_decay, c_decay, feedback, vib_depth)
FM_PATCHES = {
    "slap_bass":    (1.0, 2.0, 5.8, 0.9, 22.0, 4.2, 0.18, 0.0),
    "epiano_bell":  (1.0, 4.0, 3.6, 0.45, 14.0, 3.8, 0.05, 0.004),
    "sitar":        (1.0, 3.5, 4.6, 1.9, 6.5, 3.4, 0.28, 0.011),
    "brass":        (1.0, 1.0, 4.4, 2.8, 3.5, 1.2, 0.30, 0.007),
    "bandoneon":    (1.0, 2.0, 3.1, 2.3, 4.0, 1.4, 0.22, 0.008),
    "guitar":       (1.0, 2.0, 3.4, 0.35, 18.0, 6.5, 0.08, 0.0),
    "oud":          (1.0, 3.0, 3.9, 0.55, 16.0, 5.8, 0.15, 0.004),
    "bouzouki":     (1.0, 2.0, 4.1, 0.70, 14.0, 5.2, 0.14, 0.005),
    "chord_ep":     (1.0, 3.0, 2.4, 0.30, 15.0, 9.5, 0.04, 0.0),
}


def osc8(kind: str, p: float) -> float:
    p = p % 1.0
    if kind == "square":
        return 1.0 if p < 0.5 else -1.0
    if kind == "pulse25":
        return 1.0 if p < 0.25 else -1.0
    if kind == "pulse12":
        return 1.0 if p < 0.125 else -1.0
    if kind == "triangle":
        return 4.0 * abs(p - 0.5) - 1.0
    if kind == "saw":
        return 2.0 * p - 1.0
    if kind == "sine":
        return math.sin(TWO_PI * p)
    return 0.0


def write_mono_wav(filename: str, channels: list[list[float]], tag: str, sample_rate: int = SR):
    n = len(channels[0])
    mixed = [0.0] * n
    edge = int(0.002 * sample_rate)
    peak = 0.0
    for i in range(n):
        s = channels[0][i] + channels[1][i] + channels[2][i] + channels[3][i]
        if i < edge:
            s *= i / edge
        elif i >= n - edge:
            s *= (n - 1 - i) / edge
        mixed[i] = s
        a = s if s >= 0 else -s
        if a > peak:
            peak = a

    scale = (0.90 if tag == "FM90" else 0.88) / peak if peak > 1e-6 else 1.0
    os.makedirs(OUT_DIR, exist_ok=True)
    pcm = bytearray(n * 2)
    pack = struct.pack_into
    for i, s in enumerate(mixed):
        val = int(round(s * scale * 32767.0))
        if val > 32767:
            val = 32767
        elif val < -32767:
            val = -32767
        pack("<h", pcm, i * 2, val)

    out_path = os.path.join(OUT_DIR, filename)
    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    print(f"OK {tag} {filename}: {n} samples, {n / sample_rate:.2f}s, {os.path.getsize(out_path)} bytes")


# ─── MOTOR 8-BIT ──────────────────────────────────────────────────────────────
def synth_melody_8bit(buf, events, step_sec, wave_kind="square", amp=0.30, vibrato=0.0, slide_mode=False, lp=0.0):
    phase = 0.0
    lp_state = 0.0
    total = len(buf)
    prev_freq = 0.0
    sin = math.sin
    inv_sr = 1.0 / SR
    for ev in events:
        st, dur, note = ev[0], ev[1], ev[2]
        stac = ev[3] if len(ev) > 3 else 0.88
        freq = NOTES.get(note, 0.0)
        if freq <= 0:
            prev_freq = 0.0
            continue
        i0 = int(round(st * step_sec * SR))
        i1 = min(total, int(round((st + dur) * step_sec * SR)))
        active = max(1, int((i1 - i0) * stac))
        att = min(int(0.004 * SR), active // 4)
        rel = min(int(0.014 * SR), active // 3)
        start_f = prev_freq if (slide_mode and prev_freq > 0 and dur >= 2) else freq
        for j in range(active):
            idx = i0 + j
            if idx >= total:
                break
            t_loc = j * inv_sr
            f_inst = start_f + (freq - start_f) * min(1.0, (j / max(1, active - 1)) / 0.22) if slide_mode else freq
            if vibrato > 0 and dur >= 3 and t_loc > 0.07:
                f_inst *= 1.0 + vibrato * sin(TWO_PI * 6.2 * t_loc)
            phase += f_inst * inv_sr
            val = osc8(wave_kind, phase)
            if lp > 0:
                lp_state = lp_state + lp * (val - lp_state)
                val = lp_state
            env = 1.0
            if j < att and att > 0:
                env = j / att
            elif j > active - rel and rel > 0:
                env = max(0.0, (active - j) / rel)
            buf[idx] += val * env * amp
        prev_freq = freq


def synth_bass_8bit(buf, events, step_sec, amp=0.40, decay=4.5):
    phase = 0.0
    total = len(buf)
    exp = math.exp
    inv_sr = 1.0 / SR
    for st, dur, note in events:
        freq = NOTES.get(note, 0.0)
        if freq <= 0:
            continue
        i0 = int(round(st * step_sec * SR))
        i1 = min(total, int(round((st + dur) * step_sec * SR)))
        n = max(1, i1 - i0)
        att = min(int(0.004 * SR), n // 4)
        rel = min(int(0.015 * SR), n // 3)
        for j in range(n):
            idx = i0 + j
            t_loc = j * inv_sr
            phase += freq * inv_sr
            tri = osc8("triangle", phase)
            fund = osc8("sine", phase)
            env = (j / att if j < att and att > 0 else 1.0)
            if j > n - rel and rel > 0:
                env *= max(0.0, (n - j) / rel)
            buf[idx] += (0.68 * tri + 0.32 * fund) * env * exp(-t_loc * decay) * amp


def synth_harmony_8bit(buf, events, step_sec, wave_kind="pulse25", amp=0.20, decay=11.0):
    total = len(buf)
    lp_state = 0.0
    exp = math.exp
    inv_sr = 1.0 / SR
    for st, dur, chord_notes in events:
        i0 = int(round(st * step_sec * SR))
        i1 = min(total, int(round((st + dur) * step_sec * SR)))
        n = max(1, i1 - i0)
        freqs = [NOTES[c] for c in chord_notes if c in NOTES and NOTES[c] > 0]
        if not freqs:
            continue
        phases = [0.0] * len(freqs)
        att = min(int(0.003 * SR), n // 4)
        inv_l = 1.0 / len(freqs)
        for j in range(n):
            idx = i0 + j
            t_loc = j * inv_sr
            val = 0.0
            for k, f in enumerate(freqs):
                phases[k] += f * inv_sr
                val += osc8(wave_kind, phases[k])
            lp_state = lp_state + 0.28 * ((val * inv_l) - lp_state)
            env = (j / att if j < att and att > 0 else 1.0) * exp(-t_loc * decay)
            buf[idx] += lp_state * env * amp


def synth_drums_8bit(buf, events, step_sec, seed=1985):
    rng = random.Random(seed)
    total = len(buf)
    sin, exp = math.sin, math.exp
    inv_sr = 1.0 / SR
    for st, kind in events:
        i0 = int(round(st * step_sec * SR))
        if kind in ("kick", "leguero_parche"):
            dur = int((0.11 if kind == "leguero_parche" else 0.075) * SR)
            ph, lp = 0.0, 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                f = (120.0 * exp(-t * 30.0) + 52.0) if kind == "leguero_parche" else (150.0 * exp(-t * 42.0) + 48.0)
                ph += f * inv_sr
                body = sin(TWO_PI * ph) * exp(-t * (18.0 if kind == "leguero_parche" else 28.0))
                w = rng.random() * 2 - 1
                lp = lp + 0.09 * (w - lp)
                buf[idx] += (body * 0.55 + lp * exp(-t * 25.0) * (0.9 if kind == "leguero_parche" else 0.3)) * 0.62
        elif kind in ("snare", "darbuka_tek"):
            dur = int(0.065 * SR)
            f_tone = 310.0 if kind == "darbuka_tek" else 195.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                noise = (rng.random() * 2 - 1) * exp(-t * 60.0)
                tone = sin(TWO_PI * f_tone * t) * exp(-t * 48.0) * 0.35
                buf[idx] += (noise * 0.65 + tone) * 0.36
        elif kind in ("clave", "leguero_aro"):
            dur = int(0.038 * SR)
            f_c = 1950.0 if kind == "clave" else 1120.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                click = sin(TWO_PI * f_c * t) * exp(-t * 105.0)
                edge_n = (rng.random() * 2 - 1) * exp(-t * 130.0) * (0.25 if kind == "leguero_aro" else 0.12)
                buf[idx] += (click + edge_n) * (0.45 if kind == "clave" else 0.38)
        elif kind == "tabla":
            dur = int(0.085 * SR)
            ph = 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                ph += (290.0 + 70.0 * exp(-t * 35.0)) * inv_sr
                buf[idx] += (sin(TWO_PI * ph) * 0.75 + (rng.random() * 2 - 1) * 0.15) * exp(-t * 32.0) * 0.42
        else:
            dur = int(0.025 * SR)
            prev = 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                w = rng.random() * 2 - 1
                hp = w - prev * 0.85
                prev = w
                buf[idx] += hp * exp(-t * 140.0) * 0.15


# ─── MOTOR FM 90s (YM2151 / SEGA GENESIS) ────────────────────────────────────
def synth_fm_voice(buf, events, step_sec, patch_name="epiano_bell", amp=0.32, slide_mode=False, brass_swell=False):
    c_ratio, m_ratio, i_att, i_sus, m_dec, c_dec, fb, vib_depth = FM_PATCHES[patch_name]
    sin, exp = math.sin, math.exp
    total = len(buf)
    c_phase, m_phase, prev_m_out, prev_freq = 0.0, 0.0, 0.0, 0.0
    inv_sr = 1.0 / SR

    for ev in events:
        st, dur, note = ev[0], ev[1], ev[2]
        stac = ev[3] if len(ev) > 3 else 0.90
        freq = NOTES.get(note, 0.0)
        if freq <= 0:
            prev_freq = 0.0
            continue
        i0 = int(round(st * step_sec * SR))
        i1 = min(total, int(round((st + dur) * step_sec * SR)))
        active = max(1, int((i1 - i0) * stac))
        att = min(int((0.025 if brass_swell else 0.004) * SR), active // 3)
        rel = min(int(0.018 * SR), active // 3)
        start_f = prev_freq if (slide_mode and prev_freq > 0 and dur >= 2) else freq

        for j in range(active):
            idx = i0 + j
            if idx >= total:
                break
            t_loc = j * inv_sr
            f_inst = start_f + (freq - start_f) * min(1.0, (j / max(1, active - 1)) / 0.22) if slide_mode else freq
            if vib_depth > 0 and dur >= 3 and t_loc > 0.07:
                f_inst *= 1.0 + vib_depth * sin(TWO_PI * 6.0 * t_loc)

            if brass_swell:
                swell = min(1.0, t_loc / 0.040)
                mod_index = (0.7 + (i_att - 0.7) * swell) * (0.7 + 0.3 * exp(-t_loc * m_dec))
            else:
                mod_index = i_sus + (i_att - i_sus) * exp(-t_loc * m_dec)

            c_phase += (f_inst * c_ratio) * inv_sr
            m_phase += (f_inst * m_ratio) * inv_sr
            m_out = sin(TWO_PI * m_phase + fb * prev_m_out)
            prev_m_out = m_out
            c_out = sin(TWO_PI * c_phase + mod_index * m_out)

            env = exp(-t_loc * c_dec)
            if j < att and att > 0:
                env *= j / att
            elif j > active - rel and rel > 0:
                env *= max(0.0, (active - j) / rel)

            buf[idx] += c_out * env * amp
        prev_freq = freq


def synth_fm_harmony(buf, events, step_sec, patch_name="chord_ep", amp=0.17):
    c_ratio, m_ratio, i_att, i_sus, m_dec, c_dec, _, _ = FM_PATCHES[patch_name]
    sin, exp = math.sin, math.exp
    total = len(buf)
    inv_sr = 1.0 / SR
    for st, dur, chord_notes in events:
        i0 = int(round(st * step_sec * SR))
        i1 = min(total, int(round((st + dur) * step_sec * SR)))
        n = max(1, i1 - i0)
        freqs = [NOTES[c] for c in chord_notes if c in NOTES and NOTES[c] > 0]
        if not freqs:
            continue
        c_ph, m_ph = [0.0] * len(freqs), [0.0] * len(freqs)
        att = min(int(0.004 * SR), n // 4)
        inv_l = 1.0 / len(freqs)
        for j in range(n):
            idx = i0 + j
            t_loc = j * inv_sr
            mod_index = i_sus + (i_att - i_sus) * exp(-t_loc * m_dec)
            val = 0.0
            for k, f in enumerate(freqs):
                c_ph[k] += f * c_ratio * inv_sr
                m_ph[k] += f * m_ratio * inv_sr
                val += sin(TWO_PI * c_ph[k] + mod_index * sin(TWO_PI * m_ph[k]))
            env = exp(-t_loc * c_dec)
            if j < att and att > 0:
                env *= j / att
            buf[idx] += (val * inv_l) * env * amp


def synth_drums_90s(buf, events, step_sec, seed=1992):
    rng = random.Random(seed)
    sin, exp = math.sin, math.exp
    total = len(buf)
    inv_sr = 1.0 / SR
    for st, kind in events:
        i0 = int(round(st * step_sec * SR))
        if kind in ("kick", "leguero_parche"):
            is_leg = (kind == "leguero_parche")
            dur = int((0.14 if is_leg else 0.095) * SR)
            c_ph, m_ph, lp = 0.0, 0.0, 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                f = (130.0 * exp(-t * 28.0) + 52.0) if is_leg else (188.0 * exp(-t * 48.0) + 44.0)
                c_ph += f * inv_sr
                m_ph += (f * 1.5) * inv_sr
                mod_i = (1.6 if is_leg else 2.4) * exp(-t * 45.0)
                body = sin(TWO_PI * c_ph + mod_i * sin(TWO_PI * m_ph)) * exp(-t * (15.0 if is_leg else 24.0))
                w = rng.random() * 2.0 - 1.0
                lp = lp + (0.08 if is_leg else 0.14) * (w - lp)
                skin = lp * exp(-t * (22.0 if is_leg else 65.0)) * (0.85 if is_leg else 0.35)
                buf[idx] += (body * 0.65 + skin) * 0.62
        elif kind in ("snare", "darbuka_tek"):
            is_tek = (kind == "darbuka_tek")
            dur = int(0.11 * SR)
            c_ph, m_ph, prev = 0.0, 0.0, 0.0
            f = 330.0 if is_tek else 205.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                c_ph += f * inv_sr
                m_ph += (f * 2.41) * inv_sr
                tone = sin(TWO_PI * c_ph + 1.8 * exp(-t * 35.0) * sin(TWO_PI * m_ph)) * exp(-t * 34.0)
                w = rng.random() * 2.0 - 1.0
                hp = w - 0.55 * prev
                prev = w
                buf[idx] += (tone * 0.45 + hp * exp(-t * 28.0) * 0.55) * 0.42
        elif kind in ("clave", "leguero_aro"):
            dur = int(0.045 * SR)
            f = 2100.0 if kind == "clave" else 1180.0
            c_ph, m_ph = 0.0, 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                c_ph += f * inv_sr
                m_ph += (f * 2.71) * inv_sr
                buf[idx] += sin(TWO_PI * c_ph + 1.2 * exp(-t * 80.0) * sin(TWO_PI * m_ph)) * exp(-t * 95.0) * 0.42
        elif kind == "tabla":
            dur = int(0.10 * SR)
            c_ph, m_ph = 0.0, 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                f = 285.0 + 85.0 * exp(-t * 38.0)
                c_ph += f * inv_sr
                m_ph += (f * 1.5) * inv_sr
                buf[idx] += sin(TWO_PI * c_ph + 1.4 * exp(-t * 30.0) * sin(TWO_PI * m_ph)) * exp(-t * 28.0) * 0.42
        else:
            dur = int(0.045 * SR)
            c_ph, m_ph, prev = 0.0, 0.0, 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= total:
                    break
                t = j * inv_sr
                c_ph += 3420.0 * inv_sr
                m_ph += (3420.0 * 1.4142) * inv_sr
                metal = sin(TWO_PI * c_ph + 2.2 * sin(TWO_PI * m_ph))
                w = rng.random() * 2.0 - 1.0
                hp = w - 0.85 * prev
                prev = w
                buf[idx] += (metal * 0.35 + hp * 0.65) * exp(-t * 95.0) * 0.16


# ─── ARREGLOS MUSICALES COMPARTIDOS ──────────────────────────────────────────
def build_tchaikovsky_a_44(root_mode="Am"):
    mel = [
        (0, 6, "E5"), (6, 2, "D5"), (8, 4, "C5"), (12, 4, "B4"),
        (16, 4, "A4"), (20, 4, "C5"), (24, 8, "E5"),
        (32, 6, "F5"), (38, 2, "E5"), (40, 4, "D5"), (44, 4, "C5"),
        (48, 4, "B4"), (52, 4, "C5"), (56, 8, "E5"),
        (64, 6, "A5"), (70, 2, "G5"), (72, 4, "F5"), (76, 4, "E5"),
        (80, 6, "D5"), (86, 2, "E5"), (88, 8, "F5"),
        (96, 4, "E5"), (100, 4, "D5"), (104, 4, "C5"), (108, 4, "B4"),
        (112, 8, "E5"), (120, 4, "C5"), (124, 4, "E5"),
    ]
    roots = ["A2", "A2", "D2", "E2", "A2", "F2", "D2", "E2"] if root_mode == "Am" else ["C2", "C2", "F2", "G2", "C2", "A2", "F2", "G2"]
    bass, harm = [], []
    for b, r in enumerate(roots):
        s = b * 16
        oct_n = r[:-1] + str(int(r[-1]) + 1)
        bass.extend([(s + 0, 4, r), (s + 4, 2, oct_n), (s + 6, 2, r), (s + 8, 4, r), (s + 12, 2, oct_n), (s + 14, 2, r)])
        chord = [r[:-1] + "3", "C4", "E4"] if "A" in r else ([r[:-1] + "3", "F4", "A4"] if "D" in r or "F" in r else [r[:-1] + "3", "B3", "E4"])
        harm.extend([(s + 0, 4, chord), (s + 4, 2, chord), (s + 8, 4, chord), (s + 12, 2, chord)])
    return mel, bass, harm


def generate_turkish(mode="8bit"):
    step_sec = (60.0 / 135.0) / 4.0
    total_samples = int(round(256 * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples
    mel_a, bass_a, harm_a = build_tchaikovsky_a_44("Am")
    o = 128
    mel_b = [
        (o+0, 1, "B4"), (o+1, 1, "A4"), (o+2, 1, "G#4"), (o+3, 1, "A4"), (o+4, 4, "C#5"),
        (o+8, 1, "D5"), (o+9, 1, "C#5"), (o+10, 1, "Bb4"), (o+11, 1, "C#5"), (o+12, 4, "E5"),
        (o+16, 1, "F5"), (o+17, 1, "E5"), (o+18, 1, "D5"), (o+19, 1, "E5"), (o+20, 2, "G#5"), (o+22, 2, "F5"),
        (o+24, 2, "E5"), (o+26, 2, "D5"), (o+28, 2, "C#5"), (o+30, 2, "Bb4"),
        (o+32, 1, "A4"), (o+33, 1, "Bb4"), (o+34, 1, "C#5"), (o+35, 1, "D5"), (o+36, 2, "E5"), (o+38, 2, "F5"),
        (o+40, 2, "E5"), (o+42, 2, "D5"), (o+44, 2, "C#5"), (o+46, 2, "Bb4"),
        (o+48, 2, "A4"), (o+50, 2, "G#4"), (o+52, 4, "A4"), (o+56, 2, "E5"), (o+58, 2, "F5"), (o+60, 4, "E5"),
        (o+64, 2, "A5"), (o+66, 2, "G#5"), (o+68, 2, "F5"), (o+70, 2, "E5"),
        (o+72, 1, "F5"), (o+73, 1, "E5"), (o+74, 1, "D5"), (o+75, 1, "C#5"), (o+76, 4, "D5"),
        (o+80, 2, "G#5"), (o+82, 2, "F5"), (o+84, 2, "E5"), (o+86, 2, "D5"),
        (o+88, 1, "E5"), (o+89, 1, "D5"), (o+90, 1, "C#5"), (o+91, 1, "Bb4"), (o+92, 4, "C#5"),
        (o+96, 1, "D5"), (o+97, 1, "C#5"), (o+98, 1, "Bb4"), (o+99, 1, "A4"),
        (o+100, 1, "Bb4"), (o+101, 1, "C#5"), (o+102, 1, "D5"), (o+103, 1, "E5"),
        (o+104, 2, "F5"), (o+106, 2, "E5"), (o+108, 2, "D5"), (o+110, 2, "C#5"),
        (o+112, 2, "Bb4"), (o+114, 2, "A4"), (o+116, 4, "G#4"), (o+120, 4, "A4"), (o+124, 4, "E5"),
    ]
    harm_b, bass_b = [], []
    for b in range(8):
        s = o + b * 16
        r = "A2" if b % 2 == 0 else "Bb2" if b in (1, 5) else "E2"
        oct_r = r[:-1] + str(int(r[-1]) + 1)
        bass_b.extend([(s+0, 4, r), (s+4, 4, oct_r), (s+8, 4, r), (s+12, 4, oct_r)])
        ch = ["A3", "C#4", "E4"] if r == "A2" else (["Bb3", "D4", "F4"] if "Bb" in r else ["G#3", "D4", "E4"])
        for st in (2, 6, 10, 14):
            harm_b.append((s + st, 2, ch))
    drums = []
    for bar in range(16):
        s = bar * 16
        if bar < 8:
            drums.extend([(s+0, "kick"), (s+4, "snare"), (s+8, "kick"), (s+12, "snare")])
        else:
            drums.extend([(s+0, "kick"), (s+3, "darbuka_tek"), (s+6, "darbuka_tek"), (s+8, "kick"), (s+12, "darbuka_tek"), (s+14, "hat")])

    if mode == "8bit":
        synth_melody_8bit(ch1, mel_a + mel_b, step_sec, "pulse25", amp=0.31, vibrato=0.005)
        synth_harmony_8bit(ch2, harm_a + harm_b, step_sec, "pulse12", amp=0.19)
        synth_bass_8bit(ch3, bass_a + bass_b, step_sec, amp=0.38)
        synth_drums_8bit(ch4, drums, step_sec, seed=101)
        write_mono_wav("bgm_turkish.wav", [ch1, ch2, ch3, ch4], "8BIT")
    else:
        synth_fm_voice(ch1, mel_a, step_sec, "epiano_bell", amp=0.33)
        synth_fm_voice(ch1, mel_b, step_sec, "oud", amp=0.33)
        synth_fm_harmony(ch2, harm_a + harm_b, step_sec, "chord_ep", amp=0.17)
        synth_fm_voice(ch3, bass_a + bass_b, step_sec, "slap_bass", amp=0.39)
        synth_drums_90s(ch4, drums, step_sec, seed=101)
        write_mono_wav("bgm_turkish_fm90.wav", [ch1, ch2, ch3, ch4], "FM90")


def generate_india(mode="8bit"):
    step_sec = (60.0 / 128.0) / 4.0
    total_samples = int(round(256 * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples
    mel_a, bass_a, harm_a = build_tchaikovsky_a_44("C")
    o = 128
    mel_b = [
        (o+0, 4, "C5"), (o+4, 2, "Db5"), (o+6, 2, "E5"), (o+8, 4, "F5"), (o+12, 4, "E5"),
        (o+16, 2, "G5"), (o+18, 2, "Ab5"), (o+20, 4, "G5"), (o+24, 4, "F5"), (o+28, 4, "E5"),
        (o+32, 2, "E5"), (o+34, 2, "F5"), (o+36, 4, "Ab5"), (o+40, 2, "B5"), (o+42, 2, "Ab5"), (o+44, 4, "G5"),
        (o+48, 2, "F5"), (o+50, 2, "E5"), (o+52, 2, "Db5"), (o+54, 2, "C5"), (o+56, 8, "C5"),
        (o+64, 2, "C5"), (o+66, 2, "E5"), (o+68, 4, "G5"), (o+72, 2, "Ab5"), (o+74, 2, "B5"), (o+76, 4, "C6"),
        (o+80, 2, "B5"), (o+82, 2, "Ab5"), (o+84, 4, "G5"), (o+88, 2, "F5"), (o+90, 2, "E5"), (o+92, 4, "Db5"),
        (o+96, 2, "C5"), (o+98, 2, "Db5"), (o+100, 2, "E5"), (o+102, 2, "F5"), (o+104, 4, "G5"), (o+108, 4, "Ab5"),
        (o+112, 2, "G5"), (o+114, 2, "F5"), (o+116, 2, "E5"), (o+118, 2, "Db5"), (o+120, 4, "C5"), (o+124, 4, "G4"),
    ]
    bass_b = []
    for b in range(8):
        s = o + b * 16
        bass_b.extend([(s+0, 8, "C2"), (s+8, 8, "G2" if b % 2 == 1 else "C2")])

    i_start_b = int(round(o * step_sec * SR))
    ph_c, ph_g, ph_m = 0.0, 0.0, 0.0
    sin = math.sin
    inv_sr = 1.0 / SR
    for idx in range(i_start_b, total_samples):
        t = (idx - i_start_b) * inv_sr
        ph_c += NOTES["C2"] * inv_sr
        ph_g += NOTES["G2"] * inv_sr
        ph_m += (NOTES["C2"] * (4.0 if mode == "fm90" else 2.0)) * inv_sr
        shimmer = 0.74 + 0.26 * sin(TWO_PI * 1.4 * t)
        fade = min(1.0, t / 0.15) * min(1.0, (total_samples - 1 - idx) / (0.15 * SR))
        if mode == "8bit":
            drone = (osc8("saw", ph_c) * 0.45 + osc8("triangle", ph_g) * 0.35 + osc8("pulse12", ph_m) * 0.20)
            ch2[idx] += drone * shimmer * fade * 0.20
        else:
            m_val = sin(TWO_PI * ph_m)
            drone = sin(TWO_PI * ph_c + 1.8 * m_val) * 0.6 + sin(TWO_PI * ph_g + 1.1 * m_val) * 0.4
            ch2[idx] += drone * shimmer * fade * 0.17

    drums = []
    for bar in range(16):
        s = bar * 16
        if bar < 8:
            drums.extend([(s+0, "kick"), (s+4, "snare"), (s+8, "kick"), (s+12, "snare")])
        else:
            drums.extend([(s+0, "kick"), (s+2, "tabla"), (s+4, "tabla"), (s+6, "hat"), (s+8, "kick"), (s+10, "tabla"), (s+12, "tabla"), (s+14, "hat")])

    if mode == "8bit":
        synth_melody_8bit(ch1, mel_a, step_sec, "square", amp=0.30)
        synth_melody_8bit(ch1, mel_b, step_sec, "saw", amp=0.28, vibrato=0.012, slide_mode=True, lp=0.38)
        synth_harmony_8bit(ch2, harm_a, step_sec, "pulse25", amp=0.18)
        synth_bass_8bit(ch3, bass_a + bass_b, step_sec, amp=0.36)
        synth_drums_8bit(ch4, drums, step_sec, seed=202)
        write_mono_wav("bgm_india.wav", [ch1, ch2, ch3, ch4], "8BIT")
    else:
        synth_fm_voice(ch1, mel_a, step_sec, "epiano_bell", amp=0.32)
        synth_fm_voice(ch1, mel_b, step_sec, "sitar", amp=0.31, slide_mode=True)
        synth_fm_harmony(ch2, harm_a, step_sec, "chord_ep", amp=0.16)
        synth_fm_voice(ch3, bass_a + bass_b, step_sec, "slap_bass", amp=0.36)
        synth_drums_90s(ch4, drums, step_sec, seed=202)
        write_mono_wav("bgm_india_fm90.wav", [ch1, ch2, ch3, ch4], "FM90")


def generate_argentina(mode="8bit"):
    step_sec = (60.0 / 135.0) / 6.0
    total_samples = int(round(384 * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples
    mel_a = []
    for rep in range(2):
        r = rep * 96
        mel_a.extend([
            (r+0, 4, "E5"), (r+4, 2, "D5"), (r+6, 4, "C5"), (r+10, 2, "B4"), (r+12, 6, "A4"), (r+18, 6, "C5"),
            (r+24, 4, "D5"), (r+28, 2, "C5"), (r+30, 4, "B4"), (r+34, 2, "A4"), (r+36, 6, "G#4"), (r+42, 6, "E5"),
            (r+48, 4, "A5"), (r+52, 2, "G5"), (r+54, 4, "F5"), (r+58, 2, "E5"), (r+60, 6, "D5"), (r+66, 6, "F5"),
            (r+72, 4, "E5"), (r+76, 2, "D5"), (r+78, 4, "C5"), (r+82, 2, "B4"), (r+84, 6, "A4"), (r+90, 6, "E5"),
        ])
    o = 192
    mel_b = []
    for rep in range(2):
        r = o + rep * 96
        mel_b.extend([
            (r+0, 2, "E5"), (r+2, 2, "C5"), (r+4, 2, "A4"), (r+6, 2, "E5"), (r+8, 2, "C5"), (r+10, 2, "A4"),
            (r+12, 2, "D5"), (r+14, 2, "B4"), (r+16, 2, "G#4"), (r+18, 4, "E4"), (r+22, 2, "B4"),
            (r+24, 2, "C5"), (r+26, 2, "D5"), (r+28, 2, "E5"), (r+30, 4, "C5"), (r+34, 2, "A4"), (r+36, 6, "B4"), (r+42, 6, "E5"),
            (r+48, 3, "G5"), (r+51, 3, "E5"), (r+54, 3, "C5"), (r+57, 3, "G4"),
            (r+60, 3, "F5"), (r+63, 3, "D5"), (r+66, 3, "B4"), (r+69, 3, "G4"),
            (r+72, 2, "E5"), (r+74, 2, "D5"), (r+76, 2, "C5"), (r+78, 2, "B4"), (r+80, 2, "G#4"), (r+82, 2, "E4"),
            (r+84, 4, "A4"), (r+88, 2, "C5"), (r+90, 6, "E5"),
        ])
    bass, harm, drums = [], [], []
    prog = ["A2", "E2", "A2", "E2", "C2", "G2", "E2", "A2"]
    for bar in range(32):
        s = bar * 12
        r = prog[bar % 8]
        arp = ["A3", "C4", "E4", "A4", "E4", "C4"] if r == "A2" else (
            ["E3", "G#3", "B3", "E4", "B3", "G#3"] if r == "E2" else (
                ["C3", "E3", "G3", "C4", "G3", "E3"] if r == "C2" else ["G3", "B3", "D4", "G4", "D4", "B3"]
            )
        )
        bass.extend([(s+0, 6, r), (s+6, 4, r), (s+10, 2, r)])
        if bar >= 16:
            for k, n in enumerate(arp):
                harm.append((s + k * 2, 2, [n]))
        else:
            harm.extend([(s+0, 3, arp[:3]), (s+6, 3, arp[:3])])
        drums.extend([
            (s+0, "leguero_parche"), (s+2, "leguero_aro"), (s+4, "leguero_parche"),
            (s+6, "leguero_aro"), (s+8, "leguero_parche"), (s+10, "leguero_aro"),
        ])

    if mode == "8bit":
        synth_melody_8bit(ch1, mel_a + mel_b, step_sec, "square", amp=0.30, vibrato=0.004)
        synth_harmony_8bit(ch2, harm, step_sec, "triangle", amp=0.22, decay=9.0)
        synth_bass_8bit(ch3, bass, step_sec, amp=0.38)
        synth_drums_8bit(ch4, drums, step_sec, seed=303)
        write_mono_wav("bgm_argentina.wav", [ch1, ch2, ch3, ch4], "8BIT")
    else:
        synth_fm_voice(ch1, mel_a, step_sec, "epiano_bell", amp=0.31)
        synth_fm_voice(ch1, mel_b, step_sec, "bandoneon", amp=0.31, brass_swell=True)
        synth_fm_harmony(ch2, harm, step_sec, "guitar", amp=0.21)
        synth_fm_voice(ch3, bass, step_sec, "slap_bass", amp=0.38)
        synth_drums_90s(ch4, drums, step_sec, seed=303)
        write_mono_wav("bgm_argentina_fm90.wav", [ch1, ch2, ch3, ch4], "FM90")


def generate_cuba(mode="8bit"):
    step_sec = (60.0 / 132.0) / 4.0
    total_samples = int(round(256 * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples
    mel_a, bass_a, harm_a = build_tchaikovsky_a_44("Am")
    o = 128
    mel_b = [
        (o+0, 3, "E5"), (o+3, 3, "C5"), (o+6, 4, "A4"), (o+10, 2, "C5"), (o+12, 4, "E5"),
        (o+16, 3, "F5"), (o+19, 3, "D5"), (o+22, 4, "A4"), (o+26, 2, "D5"), (o+28, 4, "F5"),
        (o+32, 3, "G5"), (o+35, 3, "E5"), (o+38, 4, "D5"), (o+42, 2, "B4"), (o+44, 4, "D5"),
        (o+48, 3, "E5"), (o+51, 3, "D5"), (o+54, 4, "C5"), (o+58, 2, "B4"), (o+60, 4, "G#4"),
        (o+64, 2, "A4"), (o+66, 2, "C5"), (o+68, 2, "E5"), (o+70, 4, "A5"), (o+74, 2, "G5"), (o+76, 4, "E5"),
        (o+80, 2, "F5"), (o+82, 2, "A5"), (o+84, 4, "G5"), (o+88, 2, "F5"), (o+90, 2, "E5"), (o+92, 4, "D5"),
        (o+96, 3, "G5"), (o+99, 3, "F5"), (o+102, 4, "E5"), (o+106, 2, "D5"), (o+108, 4, "C5"),
        (o+112, 2, "B4"), (o+114, 2, "D5"), (o+116, 4, "E5"), (o+120, 4, "G#5"), (o+124, 4, "E5"),
    ]
    tumbao_roots = [("A2", "E2"), ("F2", "C3"), ("G2", "D3"), ("E2", "B2")]
    bass_b, harm_b = [], []
    for b in range(8):
        s = o + b * 16
        r, q = tumbao_roots[b % 4]
        bass_b.extend([(s+0, 4, r), (s+6, 4, q), (s+12, 2, r), (s+14, 4, q)])
        ch = ["A3", "C4", "E4"] if b % 4 == 0 else (["F3", "A3", "C4"] if b % 4 == 1 else (["G3", "B3", "D4"] if b % 4 == 2 else ["G#3", "B3", "E4"]))
        for st in (0, 3, 6, 9, 12, 14):
            harm_b.append((s + st, 2, ch))
    drums = []
    for bar in range(16):
        s = bar * 16
        if bar < 8:
            drums.extend([(s+0, "kick"), (s+4, "snare"), (s+8, "kick"), (s+12, "snare")])
        else:
            if (bar - 8) % 2 == 0:
                drums.extend([(s+0, "clave"), (s+6, "clave"), (s+12, "clave")])
            else:
                drums.extend([(s+4, "clave"), (s+8, "clave")])
            drums.extend([(s+0, "kick"), (s+6, "kick"), (s+14, "kick")])
            for st in range(0, 16, 2):
                drums.append((s + st, "hat"))

    if mode == "8bit":
        synth_melody_8bit(ch1, mel_a, step_sec, "square", amp=0.30)
        synth_melody_8bit(ch1, mel_b, step_sec, "saw", amp=0.31, vibrato=0.007, lp=0.45)
        synth_harmony_8bit(ch2, harm_a + harm_b, step_sec, "pulse25", amp=0.18, decay=13.0)
        synth_bass_8bit(ch3, bass_a + bass_b, step_sec, amp=0.40, decay=3.8)
        synth_drums_8bit(ch4, drums, step_sec, seed=404)
        write_mono_wav("bgm_cuba.wav", [ch1, ch2, ch3, ch4], "8BIT")
    else:
        synth_fm_voice(ch1, mel_a, step_sec, "epiano_bell", amp=0.31)
        synth_fm_voice(ch1, mel_b, step_sec, "brass", amp=0.32, brass_swell=True)
        synth_fm_harmony(ch2, harm_a + harm_b, step_sec, "chord_ep", amp=0.17)
        synth_fm_voice(ch3, bass_a + bass_b, step_sec, "slap_bass", amp=0.40)
        synth_drums_90s(ch4, drums, step_sec, seed=404)
        write_mono_wav("bgm_cuba_fm90.wav", [ch1, ch2, ch3, ch4], "FM90")


def generate_greece(mode="8bit"):
    step_sec = (60.0 / 135.0) / 4.0
    total_samples = int(round(256 * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples, [0.0]*total_samples
    mel_a, bass_a, harm_a = build_tchaikovsky_a_44("Am")
    o = 128
    mel_b = [
        (o+0, 2, "E5"), (o+2, 1, "F5"), (o+3, 1, "E5"), (o+4, 1, "D5"), (o+5, 1, "E5"), (o+6, 2, "C5"),
        (o+8, 1, "D5"), (o+9, 1, "C5"), (o+10, 1, "B4"), (o+11, 1, "C5"), (o+12, 4, "A4"),
        (o+16, 2, "G#4"), (o+18, 2, "A4"), (o+20, 2, "B4"), (o+22, 2, "C5"),
        (o+24, 1, "D5"), (o+25, 1, "E5"), (o+26, 1, "D5"), (o+27, 1, "C5"), (o+28, 4, "B4"),
        (o+32, 2, "E5"), (o+34, 1, "F5"), (o+35, 1, "E5"), (o+36, 2, "D5"), (o+38, 2, "C5"),
        (o+40, 2, "B4"), (o+42, 1, "C5"), (o+43, 1, "B4"), (o+44, 4, "A4"),
        (o+48, 2, "F5"), (o+50, 2, "E5"), (o+52, 2, "D5"), (o+54, 2, "C5"),
        (o+56, 2, "B4"), (o+58, 2, "G#4"), (o+60, 4, "A4"),
        (o+64, 1, "A5"), (o+65, 1, "G#5"), (o+66, 1, "A5"), (o+67, 1, "G#5"), (o+68, 2, "F5"), (o+70, 2, "E5"),
        (o+72, 1, "F5"), (o+73, 1, "E5"), (o+74, 1, "D5"), (o+75, 1, "C5"), (o+76, 4, "D5"),
        (o+80, 1, "G#5"), (o+81, 1, "F5"), (o+82, 1, "E5"), (o+83, 1, "D5"), (o+84, 2, "C5"), (o+86, 2, "B4"),
        (o+88, 1, "C5"), (o+89, 1, "B4"), (o+90, 1, "A4"), (o+91, 1, "G#4"), (o+92, 4, "A4"),
        (o+96, 1, "A4"), (o+97, 1, "B4"), (o+98, 1, "C5"), (o+99, 1, "D5"), (o+100, 1, "E5"), (o+101, 1, "F5"), (o+102, 2, "G#5"),
        (o+104, 2, "A5"), (o+106, 2, "E5"), (o+108, 2, "C5"), (o+110, 2, "A4"),
        (o+112, 2, "D5"), (o+114, 2, "C5"), (o+116, 2, "B4"), (o+118, 2, "G#4"),
        (o+120, 4, "A4"), (o+124, 4, "E5"),
    ]
    bass_b, harm_b, drums = [], [], []
    for b in range(8):
        s = o + b * 16
        r = "A2" if b in (0, 2, 4, 7) else ("E2" if b in (1, 3, 6) else "D2")
        q = "E3" if r == "A2" else ("B2" if r == "E2" else "A2")
        bass_b.extend([(s+0, 4, r), (s+4, 4, q), (s+8, 4, r), (s+12, 4, q)])
        ch = ["A3", "C4", "E4"] if r == "A2" else (["G#3", "B3", "E4"] if r == "E2" else ["D3", "F3", "A3"])
        for st in (2, 6, 10, 14):
            harm_b.append((s + st, 2, ch))
    for bar in range(16):
        s = bar * 16
        if bar < 8:
            drums.extend([(s+0, "kick"), (s+4, "snare"), (s+8, "kick"), (s+12, "snare")])
        else:
            drums.extend([(s+0, "kick"), (s+2, "hat"), (s+4, "snare"), (s+6, "hat"), (s+8, "kick"), (s+10, "hat"), (s+12, "snare"), (s+14, "hat")])

    if mode == "8bit":
        synth_melody_8bit(ch1, mel_a + mel_b, step_sec, "square", amp=0.30, vibrato=0.005)
        synth_harmony_8bit(ch2, harm_a + harm_b, step_sec, "pulse25", amp=0.18)
        synth_bass_8bit(ch3, bass_a + bass_b, step_sec, amp=0.38)
        synth_drums_8bit(ch4, drums, step_sec, seed=505)
        write_mono_wav("bgm_greece.wav", [ch1, ch2, ch3, ch4], "8BIT")
    else:
        synth_fm_voice(ch1, mel_a, step_sec, "epiano_bell", amp=0.31)
        synth_fm_voice(ch1, mel_b, step_sec, "bouzouki", amp=0.32)
        synth_fm_harmony(ch2, harm_a + harm_b, step_sec, "chord_ep", amp=0.17)
        synth_fm_voice(ch3, bass_a + bass_b, step_sec, "slap_bass", amp=0.39)
        synth_drums_90s(ch4, drums, step_sec, seed=505)
        write_mono_wav("bgm_greece_fm90.wav", [ch1, ch2, ch3, ch4], "FM90")


if __name__ == "__main__":
    for engine in ("8bit", "fm90"):
        generate_turkish(engine)
        generate_india(engine)
        generate_argentina(engine)
        generate_cuba(engine)
        generate_greece(engine)
