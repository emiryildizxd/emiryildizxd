#!/usr/bin/env python3
"""Reel ses motoru: tamamen sentetik (telifsiz) müzik + ses efektleri.

Kullanım:  python3 audio.py out/01-yuzde-bir.cues.json out/01-yuzde-bir.wav

cues.json (reel dosyasındaki cues() fonksiyonundan gelir):
  { "duration": 23,
    "music": { "bpm": 140, "grid0": 2.2, "climax": 13.6, "punch": 15.0, "end": 20.2,
               "prog": "am", "drums": "full" | "light", "melody": true },
    "cues": [ { "t": 0.0, "type": "title" }, { "t": 3.1, "type": "tick", "p": 0.2 }, ... ] }
Sadece numpy gerekir.
"""
import json
import sys
import wave

import numpy as np

SR = 44100
R = np.random.default_rng(7)


# ------------------------------------------------------------------ yardımcılar
def T(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return R.uniform(-1, 1, int(dur * SR))


def _mag(f, lo=None, hi=None, order=2):
    m = np.ones_like(f)
    if lo:
        m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if hi:
        m *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return m


def filt(x, lo=None, hi=None, order=2):
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + 2048)))
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    return np.fft.irfft(X * _mag(f, lo, hi, order), N)[:n]


def sweep(x, f0, f1, kind="lp", bw=0.7, curve=1.0):
    """Zamanla kayan filtre (STFT): f0 -> f1 (üstel)."""
    n, hop = 1024, 256
    win = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(n) / n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    out = np.zeros_like(pad)
    f = np.fft.rfftfreq(n, 1 / SR)
    frames = (len(pad) - n) // hop
    for i in range(frames):
        s = i * hop
        r = min(1.0, max(0.0, (s - n / 2) / max(1, len(x)))) ** curve
        fc = f0 * (f1 / f0) ** r
        X = np.fft.rfft(pad[s:s + n] * win)
        if kind == "lp":
            m = 1 / np.sqrt(1 + (f / fc) ** 4)
        else:
            m = np.exp(-((np.log2(np.maximum(f, 1) / fc)) / bw) ** 2)
        out[s:s + n] += np.fft.irfft(X * m, n)
    return out[n:n + len(x)] / 2.0


def env(dur, a=0.005, tau=0.2):
    t = T(dur)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / tau)


def osc_sweep(f_of_t):
    return np.sin(2 * np.pi * np.cumsum(f_of_t) / SR)


def saw(f, dur, phase=0.0):
    t = T(dur)
    return 2 * ((t * f + phase) % 1) - 1


def conv(x, ir):
    n = len(x) + len(ir)
    N = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]


def make_ir(decay=1.8, seed=0, bright=6000):
    r = np.random.default_rng(seed)
    t = T(decay)
    ir = r.uniform(-1, 1, len(t)) * np.exp(-t / (decay / 6.9))
    ir = filt(ir, 200, bright)
    ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


IR_L, IR_R = make_ir(seed=1), make_ir(seed=2)


def reverb(x, wet=0.3):
    return x * (1 - wet) + conv(x, IR_L) * wet, x * (1 - wet) + conv(x, IR_R) * wet


def nfreq(name):
    notes = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((notes[n] + (o - 4) * 12) / 12)


# ------------------------------------------------------------------ enstrümanlar
def kick(punch=1.0):
    t = T(0.55)
    f = 44 + 120 * np.exp(-t / 0.035)
    y = osc_sweep(f) * np.exp(-t / 0.28)
    click = filt(noise(0.55), 2500) * np.exp(-t / 0.004) * 0.5
    return np.tanh((y + click) * 1.8 * punch) * 0.9


def b808(freq, dur, glide_from=None):
    t = T(dur)
    f = freq * (1 + 0.5 * np.exp(-t / 0.025))
    if glide_from:
        f = f * 0 + glide_from + (freq - glide_from) * np.minimum(1, t / 0.12)
    y = osc_sweep(f)
    e = np.minimum(1, t / 0.004) * np.exp(-t / max(0.25, dur * 0.55))
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return filt(np.tanh(y * 2.6) * e, None, 1800) * 0.85


def clap():
    t = T(0.45)
    n = filt(noise(0.45), 900, 4500)
    e = np.zeros_like(t)
    for d in (0, 0.011, 0.022):
        e += np.where(t >= d, np.exp(-(t - d) / 0.006), 0)
    e += np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.12), 0) * 0.55
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.4
    return np.tanh((n * e + tone) * 1.4) * 0.7


