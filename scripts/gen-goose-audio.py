#!/usr/bin/env python3
"""Night-market BGM + honk beds for 套大鹅. Safe to overwrite; drop AI wavs on top later."""
from __future__ import annotations

import math
import os
import random
import struct
import wave

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "goose")
SR = 44100
rng = random.Random(42)


def clamp(x, a=-1.0, b=1.0):
    return a if x < a else b if x > b else x


def write_wav(name, samples, ch=1):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    n = len(samples) if ch == 1 else len(samples[0])
    peak = 1e-9
    if ch == 1:
        peak = max(peak, max(abs(x) for x in samples))
    else:
        peak = max(peak, max(abs(x) for x in samples[0]), max(abs(x) for x in samples[1]))
    scale = 0.89 / peak
    with wave.open(path, "w") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        if ch == 1:
            for x in samples:
                frames += struct.pack("<h", int(clamp(x * scale) * 32767))
        else:
            L, R = samples
            for i in range(n):
                frames += struct.pack("<hh", int(clamp(L[i] * scale) * 32767), int(clamp(R[i] * scale) * 32767))
        w.writeframes(frames)
    print(f"{name:22} {n / SR:.2f}s  {os.path.getsize(path)} bytes")


def env_adsr(i, n, a=0.01, d=0.08, s=0.7, r=0.12):
    t = i / n
    if t < a:
        return t / max(a, 1e-6)
    if t < a + d:
        u = (t - a) / max(d, 1e-6)
        return 1 - u * (1 - s)
    if t > 1 - r:
        return s * (1 - (t - (1 - r)) / max(r, 1e-6))
    return s


def sine(f, i):
    return math.sin(2 * math.pi * f * i / SR)


def noise():
    return rng.random() * 2 - 1


def lowpass(seq, alpha=0.12):
    y = 0.0
    out = []
    for x in seq:
        y += alpha * (x - y)
        out.append(y)
    return out


def bandpass(seq, low=0.04, high=0.18):
    lp = lowpass(seq, high)
    lp2 = lowpass(lp, low)
    return [a - b for a, b in zip(lp, lp2)]


