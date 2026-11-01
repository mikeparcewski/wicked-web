"""The font check must fail a regenerated face whose glyphs collapsed, not only pass the good ones.

  uv run --with fonttools --with brotli python -I -m unittest discover -s test -p 'test_*.py'
"""
import contextlib
import copy
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph

PACKAGE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("check_wicked_fonts", PACKAGE / "scripts" / "fonts" / "check_wicked_fonts.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)
SANS_TTF = PACKAGE / "source" / "wicked-fonts" / "WickedSans-Regular.ttf"


def run_check(path):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        ok = checker.check(path)
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

    def test_collapsed_letters_fail(self):
        def collapse(font, cmap):
            # What a broken drawer does: 'b' gets the outline and metrics of 'a'.
            font["glyf"][cmap[ord("b")]] = copy.deepcopy(font["glyf"][cmap[ord("a")]])
            font["hmtx"][cmap[ord("b")]] = font["hmtx"][cmap[ord("a")]]
        ok, out = run_check(self.mutated(collapse))
        self.assertFalse(ok)
        self.assertIn("shared outline among letters/digits: a b", out)

    def test_empty_outline_fails(self):
        def empty(font, cmap):
            font["glyf"][cmap[ord("Q")]] = Glyph()
        ok, out = run_check(self.mutated(empty))
        self.assertFalse(ok)
        self.assertIn("empty outline U+0051", out)

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