def hat(open_=False):
    d = 0.35 if open_ else 0.08
    t = T(d)
    return filt(noise(d), 7500) * np.exp(-t / (0.11 if open_ else 0.018)) * 0.5


def cowbell(freq):
    t = T(0.35)
    sq = lambda f: np.sign(np.sin(2 * np.pi * f * t))
    y = (sq(freq) + sq(freq * 1.48)) * 0.5
    y = filt(y, freq * 0.8, 4200)
    return y * (np.minimum(1, t / 0.002) * (0.7 * np.exp(-t / 0.05) + 0.3 * np.exp(-t / 0.2))) * 0.55


def bell(freq, dur=2.2):
    t = T(dur)
    y = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t / 0.4)
         + 0.25 * np.sin(2 * np.pi * freq * 3.98 * t) * np.exp(-t / 0.2))
    return y * np.minimum(1, t / 0.003) * np.exp(-t / 0.7) * 0.45


def pad_chord(freqs, dur, cutoff=900):
    y = np.zeros(int(dur * SR))
    for f in freqs:
        for det in (-0.004, 0.0, 0.0045):
            y += saw(f * (1 + det), dur, R.uniform())
    y = filt(y / (len(freqs) * 3), 60, cutoff, order=3)
    t = T(dur)
    e = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.35)
    return y * e * 0.55


def boom(big=1.0):
    t = T(3.2)
    f = 30 + 45 * np.exp(-t / 0.25)
    sub = osc_sweep(f) * np.exp(-t / (0.9 * big))
    rumble = filt(noise(3.2), None, 180) * np.exp(-t / 0.7) * 1.4
    crack = filt(noise(3.2), 1200, 7000) * np.exp(-t / 0.05) * 0.6
    return np.tanh((sub * 1.2 + rumble + crack) * 1.6) * 0.95 * big


def whoosh(dur=0.7, up=True):
    n = noise(dur)
    y = sweep(n, 250 if up else 3500, 3500 if up else 250, "bp", bw=0.9)
    t = T(dur)
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** 2
    return y * e * 1.6


def riser(dur):
    n = noise(dur)
    y = sweep(n, 200, 9000, "lp", curve=1.6) * 0.9
    t = T(dur)
    f = 180 * (4 ** (t / dur) ** 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.18 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.1
    e = (t / dur) ** 2.2
    return (y + tone) * e


def reverse_swell(dur=1.2):
    t = T(dur)
    y = filt(noise(dur), 1200, 7000) * np.exp(-t / 0.3)
    return y[::-1] * 0.45


def tick(p=0.0):
    t = T(0.05)
    f = 1500 + 1300 * p
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) * 0.6


def blip(p=0.0):
    t = T(0.12)
    return np.sin(2 * np.pi * (700 + 500 * p) * t) * np.exp(-t / 0.025) * 0.5


def pop(f0=420, f1=900):
    t = T(0.12)
    f = f0 + (f1 - f0) * np.minimum(1, t / 0.05)
    return osc_sweep(f) * np.exp(-t / 0.04) * 0.6


def metal_hit(var=1.0, bright=1.0):
    t = T(0.7)
    partials = [(1120, 0.09), (2630, 0.06), (4180, 0.04), (5870, 0.03), (7300, 0.02)]
    var = var * R.uniform(0.94, 1.06)
    y = sum(np.sin(2 * np.pi * f * var * t + R.uniform(0, 6)) * np.exp(-t / d) * (0.9 ** i)
            for i, (f, d) in enumerate(partials)) * 0.35 * bright
    trans = filt(noise(0.7), 2500) * np.exp(-t / 0.006) * 0.9
    thud = np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.05) * 0.8
    stone = filt(noise(0.7), 300, 2500) * np.exp(-t / 0.03) * 0.5
    return np.tanh(y + trans + thud + stone)


def crumble(dur=1.8):
    y = np.zeros(int(dur * SR))
    r = np.random.default_rng(5)
    for _ in range(140):
        s = int((r.uniform() ** 2.2) * (dur - 0.1) * SR)
        g = filt(noise(0.06), 200, r.uniform(800, 4000)) * np.exp(-T(0.06) / 0.012) * r.uniform(0.2, 1)
        y[s:s + len(g)] += g
    t = T(dur)
    y += filt(noise(dur), None, 150) * np.exp(-t / 0.5) * 1.5
    return np.tanh(y) * 0.8


