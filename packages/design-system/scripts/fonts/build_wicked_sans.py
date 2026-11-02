#!/usr/bin/env python3
"""Wicked Sans (v3, operator pick 2026-11-02): the cut of Inter 4.1 that ships in fonts/wicked/.

Inter's variable font instanced at 400 and 600 with its optical-size axis kept (opsz 14-32); the
signature alternates frozen into the cmap (ss01 open digits, cv05 tailed l, cv08 serifed I, cv10, and
tabular figures by default on the digits only); the UI glyphs Inter lacks drawn from its own parts (check, times, and the
<= >= != +- marks); the six v2 brand icons carried at U+E000-U+E005; renamed "Wicked Sans" (Inter declares
no Reserved Font Name); subset to Latin-1, Latin Extended-A and the UI symbols; woff2 + ttf.
The result is a Modified Version under the SIL OFL 1.1: licenses/LICENSE-WickedSans.txt.
This is the fonts-v3 exploration build (direction A), trimmed to the one direction that shipped.

  uv run --with fonttools --with brotli --with skia-pathops python -I build_wicked_sans.py \
      <Inter[opsz,wght].ttf> <icons.ttf> <out-dir>

<Inter[opsz,wght].ttf>: google/fonts ofl/inter (Inter 4.1), with its OFL.txt beside it. <icons.ttf>: Wicked Sans v2 Regular, the
source of the six brand icons (no longer in the tree: `git show 0600118:packages/design-system/source/
wicked-fonts/WickedSans-Regular.ttf`). Writes WickedSansA-{Regular,SemiBold}.{ttf,woff2} to <out-dir>.
"""
import sys, pathlib, json, copy, io
from fontTools.ttLib import TTFont, newTable
from fontTools.varLib import instancer
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import pathops

INTER = pathlib.Path(sys.argv[1]); ICONS = pathlib.Path(sys.argv[2]); OUT = pathlib.Path(sys.argv[3])

DIRS = {
    "A": dict(label="Inter cut", keep={"opsz": (14, 32)}, pin={},
              freeze=["tnum", "ss01", "cv05", "cv08", "cv10"], upstream="Inter 4.1 (rsms/inter)",
              # tabular figures by default, the digits only: Inter's tnum also maps the hyphen (to a 0.65 em
              # figure-width dash, so "re-derives" reads "re - derives"), the space and punctuation.
              tnum_chars="0123456789"),
}
WEIGHTS = {400: "Regular", 600: "SemiBold"}
UNICODES = ([*range(0x20, 0x7F), *range(0xA0, 0x180), 0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, *range(0x2000, 0x2070),
             0x20AC, 0x2122, *range(0x2190, 0x219A), 0x2212, 0x2260, 0x2264, 0x2265, 0x00B1, 0x2713, 0x2715, 0x2026,
             0x2022, 0x25CF, 0x2318, 0x21B5, 0x2325, 0x21E7, 0x2715, *range(0xE000, 0xE006)])


def single_maps(font, tag, only_chars=None):
    """{glyph: alternate} for a GSUB feature's single (type 1) and alternate (type 3, first alt) lookups."""
    gsub = font["GSUB"].table; m = {}
    for fr in gsub.FeatureList.FeatureRecord:
        if fr.FeatureTag != tag:
            continue
        for li in fr.Feature.LookupListIndex:
            lk = gsub.LookupList.Lookup[li]
            for st in lk.SubTable:
                t = lk.LookupType
                if t == 7:
                    t = st.ExtensionLookupType; st = st.ExtSubTable
                if t == 1:
                    m.update(st.mapping)
                elif t == 3:
                    m.update({k: v[0] for k, v in st.alternates.items()})
    if only_chars:
        cmap = font.getBestCmap(); keep = {cmap[ord(c)] for c in only_chars.split() if ord(c) in cmap} if all(len(c) == 1 for c in only_chars.split()) else None
        names = set()
        for c in only_chars.split():
            if len(c) == 1:
                names.add(cmap.get(ord(c)))
            else:
                names.add(c)
        m = {k: v for k, v in m.items() if k in names}
    return m


