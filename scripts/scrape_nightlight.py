#!/usr/bin/env python3
"""
scrape_nightlight.py — Extract official perk descriptions + version history
from nightlight.gg and emit scripts/nightlight_perks.json.

Data sources (all first-party nightlight.gg):
  - perk metadata table : bundled JS chunk (cached -> _nightlight_meta_raw.js)
  - per-perk detail      : https://nightlight.gg/perks/<slug>.data  (turbo-stream)

Usage:
  python scripts/scrape_nightlight.py --self-test          # decode cached sample only
  python scripts/scrape_nightlight.py --limit 5            # fetch first 5 perks
  python scripts/scrape_nightlight.py                      # fetch all perks
"""
import argparse
import json
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent.parent
SCRIPTS = Path(__file__).parent
META_RAW = SCRIPTS / "_nightlight_meta_raw.js"
CACHE_DIR = SCRIPTS / "_nightlight_cache"
OUT = SCRIPTS / "perk.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
BASE = "https://nightlight.gg"
ROLE = {1: "survivor", 2: "killer", 0: "general"}


# ── turbo-stream decoder ─────────────────────────────────────────────────────
# React Router single-fetch `.data` payload is a flat JSON array `V`.
# Composite values reference other entries by index:
#   object  -> {"_<keyIdx>": valIdx, ...}   (both key and value are indices)
#   array   -> [idx, idx, ...]              (each element is an index)
#   leaf    -> the entry at V[i] is a literal str/num/bool/null
# Negative indices encode turbo-stream constants (undefined/NaN/...); we map
# them all to None — irrelevant for the text we extract.
def decode_turbo_stream(text):
    arr = json.loads(text)
    memo = {}

    def resolve(i, stack):
        if isinstance(i, int) and i < 0:
            return None
        if i in memo:
            return memo[i]
        if i in stack:                     # cycle guard
            return None
        stack = stack | {i}
        v = arr[i]
        if isinstance(v, dict):
            out = {}
            for k, val in v.items():
                key = resolve(int(k[1:]), stack) if k.startswith("_") else k
                out[key] = resolve(val, stack)
            res = out
        elif isinstance(v, list):
            res = [resolve(x, stack) for x in v]
        else:
            res = v
        memo[i] = res
        return res

    return resolve(0, frozenset())


# ── html -> clean text (keeps tunable numbers like 40/50/60) ─────────────────
class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self._block = {"p", "li", "br", "ul", "ol", "div"}

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "li"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._block:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(html):
    if not html:
        return ""
    p = _Text()
    p.feed(html)
    txt = "".join(p.parts)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n\s*\n+", "\n", txt)
    lines = [ln.strip() for ln in txt.splitlines()]
    return "\n".join(ln for ln in lines if ln).strip()


# ── load perk metadata table from the cached JS chunk ────────────────────────
def load_perk_meta():
    raw = META_RAW.read_text(encoding="utf-8")
    # the map is declared as  var XX=JSON.parse(`{ ...big json... }`)
    # grab the backtick string that contains the first known perk.
    # there are several JSON.parse(`...`) calls; pick the one that is the perk map
    blob = None
    for m in re.finditer(r"JSON\.parse\(`(\{.*?\})`\)", raw, re.DOTALL):
        if '"Dark Sense"' in m.group(1) or '"Decisive Strike"' in m.group(1):
            blob = m.group(1)
            break
    if blob is None:
        sys.exit("Could not locate the perk-map JSON.parse(`...`) in metadata file.")
    # undo JS template-literal escaping: `\\` -> `\`, `\`` -> `` ` ``, `\$` -> `$`
    blob = blob.replace("\\\\", "\\").replace("\\`", "`").replace("\\$", "$")
    # JS allows `\xHH`; JSON does not -> rewrite to `\u00HH`
    blob = re.sub(r"\\x([0-9A-Fa-f]{2})", r"\\u00\1", blob)
    data = json.loads(blob)
    perks = []
    for pid, info in data.items():
        if int(pid) <= 0:                  # skip "None"/"Unknown" placeholders
            continue
        url = info.get("u", "")
        if not url.startswith("/perks/"):
            continue
        perks.append({
            "id": int(pid),
            "name": info.get("n", ""),
            "slug": url[len("/perks/"):],
            "url": url,
            "role": ROLE.get(info.get("r"), "unknown"),
        })
    perks.sort(key=lambda p: p["id"])
    return perks


