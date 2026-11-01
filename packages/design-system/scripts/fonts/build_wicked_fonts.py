#!/usr/bin/env python3
"""
Wicked Agile 3-Font Suite Compiler (v2)
=======================================
Draws and compiles the three brand typefaces with fontTools, entirely in code:

  1. Wicked Sans   Regular (400) + SemiBold (600): chamfered nautical utility sans,
                   built for UI text: real lowercase, ten distinct tabular digits,
                   UI punctuation and symbols, Inter-like vertical metrics.
  2. Wicked Serif  Regular: high-contrast thorn & wave display serif (caps + small caps).
  3. Wicked Script Regular: 14-degree coastal brush display script (caps + small caps).

Serif and Script keep their v1 display letterforms; they share the v2 digit and
punctuation drawers (in their own stroke contrast), the v2 metrics and the v2 outputs.
The six brand icons live in the Private Use Area (U+E000-U+E005) of every face,
so @ # $ % ^ & are real characters.

Outputs (written to the current directory):
  <Face>.otf, <Face>.ttf, <Face>.woff2  per face
  wicked-agile-fonts.css            @font-face rules with the woff2 inlined as base64
  wicked-agile-fonts-selfhost.css   @font-face rules with url('./<Face>.woff2')

Run inside an empty output folder, then copy the outputs into the package
(see "Rebuilding the Wicked faces" in packages/design-system/README.md):
  uv run --with fonttools --with brotli python -I <package>/scripts/fonts/build_wicked_fonts.py

No network access. Every outline below is drawn by this script.
"""

import base64
import math
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
CAP_H = 700          # cap height and lining-figure height
X_H = 530            # x-height (0.53 em, close to Inter's 0.546)
ASC_H = 740          # lowercase ascender (b d f h k l)
DESC_D = -200        # lowercase descender (g j p q y)
AXIS = 300           # centre line of dashes, arrows and math signs

# Line metrics: 940 + 260 = 1.2 em content area (Inter is 1.21), no line gap,
# so CSS line-height 1.5 adds equal leading above and below.
HHEA_ASC = 940
HHEA_DESC = -260
LINE_GAP = 0

FONT_VERSION = 5.0
PUA_ICONS = {"@": 0xE000, "#": 0xE001, "$": 0xE002, "%": 0xE003, "^": 0xE004, "&": 0xE005}


# ============================================================================
# 1. V1 DISPLAY PRIMITIVES (Serif + Script letterforms and the brand icons)
# ============================================================================

def add_wicked_stem(pen, x, y_bot, y_top, stem=88, hair=28, serif=52, thorn=68, thorn_top=True, wave_bot=False):
    """Draws a vertical serif stem with a wicked top-left thorn spur and bracketed/wave base."""
    pen.moveTo((round(x - serif), round(y_bot)))
    if wave_bot:
        pen.lineTo((round(x + stem + serif + 24), round(y_bot)))
        pen.lineTo((round(x + stem + serif), round(y_bot + hair + 16)))
        pen.lineTo((round(x + stem), round(y_bot + hair)))
    else:
        pen.lineTo((round(x + stem + serif), round(y_bot)))
        pen.lineTo((round(x + stem + serif), round(y_bot + hair)))
        pen.lineTo((round(x + stem), round(y_bot + hair + 12)))

    pen.lineTo((round(x + stem), round(y_top - hair - 12)))
    pen.lineTo((round(x + stem + serif), round(y_top - hair)))
    pen.lineTo((round(x + stem + serif), round(y_top)))

    if thorn_top:
        pen.lineTo((round(x - thorn), round(y_top)))
        pen.lineTo((round(x), round(y_top - hair - 28)))
    else:
        pen.lineTo((round(x - serif), round(y_top)))
        pen.lineTo((round(x - serif), round(y_top - hair)))
        pen.lineTo((round(x), round(y_top - hair - 12)))

    pen.lineTo((round(x), round(y_bot + hair + 12)))
    pen.lineTo((round(x - serif), round(y_bot + hair)))
    pen.closePath()


def add_sans_stem(pen, x, y_bot, y_top, w=78):
    """Draws a vertical utility stem with a 45-degree chamfered top-left corner."""
    pen.moveTo((round(x), round(y_bot)))
    pen.lineTo((round(x + w), round(y_bot)))
    pen.lineTo((round(x + w), round(y_top)))
    pen.lineTo((round(x + 16), round(y_top)))
    pen.lineTo((round(x), round(y_top - 16)))
    pen.closePath()


def add_bar(pen, x1, x2, y, thick=28, wicked_cut=False):
    """Draws a horizontal bar or wave-sliced crossbar."""
    pen.moveTo((round(x1), round(y)))
    if wicked_cut:
        mid = (x1 + x2) / 2
        pen.lineTo((round(mid - 10), round(y + 16)))
        pen.lineTo((round(mid + 10), round(y - 10)))
    pen.lineTo((round(x2), round(y)))
    pen.lineTo((round(x2), round(y + thick)))
    if wicked_cut:
        mid = (x1 + x2) / 2
        pen.lineTo((round(mid + 10), round(y + thick - 10)))
        pen.lineTo((round(mid - 10), round(y + thick + 16)))
    pen.lineTo((round(x1), round(y + thick)))
    pen.closePath()


def add_diag(pen, x1, y1, x2, y2, w1=88, w2=88, serif=52, thorn=68, top_serif=False, bot_serif=False):
    """Draws a diagonal stroke with optional serif terminals."""
    pen.moveTo((round(x1 - (serif if bot_serif else 0)), round(y1)))
    pen.lineTo((round(x1 + w1 + (serif if bot_serif else 0)), round(y1)))
    pen.lineTo((round(x2 + w2 + (serif if top_serif else 0)), round(y2)))
    pen.lineTo((round(x2 - (thorn if top_serif else 0)), round(y2)))
    pen.closePath()


def add_ring_arch(pen, cx, cy, rx, ry, start_deg, end_deg, thick_max=88, thick_min=28):
    """Draws a variable-contrast curved bowl or crescent using clean polygon contours."""
    steps = 28
    outer = []
    inner = []
    for i in range(steps + 1):
        t = i / steps
        ang = math.radians(start_deg + t * (end_deg - start_deg))
        weight = thick_min + (thick_max - thick_min) * (math.cos(ang) ** 2)
        ox = cx + rx * math.cos(ang)
        oy = cy + ry * math.sin(ang)
        ix = cx + (rx - weight) * math.cos(ang)
        iy = cy + (ry - weight) * math.sin(ang)
        outer.append((round(ox), round(oy)))
        inner.append((round(ix), round(iy)))

    pen.moveTo(outer[0])
    for pt in outer[1:]:
        pen.lineTo(pt)
    for pt in reversed(inner):
        pen.lineTo(pt)
    pen.closePath()


def draw_icon(pen, key):
    """Draws the 6 Wicked Agile brand icons (now at U+E000-U+E005)."""
    if key == "@":  # 1. Wave Sprint
        add_ring_arch(pen, 340, 350, 260, 260, 30, 315, thick_max=75, thick_min=35)
        pen.moveTo((510, 490))
        pen.lineTo((640, 560))
        pen.lineTo((545, 385))
        pen.closePath()
    elif key == "#":  # 2. Trident Kanban Flow
        add_wicked_stem(pen, 110, 120, 580, thorn_top=True)
        add_wicked_stem(pen, 310, 60, 700, thorn_top=True, wave_bot=True)
        add_wicked_stem(pen, 510, 120, 580, thorn_top=True)
        add_bar(pen, 80, 620, 120, thick=42, wicked_cut=True)
    elif key == "$":  # 3. Shark-Fin Velocity Chart
        pen.moveTo((80, 80))
        pen.lineTo((260, 520))
        pen.lineTo((580, 680))
        pen.lineTo((450, 320))
        pen.lineTo((590, 80))
        pen.closePath()
        add_bar(pen, 50, 630, 0, thick=40, wicked_cut=True)
    elif key == "%":  # 4. Horizon Retro
        pen.moveTo((120, 160))
        pen.lineTo((340, 690))
        pen.lineTo((460, 540))
        pen.lineTo((395, 480))
        pen.lineTo((540, 160))
        pen.closePath()
        add_bar(pen, 40, 640, 80, thick=42, wicked_cut=True)
    elif key == "^":  # 5. Surfboard Backlog
        add_ring_arch(pen, 340, 350, 175, 340, 0, 360, thick_max=65, thick_min=40)
        add_bar(pen, 180, 500, 430, thick=36, wicked_cut=True)
        add_bar(pen, 175, 505, 260, thick=36, wicked_cut=True)
    elif key == "&":  # 6. Blocker Kraken Tentacle
        add_ring_arch(pen, 330, 360, 230, 300, 75, 290, thick_max=90, thick_min=35)
        add_wicked_stem(pen, 330, 40, 420, thorn_top=True, wave_bot=True)
    return 700


