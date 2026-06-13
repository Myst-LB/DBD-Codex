# Build Plan — Dead by Daylight Codex (Horror/Halloween themed web app)

**Audience:** Sonnet (implementation agent)
**Goal:** Turn the `dbd_perks_updated_F - Copy.xlsx` workbook (plus the `.txt` for one missing column) into a polished, horror/Halloween/DBD-themed website covering **all** the data: 169 survivor perks, 22 killers, 52 survivors, 15 combo builds, and a category browser — with search, filtering, and an "about" section.

---

## 0. Environment (already set up — don't redo)

- **Python 3.12.10** is installed and on PATH (`python`), with **pip 25.0.1** and **openpyxl 3.1.5**. Use these to read the xlsx.
- If a brand-new shell ever can't find `python`, fall back to the full path:
  `C:\Users\benka\AppData\Local\Programs\Python\Python312\python.exe`
- No Node. Keep the website itself dependency-free (plain HTML/CSS/vanilla JS).

---

## 1. Source data

Two source files in this folder:

- **`dbd_perks_updated_F - Copy.xlsx`** — the primary, richer source. **6 sheets:**
  | Sheet | Content | Rows |
  |---|---|---|
  | `Full Tier List` | 169 survivor perks: #, Tier, ★, Name, Character/Origin, Category, Description & Tips, Synergy Combos | 169 perks |
  | `Combo Builds` | 15 recommended loadouts: Build Name, Perks, Strategy | 15 |
  | `By Category` | Same perks grouped under ~60 category banners (derivable from perk `category`, so optional) | — |
  | `Summary` | Tier definitions + version (9.5.0) + source credit + "top recommended" list | — |
  | `Killer Tier List` | 22 killers: Rank, Tier (S–D), Killer, Power/Ability, Strengths, Weaknesses, Status, Price/DLC | 22 |
  | `Survivor Tier List` | 52 survivors: Video Rank, Survivor, Model Size, Noise Level, Status, Price/DLC, Notes, Perk1–3 | 52 |

- **`dbd_perks_updated_F.txt`** — UTF-16LE, tab-separated. Same 169 perks but **has the Character/Origin filled for every perk**.

### ⚠️ Critical data caveat — merge for character names
In the **xlsx `Full Tier List`, the Character/Origin column is essentially empty** (only ~15 of 169 filled). The **`.txt` has all 169 characters.** So the build script must **read perks from the xlsx and backfill `character` from the `.txt`, matched by perk name** (or by id — both are ordered 1–169 identically). Verify the join covers all 169.

### Parsing gotchas
- xlsx strings are stored as `inlineStr` — openpyxl handles this transparently; just use `openpyxl.load_workbook(path, data_only=True)`.
- The `Full Tier List` has a header row and **5 tier-banner rows** (e.g. `★★★★★  EXCELLENT`) interleaved — skip rows whose first cell isn't a number.
- The `.txt` is **UTF-16LE**: open with `encoding="utf-16"`. It has a junk `&&&&&` separator column and the same banner rows.
- Tier label normalization: tiers are `Excellent`, `Very Good`, `Decent`, `Weak/Niche`, `Terrible`.

### Sanity-check counts
- Perks: **169** (ids 1–169). Tiers by perk-row: Excellent 8, Very Good 14, Decent 47, Weak/Niche 80, Terrible 20. *(The `Summary` sheet quotes slightly different rounded counts from the source video — trust the actual `Full Tier List` rows, 169 total.)*
- Killers: **22**. Survivors: **52**. Combo builds: **15**. Categories: ~60 distinct.

---

## 2. Build the data file → `data.js`

Write `scripts/build_data.py` that:
1. Loads the xlsx with openpyxl and reads each of the 5 useful sheets (skip `By Category` — regenerate it client-side from perk categories).
2. Reads the `.txt` (UTF-16) and builds a `name → character` map; backfills perk characters.
3. Cleans text (strip whitespace; normalize mojibake arrows/em-dashes/accents to proper Unicode).
4. Emits **`data.js`** that assigns plain JS globals so the site works from `file://` with **no fetch/CORS**:
   ```js
   const PERKS    = [ {id, tier, name, character, category, description, synergy}, … ];   // 169
   const KILLERS  = [ {rank, tier, name, power, strengths, weaknesses, status, price}, … ]; // 22
   const SURVIVORS= [ {rank, name, modelSize, noise, status, price, notes, perks:[..]}, … ]; // 52
   const BUILDS   = [ {name, perks, strategy}, … ];                                          // 15
   const META     = { version:"9.5.0", source:"…", tiers:[{tier,count,desc}, …] };
   ```