def freeze(font, feats, tnum_chars=None):
    """Freeze features into the cmap. Order: stylistic alternates on the base glyph first, then tnum on the result
    (only on tnum_chars when given: Inter's tnum also makes the hyphen, space and punctuation tabular);
    if tnum has no form for an alternate (Geist one.ss09, Onest alt_1), the alternate is re-centred into the
    tabular advance by tabularize()."""
    cmap_tables = [t for t in font["cmap"].tables if t.isUnicode()]
    orig = dict(font.getBestCmap())
    maps = [(f if isinstance(f, tuple) else (f, None)) for f in feats]
    tn = single_maps(font, "tnum") if any(t == "tnum" for t, _ in maps) else {}
    styl = [single_maps(font, t, o) for t, o in maps if t != "tnum"]
    changed, need_tab = 0, set()
    for t in cmap_tables:
        for u, g in list(t.cmap.items()):
            h = g
            for m in styl:
                h = m.get(h, h)
            if tn and (tnum_chars is None or chr(u) in tnum_chars):
                if h in tn:
                    h = tn[h]
                elif g in tn and h != g:
                    # alternate without a tabular twin: try the tabular base's own alternate first (Inter four.tf.ss01)
                    alt = h
                    for m in styl:
                        alt = m.get(tn[g], alt) if tn[g] in m else alt
                    if alt != h and alt in font.getGlyphOrder():
                        h = alt
                    else:
                        need_tab.add((h, font["hmtx"][tn[g]][0]))
                elif g in tn:
                    h = tn[g]
            if h != g:
                t.cmap[u] = h; changed += 1
    for name, adv in need_tab:
        tabularize(font, name, adv)
    base_remap = {}
    best = font.getBestCmap()
    for ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
        h = best.get(ord(ch)); g0 = orig.get(ord(ch))
        if h and g0 and h != g0:
            base_remap[g0] = h
    propagate(font, base_remap)
    return changed


def top_centre(font, name):
    gs = font.getGlyphSet(); p = pathops.Path(); gs[name].draw(p.getPen(glyphSet=gs))
    thr = (font["OS/2"].sCapHeight or 700) * 0.75
    q = pathops.Path(); q.moveTo(-5000, thr); q.lineTo(5000, thr); q.lineTo(5000, 5000); q.lineTo(-5000, 5000); q.close()
    b = pathops.op(p, q, pathops.PathOp.INTERSECTION).bounds
    return (b[0] + b[2]) / 2


def propagate(font, remap):
    """Accented letters are composites of the old base: point them at the frozen alternate, re-centre the
    accents on its advance and widen the composite by the same amount (Onest I_alt is 300 units wider than I)."""
    glyf, hmtx = font["glyf"], font["hmtx"]; done = 0
    for gname in font.getGlyphOrder():
        g = glyf[gname]
        if not g.isComposite() or gname in remap.values():
            continue
        comps = [c for c in g.components if c.glyphName in remap]
        if not comps:
            continue
        for c in comps:
            old, new = c.glyphName, remap[c.glyphName]
            delta = hmtx[new][0] - hmtx[old][0]
            shift = top_centre(font, new) - top_centre(font, old)   # accents follow the top of the letter (I_alt's bar, l_alt's stem)
            c.glyphName = new
            for o in g.components:
                if o is not c:
                    o.x += round(shift)
            adv, lsb = hmtx[gname]; hmtx[gname] = (adv + delta, lsb)
        g.recalcBounds(glyf); hmtx[gname] = (hmtx[gname][0], int(getattr(g, "xMin", 0))); done += 1
    return done


def tabularize(font, name, adv):
    old, lsb = font["hmtx"][name]
    if old == adv:
        return
    dx = (adv - old) / 2.0
    g = font["glyf"][name]
    if g.isComposite():
        for c in g.components:
            c.x += round(dx)
    elif g.numberOfContours > 0:
        g.coordinates.translate((round(dx), 0))
    g.recalcBounds(font["glyf"])
    font["hmtx"][name] = (adv, int(getattr(g, "xMin", 0)))
    if "gvar" in font:
        pass  # only static faces (B, D) hit this path


def stem_widths(font):
    gs = font.getGlyphSet(); cmap = font.getBestCmap()
    def bw(ch):
        bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp); return bp.bounds
    eq = bw("=")  # '=' : two bars; bar thickness ~ (height - gap)/2, estimate from '-' instead
    hy = bw("-"); l = bw("|"); lt = bw("<")   # '|' is a plain stem in every source; 'l' may be a frozen tailed alternate
    return dict(h=hy[3] - hy[1], v=l[2] - l[0], math_y=(hy[1] + hy[3]) / 2, lt=lt, eq=eq)


def draw_glyph(font, name, paths, adv):
    """Add a simple glyph from pathops paths (font units, y-up) with advance adv."""
    p = pathops.Path(); pen = p.getPen()
    for q in paths:
        q.convertConicsToQuads(); q.draw(pen)
    p.simplify(fix_winding=True); p.convertConicsToQuads()
    tt = TTGlyphPen(None); p.draw(Cu2QuPen(tt, 1.0, reverse_direction=True))
    g = tt.glyph(); font["glyf"][name] = g
    g.recalcBounds(font["glyf"])
    font["hmtx"][name] = (int(round(adv)), int(getattr(g, "xMin", 0)))
    order = list(dict.fromkeys(font.getGlyphOrder() + [name]))
    font.setGlyphOrder(order); font["glyf"].glyphOrder = order
    if hasattr(font, "_reverseGlyphOrderDict"):
        del font._reverseGlyphOrderDict
    font["maxp"].numGlyphs = len(order)
    if "gvar" in font:   # a kept axis (Inter's opsz): new glyphs do not vary; advances then come from gvar phantoms
        font["gvar"].variations.setdefault(name, [])
        if "HVAR" in font:
            del font["HVAR"]


