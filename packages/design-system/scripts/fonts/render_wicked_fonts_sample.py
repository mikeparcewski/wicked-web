#!/usr/bin/env python3
"""Renders an HTML page that loads the Wicked faces to a PNG with Playwright, so a rebuilt
face is looked at, not only checked. Prints each loaded face and its status.

  <venv with playwright>/bin/python -I scripts/fonts/render_wicked_fonts_sample.py \
      <page.html> <out.png> [width]
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def main():
    page_path = Path(sys.argv[1]).resolve()
    out = Path(sys.argv[2]).resolve()
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": width, "height": 700}, device_scale_factor=1)
        page.goto(page_path.as_uri())
        page.evaluate("document.fonts.ready")
        loaded = page.evaluate("[...document.fonts].map(f => `${f.family} ${f.weight} ${f.status}`)")
        page.wait_for_timeout(300)
        page.screenshot(path=str(out), full_page=True)
        browser.close()
    for line in loaded:
        print(line)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
