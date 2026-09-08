"""Build the self-hosted report display font from the official Noto CJK OTF.

The source font is intentionally kept out of the deployable tree. The output
contains GB2312 plus every character found in the report's frontend sources.
"""

from pathlib import Path
from fontTools import subset


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".codex-tmp" / "NotoSerifCJKsc-Regular.otf"
OUTPUT = ROOT / "web" / "assets" / "fonts" / "shiseji-report-serif.woff2"


def build_character_set() -> str:
    characters = set()
    source_files = [
        *ROOT.glob("web/*.js"),
        *ROOT.glob("web/*.css"),
        *ROOT.glob("lib/*.js"),
        ROOT / "index.html",
    ]
    for path in source_files:
        if path.exists():
            characters.update(path.read_text(encoding="utf-8", errors="ignore"))

    for lead in range(0xA1, 0xF8):
        for trail in range(0xA1, 0xFF):
            try:
                characters.update(bytes((lead, trail)).decode("gb2312"))
            except UnicodeDecodeError:
                continue

    characters.update("\u00a0—–·•…“”‘’℃")
    return "".join(sorted(characters))


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing official source font: {SOURCE}")

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_languages = [0x409, 0x804]
    options.recalc_average_width = True
    options.recalc_max_context = True

    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=build_character_set())
    subsetter.subset(font)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUTPUT), options)
    print(f"Built {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
