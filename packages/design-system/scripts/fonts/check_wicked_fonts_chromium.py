#!/usr/bin/env python3
"""Checks, in Chromium, which Wicked face each CSS weight actually renders with.

For each stylesheet (default: fonts.css, the consumer entry; fonts/wicked/wicked-agile-fonts-selfhost.css;
and the base64 source/wicked-fonts/wicked-agile-fonts.css), it renders spans at several weights, waits
until all four Wicked faces are loaded, and asks the browser (DevTools CSS.getPlatformFontsForNode)
which face drew each span:
  * Wicked Sans at 100, 300, 400 and 499 draws WickedSans-Regular; at 500 (--weight-label), 600,
    700 and 900 it draws WickedSans-SemiBold, and the SemiBold spans are wider than the Regular ones;
  * Wicked Serif and Wicked Script draw their one face at 100, 400, 500, 700 and 900;
  * within each face, every weight draws the same width and the same pixels as the face's own weight
    (400 or 600), so no weight is synthesised (faux bold) from it.

  npm run test:fonts:chromium        (from packages/design-system; uses uv)
  <python with playwright> -I scripts/fonts/check_wicked_fonts_chromium.py [stylesheet.css ...]
Exit status 1 on any failure.
"""
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

PACKAGE = Path(__file__).resolve().parents[2]
DEFAULT_SHEETS = [
    PACKAGE / "fonts.css",
    PACKAGE / "fonts" / "wicked" / "wicked-agile-fonts-selfhost.css",
    PACKAGE / "source" / "wicked-fonts" / "wicked-agile-fonts.css",
]
# family -> sample text, {face: (its own weight, [weights that must draw with it])}
FACES = {
    "Wicked Sans": ("Labels render SemiBold 0123", {
        "WickedSans-Regular": (400, [100, 300, 400, 499]),
        "WickedSans-SemiBold": (600, [500, 600, 700, 900]),
    }),
    "Wicked Serif": ("WICKED AGILE 0123", {"WickedSerif-Regular": (400, [100, 400, 500, 700, 900])}),
    "Wicked Script": ("WICKED AGILE 0123", {"WickedScript-Regular": (400, [100, 400, 500, 700, 900])}),
}
ROW = 48


def span_id(family, weight):
    return f"{family.split()[1].lower()}-{weight}"


def page_html(css):
    rows = []
    for family, (text, faces) in FACES.items():
        for _own, weights in faces.values():
            for w in weights:
                rows.append(f'<div><span id="{span_id(family, w)}" '
                            f'style="font-family:\'{family}\';font-weight:{w}">{text}</span></div>')
    return (f'<!doctype html><html><head><link rel="stylesheet" href="{css.as_uri()}">'
            f'<style>body{{margin:0;font-size:32px;line-height:{ROW}px;background:#fff;color:#000}}'
            f'div{{margin:0;height:{ROW}px}}span{{display:inline-block;white-space:nowrap}}</style></head>'
            f'<body>{"".join(rows)}</body></html>')


def check(browser, css):
    fails = []
    n_rows = sum(len(ws) for _t, faces in FACES.values() for _o, ws in faces.values())
    with tempfile.TemporaryDirectory() as tmp:
        page_path = Path(tmp) / "weights.html"
        page_path.write_text(page_html(css), encoding="utf-8")
        # Tall enough that no span is scrolled to before its screenshot.
        page = browser.new_page(viewport={"width": 1440, "height": n_rows * ROW + 100}, device_scale_factor=1)
        page.goto(page_path.as_uri())
        loaded = page.evaluate("""async () => {
            document.body.offsetHeight;                     // lay out, so the used faces start loading
            await document.fonts.ready;
            return [...document.fonts].filter(f => f.family.replace(/["']/g, '').startsWith('Wicked '))
                .map(f => `${f.family.replace(/["']/g, '')} ${f.weight} ${f.status}`);
        }""")
        print(f"{css.relative_to(PACKAGE) if css.is_relative_to(PACKAGE) else css}:")
        for line in loaded:
            print(f"  loaded: {line}")
        if len(loaded) != 4 or not all(line.endswith(" loaded") for line in loaded):
            fails.append(f"expected the 4 Wicked faces loaded, got {loaded}")
        cdp = page.context.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument")["root"]["nodeId"]

        def used_face(sid):
            node = cdp.send("DOM.querySelector", {"nodeId": root, "selector": f"#{sid}"})["nodeId"]
            fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
            return [f.get("postScriptName") or f["familyName"] for f in fonts]

        def width(sid):
            return page.evaluate(f"document.getElementById('{sid}').getBoundingClientRect().width")

        for family, (_text, faces) in FACES.items():
            for face, (own, weights) in faces.items():
                ref = span_id(family, own)
                ref_width, ref_pixels = width(ref), page.locator(f"#{ref}").screenshot()
                for w in weights:
                    sid = span_id(family, w)
                    got, got_width = used_face(sid), width(sid)
                    print(f"  {family} {w}: {', '.join(got)} ({got_width:.2f}px)")
                    if got != [face]:
                        fails.append(f"{family} {w} drew with {got}, expected [{face!r}]")
                    if abs(got_width - ref_width) > 0.01:
                        fails.append(f"{family} {w} is {got_width:.2f}px wide, {face} at {own} is {ref_width:.2f}px")
                    elif w != own and page.locator(f"#{sid}").screenshot() != ref_pixels:
                        fails.append(f"{family} {w} renders differently from {face} at {own} (faux bold)")
        regular, semibold = width(span_id("Wicked Sans", 400)), width(span_id("Wicked Sans", 600))
        if not semibold > regular:
            fails.append(f"Wicked Sans 600 ({semibold:.2f}px) is not wider than 400 ({regular:.2f}px)")
        page.close()
    for f in fails:
        print(f"  FAIL {f}")
    return not fails


def main():
    sheets = [Path(a).resolve() for a in sys.argv[1:]] or DEFAULT_SHEETS
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ok = all([check(browser, css) for css in sheets])
        browser.close()
    print("CHROMIUM WEIGHT CHECK PASSED" if ok else "CHROMIUM WEIGHT CHECK FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