def draw_display_letter(pen, ch, style="serif", scale=1.0):
    """V1 display letterforms (A-Z) for Serif and Script; lowercase is drawn as small caps."""
    use_serifs = style == "serif"
    is_script = style == "script"
    is_sans = style == "sans"

    H = int(CAP_H * scale)
    base_stem = 78 if is_sans else (68 if is_script else 90)
    base_hair = 62 if is_sans else (48 if is_script else 28)

    S = max(24, int(base_stem * (0.88 if scale < 1 else 1.0)))
    T = max(20, int(base_hair * scale))

    def stem(x, y_b, y_t, thorn=True, wave=False):
        if use_serifs:
            add_wicked_stem(pen, x, y_b, y_t, stem=S, hair=T, thorn_top=thorn, wave_bot=wave)
        else:
            add_sans_stem(pen, x, y_b, y_t, w=S)
        if is_script:
            # Connected coastal brush exit flick
            pen.moveTo((round(x + S), round(y_b)))
            pen.lineTo((round(x + S + 54), round(y_b + 46)))
            pen.lineTo((round(x + S + 42), round(y_b + 66)))
            pen.lineTo((round(x + S - 6), round(y_b + 26)))
            pen.closePath()

    if ch == "I":
        stem(110, 0, H, thorn=True, wave=True)
        return 310
    elif ch == "L":
        stem(90, 0, H, thorn=True)
        add_bar(pen, 90, 440, 0, thick=T + 8, wicked_cut=use_serifs)
        if use_serifs:
            pen.moveTo((410, 0))
            pen.lineTo((465, 115))
            pen.lineTo((440, 125))
            pen.lineTo((390, T + 8))
            pen.closePath()
        return 510
    elif ch == "T":
        stem(220, 0, H, thorn=False, wave=True)
        add_bar(pen, 40, 490, H - T, thick=T + 6, wicked_cut=use_serifs)
        if use_serifs:
            pen.moveTo((40, H))
            pen.lineTo((25, H - 95))
            pen.lineTo((65, H - T))
            pen.closePath()
            pen.moveTo((490, H))
            pen.lineTo((505, H - 95))
            pen.lineTo((465, H - T))
            pen.closePath()
        return 530
    elif ch in ("E", "F"):
        stem(90, 0, H, thorn=True)
        add_bar(pen, 90, 450, H - T, thick=T + 6)
        add_bar(pen, 90, 390, int(H * 0.50), thick=T + 4, wicked_cut=use_serifs)
        if ch == "E":
            add_bar(pen, 90, 465, 0, thick=T + 8, wicked_cut=use_serifs)
        return 510
    elif ch == "H":
        stem(85, 0, H, thorn=True)
        stem(415, 0, H, thorn=True, wave=True)
        add_bar(pen, 85, 450, int(H * 0.48), thick=T + 8, wicked_cut=use_serifs)
        return 590
    elif ch == "A":
        add_diag(pen, 55, 0, 255, H, w1=T + 10, w2=T + 10, top_serif=use_serifs, bot_serif=use_serifs)
        add_diag(pen, 445, 0, 255, H, w1=S, w2=S, bot_serif=use_serifs)
        add_bar(pen, 130, 390, int(H * 0.34), thick=T + 8, wicked_cut=use_serifs)
        return 570
    elif ch == "V":
        add_diag(pen, 250, 0, 55, H, w1=S, w2=S, top_serif=use_serifs)
        add_diag(pen, 265, 0, 465, H, w1=T + 10, w2=T + 10, top_serif=use_serifs)
        return 550
    elif ch == "W":
        add_diag(pen, 155, 0, 45, H, w1=S - 8, w2=S - 8, top_serif=use_serifs)
        add_diag(pen, 170, 0, 305, int(H * 0.82), w1=T + 6, w2=T + 6)
        add_diag(pen, 435, 0, 305, int(H * 0.82), w1=S - 8, w2=S - 8)
        add_diag(pen, 450, 0, 575, H, w1=T + 8, w2=T + 8, top_serif=use_serifs)
        return 660
    elif ch == "N":
        stem(85, 0, H, thorn=True, wave=True)
        stem(430, 0, H, thorn=True)
        add_diag(pen, 430, 0, 110, H, w1=S, w2=S)
        return 600
    elif ch == "M":
        stem(75, 0, H, thorn=True, wave=True)
        stem(515, 0, H, thorn=True, wave=True)
        add_diag(pen, 315, int(H * 0.12), 105, H, w1=S - 10, w2=S - 10)
        add_diag(pen, 325, int(H * 0.12), 525, H, w1=T + 6, w2=T + 6)
        return 685
    elif ch == "K":
        stem(85, 0, H, thorn=True)
        add_diag(pen, 145, int(H * 0.45), 430, H, w1=T + 8, w2=T + 12, top_serif=use_serifs)
        add_diag(pen, 450, 0, 195, int(H * 0.54), w1=S, w2=S, bot_serif=use_serifs)
        return 565
    elif ch in ("C", "G"):
        add_ring_arch(pen, 300, int(H * 0.5), 225, int(H * 0.5), 42, 322, thick_max=S + 10, thick_min=T)
        if use_serifs:
            pen.moveTo((445, H - 10))
            pen.lineTo((495, H + 15))
            pen.lineTo((485, int(H * 0.72)))
            pen.closePath()
        if ch == "G":
            stem(415, int(H * 0.08), int(H * 0.46), thorn=True, wave=True)
        return 565
    elif ch in ("O", "Q"):
        add_ring_arch(pen, 295, int(H * 0.5), 235, int(H * 0.5), 0, 360, thick_max=S + 8, thick_min=T)
        if ch == "Q":
            pen.moveTo((310, 40))
            pen.lineTo((520, -90))
            pen.lineTo((565, -45))
            pen.lineTo((370, 75))
            pen.closePath()
        return 590
    elif ch == "D":
        stem(85, 0, H, thorn=True)
        add_ring_arch(pen, 225, int(H * 0.5), 295, int(H * 0.5), -90, 90, thick_max=S + 10, thick_min=T)
        add_bar(pen, 85, 235, H - T, thick=T)
        add_bar(pen, 85, 235, 0, thick=T)
        return 575
    elif ch in ("P", "R", "B"):
        stem(85, 0, H, thorn=True)
        top_ry = int(H * 0.27)
        add_ring_arch(pen, 215, H - top_ry, 235, top_ry, -90, 90, thick_max=S, thick_min=T)
        add_bar(pen, 85, 225, H - T, thick=T)
        add_bar(pen, 85, 225, H - 2 * top_ry, thick=T)
        if ch == "B":
            bot_ry = int(H * 0.28)
            add_ring_arch(pen, 225, bot_ry, 255, bot_ry, -90, 90, thick_max=S + 8, thick_min=T)
            add_bar(pen, 85, 235, 0, thick=T)
        elif ch == "R":
            add_diag(pen, 435, 0, 235, H - 2 * top_ry + 20, w1=S, w2=S, bot_serif=use_serifs)
        return 535
    elif ch == "S":
        add_ring_arch(pen, 265, int(H * 0.73), 175, int(H * 0.27), 35, 275, thick_max=S, thick_min=T)
        add_ring_arch(pen, 265, int(H * 0.27), 185, int(H * 0.27), -145, 95, thick_max=S, thick_min=T)
        return 510
    elif ch == "U":
        stem(85, int(H * 0.36), H, thorn=True)
        stem(415, int(H * 0.36), H, thorn=True)
        add_ring_arch(pen, 295, int(H * 0.38), 210, int(H * 0.38), 180, 360, thick_max=S, thick_min=T)
        return 585
    elif ch == "J":
        stem(285, int(H * 0.28), H, thorn=True)
        add_ring_arch(pen, 200, int(H * 0.28), 170, int(H * 0.28), 185, 360, thick_max=S, thick_min=T)
        return 455
    elif ch == "X":
        add_diag(pen, 425, 0, 75, H, w1=S, w2=S, top_serif=use_serifs, bot_serif=use_serifs)
        add_diag(pen, 75, 0, 425, H, w1=T + 10, w2=T + 10, top_serif=use_serifs, bot_serif=use_serifs)
        return 565
    elif ch == "Y":
        stem(245, 0, int(H * 0.46), thorn=False, wave=True)
        add_diag(pen, 245, int(H * 0.44), 65, H, w1=S, w2=S, top_serif=use_serifs)
        add_diag(pen, 265, int(H * 0.44), 445, H, w1=T + 10, w2=T + 10, top_serif=use_serifs)
        return 560
    elif ch == "Z":
        add_bar(pen, 65, 465, H - T, thick=T + 8, wicked_cut=use_serifs)
        add_diag(pen, 65, 0, 415, H, w1=S, w2=S)
        add_bar(pen, 65, 475, 0, thick=T + 10, wicked_cut=use_serifs)
        return 540
    return 480


# ============================================================================
# 2. V2 STROKE ENGINE (polygon outlines from centre-line skeletons)
# ============================================================================
# Every v2 glyph is a set of filled polygons. Fills run counter-clockwise and
# counters (holes) clockwise, so overlapping parts union under the non-zero rule
# that every OpenType rasteriser uses. Strokes get their thickness from their
# direction: horizontal strokes are T thick, vertical strokes S thick, so the
# Sans keeps a slight, even contrast.

def _area(poly):
    a = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a / 2.0


def _orient(poly, ccw=True):
    return list(poly) if (_area(poly) > 0) == ccw else list(reversed(poly))


def _isect(p, d, q, e):
    den = d[0] * e[1] - d[1] * e[0]
    if abs(den) < 1e-9:
        return None
    t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
    return (p[0] + t * d[0], p[1] + t * d[1])


def _dedupe(pts):
    out = []
    for p in pts:
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 0.5:
            out.append((float(p[0]), float(p[1])))
    return out


