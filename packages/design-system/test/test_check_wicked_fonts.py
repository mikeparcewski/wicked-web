"""The font check must fail a regenerated face whose glyphs collapsed, not only pass the good ones.

  uv run --with fonttools --with brotli python -I -m unittest discover -s test -p 'test_*.py'
"""
import base64
import contextlib
import copy
import importlib.util
import io
import re
import tempfile
import unittest
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates

PACKAGE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("check_wicked_fonts", PACKAGE / "scripts" / "fonts" / "check_wicked_fonts.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)
SANS_TTF = PACKAGE / "source" / "wicked-fonts" / "WickedSans-Regular.ttf"


SHEETS = [PACKAGE / "fonts" / "wicked" / "wicked-agile-fonts-selfhost.css",
          PACKAGE / "source" / "wicked-fonts" / "wicked-agile-fonts.css"]


def run_check(path, check=None):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        ok = (check or checker.check)(path)
    return ok, out.getvalue()


class CheckWickedFonts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def mutated(self, change):
        font = TTFont(SANS_TTF)
        change(font, font.getBestCmap())
        path = Path(self.tmp.name) / "WickedSans-Regular.ttf"
        font.save(path)
        return path

    def test_every_shipped_face_passes(self):
        files = [p for folder in checker.DEFAULT_FOLDERS for p in sorted(folder.iterdir()) if p.suffix in {".woff2", ".otf", ".ttf"}]
        self.assertEqual(len(files), 12)
        for path in files:
            ok, out = run_check(path)
            self.assertTrue(ok, out)

    def test_inlined_stylesheet_carries_the_shipped_woff2(self):
        css = (PACKAGE / "source" / "wicked-fonts" / "wicked-agile-fonts.css").read_text(encoding="utf-8")
        payloads = re.findall(r"url\('data:font/woff2;base64,([A-Za-z0-9+/=]+)'\)", css)
        shipped = sorted((PACKAGE / "fonts" / "wicked").glob("*.woff2"))
        self.assertEqual(len(payloads), len(shipped))
        self.assertEqual(sorted(base64.b64decode(p) for p in payloads), sorted(p.read_bytes() for p in shipped))

    def sheet(self, source, change):
        path = Path(self.tmp.name) / source.name
        path.write_text(change(source.read_text(encoding="utf-8")), encoding="utf-8")
        return path

    def test_shipped_stylesheets_declare_the_weight_ranges(self):
        for sheet in SHEETS:
            ok, out = run_check(sheet, checker.check_css)
            self.assertTrue(ok, out)
            self.assertIn("WickedSans-Regular 100 499, WickedSans-SemiBold 500 900, "
                          "WickedSerif-Regular 100 900, WickedScript-Regular 100 900", out)

    def test_point_weights_fail(self):
        # The v2 sheets as first shipped: a 500 fell to the 400 face, a bold Serif was faux-bolded.
        points = {"100 499": "400", "500 900": "600", "100 900": "400"}
        for sheet in SHEETS:
            broken = self.sheet(sheet, lambda css: re.sub(
                r"font-weight: ([0-9 ]+);", lambda m: f"font-weight: {points[m.group(1)]};", css))
            ok, out = run_check(broken, checker.check_css)
            self.assertFalse(ok, out)
            self.assertIn("WickedSans-Regular: font-weight '400', expected '100 499'", out)
            self.assertIn("WickedSans-SemiBold: font-weight '600', expected '500 900'", out)
            self.assertIn("WickedSerif-Regular: font-weight '400', expected '100 900'", out)

    def test_a_missing_or_duplicated_face_fails(self):
        # Both sheets: rule 0 is the header comment, rules 1-4 the faces in FACES order.
        for sheet in SHEETS:
            rules = sheet.read_text(encoding="utf-8").split("\n\n")
            self.assertEqual(len(rules), 5)
            missing = self.sheet(sheet, lambda css: "\n\n".join(r for i, r in enumerate(rules) if i != 2))
            ok, out = run_check(missing, checker.check_css)
            self.assertFalse(ok, out)
            self.assertIn("WickedSans-SemiBold: declared 0 times, expected once", out)
            # A commented-out rule is not declared.
            commented = self.sheet(sheet, lambda css: re.sub(r"(@font-face \{.*?\})", r"/* \1 */", css, count=1, flags=re.S))
            ok, out = run_check(commented, checker.check_css)
            self.assertFalse(ok, out)
            self.assertIn("WickedSans-Regular: declared 0 times, expected once", out)
            doubled = self.sheet(sheet, lambda css: css + "\n" + rules[1])
            ok, out = run_check(doubled, checker.check_css)
            self.assertFalse(ok, out)
            self.assertIn("WickedSans-Regular: declared 2 times, expected once", out)

    def test_wrong_family_fails(self):
        for sheet in SHEETS:
            swapped = self.sheet(sheet, lambda css: css.replace("'Wicked Serif'", "'Wicked Sans'"))
            ok, out = run_check(swapped, checker.check_css)
            self.assertFalse(ok, out)
            self.assertIn("WickedSerif-Regular: font-family 'Wicked Sans', expected 'Wicked Serif'", out)

    def test_a_url_to_a_missing_file_fails(self):
        moved = self.sheet(SHEETS[0], lambda css: css)          # a copy, with no woff2 next to it
        ok, out = run_check(moved, checker.check_css)
        self.assertFalse(ok, out)
        self.assertIn("WickedSans-Regular: WickedSans-Regular.woff2 is not next to wicked-agile-fonts-selfhost.css", out)

    def test_collapsed_letters_fail(self):
        def collapse(font, cmap):
            # What a broken drawer does: 'b' gets the outline and metrics of 'a'.
            font["glyf"][cmap[ord("b")]] = copy.deepcopy(font["glyf"][cmap[ord("a")]])
            font["hmtx"][cmap[ord("b")]] = font["hmtx"][cmap[ord("a")]]
        ok, out = run_check(self.mutated(collapse))
        self.assertFalse(ok)
        self.assertIn("shared outline among letters/digits: a b", out)

    def test_collapsed_letters_fail_at_a_different_side_bearing(self):
        def collapse(font, cmap):
            # The same shape, but 'b' keeps its own advance and left side bearing, so it sits elsewhere.
            font["glyf"][cmap[ord("b")]] = copy.deepcopy(font["glyf"][cmap[ord("a")]])
            self.assertNotEqual(font["hmtx"][cmap[ord("b")]], font["hmtx"][cmap[ord("a")]])
        ok, out = run_check(self.mutated(collapse))
        self.assertFalse(ok)
        self.assertIn("shared outline among letters/digits: a b", out)

    def test_flattened_outline_fails(self):
        def flatten(font, cmap):
            # Contours remain, but every point is on one line: nothing is drawn.
            glyph = font["glyf"][cmap[ord("Q")]]
            self.assertGreater(glyph.numberOfContours, 0)
            glyph.coordinates = GlyphCoordinates([(x, 0) for x, _ in glyph.coordinates])
        ok, out = run_check(self.mutated(flatten))
        self.assertFalse(ok)
        self.assertIn("empty outline (no area) U+0051", out)

    def test_empty_outline_fails(self):
        def empty(font, cmap):
            font["glyf"][cmap[ord("Q")]] = Glyph()
        ok, out = run_check(self.mutated(empty))
        self.assertFalse(ok)
        self.assertIn("empty outline (no area) U+0051", out)

    def test_proportional_digits_fail(self):
        def widen(font, cmap):
            name = cmap[ord("1")]
            adv, lsb = font["hmtx"][name]
            font["hmtx"][name] = (adv + 40, lsb)
        ok, out = run_check(self.mutated(widen))
        self.assertFalse(ok)
        self.assertIn("digits are not tabular", out)


if __name__ == "__main__":
    unittest.main()