def shimmer(dur=2.4, base="A5", n=10, seed=3):
    y = np.zeros(int(dur * SR))
    r = np.random.default_rng(seed)
    scale = [0, 3, 7, 10, 12, 15, 19, 24]
    f0 = nfreq(base)
    for i in range(n):
        s = int((i / n) * dur * 0.55 * SR + r.uniform(0, 0.03) * SR)
        f = f0 * 2 ** (scale[r.integers(len(scale))] / 12)
        b = bell(f, 1.2) * r.uniform(0.25, 0.55)
        e = min(len(b), len(y) - s)
        if e > 0:
            y[s:s + e] += b[:e]
    return y


def thud(p=0.0):
    t = T(0.3)
    f = 95 + 40 * p
    y = osc_sweep(f * (1 + 0.6 * np.exp(-t / 0.02))) * np.exp(-t / 0.08)
    knock = filt(noise(0.3), 400, 2200) * np.exp(-t / 0.015) * 0.5
    return np.tanh((y + knock) * 1.5) * 0.7


def sad_tone(dur=1.6):
    t = T(dur)
    y = np.sin(2 * np.pi * 110 * t) + np.sin(2 * np.pi * 116.5 * t) + 0.5 * np.sin(2 * np.pi * 55 * t)
    return y * np.minimum(1, t / 0.08) * np.exp(-t / 0.7) * 0.25


def swipe():
    t = T(0.09)
    return filt(noise(0.09), 1500, 6000) * np.sin(np.pi * t / 0.09) ** 2 * 0.25


# ------------------------------------------------------------------ mikser
class Bus:
    def __init__(self, dur):
        self.L = np.zeros(int((dur + 4) * SR))
        self.R = np.zeros_like(self.L)

    def add(self, sig, t, gain=1.0, pan=0.0):
        s = int(t * SR)
        if s >= len(self.L) or s + len(sig) <= 0:
            return
        if s < 0:
            sig, s = sig[-s:], 0
        e = min(len(sig), len(self.L) - s)
        gl, gr = gain * np.sqrt(0.5 * (1 - pan)), gain * np.sqrt(0.5 * (1 + pan))
        self.L[s:s + e] += sig[:e] * gl * 1.414
        self.R[s:s + e] += sig[:e] * gr * 1.414

    def add_st(self, lr, t, gain=1.0):
        s = int(t * SR)
        e = min(len(lr[0]), len(self.L) - s)
        self.L[s:s + e] += lr[0][:e] * gain
        self.R[s:s + e] += lr[1][:e] * gain


PROGS = {
    "am": [["A2", "C3", "E3", "A3"], ["F2", "A2", "C3", "F3"], ["D2", "F2", "A2", "D3"], ["E2", "G#2", "B2", "E3"]],
    "dm": [["D2", "F2", "A2", "D3"], ["A#1", "D2", "F2", "A#2"], ["G2", "A#2", "D3", "G3"], ["A2", "C#3", "E3", "A3"]],
    "em": [["E2", "G2", "B2", "E3"], ["C2", "E2", "G2", "C3"], ["A2", "C3", "E3", "A3"], ["B2", "D#3", "F#3", "B3"]],
}
MELODY = [0, None, 3, None, 4, None, 3, 0, None, 0, 3, None, 7, None, 4, 3]  # pentatonik adımlar (16'lık)
PENTA = [0, 3, 5, 7, 10, 12, 15]


