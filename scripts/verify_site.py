"""Headless verification of index.html via Playwright."""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright, ConsoleMessage

FILE = Path(__file__).parent.parent / "index.html"
URL  = FILE.as_uri()
SHOTS = Path(__file__).parent.parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

errors = []
findings = []

def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        print(f"Loading {URL}")
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(800)

        # ── Screenshot: Perks tab (default) ────────────────────────────────
        page.screenshot(path=str(SHOTS / "01_perks_default.png"), full_page=False)
        print("SHOT 01_perks_default.png")

        # ── Count tier groups and perk cards ───────────────────────────────
        tier_groups = page.locator(".tier-group").count()
        perk_cards  = page.locator(".perk-card").count()
        result_text = page.locator("#perk-count").inner_text()
        print(f"Tier groups visible: {tier_groups}")
        print(f"Perk cards visible:  {perk_cards}")
        print(f"Result count text:   {result_text}")
        assert perk_cards == 169, f"Expected 169 perk cards, got {perk_cards}"
        assert tier_groups == 5,  f"Expected 5 tier groups, got {tier_groups}"
        assert "169 of 169" in result_text, f"Unexpected count text: {result_text}"

        # ── Check first perk has character name ────────────────────────────
        first_char = page.locator(".perk-character").first.inner_text()
        print(f"First perk character: {first_char}")
        assert first_char and first_char not in ("", "undefined"), "Character name missing on first perk"

        # ── Search filter ──────────────────────────────────────────────────
        page.fill("#perk-search", "sprint")
        page.wait_for_timeout(300)
        filtered_count = page.locator(".perk-card").count()
        filtered_text  = page.locator("#perk-count").inner_text()
        page.screenshot(path=str(SHOTS / "02_search_sprint.png"), full_page=False)
        print(f"Search 'sprint' → {filtered_count} cards  |  {filtered_text}")
        assert 0 < filtered_count < 169, f"Search filter didn't narrow results: {filtered_count}"

        # ── Tier chip filter ───────────────────────────────────────────────
        page.fill("#perk-search", "")
        page.locator("[data-tier-filter='Excellent']").click()
        page.wait_for_timeout(300)
        excellent_count = page.locator(".perk-card").count()
        page.screenshot(path=str(SHOTS / "03_tier_excellent.png"), full_page=False)
        print(f"Tier 'Excellent' → {excellent_count} cards")
        assert excellent_count == 8, f"Expected 8 Excellent perks, got {excellent_count}"

        # ── Reset filters ──────────────────────────────────────────────────
        page.locator("[data-tier-filter='all']").click()
        page.wait_for_timeout(300)

        # ── Builds tab ─────────────────────────────────────────────────────
        page.locator("[data-section='builds']").click()
        page.wait_for_timeout(400)
        build_cards = page.locator(".build-card").count()
        page.screenshot(path=str(SHOTS / "04_builds.png"), full_page=False)
        print(f"Build cards: {build_cards}")
        assert build_cards == 15, f"Expected 15 builds, got {build_cards}"

        # ── Killers tab ────────────────────────────────────────────────────
        page.locator("[data-section='killers']").click()
        page.wait_for_timeout(400)
        killer_cards = page.locator(".killer-card").count()
        killer_text  = page.locator("#killer-count").inner_text()
        page.screenshot(path=str(SHOTS / "05_killers.png"), full_page=False)
        print(f"Killer cards: {killer_cards}  |  {killer_text}")
        assert killer_cards == 22, f"Expected 22 killers, got {killer_cards}"

        # ── Killer tier filter ─────────────────────────────────────────────
        page.locator("[data-killer-tier='S']").click()
        page.wait_for_timeout(300)
        s_killers = page.locator(".killer-card").count()
        print(f"Killer S tier: {s_killers} card(s)")
        assert s_killers >= 1, "S-tier killer filter returned 0"
        page.locator("[data-killer-tier='all']").click()

        # ── Survivors tab ──────────────────────────────────────────────────
        page.locator("[data-section='survivors']").click()
        page.wait_for_timeout(400)
        surv_cards = page.locator(".survivor-card").count()
        surv_text  = page.locator("#survivor-count").inner_text()
        page.screenshot(path=str(SHOTS / "06_survivors.png"), full_page=False)
        print(f"Survivor cards: {surv_cards}  |  {surv_text}")
        assert surv_cards == 52, f"Expected 52 survivors, got {surv_cards}"

        # ── About tab ──────────────────────────────────────────────────────
        page.locator("[data-section='about']").click()
        page.wait_for_timeout(400)
        legend_rows = page.locator(".tier-legend-row").count()
        page.screenshot(path=str(SHOTS / "07_about.png"), full_page=False)
        print(f"Tier legend rows: {legend_rows}")
        assert legend_rows == 5, f"Expected 5 tier legend rows, got {legend_rows}"

        # ── Category filter (back to perks) ───────────────────────────────
        page.locator("[data-section='perks']").click()
        page.wait_for_timeout(300)
        page.select_option("#category-filter", label="Healing")
        page.wait_for_timeout(300)
        healing_count = page.locator(".perk-card").count()
        print(f"Category 'Healing' filter → {healing_count} cards")
        assert 0 < healing_count < 169, "Category filter had no effect"

        # ── Combined filter ────────────────────────────────────────────────
        page.locator("[data-tier-filter='Decent']").click()
        page.wait_for_timeout(300)
        combined_count = page.locator(".perk-card").count()
        combined_text  = page.locator("#perk-count").inner_text()
        page.screenshot(path=str(SHOTS / "08_combined_filter.png"), full_page=False)
        print(f"Combined (Decent + Healing) → {combined_count} cards  |  {combined_text}")
        assert combined_count <= healing_count, "Combined filter should narrow results"

        # ── Empty state ────────────────────────────────────────────────────
        page.locator("[data-tier-filter='all']").click()
        page.select_option("#category-filter", "")
        page.fill("#perk-search", "xyzzy_noresult_42")
        page.wait_for_timeout(300)
        empty = page.locator(".empty-state").is_visible()
        print(f"Empty state shown for no-results search: {empty}")
        assert empty, "Empty state not shown when search has no results"
        page.screenshot(path=str(SHOTS / "09_empty_state.png"), full_page=False)

        # ── Mobile viewport ────────────────────────────────────────────────
        page.set_viewport_size({"width": 390, "height": 844})
        page.fill("#perk-search", "")
        page.wait_for_timeout(300)
        page.screenshot(path=str(SHOTS / "10_mobile.png"), full_page=False)
        print("Mobile viewport screenshot taken")

        browser.close()

    # ── Console errors ──────────────────────────────────────────────────────
    if errors:
        print(f"\nCONSOLE ERRORS ({len(errors)}):")
        for e in errors:
            print(f"  {e}")
    else:
        print("\nNo console errors.")

    print("\nAll assertions passed.")
    for s in sorted(SHOTS.glob("*.png")):
        print(f"  screenshot: {s}")

if __name__ == "__main__":
    run()