# ── fetch one perk's .data (cached on disk) ──────────────────────────────────
def fetch_data(slug, force=False):
    CACHE_DIR.mkdir(exist_ok=True)
    cache = CACHE_DIR / f"{slug}.data"
    if cache.exists() and not force:
        return cache.read_text(encoding="utf-8")
    url = f"{BASE}/perks/{slug}.data"
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
    cache.write_text(body, encoding="utf-8")
    return body


# ── pull the perk detail object out of the decoded tree ──────────────────────
def find_container(tree):
    """Walk the decoded structure for the perk-detail container
    (the dict holding both 'excerpt' and 'perk_updates')."""
    stack = [tree]
    seen = set()
    while stack:
        node = stack.pop()
        if id(node) in seen:
            continue
        seen.add(id(node))
        if isinstance(node, dict):
            if "perk_updates" in node and "excerpt" in node:
                return node
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return None


def extract(perk, tree):
    c = find_container(tree) or {}
    basic = c.get("perk") or {}
    raw_updates = [u for u in (c.get("perk_updates") or []) if isinstance(u, dict)]

    history = []
    for u in raw_updates:
        changes = [
            {"type": ch.get("type") or "", "text": html_to_text(ch.get("description"))}
            for ch in (u.get("changes") or []) if isinstance(ch, dict)
        ]
        history.append({
            "version": u.get("version") or "",
            "date": u.get("friendly_date") or "",
            "description": html_to_text(u.get("description")),
            "changes": changes,
        })

    # current description = most recent version entry (updates are newest-first)
    current = history[0]["description"] if history else ""

    return {
        "id": perk["id"],
        "name": basic.get("name") or perk["name"],
        "character": basic.get("character") or "",
        "role": (basic.get("role") or perk["role"] or "").lower(),
        "url": perk["url"],
        "patch_added": basic.get("patch_added") or "",
        "teachable": basic.get("teachable"),
        "licensed": basic.get("licensed"),
        "excerpt": (c.get("excerpt") or "").strip(),
        "description": current,
        "previous_names": c.get("previous_names") or [],
        "version_history": history,
    }


def self_test():
    sample = SCRIPTS.parent / "scripts" / "_sample_ds.data"
    # fall back to /tmp sample copied during dev
    for cand in (CACHE_DIR / "Decisive_Strike.data", sample):
        if cand.exists():
            tree = decode_turbo_stream(cand.read_text(encoding="utf-8"))
            rec = extract({"id": 57, "name": "Decisive Strike",
                           "role": "survivor", "url": "/perks/Decisive_Strike"}, tree)
            print(json.dumps(rec, indent=2, ensure_ascii=False)[:2500])
            return
    print("No cached sample found; run with --limit 1 first.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="fetch only first N perks")
    ap.add_argument("--delay", type=float, default=0.4, help="seconds between requests")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--force", action="store_true", help="ignore disk cache")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return

    perks = load_perk_meta()
    print(f"[meta] {len(perks)} perks in metadata table")
    if args.limit:
        perks = perks[:args.limit]
        print(f"[meta] limited to {len(perks)}")

    out, fails = [], []
    for i, perk in enumerate(perks, 1):
        try:
            body = fetch_data(perk["slug"], force=args.force)
            tree = decode_turbo_stream(body)
            rec = extract(perk, tree)
            out.append(rec)
            n_hist = len(rec["version_history"])
            print(f"[{i}/{len(perks)}] {perk['name']:<28} "
                  f"desc={len(rec['description'])}c hist={n_hist}")
        except Exception as e:
            fails.append((perk["name"], str(e)))
            print(f"[{i}/{len(perks)}] {perk['name']:<28} FAILED: {e}")
        if i < len(perks):
            time.sleep(args.delay)

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[done] wrote {len(out)} perks -> {OUT}")
    if fails:
        print(f"[warn] {len(fails)} failures: {fails[:5]}")


if __name__ == "__main__":
    main()