def music(m, dur):
    mus = Bus(dur)
    bpm, g0 = m["bpm"], m["grid0"]
    beat = 60 / bpm
    bar = beat * 4
    prog = PROGS[m.get("prog", "am")]
    climax, punch, end = m["climax"], m["punch"], m["end"]
    full = m.get("drums", "full") == "full"
    K, CL, HC, HO = kick(), clap(), hat(), hat(True)
    root = lambda ch: nfreq(ch[0][:-1] + "1") if nfreq(ch[0][:-1] + "1") > 40 else nfreq(ch[0][:-1] + "2")

    # 1) intro padi: 0 → g0
    i = 0
    tt = 0.0
    while tt < g0 - 0.05:
        d = min(bar, g0 - tt + 0.4)
        mus.add_st(reverb(pad_chord([nfreq(n) for n in prog[i % 4]], d, 700), 0.4), tt, 0.55)
        tt += bar
        i += 1
    mus.add(b808(root(prog[0]), g0 + 0.3) * 0.6, 0.0, 0.5)

    # 2) build: g0 → climax
    n_bars = int(np.ceil((climax - g0) / bar))
    mel_root = nfreq("A4") if m.get("prog", "am") == "am" else (nfreq("D5") if m.get("prog") == "dm" else nfreq("E5"))
    for b in range(n_bars):
        bs = g0 + b * bar
        ch = prog[b % 4]
        d = min(bar, climax - bs)
        if d <= 0:
            break
        mus.add_st(reverb(pad_chord([nfreq(n) for n in ch], d + 0.3, 900 + 120 * b), 0.35), bs, 0.5)
        rf = root(ch)
        last_bar = b == n_bars - 1
        for k, bt in enumerate([0, 0.75, 2.5]):
            ts = bs + bt * beat
            if ts < climax - 0.05:
                ln = [0.75, 1.75, 1.5][k] * beat
                mus.add(b808(rf * (2 if (k == 2 and b % 2) else 1), min(ln, climax - ts)), ts, 0.9)
        for bt in ([0, 2.5] if full else [0]):
            ts = bs + bt * beat
            if ts < climax - beat * 0.9:
                mus.add(K, ts, 0.95)
        if full and b >= 1:
            ts = bs + 2 * beat
            if ts < climax - 0.05:
                mus.add_st(reverb(CL, 0.25), ts, 0.6)
        if full:
            steps = 16 if b % 2 else 8
            for s in range(steps):
                ts = bs + s * (4 / steps) * beat
                if ts < climax - 0.05 and not (last_bar and s * (4 / steps) >= 3):
                    mus.add(HC, ts, 0.32 if s % 2 else 0.42, pan=0.35)
            if b % 2 == 1:  # 32'lik rulo
                for s in range(6):
                    ts = bs + 3 * beat + s * beat / 6
                    if ts < climax - 0.05:
                        mus.add(HC, ts, 0.18 + 0.05 * s, pan=-0.3)
            if b % 4 == 3:
                mus.add(HO, bs + 3.5 * beat, 0.3, pan=0.2)
        if m.get("melody", True) and b >= 2:
            for s, st in enumerate(MELODY):
                if st is None:
                    continue
                ts = bs + s * beat / 4
                if ts < climax - 0.05:
                    f = mel_root * 2 ** (PENTA[st % len(PENTA)] / 12) if st < 7 else mel_root * 2 ** (12 / 12)
                    mus.add_st(reverb(cowbell(f), 0.3), ts, 0.33)

    # 3) climax → punch: nefes (filtreli pad + uzun 808)
    gap = punch - climax
    if gap > 0.2:
        mus.add_st(reverb(pad_chord([nfreq(n) for n in prog[0]], gap + 0.5, 500), 0.5), climax, 0.45)
        mus.add(b808(root(prog[0]), gap + 0.3), climax + 0.05, 0.7)

    # 4) punch → end: karanlık, ağır, yarım-tempo
    tt, j = punch, 0
    while tt < end:
        ch = prog[[0, 2, 1, 3][j % 4]]
        d = min(bar, end - tt + 0.6)
        mus.add_st(reverb(pad_chord([nfreq(n) for n in ch], d, 650), 0.45), tt, 0.6)
        mus.add(b808(root(ch), min(bar * 0.95, end - tt + 0.3)), tt, 0.95)
        if j >= 1:
            mus.add(K, tt, 0.9)
            if full:
                mus.add_st(reverb(CL, 0.35), tt + 2 * beat, 0.45)
        for s in range(4):
            mus.add_st(reverb(bell(mel_root * 2 ** ([0, 3, 7, 3][s] / 12) / 2, 1.5), 0.5), tt + s * beat, 0.22)
        tt += bar
        j += 1

    # 5) son kart: kuyruk
    mus.add_st(reverb(pad_chord([nfreq(n) for n in prog[0]], dur - end + 1.0, 500), 0.6), end, 0.5)
    mus.add(b808(root(prog[0]) / 1, 2.5), end + 0.25, 0.6)
    return mus