def line(pts, w, cap=pathops.LineCap.BUTT_CAP, join=pathops.LineJoin.MITER_JOIN):
    p = pathops.Path(); p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.stroke(w, cap, join, 4); p.convertConicsToQuads(); return p


def glyph_path(font, ch, m=(1, 0, 0, 1, 0, 0)):
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); p = pathops.Path()
    gs[cmap[ord(ch)]].draw(TransformPen(p.getPen(glyphSet=gs), m)); return p


def add_missing(font, redraw=""):
    """Draw the UI glyphs a source lacks from the source's own parts: '<' '>' '=' '+' and a bar the
    thickness of the '=' bars; the check mark is two strokes at the vertical stem weight."""
    cmap = font.getBestCmap(); s = stem_widths(font); added = []
    vw = s["v"]
    eqc = sorted(glyph_path(font, "=").contours, key=lambda c: c.bounds[1])
    t = eqc[0].bounds[3] - eqc[0].bounds[1]                      # bar thickness
    lt = s["lt"]; H = lt[3] - lt[1]; axis = (lt[1] + lt[3]) / 2
    adv_math = font["hmtx"][cmap[ord("<")]][0]
    def put(cp, name, paths, adv):
        draw_glyph(font, name, paths, adv)
        for tb in font["cmap"].tables:
            if tb.isUnicode():
                tb.cmap[cp] = name
        added.append(chr(cp))
    def bar(x0, x1, y0):
        q = pathops.Path(); q.moveTo(x0, y0); q.lineTo(x1, y0); q.lineTo(x1, y0 + t); q.lineTo(x0, y0 + t); q.close(); return q
    if 0xB5 not in cmap:
        gs = font.getGlyphSet(); u = glyph_path(font, "u"); ub = u.bounds
        desc = font["OS/2"].sTypoDescender * 0.92
        stem = pathops.Path(); x0 = ub[0]; x1 = ub[0] + vw
        stem.moveTo(x0, desc); stem.lineTo(x1, desc); stem.lineTo(x1, ub[3] * 0.5); stem.lineTo(x0, ub[3] * 0.5); stem.close()
        put(0xB5, "mu", [u, stem], font["hmtx"][cmap[ord("u")]][0])
    if 0x2715 not in cmap:   # multiplication x as a UI close mark: two strokes at the stem weight, x-height box
        cap = font["OS/2"].sCapHeight or 700; hh = cap * 0.34; my = s["math_y"]; a = hh * 2 + vw * 3.2; m = (a - 2 * hh) / 2
        put(0x2715, "uni2715", [line([(m, my - hh), (a - m, my + hh)], vw * 0.85), line([(m, my + hh), (a - m, my - hh)], vw * 0.85)], a)
    if 0x2713 not in cmap or "✓" in redraw:
        cap = font["OS/2"].sCapHeight or 700; a = cap * 0.95; h = cap * 0.84
        put(0x2713, "uni2713" if 0x2713 not in cmap else cmap[0x2713],
            [line([(a * 0.14, h * 0.50), (a * 0.40, h * 0.10), (a * 0.88, h)], vw * 0.9, cap=pathops.LineCap.ROUND_CAP, join=pathops.LineJoin.ROUND_JOIN)], a + vw * 0.6)
    sc = 0.80; g = t * 1.25; total = sc * H + g + t; bottom = axis - total / 2
    for cp, ch, name in ((0x2264, "<", "lessequal"), (0x2265, ">", "greaterequal")):
        if cp in cmap:
            continue
        chev = glyph_path(font, ch, (1, 0, 0, sc, 0, bottom + t + g - sc * lt[1]))
        put(cp, name, [chev, bar(lt[0], lt[2], bottom)], adv_math)
    if 0x2260 not in cmap:
        eq = glyph_path(font, "="); b = eq.bounds; cx = (b[0] + b[2]) / 2; ext = (b[3] - b[1]) * 0.55
        sl = line([(cx - (b[2] - b[0]) * 0.16, b[1] - ext), (cx + (b[2] - b[0]) * 0.16, b[3] + ext)], t)
        put(0x2260, "notequal", [eq, sl], font["hmtx"][cmap[ord("=")]][0])
    if 0xB1 not in cmap:
        pl = glyph_path(font, "+"); b = pl.bounds; k = 0.84; cx = (b[0] + b[2]) / 2
        h = (b[3] - b[1]) * k; tot = h + g + t; bot = axis - tot / 2
        plus = glyph_path(font, "+", (k, 0, 0, k, cx - k * cx, bot + t + g - k * b[1]))
        put(0xB1, "plusminus", [plus, bar(cx - (b[2] - b[0]) / 2, cx + (b[2] - b[0]) / 2, bot)], font["hmtx"][cmap[ord("+")]][0])
    return added