def stroke_outline(pts, closed, S, T, uniform=None, ext0=0.0, ext1=0.0, miter_limit=3.0):
    """Offsets a centre-line polyline into outline polygon(s) with mitred joins.

    Returns one polygon for an open path (butt caps, optionally extended by ext0/ext1)
    or [outer, inner] for a closed path.
    """
    pts = _dedupe(pts)
    if closed and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.5:
        pts = pts[:-1]
    n = len(pts)
    if not closed and (ext0 or ext1):
        (x0, y0), (x1, y1) = pts[0], pts[1]
        d = math.hypot(x1 - x0, y1 - y0)
        pts[0] = (x0 - (x1 - x0) / d * ext0, y0 - (y1 - y0) / d * ext0)
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        d = math.hypot(x1 - x0, y1 - y0)
        pts[-1] = (x1 + (x1 - x0) / d * ext1, y1 + (y1 - y0) / d * ext1)
    nseg = n if closed else n - 1
    dirs, norms, half = [], [], []
    for i in range(nseg):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
        ln = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / ln, (by - ay) / ln
        dirs.append((ux, uy))
        norms.append((-uy, ux))
        half.append(0.5 * (uniform if uniform else math.hypot(T * ux, S * uy)))

    def off(p, nrm, h):
        return (p[0] + nrm[0] * h, p[1] + nrm[1] * h)

    def side(sgn):
        out = []
        for j in range(n):
            if not closed and j == 0:
                out.append(off(pts[0], norms[0], sgn * half[0]))
                continue
            if not closed and j == n - 1:
                out.append(off(pts[-1], norms[-1], sgn * half[-1]))
                continue
            i0, i1 = (j - 1) % nseg, j % nseg
            p0 = off(pts[j], norms[i0], sgn * half[i0])
            p1 = off(pts[j], norms[i1], sgn * half[i1])
            x = _isect(p0, dirs[i0], p1, dirs[i1])
            if x is None:
                out.append(p1)
            elif math.hypot(x[0] - pts[j][0], x[1] - pts[j][1]) > miter_limit * max(half[i0], half[i1]):
                out.extend([p0, p1])  # bevel very sharp joins
            else:
                out.append(x)
        return out

    left, right = side(1), side(-1)
    if closed:
        a, b = (left, right) if abs(_area(left)) > abs(_area(right)) else (right, left)
        return [a, b]
    return left + list(reversed(right))


def chamfer_vertex(poly, near, k):
    """Replaces the polygon vertex nearest `near` with a chamfer of size k."""
    i = min(range(len(poly)), key=lambda j: math.hypot(poly[j][0] - near[0], poly[j][1] - near[1]))
    p, a, b = poly[i], poly[i - 1], poly[(i + 1) % len(poly)]
    da, db = math.hypot(a[0] - p[0], a[1] - p[1]), math.hypot(b[0] - p[0], b[1] - p[1])
    ka, kb = min(k, da * 0.45), min(k, db * 0.45)
    pa = (p[0] + (a[0] - p[0]) / da * ka, p[1] + (a[1] - p[1]) / da * ka)
    pb = (p[0] + (b[0] - p[0]) / db * kb, p[1] + (b[1] - p[1]) / db * kb)
    return poly[:i] + [pa, pb] + poly[i + 1:]


class Params:
    """Per-face drawing parameters."""

    def __init__(self, S, T, k, c, C, sb, space, digit_extra=0):
        self.S = S      # vertical stroke thickness (stems)
        self.T = T      # horizontal stroke thickness (bars, bowl tops)
        self.k = k      # brand chamfer on free stem tops (top-left cut)
        self.c = c      # lowercase bowl chamfer (centre line)
        self.C = C      # capital / figure bowl chamfer (centre line)
        self.sb = sb    # default side bearing for straight sides
        self.space = space
        self.digit_extra = digit_extra


class G:
    """Collects the polygons of one glyph."""

    def __init__(self, p):
        self.p = p
        self.S, self.T, self.k, self.c, self.C = p.S, p.T, p.k, p.c, p.C
        self.polys = []          # (points, is_hole)
        self.lsb = p.sb
        self.rsb = p.sb
        self.tabular = None      # set to an advance to centre the glyph in it

    # --- spacing -----------------------------------------------------------
    def sb(self, left, right=None):
        self.lsb, self.rsb = left, (left if right is None else right)

    # --- primitives ---------------------------------------------------------
    def fill(self, poly):
        self.polys.append((_orient(poly, True), False))
        return poly

    def rect(self, x0, y0, x1, y1, tl=0, tr=0, bl=0, br=0):
        poly = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        for near, k in (((x0, y1), tl), ((x1, y1), tr), ((x0, y0), bl), ((x1, y0), br)):
            if k:
                poly = chamfer_vertex(poly, near, k)
        return self.fill(poly)

    def stem(self, xc, y0, y1, tl=0, tr=0, bl=0, br=0, s=None):
        h = (s or self.S) / 2
        return self.rect(xc - h, y0, xc + h, y1, tl=tl, tr=tr, bl=bl, br=br)

    def hbar(self, x0, x1, yc, t=None):
        h = (t or self.T) / 2
        return self.rect(x0, yc - h, x1, yc + h)

    def path(self, pts, closed=False, s=None, t=None, uniform=None, ext0=0.0, ext1=0.0, cuts=()):
        res = stroke_outline(pts, closed, s or self.S, t or self.T, uniform, ext0, ext1)
        if closed:
            outer, inner = res
            self.polys.append((_orient(outer, True), False))
            self.polys.append((_orient(inner, False), True))
            return
        poly = res
        for near, k in cuts:
            poly = chamfer_vertex(poly, near, k)
        self.fill(poly)

    def diag(self, xb, yb, xt, yt, t=None):
        """Diagonal stroke with horizontal end cuts; (xb,yb)/(xt,yt) are end centres."""
        t = t or self.S
        theta = math.atan2(abs(yt - yb), abs(xt - xb))
        w = t / max(0.2, math.sin(theta))
        self.fill([(xb - w / 2, yb), (xb + w / 2, yb), (xt + w / 2, yt), (xt - w / 2, yt)])
        return w

    def dot(self, xc, y0, size=None):
        d = size or self.dot_size()
        return self.rect(xc - d / 2, y0, xc + d / 2, y0 + d, tl=d * 0.3)

    def dot_size(self):
        return max(self.S, self.T) * 1.12

    def oct(self, L, B, R, Tp, c, **kw):
        """Closed octagonal bowl on a centre-line box."""
        self.path(octagon(L, B, R, Tp, c), closed=True, **kw)

    def transform(self, fn):
        out = []
        for poly, hole in self.polys:
            pts = [fn(x, y) for x, y in poly]
            out.append((_orient(pts, not hole), hole))
        self.polys = out


def octagon(L, B, R, Tp, c):
    """Centre-line octagon, counter-clockwise from the lower right."""
    return [(R, B + c), (R, Tp - c), (R - c, Tp), (L + c, Tp), (L, Tp - c), (L, B + c), (L + c, B), (R - c, B)]


def lerp_x(p0, p1, y):
    (x0, y0), (x1, y1) = p0, p1
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)


# ============================================================================
# 3. V2 GLYPHS. Coordinates are ink-relative: x=0 is the left ink edge.
# ============================================================================
# L/R = centre lines of the left/right walls; B, X, K = centre lines of strokes
# that sit on the baseline, x-height and cap height.

GLYPHS = {}


def glyph(chars):
    def reg(fn):
        for ch in chars:
            GLYPHS[ch] = fn
        return fn
    return reg


def _frame(g, w):
    S, T = g.S, g.T
    return S / 2, w - S / 2, T / 2, X_H - T / 2, CAP_H - T / 2


# ---------------------------- lowercase --------------------------------------

@glyph("a")
def g_a(g):
    S, T, c = g.S, g.T, g.c
    w = 250 + 2 * S
    L, R, B, X, K = _frame(g, w)
    M = X_H * 0.56
    cb = c * 0.8
    g.path([(L + 22, X), (R - c, X), (R, X - c), (R, 0)])
    g.path([(R, M), (L + cb, M), (L, M - cb), (L, B + cb), (L + cb, B), (R, B)])
    g.sb(g.p.sb - 14, g.p.sb)
    return w


@glyph("b")
def g_b(g):
    S, c = g.S, g.c
    w = 270 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, ASC_H, tl=g.k)
    g.path([(L, X), (R - c, X), (R, X - c), (R, B + c), (R - c, B), (L, B)])
    g.sb(g.p.sb, g.p.sb - 14)
    return w


@glyph("c")
def g_c(g):
    S, c = g.S, g.c
    w = 238 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.path([(R, X - c - 26), (R, X - c), (R - c, X), (L + c, X), (L, X - c),
            (L, B + c), (L + c, B), (R - c, B), (R, B + c), (R, B + c + 26)])
    g.sb(g.p.sb - 14, g.p.sb - 18)
    return w


@glyph("d")
def g_d(g):
    S, c = g.S, g.c
    w = 270 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(R, 0, ASC_H, tl=g.k)
    g.path([(R, X), (L + c, X), (L, X - c), (L, B + c), (L + c, B), (R, B)])
    g.sb(g.p.sb - 14, g.p.sb)
    return w


@glyph("e")
def g_e(g):
    S, c = g.S, g.c
    w = 262 + 2 * S
    L, R, B, X, K = _frame(g, w)
    M = X_H * 0.52
    g.path([(L, M), (R, M), (R, X - c), (R - c, X), (L + c, X), (L, X - c),
            (L, B + c), (L + c, B), (R - c, B), (R, B + c), (R, B + c + 20)])
    g.sb(g.p.sb - 14, g.p.sb - 16)
    return w


@glyph("f")
def g_f(g):
    S, T = g.S, g.T
    xs = S / 2 + 48
    top = ASC_H - T / 2
    cf = 80
    g.path([(xs, 0), (xs, top - cf), (xs + cf, top), (xs + cf + 92, top)])
    g.rect(0, X_H - T, xs + S / 2 + 112, X_H)
    g.sb(18, 4)
    return max(xs + cf + 92, xs + S / 2 + 112)