5. Prints assertion results (counts) so the parse is verifiable. Keep the script in the repo for regeneration.

**Verify:** 169 perks (all with non-empty `character`), 22 killers, 52 survivors, 15 builds.

---

## 3. Site structure (single page, tabbed sections)

One `index.html`, no build step, opens by double-click. Top nav switches between sections (hash-routed, e.g. `#perks`):

1. **Perks** (default) — the codex; search + tier + category + character filters; cards grouped by tier.
2. **Builds** — the 15 combo loadouts as themed cards (name, the perks involved, the strategy text). Link perk names back to the Perks section where possible.
3. **Killers** — 22 killer cards/rows ranked S→D, color-coded by tier, showing power, strengths, weaknesses, DLC/price. Filter by tier.
4. **Survivors** — 52 survivors ranked, showing model size / noise / price / notes and their 3 perks.
5. **About** — version (9.5.0), tier-system legend, source credit, fan-project disclaimer.

Files: `index.html`, `styles.css`, `app.js`, `data.js`, `scripts/build_data.py`, `README.md`.

---

## 4. Features

- **Live search** on the Perks tab (name / character / category / description). Killers & Survivors tabs get their own simple search too.
- **Tier filter chips** (Excellent → Terrible + All), color-coded; combinable with search and category.
- **Category filter** — populated dynamically from perk data.
- **Character filter** — optional dropdown.
- Cards grouped under **tier section headers**; result count ("Showing 42 of 169 perks"); empty state ("The fog hides everything…").
- Responsive grid (mobile → desktop), semantic HTML, keyboard accessible.
- **Nice-to-haves** if time: "Random perk" button, loadout builder (pick 4 perks → shareable summary), localStorage favourites, sort toggle.

---

## 5. Theme — "DBD / horror / Halloween"

**Mood:** dark, foggy, blood, candlelight, ritual.

- **Palette:** background near-black `#0a0a0c` with a dark-red radial fog gradient; surfaces `#15151a` with faint red border `#3a0d0d`; blood-red accent `#8b0000`→`#c1121f`; bone text `#e8e2d4`, muted `#9a948a`; optional Entity-green `#3a5a40` for synergy text.
- **Tier badge colors:** Excellent → gold `#d4af37`; Very Good → green `#4caf50`; Decent → blue `#3f7fbf`; Weak/Niche → grey `#8a8a8a`; Terrible → blood red `#b71c1c`. Reuse the same scale for killer S–D tiers (S=gold, A=green, B=blue, C=grey, D=red).
- **Typography:** a horror display font (Google Fonts *Nosifer* / *Creepster* / *IM Fell English*) for the **title and section headers only**; clean readable serif/sans for body (e.g. *Crimson Text* or system). Don't sacrifice legibility.
- **Effects (CSS only):** slow animated fog overlay; card hover red glow + lift; candle-flicker on the title; optional grain/vignette. **Respect `prefers-reduced-motion`** — disable flicker/fog for those users.
- **Copy/voice:** lean in. Title e.g. "The Codex of the Fog"; section subtitles in-theme. Footer: fan project, not affiliated with Behaviour Interactive; data per DBD patch 9.5.0.

---

## 6. Implementation order

1. Confirm both source files are present in the folder.
2. Write & run `scripts/build_data.py` → `data.js`; verify all counts and that every perk has a character.
3. `index.html` skeleton: header/title, nav tabs, controls bar, section containers, footer.
4. `styles.css`: theme, responsive grid, tier badges, fog/flicker, reduced-motion guard.
5. `app.js`: render all five sections from `data.js`; wire nav, search, filters, counts, empty states.
6. Test by opening `index.html` directly in a browser: all 169 perks + 22 killers + 52 survivors + 15 builds render; filters/search combine; mobile layout holds; no console errors.
7. `README.md`: how to open, how to regenerate data (`python scripts/build_data.py`), credit/disclaimer.

---

## 7. Acceptance criteria

- [ ] 169 perks render, grouped into 5 tiers with matching counts; **every perk shows its character** (merged from the txt); no `&&&&&`/mojibake artifacts.
- [ ] 22 killers, 52 survivors, and 15 builds all render in their sections.
- [ ] Search + tier + category filters work together and update the result count.
- [ ] Opens from `file://` (double-click) with no server and no console errors.
- [ ] Clearly DBD/horror/Halloween themed, responsive, respects `prefers-reduced-motion`.
- [ ] Fan-project disclaimer + version (9.5.0) + source credit in the About/footer.

**Stack constraint:** plain HTML/CSS/vanilla JS, no framework, no bundler. Python+openpyxl is used only at build time to generate `data.js`. Google Fonts via CDN link is fine; keep the site openable offline otherwise.