def sfx(cues, dur):
    fx = Bus(dur)
    for c in cues:
        t, k, p = c["t"], c["type"], c.get("p", 0.0)
        if k == "title":
            fx.add_st(reverb(boom(0.8), 0.25), t, 0.9)
            fx.add(whoosh(0.5, False), t, 0.5)
        elif k == "ui":
            fx.add_st(reverb(blip(p), 0.3), t, 0.5)
        elif k == "whoosh":
            fx.add_st(reverb(whoosh(0.6), 0.3), t - 0.15, 0.55)
        elif k == "tick":
            fx.add(tick(p), t, 0.45, pan=(p - 0.5) * 0.4)
        elif k == "riser":
            fx.add_st(reverb(riser(c["d"]), 0.3), t, 0.7)
        elif k == "climax":
            fx.add_st(reverb(boom(1.0), 0.35), t, 1.0)
            fx.add_st(reverb(shimmer(2.6, "A5", 12), 0.6), t + 0.05, 0.55)
        elif k == "drop":  # final kararması: ters süpürme
            fx.add_st(reverb(reverse_swell(0.6), 0.3), t - 0.6, 0.3)
        elif k == "punch":
            fx.add_st(reverb(boom(1.1), 0.4), t, 1.0)
        elif k == "hit":
            fx.add_st(reverb(boom(0.6), 0.3), t, 0.75)
            fx.add(whoosh(0.35, False), t - 0.05, 0.3)
        elif k == "end":
            fx.add_st(reverb(reverse_swell(1.0), 0.4), t - 0.75, 0.3)
            fx.add_st(reverb(shimmer(2.0, "E6", 6, 9), 0.6), t + 0.25, 0.45)
            fx.add_st(reverb(pop(500, 1000), 0.4), t + 0.85, 0.5)
        elif k == "step":
            fx.add_st(reverb(thud(p), 0.2), t, 0.8)
            fx.add(tick(0.3 + p * 0.7) * 0.5, t, 0.4)
        elif k == "bubble":
            fx.add_st(reverb(pop(300, 520), 0.3), t, 0.35, )
        elif k == "door":
            fx.add_st(reverb(riser(1.2), 0.4), t - 0.9, 0.5)
            fx.add_st(reverb(shimmer(2.6, "A5", 12, 4), 0.6), t + 0.3, 0.6)
        elif k == "block":
            fx.add_st(reverb(thud(p), 0.15), t, 0.45 + 0.25 * p)
        elif k == "tag":
            fx.add_st(reverb(pop(600, 1200), 0.35), t, 0.45)
            fx.add_st(reverb(bell(nfreq("E6") * 2 ** (p * 7 / 12), 1.0), 0.5), t, 0.25)
        elif k == "swipe":
            fx.add(swipe(), t, 0.5, pan=-0.4)
        elif k == "clank":
            fx.add_st(reverb(metal_hit(0.9 + 0.2 * p, c.get("bright", 1.0)), 0.25), t, c.get("g", 0.6), )
        elif k == "quit":
            fx.add_st(reverb(metal_hit(0.7, 0.6), 0.3), t + 0.45, 0.55)
            fx.add(thud(0.0), t + 0.5, 0.6)
            fx.add_st(reverb(sad_tone(2.0), 0.5), t + 0.4, 0.7)
        elif k == "break":
            fx.add_st(reverb(boom(1.2), 0.4), t, 1.0)
            fx.add_st(reverb(crumble(1.8), 0.3), t, 0.8)
            fx.add_st(reverb(shimmer(3.0, "A5", 16, 6), 0.6), t + 0.1, 0.7)
    return fx


def master(mus, fx, dur, music_gain=0.5):
    n = int(dur * SR)
    L = mus.L[:n] * music_gain + fx.L[:n]
    Rr = mus.R[:n] * music_gain + fx.R[:n]
    st = np.stack([L, Rr])
    st = np.tanh(st / (np.max(np.abs(st)) + 1e-9) * 1.4) / np.tanh(1.4)  # yumuşak limiter
    fade = int(0.8 * SR)
    st[:, -fade:] *= np.linspace(1, 0, fade)
    st[:, :200] *= np.linspace(0, 1, 200)
    return (st * 0.93 * 32767).astype(np.int16)


def main(src, dst):
    spec = json.load(open(src))
    dur = spec["duration"]
    mus = music(spec["music"], dur)
    fx = sfx(spec["cues"], dur)
    pcm = master(mus, fx, dur, spec["music"].get("gain", 0.5))
    with wave.open(dst, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.T.copy().tobytes())
    print("ses:", dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
