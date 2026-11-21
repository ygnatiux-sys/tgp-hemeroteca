"""
scripts/gen-arcade-voices-and-forks.py
Sintetizador 100% Python puro (wave, struct, math, random):
1. 11 voces robóticas/lo-fi estilo fichín de los 90 (banco de formantes F1/F2/F3 + fricativas/oclusivas + cuantización DAC 11kHz/8-bit + eco arcade).
2. 3 pistas BGM FM 90s libres de derechos (forks originales inspirados en Star Force, Commando y 1942).
"""

import math
import os
import random
import struct
import wave

SR = 44100
TWO_PI = 2.0 * math.pi
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "sounds")

# Tabla fonética: (voiced, noise, F1, F2, F3, noise_fc, dur_ms, gap_ms)
PHON = {
    "_":  (0.0, 0.0, 400, 1200, 2400, 2000, 55, 0),
    "AA": (1.0, 0.0, 730, 1090, 2440, 2000, 130, 0),
    "AE": (1.0, 0.0, 660, 1720, 2410, 2000, 125, 0),
    "AH": (1.0, 0.0, 560, 1220, 2390, 2000, 105, 0),
    "AO": (1.0, 0.0, 570, 840,  2410, 2000, 125, 0),
    "EH": (1.0, 0.0, 530, 1840, 2480, 2000, 115, 0),
    "ER": (1.0, 0.0, 490, 1350, 1690, 2000, 125, 0),
    "IH": (1.0, 0.0, 400, 1990, 2550, 2000, 95,  0),
    "IY": (1.0, 0.0, 290, 2290, 3010, 2000, 125, 0),
    "OW": (1.0, 0.0, 460, 820,  2380, 2000, 145, 0),
    "UW": (1.0, 0.0, 310, 870,  2240, 2000, 125, 0),
    "EY": (1.0, 0.0, 420, 2120, 2700, 2000, 140, 0),
    "AY": (1.0, 0.0, 680, 1480, 2500, 2000, 155, 0),
    "OY": (1.0, 0.0, 500, 1350, 2400, 2000, 165, 0),
    "AW": (1.0, 0.0, 650, 1050, 2400, 2000, 150, 0),
    "M":  (0.7, 0.0, 280, 920,  2200, 1500, 75, 0),
    "N":  (0.7, 0.0, 280, 1450, 2300, 1500, 70, 0),
    "R":  (0.8, 0.0, 420, 1280, 1620, 1800, 75, 0),
    "L":  (0.8, 0.0, 360, 1120, 2600, 1800, 75, 0),
    "W":  (0.8, 0.0, 310, 760,  2200, 1500, 80, 0),
    "Y":  (0.8, 0.0, 290, 2150, 2900, 2000, 75, 0),
    "V":  (0.6, 0.35, 320, 1150, 2200, 3200, 75, 0),
    "Z":  (0.6, 0.55, 320, 1450, 2400, 5000, 85, 0),
    "S":  (0.0, 0.95, 400, 1800, 2800, 5600, 95, 0),
    "SH": (0.0, 0.95, 400, 1800, 2600, 2700, 105, 0),
    "F":  (0.0, 0.80, 400, 1400, 2400, 4200, 85, 0),
    "H":  (0.0, 0.75, 550, 1400, 2400, 1600, 80, 0),
    "T":  (0.0, 1.0,  400, 1600, 2600, 4200, 32, 38),
    "K":  (0.0, 1.0,  450, 1800, 2400, 2200, 35, 42),
    "P":  (0.0, 0.9,  350, 1100, 2200, 1100, 30, 40),
    "G":  (0.4, 0.8,  320, 1500, 2300, 2000, 35, 35),
    "D":  (0.4, 0.8,  320, 1550, 2450, 3600, 32, 32),
    "B":  (0.4, 0.75, 300, 1050, 2200, 1000, 30, 32),
    "CH": (0.0, 1.0,  420, 1850, 2650, 3100, 55, 35),
}


def biquad_bandpass_coeffs(fc: float, bw: float, sr: int):
    fc = max(60.0, min(sr * 0.45, fc))
    q = max(1.2, fc / max(40.0, bw))
    w0 = TWO_PI * fc / sr
    alpha = math.sin(w0) / (2.0 * q)
    cos_w0 = math.cos(w0)
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * cos_w0
    a2 = 1.0 - alpha
    return b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0


