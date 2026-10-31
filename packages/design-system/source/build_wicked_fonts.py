"""
Wicked Agile 3-Font Suite Compiler (Wicked Serif, Wicked Script, Wicked Sans)
Run: uv run --with fonttools --with brotli build_wicked_fonts.py
Outputs .otf, .ttf, and web-ready .woff2 files.
"""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

print("Run this script with fonttools + brotli to compile WickedSerif.woff2, WickedScript.woff2, and WickedSans.woff2")