@glyph("g")
def g_g(g):
    S, T, c = g.S, g.T, g.c
    w = 270 + 2 * S
    L, R, B, X, K = _frame(g, w)
    D = DESC_D + T / 2
    g.path([(R, X), (L + c, X), (L, X - c), (L, B + c), (L + c, B), (R, B)])
    g.path([(R, X_H), (R, D + c), (R - c, D), (L + 18, D)])
    g.sb(g.p.sb - 14, g.p.sb)
    return w


@glyph("h")
def g_h(g):
    S, c = g.S, g.c
    w = 262 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, ASC_H, tl=g.k)
    g.path([(L, X), (R - c, X), (R, X - c), (R, 0)])
    return w


@glyph("i")
def g_i(g):
    S = g.S
    d = g.dot_size()
    xc = d / 2
    g.stem(xc, 0, X_H, tl=g.k)
    g.dot(xc, ASC_H - d)
    return d


@glyph("j")
def g_j(g):
    S, T = g.S, g.T
    cj = 72
    xs = cj + 86 + S / 2
    D = DESC_D + T / 2
    g.path([(xs, X_H), (xs, D + cj), (xs - cj, D), (0, D)], cuts=[((xs - S / 2, X_H), g.k)])
    d = g.dot_size()
    g.dot(xs, ASC_H - d)
    g.sb(-10, g.p.sb)
    return xs + d / 2


@glyph("k")
def g_k(g):
    S, T = g.S, g.T
    w = 300 + S
    L = S / 2
    g.stem(L, 0, ASC_H, tl=g.k)
    t = S * 0.94
    jy = X_H * 0.30
    arm_b, arm_t = (S * 0.85, jy), (w - t * 0.62, X_H)
    g.diag(arm_b[0], arm_b[1], arm_t[0], arm_t[1], t)
    ly = X_H * 0.50
    lx = lerp_x(arm_b, arm_t, ly)
    g.diag(w - t * 0.6, 0, lx, ly, t)
    g.sb(g.p.sb, 16)
    return w


@glyph("l")
def g_l(g):
    S, T = g.S, g.T
    L = S / 2
    cl = 66
    w = L + cl + 52
    g.path([(L, ASC_H), (L, T / 2 + cl), (L + cl, T / 2), (w, T / 2)], cuts=[((0, ASC_H), g.k)])
    g.sb(g.p.sb, 22)
    return w


@glyph("m")
def g_m(g):
    S, c = g.S, g.c * 0.72
    cw = 178
    w = 2 * cw + 3 * S
    L, R, B, X, K = _frame(g, w)
    M = L + S + cw
    g.stem(L, 0, X_H, tl=g.k)
    g.path([(L, X), (M - c, X), (M, X - c), (M, 0)])
    g.path([(M - c, X), (R - c, X), (R, X - c), (R, 0)])
    return w


@glyph("n")
def g_n(g):
    S, c = g.S, g.c
    w = 262 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, X_H, tl=g.k)
    g.path([(L, X), (R - c, X), (R, X - c), (R, 0)])
    return w


@glyph("o")
def g_o(g):
    S, c = g.S, g.c
    w = 276 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.oct(L, B, R, X, c)
    g.sb(g.p.sb - 14)
    return w


@glyph("p")
def g_p(g):
    S, c = g.S, g.c
    w = 270 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, DESC_D, X_H, tl=g.k)
    g.path([(L, X), (R - c, X), (R, X - c), (R, B + c), (R - c, B), (L, B)])
    g.sb(g.p.sb, g.p.sb - 14)
    return w


@glyph("q")
def g_q(g):
    S, c = g.S, g.c
    w = 270 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(R, DESC_D, X_H)
    g.path([(R, X), (L + c, X), (L, X - c), (L, B + c), (L + c, B), (R, B)])
    g.sb(g.p.sb - 14, g.p.sb)
    return w


@glyph("r")
def g_r(g):
    S, c = g.S, g.c * 0.8
    w = S + 142
    L, R, B, X, K = _frame(g, w)
    R = w - g.S * 0.35
    g.stem(L, 0, X_H, tl=g.k)
    g.path([(L, X), (R - c, X), (R, X - c)])
    g.sb(g.p.sb, 8)
    return w


@glyph("s")
def g_s(g):
    S, T = g.S, g.T
    w = 228 + 2 * S
    L, R, B, X, K = _frame(g, w)
    cs = 68
    M = X_H / 2
    g.path([(R, X - cs - 10), (R, X - cs), (R - cs, X), (L + cs, X), (L, X - cs), (L, M + cs),
            (L + cs, M), (R - cs, M), (R, M - cs), (R, B + cs), (R - cs, B), (L + cs, B), (L, B + cs),
            (L, B + cs + 10)])
    g.sb(g.p.sb - 16)
    return w


@glyph("t")
def g_t(g):
    S, T = g.S, g.T
    xs = S / 2 + 46
    ct = 64
    w_tail = xs + ct + 58
    g.path([(xs, 660), (xs, T / 2 + ct), (xs + ct, T / 2), (w_tail, T / 2)], cuts=[((xs - S / 2, 660), g.k)])
    g.rect(0, X_H - T, xs + S / 2 + 108, X_H)
    g.sb(16, 12)
    return max(w_tail, xs + S / 2 + 108)


@glyph("u")
def g_u(g):
    S, c = g.S, g.c
    w = 262 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.path([(L, X_H), (L, B + c), (L + c, B), (R, B)], cuts=[((0, X_H), g.k)])
    g.stem(R, 0, X_H, tl=g.k)
    return w


def _v_shape(g, w, top, bottom=0, t=None, t2=None):
    t = t or g.S * 0.94
    t2 = t2 or t
    wd = t * 1.12
    g.diag(w / 2, bottom, wd / 2, top, t)
    g.diag(w / 2, bottom, w - wd / 2, top, t2)


@glyph("v")
def g_v(g):
    w = 330 + g.S
    _v_shape(g, w, X_H)
    g.sb(14)
    return w


@glyph("w")
def g_w(g):
    t = g.S * 0.9
    w = 560 + g.S
    wd = t * 1.1
    g.diag(w * 0.27, 0, wd / 2, X_H, t)
    g.diag(w * 0.27, 0, w / 2, X_H * 0.86, t * 0.92)
    g.diag(w * 0.73, 0, w / 2, X_H * 0.86, t * 0.92)
    g.diag(w * 0.73, 0, w - wd / 2, X_H, t)
    g.sb(12)
    return w


@glyph("x")
def g_x(g):
    t = g.S * 0.94
    w = 330 + g.S
    wd = t * 1.15
    g.diag(wd / 2, 0, w - wd / 2, X_H, t)
    g.diag(w - wd / 2, 0, wd / 2, X_H, t)
    g.sb(14)
    return w


@glyph("y")
def g_y(g):
    t = g.S * 0.94
    w = 340 + g.S
    wd = t * 1.12
    top_r = (w - wd / 2, X_H)
    mid = (w * 0.47, 0)
    xb = lerp_x(mid, top_r, DESC_D)
    g.diag(xb, DESC_D, top_r[0], top_r[1], t)
    g.diag(mid[0], 0, wd / 2, X_H, t)
    g.sb(14)
    return w


@glyph("z")
def g_z(g):
    S, T = g.S, g.T
    w = 300 + S
    g.rect(0, X_H - T, w, X_H, tl=g.k)
    g.rect(0, 0, w, T)
    t = S * 0.98
    wd = t * 1.25
    g.diag(wd / 2 + 4, T * 0.5, w - wd / 2 - 4, X_H - T * 0.5, t)
    g.sb(g.p.sb - 20)
    return w


# ---------------------------- capitals ---------------------------------------

@glyph("A")
def g_A(g):
    t = g.S * 0.98
    w = 520 + g.S
    wd = t * 1.08
    apex = wd * 0.42
    lb, lt = (wd / 2, 0), (w / 2 - apex, CAP_H)
    rb, rt = (w - wd / 2, 0), (w / 2 + apex, CAP_H)
    g.diag(lb[0], lb[1], lt[0], lt[1], t)
    g.diag(rb[0], rb[1], rt[0], rt[1], t)
    yb = CAP_H * 0.27
    g.hbar(lerp_x(lb, lt, yb), lerp_x(rb, rt, yb), yb)
    g.sb(10)
    return w


@glyph("B")
def g_B(g):
    S, T = g.S, g.T
    w = 340 + 2 * S
    L, R, B, X, K = _frame(g, w)
    cb = 96
    M = CAP_H * 0.52
    Rt = R - 28
    g.stem(L, 0, CAP_H, tl=g.k)
    g.path([(L, K), (Rt - cb, K), (Rt, K - cb), (Rt, M + cb * 0.8), (Rt - cb * 0.8, M), (L, M)])
    g.path([(L, M), (R - cb, M), (R, M - cb), (R, B + cb), (R - cb, B), (L, B)])
    g.sb(g.p.sb, g.p.sb - 12)
    return w


@glyph("C")
def g_C(g):
    S, C = g.S, g.C
    w = 390 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.path([(R, K - C - 40), (R, K - C), (R - C, K), (L + C, K), (L, K - C),
            (L, B + C), (L + C, B), (R - C, B), (R, B + C), (R, B + C + 40)])
    g.sb(g.p.sb - 14, g.p.sb - 18)
    return w


@glyph("D")
def g_D(g):
    S, C = g.S, g.C
    w = 410 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, CAP_H, tl=g.k)
    g.path([(L, K), (R - C, K), (R, K - C), (R, B + C), (R - C, B), (L, B)])
    g.sb(g.p.sb, g.p.sb - 14)
    return w


