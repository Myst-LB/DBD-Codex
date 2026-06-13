#!/usr/bin/env python3
"""Download perk icons — tries GitHub repo first, wiki.gg as fallback."""
import sys, re, json, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from pathlib import Path
import urllib.request

ROOT    = Path(__file__).parent.parent
OUT_DIR = ROOT / "images" / "perks"
OUT_DIR.mkdir(parents=True, exist_ok=True)

GITHUB_URL = "https://raw.githubusercontent.com/newbstar/dbd-assets/main/icons/iconPerks_{}.png"
WIKI_URL   = "https://deadbydaylight.wiki.gg/images/IconPerks_{}.png"
HEADERS    = {"User-Agent": "Mozilla/5.0 (DBD Codex fan site icon fetcher)"}

def to_pascal(name):
    """PascalCase for GitHub repo: 'Dead Hard' → 'DeadHard'"""
    clean = re.sub(r"[^A-Za-z0-9 ]", "", name)
    return "".join(w.capitalize() for w in clean.split())

def to_lower_camel(name):
    """lowerCamelCase for wiki.gg: 'Dead Hard' → 'deadHard', 'Self-Care' → 'self-Care'"""
    name = re.sub(r"[^A-Za-z0-9 \-]", "", name)
    words = name.split()
    result = []
    for i, word in enumerate(words):
        parts = word.split("-")
        word_str = ""
        for j, part in enumerate(parts):
            if not part:
                word_str += "-"
                continue
            if i == 0 and j == 0:
                word_str += part.lower()
            else:
                word_str += part[0].upper() + part[1:]
            if j < len(parts) - 1:
                word_str += "-"
        result.append(word_str)
    return "".join(result)

def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read()

# Load perks
data = (ROOT / "data.js").read_text(encoding="utf-8")
perks_json = re.search(r"const PERKS = (\[.*?\]);", data, re.DOTALL).group(1)
perks = json.loads(perks_json)

ok, still_missing = [], []

for p in perks:
    pascal = to_pascal(p["name"])
    wiki   = to_lower_camel(p["name"])
    dest   = OUT_DIR / f"iconPerks_{pascal}.png"

    if dest.exists():
        ok.append(p["name"])
        continue

    # Try GitHub first
    downloaded = False
    try:
        data_bytes = fetch(GITHUB_URL.format(pascal))
        dest.write_bytes(data_bytes)
        ok.append(p["name"])
        print(f"  ✓ [gh]   {p['name']}")
        downloaded = True
    except Exception:
        pass

    if downloaded:
        time.sleep(0.05)
        continue

    # Fallback: wiki.gg
    try:
        data_bytes = fetch(WIKI_URL.format(wiki))
        dest.write_bytes(data_bytes)
        ok.append(p["name"])
        print(f"  ✓ [wiki] {p['name']} (wiki: {wiki})")
    except Exception as e:
        still_missing.append((p["name"], pascal, wiki, str(e)))
        print(f"  ✗        {p['name']} — {e}")

    time.sleep(0.08)

print(f"\nDone: {len(ok)}/{len(perks)} icons, {len(still_missing)} still missing")
if still_missing:
    print("Still missing:")
    for name, p, w, err in still_missing:
        print(f"  {name}  (pascal={p}, wiki={w})")
