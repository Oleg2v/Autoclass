"""Subset self-hosted variable fonts (Hebrew + basic Latin) into public/fonts.

Run: npm run fonts   (requires: pip install fonttools brotli)
Sources come from the @fontsource-variable/* devDependencies (OFL-licensed).
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
NM = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "public" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

HEB = "U+0590-05FF,U+200C-200F,U+2010-2011,U+20AA,U+25CC,U+FB1D-FB4F"
LAT = "U+0020-007E,U+00A0-00BF,U+00D7,U+00F7,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2032-2033,U+2039-203A,U+20AC,U+2122,U+2190-2193"
# Hebrew text still needs space/punctuation/digits from the same face
HEB_FULL = HEB + ",U+0020-0040,U+005B-0060,U+007B-007E,U+00A0,U+2013-2014,U+2019,U+201C-201E,U+2022,U+2026"

JOBS = [
    ("noto-sans-hebrew/files/noto-sans-hebrew-hebrew-standard-normal.woff2", "noto-heb.woff2", HEB_FULL),
    ("noto-sans-hebrew/files/noto-sans-hebrew-latin-standard-normal.woff2", "noto-lat.woff2", LAT),
    ("frank-ruhl-libre/files/frank-ruhl-libre-hebrew-wght-normal.woff2", "frank-heb.woff2", HEB_FULL),
]

def ranges(spec):
    out = []
    for part in spec.split(","):
        part = part.replace("U+", "")
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            out.append(int(part, 16))
    return out

for src, dst, spec in JOBS:
    font = TTFont(NM / src)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=ranges(spec))
    s.subset(font)
    font.flavor = "woff2"
    font.save(OUT / dst)
    print(f"{dst}: {(OUT / dst).stat().st_size / 1024:.1f} KB")