def pluck(freq, dur, amp=0.4, decay=3.2, bright=0.35):
    n = int(SR * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        e = math.exp(-decay * t)
        v = (
            sine(freq, i)
            + bright * 0.45 * sine(freq * 2, i)
            + bright * 0.18 * sine(freq * 3.01, i)
            + 0.08 * sine(freq * 4.2, i)
        )
        out[i] = amp * e * v * env_adsr(i, n, 0.004, 0.05, 0.55, 0.18)
    return out


def add_at(dst, src, at, gain=1.0):
    start = int(at * SR)
    for i, x in enumerate(src):
        j = start + i
        if 0 <= j < len(dst):
            dst[j] += x * gain


def crossfade_loop(seq, fade=0.08):
    n = int(fade * SR)
    if n <= 0 or n * 2 >= len(seq):
        return seq
    out = seq[:]
    for i in range(n):
        k = i / n
        a = seq[i]
        b = seq[-n + i]
        mixed = b * (1 - k) + a * k
        out[i] = mixed
        out[-n + i] = mixed
    return out


def stereo(mono, width=0.12):
    delay = int(0.012 * SR)
    L = mono[:]
    R = [0.0] * len(mono)
    for i, x in enumerate(mono):
        j = i - delay
        y = mono[j] if j >= 0 else 0.0
        R[i] = x * (1 - width) + y * width
        L[i] = x * (1 - width * 0.4)
    return L, R


NOTE = {
    "A2": 110.00, "C3": 130.81, "D3": 146.83, "E3": 164.81, "G3": 196.00,
    "A3": 220.00, "C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.00,
    "A4": 440.00, "C5": 523.25, "D5": 587.33, "E5": 659.26, "G5": 783.99, "A5": 880.00,
    "C6": 1046.50, "E6": 1318.51, "G6": 1567.98,
}


def woodblock(dur=0.09, amp=0.28):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        e = math.exp(-28 * t)
        out.append(amp * e * (sine(980, i) + 0.4 * sine(1460, i) + 0.15 * noise()))
    return out


def shaker(dur=0.07, amp=0.12):
    n = int(SR * dur)
    raw = [noise() * amp * math.exp(-18 * i / SR) for i in range(n)]
    return bandpass(raw, 0.16, 0.45)


def kick(dur=0.18, amp=0.22):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        f = 92 * math.exp(-14 * t) + 38
        e = math.exp(-9 * t)
        out.append(amp * e * math.sin(2 * math.pi * f * t))
    return out


def pad_tone(freq, n, amp=0.05):
    out = []
    for i in range(n):
        e = env_adsr(i, n, 0.08, 0.2, 0.7, 0.18)
        out.append(amp * e * (sine(freq, i) + 0.25 * sine(freq * 1.997, i)))
    return out


def make_bgm(boss=False):
    bpm = 100 if boss else 112
    beat = 60 / bpm
    bars = 8
    dur = bars * 4 * beat
    n = int(SR * dur)
    mix = [0.0] * n
    melody = (
        ["A4", "C5", "D5", "E5", "D5", "C5", "A4", None,
         "E4", "G4", "A4", "C5", "A4", "G4", "E4", None]
        if not boss else
        ["A3", "C4", None, "E4", "D4", None, "C4", "A3",
         "G3", "A3", None, "C4", "E4", "D4", "A3", None]
    )
    bass = ["A2", "A2", "E3", "A2", "C3", "C3", "G3", "E3"] * (2 if not boss else 2)

    for bi, note in enumerate(bass):
        add_at(mix, pluck(NOTE[note], beat * 1.6, amp=0.34 if boss else 0.28, decay=2.1, bright=0.12), bi * beat)

    for i, note in enumerate(melody * 2):
        if not note:
            continue
        t = i * beat
        add_at(mix, pluck(NOTE[note], beat * 0.92, amp=0.22 if boss else 0.32, decay=3.6, bright=0.42), t)
        if not boss and i % 4 == 0:
            add_at(mix, pluck(NOTE[note], beat * 0.4, amp=0.08, decay=6, bright=0.6), t + beat * 0.5)

    for b in range(bars * 4):
        t = b * beat
        if b % 2 == 0:
            add_at(mix, kick(0.16, 0.16 if boss else 0.2), t)
        add_at(mix, woodblock(0.08, 0.1 if boss else 0.16), t + beat * 0.5)
        if not boss and b % 2 == 1:
            add_at(mix, shaker(0.08, 0.09), t)
        if not boss and b % 8 == 4:
            add_at(mix, pluck(NOTE["E5"], 0.35, 0.12, 5.5, 0.7), t)

    pad = pad_tone(NOTE["A3"] if boss else NOTE["C4"], n, amp=0.045 if boss else 0.03)
    if boss:
        drone = pad_tone(NOTE["A2"], n, amp=0.07)
        mix = [a + b + c for a, b, c in zip(mix, pad, drone)]
    else:
        mix = [a + b for a, b in zip(mix, pad)]

    mix = crossfade_loop(lowpass(mix, 0.55 if boss else 0.7), 0.12)
    return stereo(mix, 0.18 if boss else 0.14)


def make_amb():
    n = int(SR * 8)
    raw = [noise() * 0.35 for _ in range(n)]
    crowd = lowpass(raw, 0.045)
    air = [0.04 * math.sin(2 * math.pi * 0.17 * i / SR) for i in range(n)]
    mix = [crowd[i] * (0.55 + 0.2 * air[i]) for i in range(n)]
    for k in range(6):
        t = 0.6 + k * 1.15 + rng.random() * 0.3
        add_at(mix, pluck(NOTE["E5"] if k % 2 == 0 else NOTE["C5"], 0.4, 0.05, 7, 0.8), t)
    mix = crossfade_loop(mix, 0.2)
    return stereo(mix, 0.22)


def saw(f, i):
    x = (f * i / SR) % 1.0
    return 2 * x - 1


def square(f, i):
    return 1.0 if saw(f, i) >= 0 else -1.0


def honk_call(f0, dur, amp=1.0):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        u = t / max(dur, 1e-6)
        f = f0 * (1.18 - 0.58 * (u ** 0.65))
        e = env_adsr(i, n, 0.018, 0.08, 0.72, 0.2)
        grit = 0.12 * noise() * e
        v = (
            0.62 * saw(f, i)
            + 0.28 * square(f * 0.5, i)
            + 0.35 * sine(f * 2.02, i)
            + 0.18 * sine(900 + 80 * math.sin(2 * math.pi * 14 * t), i)
            + grit
        )
        out.append(amp * e * v)
    # keep body; light high-cut only
    return lowpass(out, 0.42)


def wing_rustle(dur=0.55, amp=0.22):
    n = int(SR * dur)
    raw = [
        noise() * amp * (0.35 + 0.65 * abs(math.sin(2 * math.pi * 11 * i / SR))) * math.exp(-2.1 * i / SR)
        for i in range(n)
    ]
    return bandpass(raw, 0.1, 0.45)


def make_honk():
    return honk_call(520, 0.38, 1.05)


def make_honk_angry():
    n = int(SR * 0.82)
    mix = [0.0] * n
    add_at(mix, honk_call(560, 0.22, 1.1), 0.0)
    add_at(mix, honk_call(400, 0.34, 1.15), 0.2)
    add_at(mix, wing_rustle(0.62, 0.28), 0.03)
    return mix


def make_treasure():
    n = int(SR * 1.95)
    mix = [0.0] * n
    for i, note in enumerate(["C5", "E5", "G5", "C6"]):
        add_at(mix, pluck(NOTE[note], 0.55, 0.42, 3.6, 0.65), 0.02 + i * 0.09)
    add_at(mix, pluck(NOTE["C5"], 1.3, 0.22, 2.1, 0.25), 0.34)
    add_at(mix, pluck(NOTE["E5"], 1.3, 0.2, 2.2, 0.35), 0.36)
    add_at(mix, pluck(NOTE["G5"], 1.4, 0.2, 2.0, 0.45), 0.38)
    add_at(mix, pluck(NOTE["C6"], 1.5, 0.26, 2.4, 0.7), 0.40)
    add_at(mix, pluck(NOTE["E6"], 0.9, 0.16, 4.2, 0.8), 0.48)
    add_at(mix, shaker(0.28, 0.16), 0.08)
    add_at(mix, shaker(0.22, 0.12), 0.42)
    add_at(mix, pluck(NOTE["C4"], 1.2, 0.2, 2.0, 0.15), 0.0)
    return mix


def make_catch_sting():
    n = int(SR * 0.85)
    mix = [0.0] * n
    for i, note in enumerate(["E5", "G5", "A5", "C5"]):
        add_at(mix, pluck(NOTE[note], 0.45, 0.42, 4.2, 0.7), 0.05 + i * 0.07)
    add_at(mix, pluck(NOTE["E4"], 0.7, 0.2, 2.4, 0.2), 0.0)
    return mix


def make_miss_sting():
    n = int(SR * 0.62)
    mix = [0.0] * n
    for i, note in enumerate(["E4", "D4", "C4", "A3"]):
        add_at(mix, pluck(NOTE[note], 0.28, 0.34, 6.0, 0.25), i * 0.1)
    raw = [noise() * 0.08 * math.exp(-8 * i / SR) for i in range(n)]
    mix = [a + b for a, b in zip(mix, lowpass(raw, 0.08))]
    return mix


def main():
    L, R = make_bgm(False)
    write_wav("bgm-night-market.wav", (L, R), 2)
    L, R = make_bgm(True)
    write_wav("bgm-boss.wav", (L, R), 2)
    L, R = make_amb()
    write_wav("amb-market.wav", (L, R), 2)
    write_wav("sfx-honk.wav", make_honk())
    write_wav("sfx-honk-angry.wav", make_honk_angry())
    write_wav("sfx-catch-sting.wav", make_catch_sting())
    write_wav("sfx-treasure.wav", make_treasure())
    write_wav("sfx-miss-sting.wav", make_miss_sting())


if __name__ == "__main__":
    main()