@glyph("E")
def g_E(g):
    S, T = g.S, g.T
    w = 300 + S
    L = S / 2
    g.stem(L, 0, CAP_H, tl=g.k)
    g.rect(L, CAP_H - T, w, CAP_H)
    g.hbar(L, w - 40, CAP_H * 0.5)
    g.rect(L, 0, w, T)
    g.sb(g.p.sb, g.p.sb - 18)
    return w


@glyph("F")
def g_F(g):
    S, T = g.S, g.T
    w = 290 + S
    L = S / 2
    g.stem(L, 0, CAP_H, tl=g.k)
    g.rect(L, CAP_H - T, w, CAP_H)
    g.hbar(L, w - 40, CAP_H * 0.48)
    g.sb(g.p.sb, g.p.sb - 26)
    return w


@glyph("G")
def g_G(g):
    S, C = g.S, g.C
    w = 410 + 2 * S
    L, R, B, X, K = _frame(g, w)
    gy = CAP_H * 0.44
    g.path([(R, K - C - 40), (R, K - C), (R - C, K), (L + C, K), (L, K - C),
            (L, B + C), (L + C, B), (R - C, B), (R, B + C), (R, gy), (w * 0.54, gy)])
    g.sb(g.p.sb - 14, g.p.sb - 6)
    return w


@glyph("H")
def g_H(g):
    S = g.S
    w = 380 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, CAP_H, tl=g.k)
    g.stem(R, 0, CAP_H, tl=g.k)
    g.hbar(L, R, CAP_H * 0.5)
    return w


@glyph("I")
def g_I(g):
    g.stem(g.S / 2, 0, CAP_H, tl=g.k)
    return g.S


@glyph("J")
def g_J(g):
    S, T = g.S, g.T
    w = 250 + 2 * S
    L, R, B, X, K = _frame(g, w)
    cj = 96
    g.path([(R, CAP_H), (R, B + cj), (R - cj, B), (L + cj * 0.7, B), (L, B + cj * 0.7), (L, 190)],
           cuts=[((R - S / 2, CAP_H), g.k)])
    g.sb(g.p.sb - 26, g.p.sb)
    return w


@glyph("K")
def g_K(g):
    S = g.S
    t = S * 0.98
    w = 400 + S
    L = S / 2
    g.stem(L, 0, CAP_H, tl=g.k)
    jy = CAP_H * 0.28
    arm_b, arm_t = (S * 0.85, jy), (w - t * 0.6, CAP_H)
    g.diag(arm_b[0], arm_b[1], arm_t[0], arm_t[1], t)
    ly = CAP_H * 0.5
    g.diag(w - t * 0.6, 0, lerp_x(arm_b, arm_t, ly), ly, t)
    g.sb(g.p.sb, 14)
    return w


@glyph("L")
def g_L(g):
    S, T = g.S, g.T
    w = 280 + S
    g.stem(S / 2, 0, CAP_H, tl=g.k)
    g.rect(S / 2, 0, w, T)
    g.sb(g.p.sb, 16)
    return w


@glyph("M")
def g_M(g):
    S = g.S
    w = 480 + 2 * S
    L, R, B, X, K = _frame(g, w)
    t = S * 0.92
    g.stem(L, 0, CAP_H, tl=g.k)
    g.stem(R, 0, CAP_H, tl=g.k)
    vy = CAP_H * 0.16
    g.diag(w / 2, vy, L + t * 0.25, CAP_H, t)
    g.diag(w / 2, vy, R - t * 0.25, CAP_H, t)
    return w


@glyph("N")
def g_N(g):
    S = g.S
    w = 400 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.stem(L, 0, CAP_H, tl=g.k)
    g.stem(R, 0, CAP_H, tl=g.k)
    t = S * 0.98
    g.diag(R - t * 0.3, 0, L + t * 0.3, CAP_H, t)
    return w


@glyph("O")
def g_O(g):
    S, C = g.S, g.C
    w = 446 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.oct(L, B, R, K, C * 1.1)
    g.sb(g.p.sb - 14)
    return w


def _P_bowl(g, w, bottom):
    L, R, B, X, K = _frame(g, w)
    cp = 104
    g.stem(L, 0, CAP_H, tl=g.k)
    g.path([(L, K), (R - cp, K), (R, K - cp), (R, bottom + cp), (R - cp, bottom), (L, bottom)])
    return L, R


@glyph("P")
def g_P(g):
    w = 330 + 2 * g.S
    _P_bowl(g, w, CAP_H * 0.42)
    g.sb(g.p.sb, g.p.sb - 16)
    return w


@glyph("Q")
def g_Q(g):
    S, C = g.S, g.C
    w = 446 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.oct(L, B, R, K, C * 1.1)
    g.path([(w * 0.56, CAP_H * 0.22), (w + 12, -96)], uniform=S * 0.98)
    g.sb(g.p.sb - 14, g.p.sb - 30)
    return w


@glyph("R")
def g_R(g):
    S = g.S
    w = 350 + 2 * S
    pm = CAP_H * 0.42
    L, R = _P_bowl(g, w - 20, pm)
    t = S * 0.98
    g.diag(w - t * 0.58, 0, w * 0.5, pm, t)
    g.sb(g.p.sb, 14)
    return w


@glyph("S")
def g_S(g):
    S = g.S
    w = 360 + 2 * S
    L, R, B, X, K = _frame(g, w)
    cs = 104
    M = CAP_H * 0.5 + 6
    g.path([(R, K - cs - 22), (R, K - cs), (R - cs, K), (L + cs, K), (L, K - cs), (L, M + cs),
            (L + cs, M), (R - cs, M), (R, M - cs), (R, B + cs), (R - cs, B), (L + cs, B), (L, B + cs),
            (L, B + cs + 22)])
    g.sb(g.p.sb - 18)
    return w


@glyph("T")
def g_T(g):
    S, T = g.S, g.T
    w = 420 + S
    g.rect(0, CAP_H - T, w, CAP_H, tl=g.k)
    g.stem(w / 2, 0, CAP_H)
    g.sb(16)
    return w


@glyph("U")
def g_U(g):
    S, C = g.S, g.C
    w = 380 + 2 * S
    L, R, B, X, K = _frame(g, w)
    g.path([(L, CAP_H), (L, B + C), (L + C, B), (R - C, B), (R, B + C), (R, CAP_H)],
           cuts=[((0, CAP_H), g.k), ((R - S / 2, CAP_H), g.k)])
    return w


@glyph("V")
def g_V(g):
    w = 480 + g.S
    _v_shape(g, w, CAP_H, t=g.S * 0.98)
    g.sb(10)
    return w


@glyph("W")
def g_W(g):
    t = g.S * 0.94
    w = 760 + g.S
    wd = t * 1.08
    g.diag(w * 0.26, 0, wd / 2, CAP_H, t)
    g.diag(w * 0.26, 0, w / 2, CAP_H * 0.86, t * 0.92)
    g.diag(w * 0.74, 0, w / 2, CAP_H * 0.86, t * 0.92)
    g.diag(w * 0.74, 0, w - wd / 2, CAP_H, t)
    g.sb(10)
    return w


@glyph("X")
def g_X(g):
    t = g.S * 0.98
    w = 440 + g.S
    wd = t * 1.1
    g.diag(wd / 2, 0, w - wd / 2, CAP_H, t)
    g.diag(w - wd / 2, 0, wd / 2, CAP_H, t)
    g.sb(12)
    return w


@glyph("Y")
def g_Y(g):
    t = g.S * 0.98
    w = 460 + g.S
    wd = t * 1.08
    jy = CAP_H * 0.42
    g.stem(w / 2, 0, jy + 10)
    g.diag(w / 2, jy, wd / 2, CAP_H, t)
    g.diag(w / 2, jy, w - wd / 2, CAP_H, t)
    g.sb(10)
    return w


@glyph("Z")
def g_Z(g):
    S, T = g.S, g.T
    w = 380 + S
    g.rect(0, CAP_H - T, w - 10, CAP_H, tl=g.k)
    g.rect(0, 0, w, T)
    t = S * 1.0
    wd = t * 1.2
    g.diag(wd / 2 + 4, T * 0.5, w - 10 - wd / 2 - 4, CAP_H - T * 0.5, t)
    g.sb(g.p.sb - 22)
    return w


# ---------------------------- figures (tabular) ------------------------------

def digit_ink(g):
    return 300 + 2 * g.S


def digit_adv(g):
    return digit_ink(g) + 120 + g.p.digit_extra


def _tab(g):
    g.tabular = digit_adv(g)


@glyph("0")
def g_0(g):
    _tab(g)
    S, T = g.S, g.T
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    g.oct(L, B, R, K, g.C * 1.05)
    # slashed zero: an inner diagonal tells 0 from O at a glance
    g.path([(L + S * 0.62, CAP_H * 0.26), (R - S * 0.62, CAP_H * 0.74)], uniform=T * 0.86)
    return w


@glyph("1")
def g_1(g):
    _tab(g)
    S, T = g.S, g.T
    w = digit_ink(g)
    xs = w / 2 + 34
    g.stem(xs, 0, CAP_H)
    g.path([(xs, CAP_H - 46), (xs - 176, CAP_H - 196)], uniform=T * 1.05)
    g.rect(xs - 150, 0, xs + 150, T)
    return w


@glyph("2")
def g_2(g):
    _tab(g)
    S, T, C = g.S, g.T, g.C
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    g.path([(L, K - C - 20), (L, K - C), (L + C, K), (R - C, K), (R, K - C), (R, CAP_H * 0.56), (L + 6, T * 0.9)])
    g.rect(0, 0, w, T)
    return w


