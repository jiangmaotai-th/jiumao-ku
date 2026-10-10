#!/usr/bin/env python3
"""Rebuild the arena fonts as subsets covering every in-game string (12 locales) + model names.
  public/fonts/arena-pixel.woff2     Fusion Pixel Font 12px (OFL-1.1): Latin, CJK, kana, Hangul, Cyrillic
  public/fonts/arena-fallback.woff2  Noto Sans Thai + Noto Sans Devanagari, Bold instance (OFL-1.1): th / hi
Needs: pip install fonttools brotli
Usage: python3 scripts/subset-arena-font.py FUSION_zh_hans.ttf [NotoSansThai[wdth,wght].ttf NotoSansDevanagari[wdth,wght].ttf]
Sources: https://github.com/TakWolf/fusion-pixel-font/releases · https://github.com/google/fonts (ofl/notosansthai, ofl/notosansdevanagari)"""
import subprocess, sys, tempfile, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import merge as _merge  # noqa: F401
src = sys.argv[1]
files = ['src/i18n/arena.ts', 'src/i18n/arena-v5.ts', 'src/i18n/arena-extra.ts', 'src/arena/engine.ts', 'src/arena/widget.ts', 'public/arena-data/latest.json', 'public/arena-data/index.json']
txt = ''.join(open(f, encoding='utf-8').read() for f in files if os.path.exists(f))
chars = {c for c in txt if ord(c) >= 0x20} | {chr(i) for i in range(0x20, 0x7f)}
def subset(font, text, out):
    with tempfile.NamedTemporaryFile('w', delete=False, encoding='utf-8') as f:
        f.write(''.join(sorted(text)))
    subprocess.run(['pyftsubset', font, f'--text-file={f.name}', '--flavor=woff2', '--layout-features=*', f'--output-file={out}'], check=True)
subset(src, chars, 'public/fonts/arena-pixel.woff2')
if len(sys.argv) >= 4:
    parts = []
    for path, lo, hi in [(sys.argv[2], 0x0E00, 0x0E7F), (sys.argv[3], 0x0900, 0x097F)]:
        f = TTFont(path)
        inst = instancer.instantiateVariableFont(f, {'wght': 700, 'wdth': 100})
        tmp = tempfile.mktemp(suffix='.ttf'); inst.save(tmp)
        out = tempfile.mktemp(suffix='.woff2')
        subset(tmp, {c for c in chars if lo <= ord(c) <= hi} | {'\u200c', '\u200d', '\u25cc'}, out)
        parts.append((out, lo, hi))
    # two files, one CSS family via unicode-range
    os.replace(parts[0][0], 'public/fonts/arena-fallback-th.woff2')
    os.replace(parts[1][0], 'public/fonts/arena-fallback-hi.woff2')
