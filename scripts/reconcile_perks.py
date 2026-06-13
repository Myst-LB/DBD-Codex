#!/usr/bin/env python3
"""
reconcile_perks.py — match data.js perks against scripts/nightlight_perks.json
and report which descriptions can be replaced with official text.

Read-only: prints a diff report. No files are written.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_JS = ROOT / "data.js"
NL = Path(__file__).parent / "perk.json"


def load_js_array(src, var):
    m = re.search(rf"const {var} = (\[.*?\]);\n", src, re.DOTALL)
    if not m:
        return []
    return json.loads(m.group(1))


def norm(name):
    n = name.lower().strip()
    n = n.split(":")[-1].strip() if ":" in n else n   # drop "Boon:" / "Hex:" prefix
    n = re.sub(r"[^a-z0-9]+", "", n)
    return n


def main():
    src = DATA_JS.read_text(encoding="utf-8")
    perks = load_js_array(src, "PERKS")
    kperks = load_js_array(src, "KILLER_PERKS")
    nl = json.loads(NL.read_text(encoding="utf-8"))

    # build nightlight index (normalized name -> record); keep full-name index too
    nl_by_norm = {}
    nl_by_full = {}
    for r in nl:
        nl_by_full[r["name"].lower().strip()] = r
        nl_by_norm.setdefault(norm(r["name"]), r)

    def match(p):
        full = p["name"].lower().strip()
        return nl_by_full.get(full) or nl_by_norm.get(norm(p["name"]))

    for label, lst in (("SURVIVOR PERKS (PERKS)", perks),
                       ("KILLER PERKS (KILLER_PERKS)", kperks)):
        matched, unmatched = [], []
        for p in lst:
            (matched if match(p) else unmatched).append(p)
        print(f"\n=== {label}: {len(lst)} total | "
              f"{len(matched)} matched | {len(unmatched)} unmatched ===")
        for p in unmatched:
            print(f"  [no nightlight match] {p['name']}  ({p.get('character','')})")

    used = {id(match(p)) for p in perks + kperks if match(p)}
    extra = [r for r in nl if id(r) not in used]
    print(f"\n=== nightlight perks with NO data.js counterpart: {len(extra)} ===")
    for r in extra[:40]:
        print(f"  {r['name']}  ({r['role']})")
    if len(extra) > 40:
        print(f"  ... and {len(extra)-40} more")


if __name__ == "__main__":
    main()