@glyph("3")
def g_3(g):
    _tab(g)
    S, T, C = g.S, g.T, g.C
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    M = CAP_H * 0.53
    c3 = 72
    Rt = R - 22
    Lm = L + (R - L) * 0.30
    g.path([(L, K - C), (L + C, K), (Rt - C, K), (Rt, K - C), (Rt, M + c3), (Rt - c3, M), (Lm, M)])
    g.path([(Lm, M), (R - c3, M), (R, M - c3), (R, B + C), (R - C, B), (L + C, B), (L, B + C)])
    return w


@glyph("4")
def g_4(g):
    _tab(g)
    S, T = g.S, g.T
    w = digit_ink(g)
    xs = w - S / 2 - 34
    y4 = CAP_H * 0.30
    g.hbar(0, w, y4)
    g.stem(xs, 0, CAP_H)
    t = S * 0.94
    g.diag(t * 0.62, y4 - T / 2, xs - S / 2 + t * 0.55, CAP_H, t)
    return w


@glyph("5")
def g_5(g):
    _tab(g)
    S, T, C = g.S, g.T, g.C
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    M = CAP_H * 0.58
    g.path([(R + S / 2 - 10, K), (L, K), (L, M), (R - C, M), (R, M - C), (R, B + C), (R - C, B),
            (L + C, B), (L, B + C)], cuts=[((0, CAP_H), g.k)])
    return w


def _six(g, w):
    S, T, C = g.S, g.T, g.C
    L, R, B, X, K = _frame(g, w)
    M = CAP_H * 0.57
    g.path([(R, K - C), (R - C, K), (L + C, K), (L, K - C), (L, M)])
    g.path([(L, M), (R - C, M), (R, M - C), (R, B + C), (R - C, B), (L + C, B), (L, B + C)], closed=True)


@glyph("6")
def g_6(g):
    _tab(g)
    w = digit_ink(g)
    _six(g, w)
    return w


@glyph("7")
def g_7(g):
    _tab(g)
    S, T = g.S, g.T
    w = digit_ink(g)
    g.rect(0, CAP_H - T, w, CAP_H, tl=g.k)
    t = S * 0.98
    wd = t * 1.1
    g.diag(w * 0.34, 0, w - wd / 2, CAP_H - T * 0.5, t)
    return w


@glyph("8")
def g_8(g):
    _tab(g)
    S, T, C = g.S, g.T, g.C
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    M = CAP_H * 0.54
    g.oct(L + 24, M, R - 24, K, C * 0.78)
    g.oct(L, B, R, M, C * 0.92)
    return w


@glyph("9")
def g_9(g):
    _tab(g)
    w = digit_ink(g)
    _six(g, w)
    g.transform(lambda x, y: (w - x, CAP_H - y))
    return w


# ---------------------------- punctuation ------------------------------------

@glyph(".")
def g_period(g):
    d = g.dot_size()
    g.dot(d / 2, 0)
    g.sb(64)
    return d


@glyph(",")
def g_comma(g):
    d = g.dot_size()
    g.dot(d / 2 + 20, 0)
    t = d * 0.7
    g.fill([(20 + d - t * 0.9, 0), (20 + d, 0), (20 + d - t * 0.9 - 38, -150), (20 + d - t * 1.8 - 38, -150)][::-1])
    g.sb(44, 58)
    return d + 20


@glyph(":")
def g_colon(g):
    d = g.dot_size()
    g.dot(d / 2, 0)
    g.dot(d / 2, X_H - d)
    g.sb(66)
    return d


@glyph(";")
def g_semicolon(g):
    g_comma(g)
    d = g.dot_size()
    g.dot(d / 2 + 20, X_H - d)
    return d + 20


@glyph("'")
def g_quotesingle(g):
    s = g.S * 0.95
    g.rect(0, CAP_H - 250, s, CAP_H + 20, tl=s * 0.35)
    g.sb(60)
    return s


@glyph('"')
def g_quotedbl(g):
    s = g.S * 0.95
    g.rect(0, CAP_H - 250, s, CAP_H + 20, tl=s * 0.35)
    g.rect(s + 90, CAP_H - 250, 2 * s + 90, CAP_H + 20, tl=s * 0.35)
    g.sb(60)
    return 2 * s + 90


def _curly(g, x, flip):
    """A raised comma (’); flip=True turns it 180 degrees (‘)."""
    d = g.dot_size()
    y0 = CAP_H - d + 20
    poly_dot = [(x, y0), (x + d, y0), (x + d, y0 + d), (x, y0 + d)]
    poly_tail = [(x + d, y0), (x + d - 52, y0 - 150), (x + d - 52 - d * 0.62, y0 - 150), (x + d - d * 0.72, y0)]
    if flip:
        cx, cy = x + d / 2, y0 + (d - 150) / 2
        rot = lambda pts: [(2 * cx - px, 2 * cy - py) for px, py in pts]
        poly_dot, poly_tail = rot(poly_dot), rot(poly_tail)
    g.fill(poly_dot)
    g.fill(poly_tail)
    return d


@glyph("’")
def g_quoteright(g):
    d = _curly(g, 40, False)
    g.sb(30, 60)
    return d + 40


@glyph("‘")
def g_quoteleft(g):
    d = _curly(g, 0, True)
    g.sb(60, 30)
    return d + 40


@glyph("”")
def g_quotedblright(g):
    d = _curly(g, 40, False)
    _curly(g, 40 + d + 70, False)
    g.sb(30, 60)
    return 2 * d + 110


@glyph("“")
def g_quotedblleft(g):
    d = _curly(g, 0, True)
    _curly(g, d + 70, True)
    g.sb(60, 30)
    return 2 * d + 110


@glyph("!")
def g_exclam(g):
    d = g.dot_size()
    g.stem(d / 2, d + 110, CAP_H, tl=g.k)
    g.dot(d / 2, 0)
    g.sb(70)
    return d


@glyph("?")
def g_question(g):
    S, T = g.S, g.T
    w = 230 + 2 * S
    L, R, B, X, K = _frame(g, w)
    cq = 96
    M = CAP_H * 0.44
    xm = w * 0.5
    d = g.dot_size()
    g.path([(L, K - cq - 20), (L, K - cq), (L + cq, K), (R - cq, K), (R, K - cq), (R, M + 60), (R - 60, M),
            (xm, M), (xm, d + 110)])
    g.dot(xm, 0)
    g.sb(g.p.sb - 20)
    return w


def _bracket_range():
    return 790, -150


@glyph("(")
def g_parenleft(g):
    top, bot = _bracket_range()
    s = g.S
    w = 150 + s / 2
    xr, xl = w - 4, s / 2
    g.path([(xr, top), (xl, top - 150), (xl, bot + 150), (xr, bot)], s=s, t=g.T)
    g.sb(64, 26)
    return w


@glyph(")")
def g_parenright(g):
    top, bot = _bracket_range()
    s = g.S
    w = 150 + s / 2
    xl, xr = 4, w - s / 2
    g.path([(xl, top), (xr, top - 150), (xr, bot + 150), (xl, bot)], s=s, t=g.T)
    g.sb(26, 64)
    return w


@glyph("[")
def g_bracketleft(g):
    top, bot = _bracket_range()
    S, T = g.S, g.T
    w = 150 + S / 2
    g.path([(w, top - T / 2), (S / 2, top - T / 2), (S / 2, bot + T / 2), (w, bot + T / 2)])
    g.sb(70, 30)
    return w


@glyph("]")
def g_bracketright(g):
    top, bot = _bracket_range()
    S, T = g.S, g.T
    w = 150 + S / 2
    g.path([(0, top - T / 2), (w - S / 2, top - T / 2), (w - S / 2, bot + T / 2), (0, bot + T / 2)])
    g.sb(30, 70)
    return w


@glyph("{")
def g_braceleft(g):
    top, bot = _bracket_range()
    S, T = g.S, g.T
    mid = (top + bot) / 2
    xm, xr, kb = S / 2 + 80, S / 2 + 230, 60
    g.path([(xr, top - T / 2), (xm + kb, top - T / 2), (xm, top - T / 2 - kb), (xm, mid + kb), (0, mid)])
    g.path([(0, mid), (xm, mid - kb), (xm, bot + T / 2 + kb), (xm + kb, bot + T / 2), (xr, bot + T / 2)])
    g.sb(40, 30)
    return xr


@glyph("}")
def g_braceright(g):
    w = g_braceleft(g)
    g.transform(lambda x, y: (w - x, y))
    g.sb(30, 40)
    return w


@glyph("/")
def g_slash(g):
    t = g.S * 0.92
    w = 300
    g.diag(t * 0.6, -130, w - t * 0.6, CAP_H + 60, t)
    g.sb(20)
    return w


@glyph("\\")
def g_backslash(g):
    t = g.S * 0.92
    w = 300
    g.diag(w - t * 0.6, -130, t * 0.6, CAP_H + 60, t)
    g.sb(20)
    return w


@glyph("|")
def g_bar(g):
    g.stem(g.S / 2, -180, ASC_H + 60)
    g.sb(110)
    return g.S


@glyph("-")
def g_hyphen(g):
    g.hbar(0, 250, AXIS, t=g.T * 1.05)
    g.sb(54)
    return 250


@glyph("–")
def g_endash(g):
    g.hbar(0, 480, AXIS, t=g.T * 1.0)
    g.sb(40)
    return 480


@glyph("—")
def g_emdash(g):
    g.hbar(0, 900, AXIS, t=g.T * 1.0)
    g.sb(40)
    return 900


