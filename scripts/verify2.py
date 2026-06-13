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

    # Navigate to survivors via character link
    char_link = p.locator('.character-link').first
    char_name = char_link.inner_text()
    char_link.click()
    p.wait_for_timeout(500)
    active = p.locator('.content-section.active').get_attribute('id')
    print(f'char link "{char_name}" -> section={active}')
    assert active == 'section-survivors', f'Expected survivors, got {active}'

    # Survivor sort: best first = rank 1 at top
    p.select_option('#survivor-sort', 'best')
    p.wait_for_timeout(200)
    r1 = p.locator('.survivor-rank').first.inner_text()
    print(f'sort best -> first={r1}')
    assert r1 == '#1', f'Expected #1, got {r1}'

    # Survivor sort: worst first = rank 52 at top
    p.select_option('#survivor-sort', 'worst')
    p.wait_for_timeout(200)
    r2 = p.locator('.survivor-rank').first.inner_text()
    print(f'sort worst -> first={r2}')
    assert r2 == '#52', f'Expected #52, got {r2}'

    # Survivor sort: name
    p.select_option('#survivor-sort', 'name')
    p.wait_for_timeout(200)
    n1 = p.locator('.survivor-name').first.inner_text()
    print(f'sort name -> first={n1}')

    # Killer sort: name
    p.locator('[data-section="killers"]').click()
    p.wait_for_timeout(300)
    p.select_option('#killer-sort', 'name')
    p.wait_for_timeout(200)
    k1 = p.locator('.killer-name').first.inner_text()
    print(f'killer sort name -> first={k1}')

    p.select_option('#killer-sort', 'rank')
    p.wait_for_timeout(200)
    k2 = p.locator('.killer-name').first.inner_text()
    print(f'killer sort rank -> first={k2}')

    b.close()

print('ERRORS:', errors if errors else 'none')
print('All checks passed.')