def save_wav(filename: str, samples: list[float], target_peak: float = 0.90):
    os.makedirs(OUT_DIR, exist_ok=True)
    n = len(samples)
    edge = min(int(0.003 * SR), max(1, n // 12))
    peak = max((abs(s) for s in samples), default=1.0)
    scale = target_peak / peak if peak > 1e-6 else 1.0
    pcm = bytearray(n * 2)
    pack = struct.pack_into
    for i, s in enumerate(samples):
        if i < edge:
            s *= i / edge
        elif i >= n - edge:
            s *= (n - 1 - i) / edge
        val = int(round(s * scale * 32767.0))
        val = 32767 if val > 32767 else (-32767 if val < -32767 else val)
        pack("<h", pcm, i * 2, val)
    path = os.path.join(OUT_DIR, filename)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm)
    print(f"OK {filename}: {n} samples, {n / SR:.2f}s, {os.path.getsize(path)} bytes")


def synth_speech(
    phoneme_seq: list[str],
    base_pitch: float = 108.0,
    pitch_end: float = 86.0,
    speed: float = 1.0,
    robotic_ring_hz: float = 0.0,
    dac_rate: int = 11025,
    echo_ms: int = 95,
    echo_mix: float = 0.28,
    seed: int = 95,
) -> list[float]:
    """
    Sintetizador de voz por formantes F1/F2/F3 con transiciones suaves,
    cuantización lo-fi DAC (estilo OKI/YM2612 de los 90) y eco corto de cabina.
    """
    rng = random.Random(seed)
    sin = math.sin

    # Construir timeline con segmentos + silencio inicial/final
    seq = ["_"] + phoneme_seq + ["_"]
    segments = []
    total_samples = 0
    for code in seq:
        voiced, noise, f1, f2, f3, nfc, dur_ms, gap_ms = PHON[code]
        gap_n = int((gap_ms / 1000.0 / speed) * SR)
        dur_n = max(1, int((dur_ms / 1000.0 / speed) * SR))
        segments.append((code, voiced, noise, f1, f2, f3, nfc, gap_n, dur_n))
        total_samples += gap_n + dur_n

    out = [0.0] * total_samples
    # Estados de 4 filtros biquad (F1, F2, F3 + fricativa)
    s1 = [0.0, 0.0, 0.0, 0.0]
    s2 = [0.0, 0.0, 0.0, 0.0]
    s3 = [0.0, 0.0, 0.0, 0.0]
    sn = [0.0, 0.0, 0.0, 0.0]

    glottal_ph = 0.0
    ring_ph = 0.0
    pos = 0
    prev_f1, prev_f2, prev_f3 = 450.0, 1400.0, 2400.0

    for idx_seg, (code, voiced, noise, f1, f2, f3, nfc, gap_n, dur_n) in enumerate(segments):
        # Gap oclusivo
        for j in range(gap_n):
            if voiced > 0:
                glottal_ph = (glottal_ph + (base_pitch * 0.9) / SR) % 1.0
                out[pos] = (1.0 if glottal_ph < 0.25 else -0.3) * 0.08
            pos += 1

        c_n = biquad_bandpass_coeffs(nfc, nfc * 0.35, SR)
        for j in range(dur_n):
            global_u = pos / max(1, total_samples - 1)
            local_u = j / max(1, dur_n - 1)
            # Coarticulación suave en los primeros 35% del fonema
            blend = min(1.0, local_u / 0.35)
            cf1 = prev_f1 + (f1 - prev_f1) * blend
            cf2 = prev_f2 + (f2 - prev_f2) * blend
            cf3 = prev_f3 + (f3 - prev_f3) * blend

            if j % 32 == 0:
                c1 = biquad_bandpass_coeffs(cf1, 95.0, SR)
                c2 = biquad_bandpass_coeffs(cf2, 130.0, SR)
                c3 = biquad_bandpass_coeffs(cf3, 180.0, SR)

            pitch = base_pitch + (pitch_end - base_pitch) * global_u
            pitch *= 1.0 + 0.015 * sin(TWO_PI * 5.2 * (pos / SR))
            glottal_ph = (glottal_ph + pitch / SR) % 1.0
            # Pulso glotal rico en armónicos (saw + impulso)
            glottal = (2.0 * glottal_ph - 1.0) * 0.65 + (0.85 if glottal_ph < 0.14 else -0.15)
            w = rng.random() * 2.0 - 1.0

            def step_bq(x, c, st):
                y = c[0] * x + c[1] * st[0] + c[2] * st[1] - c[3] * st[2] - c[4] * st[3]
                st[1] = st[0]
                st[0] = x
                st[3] = st[2]
                st[2] = y
                return y

            v_sig = glottal * voiced
            y1 = step_bq(v_sig, c1, s1) * 1.4
            y2 = step_bq(v_sig, c2, s2) * 1.0
            y3 = step_bq(v_sig, c3, s3) * 0.55
            yn = step_bq(w * noise, c_n, sn) * 0.75

            env = 1.0
            if j < int(0.008 * SR):
                env = j / max(1, int(0.008 * SR))
            elif dur_n - j < int(0.010 * SR):
                env = max(0.0, (dur_n - j) / max(1, int(0.010 * SR)))

            sample = (y1 + y2 + y3 + yn) * env
            if robotic_ring_hz > 0:
                ring_ph = (ring_ph + robotic_ring_hz / SR) % 1.0
                sample *= 0.68 + 0.32 * sin(TWO_PI * ring_ph)

            out[pos] = sample
            pos += 1

        prev_f1, prev_f2, prev_f3 = f1, f2, f3

    # Cuantización Lo-Fi Arcade DAC (sample-and-hold a dac_rate + bitcrush 8-bit)
    hold_step = max(1, int(round(SR / dac_rate)))
    held = 0.0
    max_v = max((abs(x) for x in out), default=1.0) or 1.0
    for i in range(total_samples):
        if i % hold_step == 0:
            norm = out[i] / max_v
            # 7-bit / 8-bit quantized gritty arcade DAC
            held = round(norm * 64.0) / 64.0
        out[i] = held

    # Eco corto arcade (slapback)
    delay_n = int((echo_ms / 1000.0) * SR)
    tail_n = delay_n * 2
    res = out + [0.0] * tail_n
    for i in range(delay_n, len(res)):
        res[i] += res[i - delay_n] * echo_mix
    return res


def mix_pad(a: list[float], b: list[float], b_offset_samples: int = 0, a_gain=1.0, b_gain=1.0) -> list[float]:
    n = max(len(a), b_offset_samples + len(b))
    out = [0.0] * n
    for i, v in enumerate(a):
        out[i] += v * a_gain
    for i, v in enumerate(b):
        out[b_offset_samples + i] += v * b_gain
    return out


def make_fm_sfx_hit(freq_start: float, freq_end: float, dur_s: float, m_ratio=1.41, mod_idx=3.5, decay=5.0) -> list[float]:
    n = int(dur_s * SR)
    out = [0.0] * n
    c_ph, m_ph = 0.0, 0.0
    sin, exp = math.sin, math.exp
    for i in range(n):
        t = i / SR
        u = i / max(1, n - 1)
        f = freq_start + (freq_end - freq_start) * u
        c_ph += f / SR
        m_ph += (f * m_ratio) / SR
        out[i] = sin(TWO_PI * c_ph + mod_idx * exp(-t * decay) * sin(TWO_PI * m_ph)) * exp(-t * (decay * 0.7))
    return out


def build_11_voices():
    # 1. INSERT COIN + tintineo metálico de moneda
    v1 = synth_speech(["IH", "N", "S", "ER", "T", "_", "K", "OY", "N"], base_pitch=112, pitch_end=96, robotic_ring_hz=45, dac_rate=11025, seed=1)
    coin = [0.0] * int(0.18 * SR)
    ph = 0.0
    for i in range(len(coin)):
        t = i / SR
        f = 1318.5 if t < 0.055 else 1975.5
        ph += f / SR
        coin[i] = (1.0 if (ph % 1.0) < 0.5 else -1.0) * math.exp(-t * 14.0) * 0.45
    save_wav("voice_insert_coin.wav", mix_pad(coin, v1, int(0.14 * SR), 0.7, 1.0))

    # 2. GAME OVER + acorde FM sombrío descendente
    v2 = synth_speech(["G", "EY", "M", "_", "OW", "V", "ER"], base_pitch=108, pitch_end=68, speed=0.88, dac_rate=11025, echo_ms=150, echo_mix=0.38, seed=2)
    gloom = make_fm_sfx_hit(220.0, 73.4, 1.1, m_ratio=2.0, mod_idx=3.2, decay=2.8)
    save_wav("voice_game_over.wav", mix_pad(v2, gloom, 0, 1.0, 0.35))

    # 3. FINISH IT + golpe sub-grave torneo 90s
    v3 = synth_speech(["F", "IH", "N", "IH", "SH", "_", "IH", "T"], base_pitch=102, pitch_end=118, speed=1.08, robotic_ring_hz=38, dac_rate=11025, echo_ms=110, echo_mix=0.35, seed=3)
    boom = make_fm_sfx_hit(140.0, 42.0, 0.55, m_ratio=1.5, mod_idx=2.6, decay=6.0)
    save_wav("voice_finish_it.wav", mix_pad(v3, boom, 0, 1.0, 0.55))

    # 4. STAGE CLEAR + fanfarria FM corta
    v4 = synth_speech(["S", "T", "EY", "D", "ZH" if "ZH" in PHON else "SH", "_", "K", "L", "IY", "R"], base_pitch=122, pitch_end=138, speed=1.02, dac_rate=12000, echo_ms=110, seed=4)
    fanf = make_fm_sfx_hit(523.25, 1046.5, 0.45, m_ratio=2.0, mod_idx=2.8, decay=5.5)
    save_wav("voice_stage_clear.wav", mix_pad(fanf, v4, int(0.18 * SR), 0.38, 1.0))

    # 5. GET OVER HERE (MK-inspired grit + metal chain sweep)
    v5 = synth_speech(["G", "EH", "T", "_", "OW", "V", "ER", "_", "H", "IY", "R"], base_pitch=94, pitch_end=128, speed=1.12, robotic_ring_hz=62, dac_rate=10500, echo_ms=120, echo_mix=0.38, seed=5)
    chain = make_fm_sfx_hit(980.0, 2600.0, 0.32, m_ratio=2.73, mod_idx=4.8, decay=6.5)
    save_wav("voice_get_over_here.wav", mix_pad(v5, chain, 0, 1.0, 0.30))

    # 6. TEST YOUR MIGHT + gong FM ceremonial
    v6 = synth_speech(["T", "EH", "S", "T", "_", "Y", "AO", "R", "_", "M", "AY", "T"], base_pitch=96, pitch_end=84, speed=0.92, dac_rate=11025, echo_ms=140, echo_mix=0.35, seed=6)
    gong = make_fm_sfx_hit(146.8, 142.0, 1.25, m_ratio=1.414, mod_idx=5.2, decay=2.2)
    save_wav("voice_test_your_might.wav", mix_pad(gong, v6, int(0.08 * SR), 0.42, 1.0))

    # 7. ROUND ONE... FIGHT!
    v7a = synth_speech(["R", "AW", "N", "D", "_", "W", "AH", "N"], base_pitch=108, pitch_end=98, speed=1.0, dac_rate=11025, seed=7)
    v7b = synth_speech(["F", "AY", "T"], base_pitch=115, pitch_end=135, speed=1.1, robotic_ring_hz=40, dac_rate=11025, echo_ms=130, seed=70)
    save_wav("voice_round_one_fight.wav", mix_pad(v7a, v7b, len(v7a) + int(0.12 * SR), 1.0, 1.1))

    # 8. MISSION START (Estilo Commando radio militar)
    v8 = synth_speech(["M", "IH", "SH", "AH", "N", "_", "S", "T", "AA", "R", "T"], base_pitch=114, pitch_end=124, speed=1.05, dac_rate=9600, echo_ms=80, echo_mix=0.22, seed=8)
    # Radio squelch click al inicio y al final
    sq = [random.Random(88).uniform(-0.4, 0.4) * math.exp(-(i / SR) * 90) for i in range(int(0.03 * SR))]
    save_wav("voice_mission_start.wav", sq + v8 + sq)

    # 9. SCRAMBLE READY (Estilo 1942 radio cabina caza)
    v9 = synth_speech(["S", "K", "R", "AE", "M", "B", "AH", "L", "_", "R", "EH", "D", "IY"], base_pitch=125, pitch_end=132, speed=1.08, dac_rate=9000, echo_ms=70, echo_mix=0.20, seed=9)
    ping = make_fm_sfx_hit(1480.0, 1480.0, 0.14, m_ratio=1.0, mod_idx=0.2, decay=18.0)
    save_wav("voice_scramble_1942.wav", mix_pad(ping, v9, int(0.10 * SR), 0.55, 1.0))

    # 10. RISA MALÉFICA ("MUA-HA-HA-HA-HA")
    laugh_segs = []
    pitches = [(165, 145), (150, 128), (138, 114), (124, 98), (112, 82)]
    for idx, (p0, p1) in enumerate(pitches):
        seg = synth_speech(["M" if idx == 0 else "H", "AA"], base_pitch=p0, pitch_end=p1, speed=1.18, robotic_ring_hz=32, dac_rate=11025, echo_ms=110, echo_mix=0.35, seed=10 + idx)
        laugh_segs.extend(seg[:int(0.19 * SR)])
    # Eco cavernoso final
    del_n = int(0.14 * SR)
    laugh_out = laugh_segs + [0.0] * (del_n * 2)
    for i in range(del_n, len(laugh_out)):
        laugh_out[i] += laugh_out[i - del_n] * 0.36
    save_wav("voice_evil_laugh.wav", laugh_out)

    # 11. PYRAMID AWAKENS (Bonus TGP)
    v11 = synth_speech(["P", "IH", "R", "AH", "M", "IH", "D", "_", "AH", "W", "EY", "K", "AH", "N", "Z"], base_pitch=92, pitch_end=78, speed=0.90, dac_rate=12000, echo_ms=160, echo_mix=0.42, seed=11)
    chord = make_fm_sfx_hit(110.0, 110.0, 1.4, m_ratio=3.0, mod_idx=3.5, decay=2.0)
    save_wav("voice_pyramid_awakens.wav", mix_pad(v11, chord, 0, 1.0, 0.38))


# ─────────────────────────────────────────────────────────────────────────────
# 3 FORKS BGM ORIGINALES LIBRES DE DERECHOS (STAR FORCE, COMMANDO, 1942)
# ─────────────────────────────────────────────────────────────────────────────
def render_fm_track(filename: str, bpm: float, mel_ev, harm_ev, bass_ev, drum_ev, mel_patch="brass", harm_patch="chord_ep", total_steps=256):
    step_sec = (60.0 / bpm) / 4.0
    n = int(round(total_steps * step_sec * SR))
    ch1, ch2, ch3, ch4 = [0.0] * n, [0.0] * n, [0.0] * n, [0.0] * n
    sin, exp = math.sin, math.exp

    # Patches FM internos para los 3 forks
    patches = {
        "space_lead": (1.0, 3.0, 4.2, 1.1, 14.0, 4.5, 0.20, 0.005),
        "brass":      (1.0, 1.0, 4.4, 2.8, 3.5,  1.2, 0.30, 0.007),
        "epiano":     (1.0, 4.0, 3.4, 0.45, 14.0, 4.2, 0.05, 0.004),
        "slap":       (1.0, 2.0, 5.6, 0.9, 22.0, 4.2, 0.18, 0.0),
    }
    freqs = {
        "E2": 82.41, "G2": 98.00, "A2": 110.00, "B2": 123.47, "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61,
        "G3": 196.00, "A3": 220.00, "B3": 246.94, "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "F#4": 369.99,
        "G4": 392.00, "G#4": 415.30, "A4": 440.00, "B4": 493.88, "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46,
        "F#5": 739.99, "G5": 783.99, "A5": 880.00, "B5": 987.77, "C6": 1046.50, "D6": 1174.66, "E6": 1318.51,
    }

    def run_voice(buf, evs, p_name, amp):
        cr, mr, ia, isus, md, cd, fb, vib = patches[p_name]
        cp, mp, pm = 0.0, 0.0, 0.0
        for st, dur, note in evs:
            f = freqs.get(note, 0.0)
            if f <= 0:
                continue
            i0 = int(round(st * step_sec * SR))
            i1 = min(n, int(round((st + dur) * step_sec * SR)))
            act = max(1, int((i1 - i0) * 0.88))
            att = min(int(0.005 * SR), act // 4)
            rel = min(int(0.015 * SR), act // 3)
            for j in range(act):
                idx = i0 + j
                t = j / SR
                fi = f * (1.0 + vib * sin(TWO_PI * 6.0 * t)) if (vib > 0 and dur >= 3) else f
                cp += (fi * cr) / SR
                mp += (fi * mr) / SR
                m_out = sin(TWO_PI * mp + fb * pm)
                pm = m_out
                mi = isus + (ia - isus) * exp(-t * md)
                env = exp(-t * cd) * (j / att if j < att and att > 0 else (max(0.0, (act - j) / rel) if j > act - rel and rel > 0 else 1.0))
                buf[idx] += sin(TWO_PI * cp + mi * m_out) * env * amp

    run_voice(ch1, mel_ev, mel_patch, 0.33)
    run_voice(ch2, harm_ev, harm_patch, 0.21)
    run_voice(ch3, bass_ev, "slap", 0.39)

    rng = random.Random(1984)
    for st, kind in drum_ev:
        i0 = int(round(st * step_sec * SR))
        if kind == "kick":
            dur = int(0.09 * SR)
            ph = 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= n:
                    break
                t = j / SR
                ph += (185.0 * exp(-t * 45.0) + 46.0) / SR
                ch4[idx] += sin(TWO_PI * ph) * exp(-t * 24.0) * 0.55
        elif kind == "snare":
            dur = int(0.095 * SR)
            prev = 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= n:
                    break
                t = j / SR
                w = rng.random() * 2 - 1
                hp = w - 0.55 * prev
                prev = w
                ch4[idx] += (sin(TWO_PI * 210.0 * t) * 0.4 + hp * 0.6) * exp(-t * 30.0) * 0.42
        else:
            dur = int(0.03 * SR)
            prev = 0.0
            for j in range(dur):
                idx = i0 + j
                if idx >= n:
                    break
                t = j / SR
                w = rng.random() * 2 - 1
                hp = w - 0.85 * prev
                prev = w
                ch4[idx] += hp * exp(-t * 110.0) * 0.16

    edge = int(0.002 * SR)
    mixed = [0.0] * n
    for i in range(n):
        s = ch1[i] + ch2[i] + ch3[i] + ch4[i]
        if i < edge:
            s *= i / edge
        elif i >= n - edge:
            s *= (n - 1 - i) / edge
        mixed[i] = s
    save_wav(filename, mixed, target_peak=0.88)


def build_3_arcade_forks():
    # 1. bgm_starforce_fork.wav (150 BPM · 18 bars 4/4 = 28.80s): Fork shooter espacial vertical
    mel_sf, harm_sf, bass_sf, drum_sf = [], [], [], []
    chords_sf = [("E2", ["E4", "G4", "B4"]), ("C3", ["E4", "G4", "C5"]), ("D3", ["D4", "F#4", "A4"]), ("B2", ["D4", "F#4", "B4"])]
    lead_patterns = [
        [(0, 2, "E5"), (2, 2, "G5"), (4, 2, "B5"), (6, 2, "E6"), (8, 2, "D6"), (10, 2, "B5"), (12, 4, "G5")],
        [(0, 2, "C5"), (2, 2, "E5"), (4, 2, "G5"), (6, 2, "C6"), (8, 2, "B5"), (10, 2, "G5"), (12, 4, "E5")],
        [(0, 2, "D5"), (2, 2, "F#5"), (4, 2, "A5"), (6, 2, "D6"), (8, 2, "C6"), (10, 2, "A5"), (12, 4, "F#5")],
        [(0, 4, "B5"), (4, 2, "A5"), (6, 2, "F#5"), (8, 2, "G5"), (10, 2, "A5"), (12, 4, "B5")],
    ]
    for b in range(18):
        s = b * 16
        r, arp = chords_sf[b % 4]
        for st, d, nt in lead_patterns[b % 4]:
            mel_sf.append((s + st, d, nt))
        for st in range(0, 16, 2):
            harm_sf.append((s + st, 2, arp[(st // 2) % 3]))
            bass_sf.append((s + st, 2, r))
        drum_sf.extend([(s+0, "kick"), (s+2, "hat"), (s+4, "snare"), (s+6, "hat"), (s+8, "kick"), (s+10, "hat"), (s+12, "snare"), (s+14, "hat")])
    render_fm_track("bgm_starforce_fork.wav", 150.0, mel_sf, harm_sf, bass_sf, drum_sf, mel_patch="space_lead", harm_patch="epiano", total_steps=18*16)

    # 2. bgm_commando_fork.wav (135 BPM · 16 bars 4/4 = 28.44s): Fork acción militar marcial
    mel_cm, harm_cm, bass_cm, drum_cm = [], [], [], []
    prog_cm = [("A2", ["A4", "C5", "E5"]), ("A2", ["A4", "C5", "E5"]), ("F3", ["F4", "A4", "C5"]), ("G3", ["G4", "B4", "D5"])]
    lead_cm = [
        [(0, 3, "A5"), (3, 1, "A5"), (4, 2, "E5"), (6, 2, "C5"), (8, 3, "A4"), (11, 1, "C5"), (12, 4, "E5")],
        [(0, 2, "A5"), (2, 2, "G5"), (4, 2, "E5"), (6, 2, "D5"), (8, 4, "C5"), (12, 4, "E5")],
        [(0, 3, "F5"), (3, 1, "F5"), (4, 2, "C5"), (6, 2, "A4"), (8, 4, "F5"), (12, 4, "A5")],
        [(0, 2, "G5"), (2, 2, "F5"), (4, 2, "D5"), (6, 2, "B4"), (8, 4, "G5"), (12, 2, "E5"), (14, 2, "G#4")],
    ]
    for b in range(16):
        s = b * 16
        r, arp = prog_cm[b % 4]
        for st, d, nt in lead_cm[b % 4]:
            mel_cm.append((s + st, d, nt))
        for st in range(0, 16, 4):
            harm_cm.append((s + st, 3, arp[(st // 4) % 3]))
            bass_cm.extend([(s+st, 2, r), (s+st+2, 2, r)])
        # Redobles marciales continuos de caja militar
        drum_cm.extend([(s+0, "kick"), (s+4, "snare"), (s+6, "snare"), (s+8, "kick"), (s+12, "snare"), (s+14, "snare"), (s+15, "snare")])
    render_fm_track("bgm_commando_fork.wav", 135.0, mel_cm, harm_cm, bass_cm, drum_cm, mel_patch="brass", harm_patch="epiano", total_steps=16*16)

    # 3. bgm_1942_fork.wav (132 BPM · 16 bars 4/4 = 29.09s): Fork escuadrón aéreo heroico
    mel_42, harm_42, bass_42, drum_42 = [], [], [], []
    prog_42 = [("C3", ["C4", "E4", "G4"]), ("G3", ["G4", "B4", "D5"]), ("A2", ["A4", "C5", "E5"]), ("G3", ["G4", "B4", "D5"])]
    lead_42 = [
        [(0, 2, "C5"), (2, 2, "E5"), (4, 4, "G5"), (8, 2, "E5"), (10, 2, "G5"), (12, 4, "C6")],
        [(0, 2, "B5"), (2, 2, "G5"), (4, 4, "D5"), (8, 2, "G5"), (10, 2, "B5"), (12, 4, "D6")],
        [(0, 3, "C6"), (3, 1, "B5"), (4, 2, "A5"), (6, 2, "G5"), (8, 4, "E5"), (12, 4, "A5")],
        [(0, 2, "G5"), (2, 2, "F5"), (4, 2, "D5"), (6, 2, "B4"), (8, 4, "G5"), (12, 4, "G5")],
    ]
    for b in range(16):
        s = b * 16
        r, arp = prog_42[b % 4]
        for st, d, nt in lead_42[b % 4]:
            mel_42.append((s + st, d, nt))
        for st in range(0, 16, 4):
            harm_42.append((s + st, 2, arp[st // 4 % 3]))
            bass_42.extend([(s+st, 2, r), (s+st+2, 2, r)])
        drum_42.extend([(s+0, "kick"), (s+4, "snare"), (s+8, "kick"), (s+10, "kick"), (s+12, "snare"), (s+14, "hat")])
    render_fm_track("bgm_1942_fork.wav", 132.0, mel_42, harm_42, bass_42, drum_42, mel_patch="brass", harm_patch="space_lead", total_steps=16*16)


if __name__ == "__main__":
    build_11_voices()
    build_3_arcade_forks()