@glyph("−")
def g_minus(g):
    g.hbar(0, 430, AXIS)
    g.sb(65)
    return 430


@glyph("_")
def g_underscore(g):
    g.rect(0, -150, 500, -150 + g.T)
    g.sb(10)
    return 500


@glyph("+")
def g_plus(g):
    g.hbar(0, 430, AXIS)
    g.stem(215, AXIS - 215, AXIS + 215)
    g.sb(65)
    return 430


@glyph("=")
def g_equal(g):
    g.hbar(0, 430, AXIS + 92)
    g.hbar(0, 430, AXIS - 92)
    g.sb(65)
    return 430


@glyph("×")
def g_multiply(g):
    t = g.T * 1.12
    a = 150
    g.path([(0, AXIS - a), (2 * a, AXIS + a)], uniform=t)
    g.path([(0, AXIS + a), (2 * a, AXIS - a)], uniform=t)
    g.sb(85)
    return 2 * a


@glyph("<")
def g_less(g):
    t = g.T * 1.12
    g.path([(400, AXIS + 220), (20, AXIS), (400, AXIS - 220)], uniform=t)
    g.sb(55)
    return 420


@glyph(">")
def g_greater(g):
    t = g.T * 1.12
    g.path([(20, AXIS + 220), (400, AXIS), (20, AXIS - 220)], uniform=t)
    g.sb(55)
    return 420


@glyph("~")
def g_asciitilde(g):
    t = g.T * 1.05
    g.path([(0, AXIS - 40), (90, AXIS + 48), (170, AXIS + 48), (270, AXIS - 48), (350, AXIS - 48), (440, AXIS + 40)],
           uniform=t)
    g.sb(50)
    return 440


@glyph("^")
def g_asciicircum(g):
    t = g.T * 1.05
    g.path([(0, CAP_H - 300), (180, CAP_H), (360, CAP_H - 300)], uniform=t)
    g.sb(45)
    return 360


@glyph("`")
def g_grave(g):
    t = g.T * 1.1
    g.path([(0, CAP_H + 40), (130, CAP_H - 110)], uniform=t)
    g.sb(70)
    return 130


@glyph("*")
def g_asterisk(g):
    t = g.T * 1.0
    cx, cy, r = 190, CAP_H - 170, 170
    for ang in (90, 30, 150):
        dx, dy = r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang))
        g.path([(cx - dx, cy - dy), (cx + dx, cy + dy)], uniform=t)
    g.sb(45)
    return 380


@glyph("#")
def g_numbersign(g):
    t = g.T * 1.02
    w = 520
    sl = 60
    for x in (150, 360):
        g.diag(x - sl, 0, x + sl, CAP_H, t)
    g.hbar(0, w, CAP_H * 0.33, t=t * 0.95)
    g.hbar(30, w + 30, CAP_H * 0.67, t=t * 0.95)
    g.sb(30)
    return w + 30


@glyph("%")
def g_percent(g):
    s, t = g.S * 0.8, g.T * 0.8
    rw, rh = 250, 300
    w = 700
    g.oct(s / 2, CAP_H - rh + t / 2, rw - s / 2, CAP_H - t / 2, 62, s=s, t=t)
    g.oct(w - rw + s / 2, t / 2, w - s / 2, rh - t / 2, 62, s=s, t=t)
    g.diag(150, 0, w - 150, CAP_H, g.S * 0.9)
    g.sb(28)
    return w


@glyph("&")
def g_ampersand(g):
    S, T = g.S, g.T
    w = 470 + 2 * S
    L, R, B, X, K = _frame(g, w)
    ca = 76
    lt = L + 46                 # left wall of the upper loop
    rt = w * 0.66               # right wall of the upper loop
    ym = CAP_H * 0.58           # waist
    # upper loop, then the stroke falls into the lower bowl
    g.path([(rt, ym + 40), (rt, K - ca), (rt - ca, K), (lt + ca, K), (lt, K - ca), (lt, ym + ca * 0.5),
            (L, CAP_H * 0.40), (L, B + ca), (L + ca, B), (w * 0.60, B), (R, CAP_H * 0.36)])
    # leg from the waist to the baseline (crossing the bowl)
    g.diag(w - S * 0.55, 0, lt + S * 0.2, ym + 10, S * 0.98)
    g.sb(g.p.sb - 20, 10)
    return w


@glyph("@")
def g_at(g):
    s, t = g.S * 0.86, g.T * 0.86
    w = 820
    Lo, Ro = s / 2, w - s / 2
    Bo, To = -150 + t / 2, CAP_H - t / 2
    co = 150
    # inner "a" bowl and stem
    xi0, xi1 = 230, 520
    yi0, yi1 = 90, 470
    ci = 70
    xs = xi1 - s / 2
    g.path([(xs, yi1 - t / 2), (xi0 + s / 2 + ci, yi1 - t / 2), (xi0 + s / 2, yi1 - t / 2 - ci),
            (xi0 + s / 2, yi0 + t / 2 + ci), (xi0 + s / 2 + ci, yi0 + t / 2), (xs, yi0 + t / 2)], s=s, t=t)
    g.stem(xs, yi0, yi1, s=s)
    # outer ring leaves the stem foot and wraps round
    g.path([(xs, yi0 + t / 2), (Ro - 70, yi0 + t / 2), (Ro, yi0 + t / 2 + 70), (Ro, To - co), (Ro - co, To),
            (Lo + co, To), (Lo, To - co), (Lo, Bo + co), (Lo + co, Bo), (Ro - co - 60, Bo)], s=s, t=t)
    g.sb(40)
    return w


@glyph("$")
def g_dollar(g):
    S, T = g.S, g.T
    w = 330 + 2 * S
    L, R, B, X, K = _frame(g, w)
    top = CAP_H - 50 - T / 2
    bot = 50 + T / 2
    cs = 92
    M = (top + bot) / 2 + 4
    g.path([(R, top - cs - 18), (R, top - cs), (R - cs, top), (L + cs, top), (L, top - cs), (L, M + cs),
            (L + cs, M), (R - cs, M), (R, M - cs), (R, bot + cs), (R - cs, bot), (L + cs, bot), (L, bot + cs),
            (L, bot + cs + 18)])
    g.stem(w / 2, -90, CAP_H + 90, s=T * 0.95)
    _tab(g)
    return w


@glyph("€")
def g_euro(g):
    S, T, C = g.S, g.T, g.C
    w = digit_ink(g)
    L, R, B, X, K = _frame(g, w)
    x0 = 70
    L += x0
    g.path([(R, K - C - 10), (R, K - C), (R - C, K), (L + C, K), (L, K - C),
            (L, B + C), (L + C, B), (R - C, B), (R, B + C), (R, B + C + 10)])
    g.hbar(0, L + 230, CAP_H * 0.60, t=T * 0.9)
    g.hbar(0, L + 190, CAP_H * 0.40, t=T * 0.9)
    _tab(g)
    return w


@glyph("£")
def g_sterling(g):
    S, T = g.S, g.T
    w = digit_ink(g)
    xs = 150
    cp = 96
    K = CAP_H - T / 2
    g.path([(w - 20, K - cp - 10), (w - 20, K - cp), (w - 20 - cp, K), (xs + cp, K), (xs, K - cp), (xs, T)])
    g.rect(10, 0, w, T)
    g.hbar(30, xs + 210, CAP_H * 0.42, t=T * 0.95)
    _tab(g)
    return w


@glyph("·")
def g_periodcentered(g):
    d = g.dot_size()
    g.dot(d / 2, AXIS - d / 2)
    g.sb(70)
    return d


@glyph("•")
def g_bullet(g):
    a = 220
    cut = 66
    g.fill([(cut, AXIS - a / 2), (a - cut, AXIS - a / 2), (a, AXIS - a / 2 + cut), (a, AXIS + a / 2 - cut),
            (a - cut, AXIS + a / 2), (cut, AXIS + a / 2), (0, AXIS + a / 2 - cut), (0, AXIS - a / 2 + cut)])
    g.sb(70)
    return a


@glyph("…")
def g_ellipsis(g):
    d = g.dot_size()
    gap = 150
    for i in range(3):
        g.dot(d / 2 + i * (d + gap), 0)
    g.sb(60)
    return 3 * d + 2 * gap


def _arrow(g, w, right=True):
    T = g.T
    t = T * 1.1
    head = 215
    g.hbar(0, w - 12, AXIS, t=t)
    g.path([(w - head, AXIS + head), (w, AXIS), (w - head, AXIS - head)], uniform=t * 1.04)
    if not right:
        g.transform(lambda x, y: (w - x, y))


@glyph("→")
def g_arrowright(g):
    w = 700
    _arrow(g, w, True)
    g.sb(60)
    return w


@glyph("←")
def g_arrowleft(g):
    w = 700
    _arrow(g, w, False)
    g.sb(60)
    return w


@glyph("↑")
def g_arrowup(g):
    w = 640
    _arrow(g, w, True)
    g.transform(lambda x, y: (AXIS - y + 230, x))
    g.sb(50)
    return 460


@glyph("↓")
def g_arrowdown(g):
    w = 640
    _arrow(g, w, True)
    g.transform(lambda x, y: (y - AXIS + 230, w - x))
    g.sb(50)
    return 460


@glyph("✓")
def g_check(g):
    t = g.S * 1.04
    g.path([(0, AXIS + 20), (190, AXIS - 200), (560, CAP_H - 40)], uniform=t, ext0=0)
    g.sb(50)
    return 560


