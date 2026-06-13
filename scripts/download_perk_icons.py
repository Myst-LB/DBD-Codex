#!/usr/bin/env python3
"""
download_perk_icons.py — (re)download ALL perk icons (survivor + killer) from
nightlight.gg into images/perks/ using the flat naming app.js perkIconUrl()
expects:  images/perks/iconPerks_<PascalName>.png

Source : https://cdn.nightlight.gg/img/perks/<slug>.png   (<slug> = metadata 'i')
Run    : python scripts/download_perk_icons.py            # fetch everything
         python scripts/download_perk_icons.py --skip-existing
"""
import argparse
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent
META_RAW = SCRIPTS / "_nightlight_meta_raw.js"
DATA_JS = ROOT / "data.js"
ICON_DIR = ROOT / "images" / "perks"
CDN = "https://cdn.nightlight.gg/img/perks/{}.png"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# data.js perk name -> nightlight.gg name, where the two spellings differ
ALIAS = {
    "Will Make It":      "We'll make it",
    "1 2 3 4":           "ONE-TWO-THREE-FOUR!",
    "Better Boom":       "Bada Bada Boom",
    "Eyes of Belmond":   "Eyes of Belmont",
    "Soul Survivor":     "Sole Survivor",
    "Hex: Blood Favour": "Hex: Blood Favor",
    "Barbecue & Chilli": "Barbecue & Chili",
    "Collective Stealth": "Teamwork: Collective Stealth",
}


def pascal(name):
    """Mirror app.js perkIconUrl(): strip non-alnum, TitleCase words, join."""
    cleaned = re.sub(r"[^A-Za-z0-9 ]", "", name)
    return "".join(w[0].upper() + w[1:] for w in cleaned.split(" ") if w)


def norm(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def load_meta_slugs():
    raw = META_RAW.read_text(encoding="utf-8")
    blob = None
    for m in re.finditer(r"JSON\.parse\(`(\{.*?\})`\)", raw, re.DOTALL):
        if '"Decisive Strike"' in m.group(1) or '"Dark Sense"' in m.group(1):
            blob = m.group(1)
            break
    if blob is None:
        raise SystemExit("perk-map JSON not found in metadata file")
    blob = blob.replace("\\\\", "\\").replace("\\`", "`").replace("\\$", "$")
    blob = re.sub(r"\\x([0-9A-Fa-f]{2})", r"\\u00\1", blob)
    by_norm = {}
    for info in json.loads(blob).values():
        name, slug = info.get("n", ""), info.get("i", "")
        if name and slug:
            by_norm.setdefault(norm(name), slug)
    return by_norm


def load_perk_names():
    src = DATA_JS.read_text(encoding="utf-8")
    names = []
    for var in ("PERKS", "KILLER_PERKS"):
        m = re.search(rf"const {var} = (\[.*?\]);\n", src, re.DOTALL)
        if m:
            names += [(p["name"], var) for p in json.loads(m.group(1))]
    return names


def fetch(slug):
    req = urllib.request.Request(CDN.format(slug),
                                 headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--delay", type=float, default=0.2)
    args = ap.parse_args()

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    by_norm = load_meta_slugs()
    names = load_perk_names()
    print(f"[meta] {len(by_norm)} slugs | [data] {len(names)} perks "
          f"-> {ICON_DIR}")

    saved = skipped = 0
    missing, failed = [], []
    for name, var in names:
        dest = ICON_DIR / f"iconPerks_{pascal(name)}.png"
        if args.skip_existing and dest.exists():
            skipped += 1
            continue
        slug = by_norm.get(norm(ALIAS.get(name, name)))
        if not slug:
            missing.append(f"{name} ({var})")
            continue
        try:
            dest.write_bytes(fetch(slug))
            saved += 1
        except Exception as e:
            failed.append((name, slug, str(e)))
            print(f"  ! {name:<30} FAILED {slug}: {e}")
        time.sleep(args.delay)

    print(f"\n[done] saved={saved} skipped={skipped} "
          f"no-slug={len(missing)} failed={len(failed)} "
          f"-> {len(list(ICON_DIR.glob('iconPerks_*.png')))} files on disk")
    if missing:
        print("  no nightlight slug:", missing)
    if failed:
        print("  failed:", failed[:5])


if __name__ == "__main__":
    main()
