#!/usr/bin/env python3
"""Build a woff2 subset of Noto Serif SC covering the site plus GB2312."""

from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/tmp/NotoSerifSC-vf.ttf")
OUTPUT = ROOT / "src" / "fonts" / "NotoSerifSC.woff2"

text = []
for path in (ROOT / "src").rglob("*"):
    if path.suffix.lower() in {".ts", ".css", ".json", ".html"} and path.is_file():
        text.append(path.read_text(encoding="utf-8"))
text.append((ROOT / "index.html").read_text(encoding="utf-8"))
text.append((ROOT / "README.md").read_text(encoding="utf-8") if (ROOT / "README.md").exists() else "")

chars = set("".join(text))
for hi in range(0xA1, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            chars.add(bytes([hi, lo]).decode("gb2312"))
        except UnicodeDecodeError:
            pass

# Pinyin tone letters, ASCII, and common punctuation live in these ranges.
extra = []
for start, end in (
    (0x0020, 0x007E),
    (0x00A0, 0x024F),
    (0x2000, 0x206F),
    (0x3000, 0x303F),
    (0xFF00, 0xFFEF),
):
    extra.extend(chr(code) for code in range(start, end + 1))

unicodes = sorted({ord(char) for char in chars if ord(char) > 31} | {ord(char) for char in extra})
options = Options()
options.flavor = "woff2"
options.layout_features = ["kern"]
options.desubroutinize = True
options.ignore_missing_unicodes = True
font = TTFont(SOURCE)
subsetter = Subsetter(options=options)
subsetter.populate(unicodes=unicodes)
subsetter.subset(font)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
font.flavor = "woff2"
font.save(OUTPUT)
print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes, {len(unicodes)} codepoints)")
