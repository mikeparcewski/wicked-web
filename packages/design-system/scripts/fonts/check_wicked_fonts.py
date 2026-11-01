#!/usr/bin/env python3
"""Checks the compiled Wicked Agile fonts.

For every face in the given folders (default: the package's fonts/wicked and
source/wicked-fonts):
  * every required character is in the cmap and has an outline that encloses some area
    (no contours, or contours flattened to a line, both fail);
  * each cmap glyph's outline is hashed with its left edge moved to x=0, so the same shape
    at a different side bearing still counts as the same; digits, a-z and A-Z must all be
    distinct, and any other required characters that share an outline are reported;
  * the ten digits share one advance width (tabular figures);
  * vertical metrics and the OS/2 weight class are printed.
And every stylesheet (*.css) in those folders declares each Wicked face exactly once, under its
family, with the CSS weight range in CSS_WEIGHTS (a face is named by its url() file, or by the
PostScript name of the woff2 inlined as base64).

  uv run --with fonttools --with brotli python -I scripts/fonts/check_wicked_fonts.py [folder ...]
Exit status 1 on any failure, or when a folder holds no font.
"""
import base64
import hashlib
import io
import re
import sys
from pathlib import Path

from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

REQUIRED = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    ".,:;'\"?!()[]/\\+=_%#@&*<>|~`-^{}$"
    "—–·→←…•✓×‘’“”€£"
)
MUST_BE_DISTINCT = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
EXTRA = "↑↓−°"
PUA = [0xE000 + i for i in range(6)]

# face -> (family, CSS font-weight). Wicked Sans splits at 500 so a 500 (--weight-label) gets
# SemiBold: with point weights 400 and 600, CSS matching sends 500 to the 400 face. Serif and
# Script have one face each, which claims every weight so a bold request is never faux-bolded.
CSS_WEIGHTS = {
    "WickedSans-Regular": ("Wicked Sans", "100 499"),
    "WickedSans-SemiBold": ("Wicked Sans", "500 900"),
    "WickedSerif-Regular": ("Wicked Serif", "100 900"),
    "WickedScript-Regular": ("Wicked Script", "100 900"),
}


def outline_hash(font, gname):
    """A hash of the glyph's shape, independent of its side bearing; None when it draws no ink."""
    gs = font.getGlyphSet()
    glyph = gs[gname]
    bounds = BoundsPen(gs)
    glyph.draw(bounds)
    area = AreaPen(gs)
    glyph.draw(area)
    if bounds.bounds is None or abs(area.value) < 1:
        return None
    pen = DecomposingRecordingPen(gs)
    glyph.draw(TransformPen(pen, (1, 0, 0, 1, -bounds.bounds[0], 0)))
    return hashlib.sha1(repr(pen.value).encode()).hexdigest()[:12]


