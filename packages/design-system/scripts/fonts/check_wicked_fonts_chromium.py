#!/usr/bin/env python3
"""Checks, in Chromium, which Wicked face each CSS weight actually renders with.

Loads fonts/wicked/wicked-agile-fonts-selfhost.css (or the stylesheet given) and asks the browser
(DevTools CSS.getPlatformFontsForNode) which face drew each span:
  * Wicked Sans at 100, 300, 400 and 499 draws WickedSans-Regular; at 500 (--weight-label), 600,
    700 and 900 it draws WickedSans-SemiBold;
  * the 500 span is exactly as wide as the 600 one and wider than the 400 one (the faces' advances);
  * Wicked Serif and Wicked Script at 700 draw the same pixels as at 400 (no faux bold).

  <venv with playwright>/bin/python -I scripts/fonts/check_wicked_fonts_chromium.py [stylesheet.css]
Exit status 1 on any failure.
"""
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

PACKAGE = Path(__file__).resolve().parents[2]
DEFAULT_CSS = PACKAGE / "fonts" / "wicked" / "wicked-agile-fonts-selfhost.css"
TEXT = "Labels render SemiBold 0123"
SANS = {100: "WickedSans-Regular", 300: "WickedSans-Regular", 400: "WickedSans-Regular",
        499: "WickedSans-Regular", 500: "WickedSans-SemiBold", 600: "WickedSans-SemiBold",
        700: "WickedSans-SemiBold", 900: "WickedSans-SemiBold"}
SINGLE = {"Wicked Serif": "WickedSerif-Regular", "Wicked Script": "WickedScript-Regular"}


def page_html(css):
    spans = [f'<p><span id="sans-{w}" style="font-family:\'Wicked Sans\';font-weight:{w}">{TEXT}</span></p>'
             for w in SANS]
    for family in SINGLE:
        slug = family.split()[1].lower()
        for w in (400, 700):
            spans.append(f'<p><span id="{slug}-{w}" style="font-family:\'{family}\';font-weight:{w}">'
                         f'WICKED AGILE</span></p>')
    return (f'<!doctype html><html><head><link rel="stylesheet" href="{css.as_uri()}">'
            '<style>body{margin:0;font-size:32px;line-height:1.5;background:#fff;color:#000}'
            'span{display:inline-block;white-space:nowrap}</style></head>'
            f'<body>{"".join(spans)}</body></html>')


def main():
    css = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_CSS
    fails = []
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        page_path = Path(tmp) / "weights.html"
        page_path.write_text(page_html(css), encoding="utf-8")
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 700}, device_scale_factor=1)
        page.goto(page_path.as_uri())
        page.evaluate("document.fonts.ready")
        loaded = page.evaluate("[...document.fonts].map(f => `${f.family} ${f.weight} ${f.status}`)")
        cdp = page.context.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument")["root"]["nodeId"]

        def used_face(span_id):
            node = cdp.send("DOM.querySelector", {"nodeId": root, "selector": f"#{span_id}"})["nodeId"]
            fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
            return [f.get("postScriptName") or f["familyName"] for f in fonts]

        def width(span_id):
            return page.evaluate(f"document.getElementById('{span_id}').getBoundingClientRect().width")

        for line in loaded:
            print(f"  loaded: {line}")
        for w, want in SANS.items():
            got = used_face(f"sans-{w}")
            print(f"Wicked Sans {w}: {', '.join(got)} ({width(f'sans-{w}'):.2f}px)")
            if got != [want]:
                fails.append(f"Wicked Sans {w} drew with {got}, expected [{want!r}]")
        w400, w500, w600 = width("sans-400"), width("sans-500"), width("sans-600")
        if abs(w500 - w600) > 0.01 or not w500 > w400:
            fails.append(f"Wicked Sans 500 is {w500:.2f}px wide: expected the 600 width {w600:.2f}px, "
                         f"wider than the 400 width {w400:.2f}px")
        for family, want in SINGLE.items():
            slug = family.split()[1].lower()
            for w in (400, 700):
                got = used_face(f"{slug}-{w}")
                print(f"{family} {w}: {', '.join(got)}")
                if got != [want]:
                    fails.append(f"{family} {w} drew with {got}, expected [{want!r}]")
            regular = page.locator(f"#{slug}-400").screenshot()
            bold = page.locator(f"#{slug}-700").screenshot()
            if regular != bold:
                fails.append(f"{family} 700 renders differently from 400 (faux bold)")
        browser.close()
    for f in fails:
        print(f"  FAIL {f}")
    print("CHROMIUM WEIGHT CHECK PASSED" if not fails else "CHROMIUM WEIGHT CHECK FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