@glyph("°")
def g_degree(g):
    s, t = g.T * 0.95, g.T * 0.95
    d = 250
    g.oct(s / 2, CAP_H - d + t / 2, d - s / 2, CAP_H - t / 2, 56, s=s, t=t)
    g.sb(50)
    return d


# ============================================================================
# 4. FACES
# ============================================================================

REQUIRED_TEXT = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    ".,:;'\"?!()[]/\\+=_%#@&*<>|~`-^{}$"
    "—–·→←…•✓×‘’“”€£"
    "↑↓−°"
)

SANS_WEIGHTS = {
    400: Params(S=88, T=75, k=40, c=96, C=132, sb=62, space=250),
    600: Params(S=114, T=97, k=50, c=96, C=132, sb=58, space=260),
}
SERIF_PARAMS = Params(S=90, T=30, k=0, c=96, C=132, sb=60, space=260)
SCRIPT_PARAMS = Params(S=68, T=48, k=0, c=96, C=132, sb=56, space=250)


def build_v2_glyph(ch, params):
    """Returns (polygons, advance) for a v2 glyph, positioned at its left side bearing."""
    g = G(params)
    ink = GLYPHS[ch](g)
    if g.tabular is not None:
        lsb = (g.tabular - ink) / 2
        adv = g.tabular
    else:
        lsb = g.lsb
        adv = g.lsb + ink + g.rsb
    polys = [([(x + lsb, y) for x, y in pts], hole) for pts, hole in g.polys]
    return polys, round(adv)


def polys_to_recording(polys):
    rec = RecordingPen()
    for pts, _hole in polys:
        ipts = _dedupe([(round(x), round(y)) for x, y in pts])
        if len(ipts) < 3:
            continue
        rec.moveTo(ipts[0])
        for p in ipts[1:]:
            rec.lineTo(p)
        rec.closePath()
    return rec


def glyph_recording(ch, style, params):
    """Records glyph `ch` for a face. Sans is fully v2; Serif/Script keep v1 letters."""
    if style == "sans" or ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz":
        polys, adv = build_v2_glyph(ch, params)
        rec = polys_to_recording(polys)
    else:
        rec = RecordingPen()
        if ch.isupper():
            adv = draw_display_letter(rec, ch, style=style, scale=1.0)
        else:
            adv = int(draw_display_letter(rec, ch.upper(), style=style, scale=0.76) * 0.86)
    if style == "script":
        slanted = RecordingPen()
        rec.replay(TransformPen(slanted, (1, 0, math.tan(math.radians(14)), 1, 0, 0)))
        rec = slanted
    return rec, adv


def icon_recording(key):
    rec = RecordingPen()
    adv = draw_icon(rec, key)
    return rec, adv


def notdef_recording():
    rec = RecordingPen()
    poly_o = [(60, 0), (440, 0), (440, CAP_H), (60, CAP_H)]
    poly_i = [(120, 60), (120, CAP_H - 60), (380, CAP_H - 60), (380, 60)]
    for poly in (poly_o, poly_i):
        rec.moveTo(poly[0])
        for p in poly[1:]:
            rec.lineTo(p)
        rec.closePath()
    return rec, 500


def compile_face(family_name, ps_prefix, style_key, style_name, weight, params):
    """Builds .otf, .ttf and .woff2 for one face; returns the woff2 bytes."""
    face = f"{ps_prefix}-{style_name.replace(' ', '')}"
    glyphs = {".notdef": notdef_recording(), "space": (RecordingPen(), params.space)}
    cmap = {0x20: "space", 0xA0: "space"}
    order = [".notdef", "space"]
    for ch in REQUIRED_TEXT:
        name = f"uni{ord(ch):04X}"
        glyphs[name] = glyph_recording(ch, style_key, params)
        cmap[ord(ch)] = name
        order.append(name)
    for key, cp in PUA_ICONS.items():
        name = f"uni{cp:04X}"
        glyphs[name] = icon_recording(key)
        cmap[cp] = name
        order.append(name)

    # bounds for hmtx lsb and the win metrics
    lsbs, y_min, y_max = {}, 0, 0
    for name, (rec, _adv) in glyphs.items():
        bp = BoundsPen(None)
        rec.replay(bp)
        if bp.bounds:
            lsbs[name] = math.floor(bp.bounds[0])
            y_min, y_max = min(y_min, bp.bounds[1]), max(y_max, bp.bounds[3])
        else:
            lsbs[name] = 0
    win_asc = max(HHEA_ASC, math.ceil(y_max))
    win_desc = max(-HHEA_DESC, math.ceil(-y_min))
    metrics = {name: (adv, lsbs[name]) for name, (_rec, adv) in glyphs.items()}

    is_regular = style_name == "Regular"
    names = {
        "familyName": family_name if is_regular else f"{family_name} {style_name}",
        "styleName": "Regular",
        "uniqueFontIdentifier": f"{face};{FONT_VERSION:.3f}",
        "fullName": f"{family_name} {style_name}",
        "psName": face,
        "version": f"Version {FONT_VERSION:.3f}",
    }
    if not is_regular:
        names["typographicFamily"] = family_name
        names["typographicSubfamily"] = style_name

    woff2_bytes = None
    for ext, is_ttf in (("otf", False), ("ttf", True)):
        fb = FontBuilder(UPM, isTTF=is_ttf)
        fb.setupGlyphOrder(order)
        fb.setupCharacterMap(cmap)
        if is_ttf:
            tt = {}
            for name, (rec, _adv) in glyphs.items():
                pen = TTGlyphPen(None)
                rec.replay(ReverseContourPen(pen))   # TrueType outer contours run clockwise
                gl = pen.glyph()
                if gl.numberOfContours > 0:
                    gl.flags[0] |= 0x40              # OVERLAP_SIMPLE: contours overlap by design
                tt[name] = gl
            fb.setupGlyf(tt)
        else:
            cs = {}
            for name, (rec, adv) in glyphs.items():
                pen = T2CharStringPen(adv, None)
                rec.replay(pen)
                cs[name] = pen.getCharString()
            fb.setupCFF(
                psName=face,
                fontInfo={"FullName": f"{family_name} {style_name}", "FamilyName": family_name,
                          "Weight": style_name},
                charStringsDict=cs,
                privateDict={},
            )
        fb.setupHorizontalMetrics(metrics)
        fb.setupHorizontalHeader(ascent=HHEA_ASC, descent=HHEA_DESC, lineGap=LINE_GAP)
        fb.setupNameTable(names)
        fb.setupOS2(
            version=4,
            usWeightClass=weight,
            fsType=0,
            fsSelection=(0x40 if is_regular else 0) | 0x80,   # REGULAR + USE_TYPO_METRICS
            sTypoAscender=HHEA_ASC,
            sTypoDescender=HHEA_DESC,
            sTypoLineGap=LINE_GAP,
            usWinAscent=win_asc,
            usWinDescent=win_desc,
            sxHeight=X_H,
            sCapHeight=CAP_H,
            achVendID="WKDA",
        )
        fb.setupPost(underlinePosition=-120, underlineThickness=round(params.T * 0.8))
        fb.font["head"].fontRevision = FONT_VERSION
        fb.font["head"].macStyle = 0

        out_file = f"{face}.{ext}"
        fb.save(out_file)
        print(f"  [ok] {out_file}")
        if is_ttf:
            woff2_file = f"{face}.woff2"
            fb.font.flavor = "woff2"
            fb.save(woff2_file)
            woff2_bytes = Path(woff2_file).read_bytes()
            print(f"  [ok] {woff2_file} ({len(woff2_bytes):,} bytes)")
    return face, woff2_bytes


FACES = [
    # family, ps prefix, style key, style name, CSS weight, params
    ("Wicked Sans", "WickedSans", "sans", "Regular", 400, SANS_WEIGHTS[400]),
    ("Wicked Sans", "WickedSans", "sans", "SemiBold", 600, SANS_WEIGHTS[600]),
    ("Wicked Serif", "WickedSerif", "serif", "Regular", 400, SERIF_PARAMS),
    ("Wicked Script", "WickedScript", "script", "Regular", 400, SCRIPT_PARAMS),
]


def font_face_rule(family, weight, src):
    return (
        "@font-face {\n"
        f"  font-family: '{family}';\n"
        f"  src: {src} format('woff2');\n"
        f"  font-weight: {weight};\n"
        "  font-style: normal;\n"
        "  font-display: swap;\n"
        "}"
    )


def main():
    print("Building Wicked Agile 3-Font Suite (v2)...")
    built = []
    for family, prefix, style_key, style_name, weight, params in FACES:
        print(f"\n--- {family} {style_name} ({weight}) ---")
        face, woff2 = compile_face(family, prefix, style_key, style_name, weight, params)
        built.append((family, weight, face, woff2))

    inline = ["/* Wicked Agile web fonts: woff2 inlined as base64 (no external files). */"]
    hosted = ["/* Wicked Agile web fonts: self-hosted woff2 files next to this stylesheet. */"]
    for family, weight, face, woff2 in built:
        b64 = base64.b64encode(woff2).decode("ascii")
        inline.append(font_face_rule(family, weight, f"url('data:font/woff2;base64,{b64}')"))
        hosted.append(font_face_rule(family, weight, f"url('./{face}.woff2')"))
    Path("wicked-agile-fonts.css").write_text("\n\n".join(inline) + "\n", encoding="utf-8")
    Path("wicked-agile-fonts-selfhost.css").write_text("\n\n".join(hosted) + "\n", encoding="utf-8")
    print("\n[ok] wicked-agile-fonts.css (base64 bundle)")
    print("[ok] wicked-agile-fonts-selfhost.css (url() rules)")


if __name__ == "__main__":
    main()