def carry_icons(font):
    """Copy the six v2 brand icons (PUA U+E000-E005) from Wicked Sans v2, scaled to this UPM."""
    v2 = TTFont(ICONS); vc = v2.getBestCmap(); gs = v2.getGlyphSet()
    k = font["head"].unitsPerEm / v2["head"].unitsPerEm
    for cp in range(0xE000, 0xE006):
        if cp not in vc:
            continue
        p = pathops.Path(); gs[vc[cp]].draw(TransformPen(p.getPen(), (k, 0, 0, k, 0, 0)))
        draw_glyph(font, f"uni{cp:04X}", [p], v2["hmtx"][vc[cp]][0] * k)
        for t in font["cmap"].tables:
            if t.isUnicode():
                t.cmap[cp] = f"uni{cp:04X}"




def rename(font, did, D, weight):
    style = WEIGHTS[weight]; fam = "Wicked Sans"; ps = f"WickedSans{did}-{style}"
    n = font["name"]
    orig_cr = n.getDebugName(0)
    keep = {0, 7, 8, 9, 11, 12, 13, 14}
    n.names = [r for r in n.names if r.nameID in keep or r.nameID >= 256]
    lic_line = INTER.parent.joinpath("OFL.txt").read_text().split("\n", 1)[0].strip()
    notices = []
    for c in [orig_cr, lic_line] + D.get("extra_cr", []):
        c = c.strip().rstrip(".")
        if c and c not in notices:
            notices.append(c)
    cr = ". ".join(notices) + f". Wicked Sans {did} modifications Copyright 2026 The Wicked Agile Project Authors."
    def s(i, v):
        n.setName(v, i, 3, 1, 0x409)
    s(0, cr)
    if style == "Regular":
        s(1, fam); s(2, "Regular")
    else:
        s(1, f"{fam} {style}"); s(2, "Regular"); s(16, fam); s(17, style)
    s(3, f"1.000;WKAG;{ps};fonts-v3 direction {did}")
    s(4, f"{fam} {style}"); s(5, f"Version 1.000; fonts-v3 exploration, derived from {D['upstream']}")
    s(6, ps)
    s(13, "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org")
    s(14, "https://openfontlicense.org")
    if "fvar" in font:  # keep axis/instance name references valid
        for a in font["fvar"].axes:
            pass
    font["OS/2"].usWeightClass = weight
    font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0b1100001) | (0b1000000 if style == "Regular" else 0)
    font["head"].macStyle = 0
    if "CFF " in font:
        raise SystemExit("CFF not handled")


def build(did, D):
    res = {}
    for weight in WEIGHTS:
        f = TTFont(INTER)
        limits = dict(D["pin"]); limits["wght"] = weight
        for ax, rng in D["keep"].items():
            limits[ax] = rng
        f = instancer.instantiateVariableFont(f, limits, updateFontNames=False)
        buf = io.BytesIO(); f.save(buf); buf.seek(0); f = TTFont(buf, lazy=False)
        if "gvar" in f:
            f["gvar"].variations = {k: f["gvar"].variations[k] for k in f.getGlyphOrder()}
        n_frozen = freeze(f, D["freeze"], D.get("tnum_chars"))
        added = add_missing(f, D.get('redraw', ''))
        carry_icons(f)
        rename(f, did, D, weight)
        # subset: keep the layout features people use in UI (kern, tnum/pnum, case, frac, zero, the unused ss/cv)
        opts = subset.Options(); opts.layout_features = ["*"]; opts.name_IDs = ["*"]; opts.name_languages = ["*"]
        opts.notdef_outline = True; opts.glyph_names = False; opts.hinting = False; opts.drop_tables += ["DSIG"]
        ss = subset.Subsetter(opts); ss.populate(unicodes=UNICODES); ss.subset(f)
        d = OUT; d.mkdir(parents=True, exist_ok=True)
        base = f"WickedSans{did}-{WEIGHTS[weight]}"
        f.flavor = None; f.save(d / f"{base}.ttf")
        f.flavor = "woff2"; f.save(d / f"{base}.woff2")
        res[weight] = dict(frozen=n_frozen, added="".join(added), woff2=(d / f"{base}.woff2").stat().st_size)
    return res


if __name__ == "__main__":
    print("A", DIRS["A"]["label"], json.dumps(build("A", DIRS["A"])), flush=True)
