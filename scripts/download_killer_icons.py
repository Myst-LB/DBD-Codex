#!/usr/bin/env python3
"""
download_killer_icons.py — fetch killer-perk icons from nightlight.gg and save
them under the project's existing convention  images/perks/iconPerks_<Pascal>.png
so app.js perkIconUrl() resolves them with no code change.

Source: https://cdn.nightlight.gg/img/perks/<slug>.png   (<slug> = metadata 'i')
"""
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

# data.js name -> nightlight name, for the handful that differ in spelling
ALIAS = {
    "Hex: Blood Favour": "Hex: Blood Favor",
    "Barbecue & Chilli": "Barbecue & Chili",
}


def pascal(name):
    """Mirror app.js perkIconUrl(): strip non-alnum, TitleCase each word, join."""
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
    blob = blob.replace("\\\\", "\\").replace("\\`", "`").replace("\\$", "$")
    blob = re.sub(r"\\x([0-9A-Fa-f]{2})", r"\\u00\1", blob)
    data = json.loads(blob)
    by_norm = {}
    for info in data.values():
        name, slug = info.get("n", ""), info.get("i", "")
        if name and slug:
            by_norm.setdefault(norm(name), slug)
    return by_norm


def load_killer_perk_names():
    src = DATA_JS.read_text(encoding="utf-8")
    m = re.search(r"const KILLER_PERKS = (\[.*?\]);\n", src, re.DOTALL)
    return [p["name"] for p in json.loads(m.group(1))]


def fetch(slug):
    req = urllib.request.Request(CDN.format(slug),
                                 headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    by_norm = load_meta_slugs()
    names = load_killer_perk_names()
    print(f"[meta] {len(by_norm)} slugs | [data] {len(names)} killer perks")

    saved = skipped = 0
    missing, failed = [], []
    for name in names:
        dest = ICON_DIR / f"iconPerks_{pascal(name)}.png"
        if dest.exists():
            skipped += 1
            continue
        lookup = ALIAS.get(name, name)
        slug = by_norm.get(norm(lookup))
        if not slug:
            missing.append(name)
            continue
        try:
            data = fetch(slug)
            dest.write_bytes(data)
            saved += 1
            print(f"  + {dest.name:<42} ({len(data)} b)  <- {slug}")
        except Exception as e:
            failed.append((name, slug, str(e)))
            print(f"  ! {name:<32} FAILED {slug}: {e}")
        time.sleep(0.25)

    print(f"\n[done] saved={saved} skipped(existing)={skipped} "
          f"no-slug={len(missing)} failed={len(failed)}")
    if missing:
        print("  no nightlight slug:", missing)
    if failed:
        print("  failed:", failed[:5])


if __name__ == "__main__":
    main()