def check(path):
    font = TTFont(path)
    cmap = font.getBestCmap()
    fails = []
    hashes = {}
    for ch in REQUIRED + EXTRA:
        cp = ord(ch)
        if cp not in cmap:
            fails.append(f"missing U+{cp:04X} {ch!r}")
            continue
        h = outline_hash(font, cmap[cp])
        if h is None:
            fails.append(f"empty outline (no area) U+{cp:04X} {ch!r}")
            continue
        hashes[ch] = h
    for cp in PUA:
        if cp not in cmap or outline_hash(font, cmap[cp]) is None:
            fails.append(f"missing icon U+{cp:04X}")

    by_hash = {}
    for ch, h in hashes.items():
        by_hash.setdefault(h, []).append(ch)
    shared = [chs for chs in by_hash.values() if len(chs) > 1]
    for chs in shared:
        if any(c in MUST_BE_DISTINCT for c in chs):
            fails.append(f"shared outline among letters/digits: {' '.join(chs)}")
    distinct_needed = [c for c in MUST_BE_DISTINCT if c in hashes]
    n_distinct = len({hashes[c] for c in distinct_needed})

    hmtx = font["hmtx"]
    digit_adv = {hmtx[cmap[ord(d)]][0] for d in "0123456789" if ord(d) in cmap}
    if len(digit_adv) != 1:
        fails.append(f"digits are not tabular: advances {sorted(digit_adv)}")

    os2, hhea = font["OS/2"], font["hhea"]
    name = font["name"].getDebugName(4)
    print(f"{path.name}: '{name}' weight={os2.usWeightClass} glyphs={len(font.getGlyphOrder())} "
          f"cmap={len(cmap)} hhea={hhea.ascent}/{hhea.descent}/{hhea.lineGap} "
          f"typo={os2.sTypoAscender}/{os2.sTypoDescender}/{os2.sTypoLineGap} "
          f"win={os2.usWinAscent}/{os2.usWinDescent} xH={os2.sxHeight} capH={os2.sCapHeight}")
    print(f"  required chars present: {len(hashes)}/{len(REQUIRED + EXTRA)}; "
          f"distinct outlines for 0-9 a-z A-Z: {n_distinct}/{len(distinct_needed)}; "
          f"digit advance: {sorted(digit_adv)}")
    for chs in shared:
        print(f"  note: identical outline shared by {' '.join(repr(c) for c in chs)}")
    for f in fails:
        print(f"  FAIL {f}")
    return not fails


def css_face_name(src):
    """The face a @font-face src points at: the url() file stem, or the inlined woff2's PostScript name."""
    m = re.search(r"url\('data:font/woff2;base64,([A-Za-z0-9+/=]+)'\)", src)
    if m:
        return TTFont(io.BytesIO(base64.b64decode(m.group(1))))["name"].getDebugName(6)
    m = re.search(r"url\('\./([^'/]+)\.woff2'\)", src)
    return m.group(1) if m else None


def check_css(path):
    fails = []
    seen = {}
    for block in re.findall(r"@font-face\s*\{(.*?)\}", path.read_text(encoding="utf-8"), re.S):
        # One declaration per line: a data: URL carries a ';' of its own.
        decl = dict(re.findall(r"^\s*([a-z-]+)\s*:\s*(.*?);\s*$", block, re.M))
        family = decl.get("font-family", "").strip().strip("'\"")
        weight = " ".join(decl.get("font-weight", "").split())
        face = css_face_name(decl.get("src", ""))
        seen[face] = seen.get(face, 0) + 1
        if face not in CSS_WEIGHTS:
            fails.append(f"unexpected @font-face for {face or decl.get('src', '')[:40]!r}")
            continue
        want_family, want_weight = CSS_WEIGHTS[face]
        if family != want_family:
            fails.append(f"{face}: font-family {family!r}, expected {want_family!r}")
        if weight != want_weight:
            fails.append(f"{face}: font-weight {weight!r}, expected {want_weight!r}")
    for face in CSS_WEIGHTS:
        if seen.get(face, 0) != 1:
            fails.append(f"{face}: declared {seen.get(face, 0)} times, expected once")
    print(f"{path.name}: {sum(seen.values())} @font-face rules, weights "
          + ", ".join(f"{f} {CSS_WEIGHTS[f][1]}" for f in CSS_WEIGHTS if seen.get(f)))
    for f in fails:
        print(f"  FAIL {f}")
    return not fails


PACKAGE = Path(__file__).resolve().parents[2]
DEFAULT_FOLDERS = [PACKAGE / "fonts" / "wicked", PACKAGE / "source" / "wicked-fonts"]


def main():
    folders = [Path(a) for a in sys.argv[1:]] or DEFAULT_FOLDERS
    files, sheets = [], []
    for folder in folders:
        found = sorted(folder.glob("*.ttf")) + sorted(folder.glob("*.otf")) + sorted(folder.glob("*.woff2"))
        if not found:
            print(f"no fonts in {folder}")
            return 1
        files += found
        sheets += sorted(folder.glob("*.css"))
    ok = all([check(p) for p in files] + [check_css(p) for p in sheets])
    print("ALL CHECKS PASSED" if ok else "CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
