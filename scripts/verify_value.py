import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    p = b.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console',   lambda m: errors.append(m.text) if m.type=='error' else None)
    p.goto('file:///C:/Projet/DBD_Test/index.html', wait_until='domcontentloaded')
    p.wait_for_timeout(800)

    # Click "Perk Value" tab
    p.locator('[data-section="value"]').click()
    p.wait_for_timeout(500)
    active = p.locator('.content-section.active').get_attribute('id')
    print(f'Perk Value tab -> section={active}')
    assert active == 'section-value', f'Expected section-value, got {active}'

    # Podium should have 3 cards
    podium_cards = p.locator('.podium-card').count()
    print(f'Podium cards: {podium_cards}')
    assert podium_cards == 3, f'Expected 3 podium cards, got {podium_cards}'

    # Top podium card name
    top_name = p.locator('.podium-card.gold .podium-name').inner_text()
    top_score = p.locator('.podium-card.gold .podium-score').inner_text()
    print(f'Gold medal: {top_name} (score={top_score})')

    # Char cards should exist
    char_cards = p.locator('.char-card').count()
    print(f'Char cards rendered: {char_cards}')
    assert char_cards > 0, 'No char cards rendered'

    # Base game notice
    basegame_text = p.locator('#value-basegame').inner_text()
    print(f'Basegame notice: {basegame_text[:80]}...')
    assert 'Base Game' in basegame_text, 'Missing base game notice'

    # Tier groups S/A/B/C/D headers
    tier_headers = p.locator('.value-tier-header').all_inner_texts()
    print(f'Value tier headers: {[t[:20] for t in tier_headers]}')
    assert len(tier_headers) > 0, 'No value tier headers rendered'

    # Filter: Free only
    p.locator('[data-value-filter="Free"]').click()
    p.wait_for_timeout(300)
    free_cards = p.locator('.char-card').count()
    print(f'Free filter: {free_cards} char cards')
    assert free_cards > 0, 'No free cards'

    # Sort: Name A-Z
    p.select_option('#value-sort', 'name')
    p.wait_for_timeout(200)

    # Click a perk in a char card -> should navigate to perks section
    perk_link = p.locator('.char-perk-name').first
    perk_name = perk_link.inner_text()
    perk_link.click()
    p.wait_for_timeout(500)
    active2 = p.locator('.content-section.active').get_attribute('id')
    print(f'Perk click "{perk_name}" -> section={active2}')
    assert active2 == 'section-perks', f'Expected perks, got {active2}'

    b.close()

print('ERRORS:', errors if errors else 'none')
print('All value index checks passed.')
