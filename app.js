// The Codex of the Fog — app.js
// All data loaded from data.js (globals: PERKS, KILLERS, SURVIVORS, BUILDS, META)

(function () {
  "use strict";

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  const PERK_BY_NAME        = Object.fromEntries(PERKS.map(p => [p.name.toLowerCase(), p]));
  const PERK_BY_ID          = Object.fromEntries(PERKS.map(p => [p.id, p]));
  const SURVIVOR_BY_NAME    = Object.fromEntries(SURVIVORS.map(s => [s.name.toLowerCase(), s]));
  const KILLER_PERK_BY_NAME = Object.fromEntries(KILLER_PERKS.map(p => [p.name.toLowerCase(), p]));
  const KILLER_PERK_BY_ID   = Object.fromEntries(KILLER_PERKS.map(p => [p.id, p]));
  const KILLER_BY_NAME      = Object.fromEntries(KILLERS.map(k => [k.name.toLowerCase(), k]));

  // ── Dynamic subtitle ────────────────────────────────────────────────────────
  (function () {
    const el = document.getElementById("site-subtitle");
    if (el) el.textContent =
      `Dead by Daylight · Patch ${META.version} · ${PERKS.length} Perks · ${KILLERS.length} Killers · ${SURVIVORS.length} Survivors`;
  })();

  // ── Constants ───────────────────────────────────────────────────────────────
  const TIER_ORDER   = ["Excellent", "Very Good", "Decent", "Weak/Niche", "Terrible"];
  const KILLER_TIERS = ["S", "A", "B", "C", "D"];

  function tierBadgeClass(tier) {
    return "badge-" + tier.replace(/[\s\/]+/g, "-");
  }

  function tierColor(tier) {
    return { "Excellent": "#d4af37", "Very Good": "#4caf50", "Decent": "#3f7fbf",
             "Weak/Niche": "#8a8a8a", "Terrible": "#b71c1c" }[tier] || "#9a948a";
  }

  function tierBgColor(tier) {
    return { "Excellent":  "rgba(212,175,55,0.28)",
             "Very Good":  "rgba(76,175,80,0.22)",
             "Decent":     "rgba(63,127,191,0.22)",
             "Weak/Niche": "rgba(138,138,138,0.15)",
             "Terrible":   "rgba(183,28,28,0.22)" }[tier] || "rgba(154,148,138,0.12)";
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Escape, then colour tier triples (e.g. 40/50/60s, 50/60/70%) so each value
  // maps to its perk level: Tier I green, Tier II blue, Tier III purple.
  // A trailing % stays with the third value; other units are left neutral.
  function descHtml(str) {
    return esc(str).replace(
      /(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)(\s*%)?/g,
      (_m, a, b, c, pct) =>
        `<span class="tier tier-1">${a}</span>/` +
        `<span class="tier tier-2">${b}</span>/` +
        `<span class="tier tier-3">${c}${pct || ""}</span>`
    );
  }

  function perkIconUrl(name) {
    const pascal = name.replace(/[^A-Za-z0-9 ]/g, "")
                       .split(" ").filter(Boolean)
                       .map(w => w[0].toUpperCase() + w.slice(1))
                       .join("");
    return `./images/perks/iconPerks_${pascal}.png`;
  }

  function perkIconHtml(name, cls = "perk-icon") {
    return `<img src="${perkIconUrl(name)}" alt="" class="${cls}" loading="lazy" onerror="this.style.display='none'">`;
  }

  // Character portrait (killers / survivors). Path is baked into data.js by
  // build_data.py; absent for characters with no portrait asset yet.
  function portraitHtml(c, cls = "char-portrait") {
    if (!c || !c.portrait) return "";
    return `<img src="./${c.portrait}" alt="" class="${cls} ${cls}-img" loading="lazy"
                 onerror="this.closest('.${cls}-wrap')?.classList.add('no-portrait');this.remove()">`;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navBtns  = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".content-section");

  function showSection(id, pushHash = true) {
    sections.forEach(s => s.classList.toggle("active", s.id === "section-" + id));
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.section === id));
    if (pushHash) window.location.hash = id;
  }

  navBtns.forEach(btn => btn.addEventListener("click", () => showSection(btn.dataset.section)));

  const hash = window.location.hash.replace("#", "") || "survivors";
  showSection(["perks","builds","killers","killerperks","killervalue","killertheory","survivors","value","theory","about"].includes(hash) ? hash : "survivors", false);

  // ── Tooltip ─────────────────────────────────────────────────────────────────
  const tooltip = document.getElementById("perk-tooltip");
  let tooltipVisible = false;

  function showTooltip(perk, anchorEl) {
    tooltip.innerHTML = `
      <div class="tooltip-name">${esc(perk.name)}</div>
      <div class="tooltip-meta">
        <span class="tier-badge ${tierBadgeClass(perk.tier)}">${esc(perk.tier)}</span>
        ${perk.character ? `<span class="tooltip-char">${esc(perk.character)}</span>` : ""}
      </div>
      <div class="tooltip-desc">${descHtml(perk.description)}</div>
      <div class="tooltip-hint">Click to view perk</div>`;
    tooltip.style.borderColor = tierColor(perk.tier);

    // Position near anchor element
    const rect = anchorEl.getBoundingClientRect();
    const tipW = 300, tipH = 200;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + tipW > window.innerWidth  - 8) x = window.innerWidth  - tipW - 8;
    if (y + tipH > window.innerHeight - 8) y = rect.top - tipH - 8;
    if (x < 8) x = 8;

    tooltip.style.left = x + "px";
    tooltip.style.top  = y + "px";
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");
    tooltipVisible = true;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
    tooltip.setAttribute("aria-hidden", "true");
    tooltipVisible = false;
  }

  const BUILD_ITEMS = {
    "luck offerings": {
      name: "Luck Offerings",
      type: "Offering",
      icon: "./images/Favors/iconFavors_ivoryChalkPouch.png",
      description: "Oblation offerings equipped before a trial that increase Luck for all Survivors, improving chances to escape Bear Traps and affecting item rarity found in chests."
    },
    "toolboxes": {
      name: "Toolboxes",
      type: "Item",
      icon: "./images/Items/iconItems_toolbox.png",
      description: "Items that significantly speed up Generator repair. Can also be used to Sabotage Hooks. Higher rarity toolboxes provide stronger bonuses. Essential for gen-rush strategies."
    }
  };

  function showItemTooltip(item, anchorEl) {
    const typeColors = { "Offering": "#b47aff", "Item": "#4fc3f7", "Mechanic": "#ffb74d" };
    const color = typeColors[item.type] || "var(--accent)";
    tooltip.innerHTML = `
      <div class="tooltip-type-tag" style="color:${color};border-color:${color}">${esc(item.type)}</div>
      <div class="tooltip-name">${esc(item.name)}</div>
      <div class="tooltip-desc">${esc(item.description)}</div>`;
    tooltip.style.borderColor = color;

    const rect = anchorEl.getBoundingClientRect();
    const tipW = 300, tipH = 200;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + tipW > window.innerWidth  - 8) x = window.innerWidth  - tipW - 8;
    if (y + tipH > window.innerHeight - 8) y = rect.top - tipH - 8;
    if (x < 8) x = 8;

    tooltip.style.left = x + "px";
    tooltip.style.top  = y + "px";
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");
    tooltipVisible = true;
  }

  // ── Navigate to a perk card ──────────────────────────────────────────────────
  function navigateToPerk(perkId) {
    hideTooltip();
    // Reset all perk filters
    perkSearch.value = "";
    activeTierFilter = "all";
    document.querySelectorAll("[data-tier-filter]").forEach(c => c.classList.toggle("active", c.dataset.tierFilter === "all"));
    categoryFilter.value  = "";
    characterFilter.value = "";
    showSection("perks");
    renderPerks();
    requestAnimationFrame(() => {
      const el = document.getElementById("perk-" + perkId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("card-highlight");
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add("card-highlight");
      el.addEventListener("animationend", () => el.classList.remove("card-highlight"), { once: true });
    });
  }

  // ── Navigate to a survivor card ──────────────────────────────────────────────
  function navigateToSurvivor(name) {
    const s = SURVIVOR_BY_NAME[name.toLowerCase()];
    if (!s) return;
    showSection("survivors");
    // Reset survivor filters to make sure the card is visible
    activeSurvivorFilter = "all";
    document.querySelectorAll("[data-survivor-filter]").forEach(c => c.classList.toggle("active", c.dataset.survivorFilter === "all"));
    survivorSearch.value = "";
    survivorSort.value = "best";
    renderSurvivors();
    requestAnimationFrame(() => {
      const el = document.getElementById("survivor-" + s.rank);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("card-highlight");
      void el.offsetWidth;
      el.classList.add("card-highlight");
      el.addEventListener("animationend", () => el.classList.remove("card-highlight"), { once: true });
    });
  }

  // ── Synergy HTML builder ─────────────────────────────────────────────────────
  // Parses "Vigil (cuts cooldown), Fixated" → interactive buttons for known perks
  function buildSynergyHtml(synergy) {
    if (!synergy) return "";
    const parts = synergy.split(/,\s*/);
    return parts.map(part => {
      const nameMatch = part.match(/^([^(]+)/);
      const rawName   = nameMatch ? nameMatch[1].trim() : part;
      const note      = part.slice(rawName.length).trim();
      const perk      = PERK_BY_NAME[rawName.toLowerCase()];
      if (perk) {
        const noteHtml = note ? ` <span class="synergy-note">${esc(note)}</span>` : "";
        return `<button class="synergy-link" data-perk-id="${perk.id}">${esc(perk.name)}${noteHtml}</button>`;
      }
      return esc(part);
    }).join(", ");
  }

  // ── Build perk list HTML (splits on " + " then falls back to comma) ─────────
  function buildPerksHtml(perks) {
    if (!perks) return "";
    const parts = perks.split(/\s*\+\s*|\s*,\s*/);
    return parts.map(part => {
      const rawName = part.match(/^([^(]+)/)?.[1]?.trim() ?? part;
      const perk    = PERK_BY_NAME[rawName.toLowerCase()];
      if (perk) {
        return `<button class="surv-perk-mini synergy-link" data-perk-id="${perk.id}" style="background:${tierBgColor(perk.tier)}">
          <span class="surv-perk-icon-wrap">
            <img src="${perkIconUrl(perk.name)}" alt="" class="surv-perk-icon" loading="lazy"
                 onerror="this.style.display='none';this.parentElement.classList.add('no-icon')">
          </span>
        </button>`;
      }
      const key  = rawName.toLowerCase();
      const item = BUILD_ITEMS[key];
      const iconImg = item && item.icon
        ? `<img src="${item.icon}" alt="" class="surv-perk-icon" loading="lazy"
                onerror="this.style.display='none';this.parentElement.classList.add('no-icon')">`
        : "";
      return `<span class="surv-perk-mini build-perk-unknown" data-build-item="${esc(key)}">
          <span class="surv-perk-icon-wrap${iconImg ? "" : " no-icon"}">${iconImg}</span>
        </span>`;
    }).join("");
  }

  // ── Character link builder ───────────────────────────────────────────────────
  function buildCharacterHtml(character) {
    if (!character) return "";
    const isBase = character.toLowerCase().includes("base game");
    if (isBase || !SURVIVOR_BY_NAME[character.toLowerCase()]) {
      return `<span class="perk-character">${esc(character)}</span>`;
    }
    return `<button class="character-link perk-character" data-survivor-name="${esc(character)}">${esc(character)}</button>`;
  }

  // ── Event delegation for synergy links and character links ──────────────────
  document.addEventListener("click", e => {
    const vb = e.target.closest(".version-btn");
    if (vb) {
      const [kind, id] = vb.dataset.versionPerk.split(":");
      openVersionModal(kind, parseInt(id, 10));
      return;
    }
    const sl = e.target.closest(".synergy-link");
    if (sl) { navigateToPerk(parseInt(sl.dataset.perkId, 10)); return; }
    const cl = e.target.closest(".character-link");
    if (cl) { navigateToSurvivor(cl.dataset.survivorName); return; }
  });

  // ── Perk version history (official change log from nightlight.gg) ────────────
  function versionBtnHtml(p, kind) {
    const n = (p.versionHistory || []).length;
    if (!n) return "";
    return `<button class="version-btn" data-version-perk="${kind}:${p.id}">`
         + `<span class="version-btn-icon">⟲</span> Version history `
         + `<span class="version-btn-count">${n}</span></button>`;
  }

  const vhModal = (function buildVersionModal() {
    const el = document.createElement("div");
    el.className = "vh-overlay";
    el.innerHTML = `
      <div class="vh-modal" role="dialog" aria-modal="true" aria-labelledby="vh-title">
        <div class="vh-modal-header">
          <h3 id="vh-title" class="vh-modal-title"></h3>
          <button class="vh-close" aria-label="Close">×</button>
        </div>
        <div class="vh-modal-body"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", ev => {
      if (ev.target === el || ev.target.closest(".vh-close")) closeVersionModal();
    });
    return el;
  })();

  function closeVersionModal() { vhModal.classList.remove("open"); }

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeVersionModal();
  });

  function openVersionModal(kind, id) {
    const p = kind === "killer" ? KILLER_PERK_BY_ID[id] : PERK_BY_ID[id];
    if (!p) return;
    const entries = (p.versionHistory || []).map(v => {
      const changes = (v.changes || []).map(c =>
        `<li><span class="vh-tag vh-${esc((c.type || "note").toLowerCase())}">${esc(c.type || "note")}</span>`
        + `<span class="vh-text">${esc(c.text)}</span></li>`).join("");
      return `
        <div class="vh-entry">
          <div class="vh-entry-head">
            <span class="vh-version">${esc(v.version || "—")}</span>
            ${v.date ? `<span class="vh-date">${esc(v.date)}</span>` : ""}
          </div>
          <ul class="vh-changes">${changes}</ul>
        </div>`;
    }).join("");
    vhModal.querySelector(".vh-modal-title").textContent = `${p.name} — version history`;
    vhModal.querySelector(".vh-modal-body").innerHTML =
      entries || `<p class="vh-empty">No recorded changes.</p>`;
    vhModal.classList.add("open");
  }

  document.addEventListener("mouseover", e => {
    const sl = e.target.closest(".synergy-link");
    if (sl) {
      const perk = PERK_BY_ID[parseInt(sl.dataset.perkId, 10)];
      if (perk) showTooltip(perk, sl);
      return;
    }
    const bi = e.target.closest(".build-perk-unknown");
    if (bi) {
      const key  = (bi.dataset.buildItem || "").toLowerCase();
      const item = BUILD_ITEMS[key];
      if (item) showItemTooltip(item, bi);
      return;
    }
    const pi = e.target.closest("[data-perk-id]");
    if (pi) {
      const perk = PERK_BY_ID[parseInt(pi.dataset.perkId, 10)];
      if (perk) showTooltip(perk, pi);
    }
  });

  document.addEventListener("mouseout", e => {
    if (e.target.closest(".synergy-link") || e.target.closest(".build-perk-unknown") || e.target.closest("[data-perk-id]")) hideTooltip();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERKS SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const perkSearch      = document.getElementById("perk-search");
  const categoryFilter  = document.getElementById("category-filter");
  const characterFilter = document.getElementById("character-filter");
  const perkCount       = document.getElementById("perk-count");
  const perksContainer  = document.getElementById("perks-container");

  // Populate dropdowns
  [...new Set(PERKS.map(p => p.category).filter(Boolean))].sort().forEach(c => {
    categoryFilter.appendChild(Object.assign(document.createElement("option"), { value: c, textContent: c }));
  });
  [...new Set(PERKS.map(p => p.character).filter(Boolean))].sort().forEach(c => {
    characterFilter.appendChild(Object.assign(document.createElement("option"), { value: c, textContent: c }));
  });

  let activeTierFilter = "all";
  document.querySelectorAll("[data-tier-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeTierFilter = chip.dataset.tierFilter;
      document.querySelectorAll("[data-tier-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderPerks();
    });
  });

  function renderPerks() {
    const query   = perkSearch.value.toLowerCase().trim();
    const catVal  = categoryFilter.value;
    const charVal = characterFilter.value;

    const filtered = PERKS.filter(p => {
      if (activeTierFilter !== "all" && p.tier !== activeTierFilter) return false;
      if (catVal  && p.category  !== catVal)  return false;
      if (charVal && p.character !== charVal) return false;
      if (query) {
        const hay = (p.name + " " + p.character + " " + p.category + " " + p.description + " " + p.synergy).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    perkCount.textContent = `Showing ${filtered.length} of ${PERKS.length} perks`;

    if (!filtered.length) {
      perksContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🕯️</span>
          <h3>The fog hides everything…</h3>
          <p>No perks match your search. Try clearing some filters.</p>
        </div>`;
      return;
    }

    const grouped = Object.fromEntries(TIER_ORDER.map(t => [t, []]));
    filtered.forEach(p => { if (grouped[p.tier]) grouped[p.tier].push(p); });

    let html = "";
    TIER_ORDER.forEach(tier => {
      const perks = grouped[tier];
      if (!perks.length) return;
      const color = tierColor(tier);
      html += `
        <div class="tier-group">
          <h2 class="tier-group-header" style="color:${color}">
            <span class="tier-badge ${tierBadgeClass(tier)}">${esc(tier)}</span>
            <span class="tier-count">(${perks.length})</span>
          </h2>
          <div class="perk-grid">${perks.map(perkCard).join("")}</div>
        </div>`;
    });

    perksContainer.innerHTML = html;
  }

  function perkCard(p) {
    const synergyHtml   = buildSynergyHtml(p.synergy);
    const characterHtml = buildCharacterHtml(p.character);
    return `
      <article class="perk-card" id="perk-${p.id}">
        <div class="perk-card-header">
          ${perkIconHtml(p.name, "perk-card-icon")}
          <div class="perk-card-header-text">
            <span class="perk-name">${esc(p.name)}</span>
            <span class="tier-badge ${tierBadgeClass(p.tier)}">${esc(p.tier)}</span>
          </div>
        </div>
        <div class="perk-meta">
          ${characterHtml}
          ${p.category ? `<span class="perk-category">${esc(p.category)}</span>` : ""}
        </div>
        <p class="perk-desc">${descHtml(p.description)}</p>
        ${versionBtnHtml(p, "survivor")}
        ${synergyHtml ? `<div class="perk-synergy"><strong>Synergy:</strong> ${synergyHtml}</div>` : ""}
      </article>`;
  }

  perkSearch.addEventListener("input", renderPerks);
  categoryFilter.addEventListener("change", renderPerks);
  characterFilter.addEventListener("change", renderPerks);
  renderPerks();

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILDS SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  document.getElementById("builds-container").innerHTML = BUILDS.map(b => `
    <article class="build-card">
      <h3 class="build-name">${esc(b.name)}</h3>
      <div class="build-perks">${buildPerksHtml(b.perks)}</div>
      <p class="build-strategy">${esc(b.strategy)}</p>
    </article>`).join("");

  // ═══════════════════════════════════════════════════════════════════════════
  // KILLERS SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const killerSearch     = document.getElementById("killer-search");
  const killerCount      = document.getElementById("killer-count");
  const killersContainer = document.getElementById("killers-container");
  const killerSort       = document.getElementById("killer-sort");
  let activeKillerTier   = "all";

  document.querySelectorAll("[data-killer-tier]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeKillerTier = chip.dataset.killerTier;
      document.querySelectorAll("[data-killer-tier]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderKillers();
    });
  });

  function renderKillers() {
    const query = killerSearch.value.toLowerCase().trim();
    let filtered = KILLERS.filter(k => {
      if (activeKillerTier !== "all" && k.tier !== activeKillerTier) return false;
      if (query) {
        const hay = (k.name + " " + k.power + " " + k.strengths + " " + k.weaknesses).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // Sort
    const sortBy = killerSort.value;
    if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "tier") {
      filtered.sort((a, b) => KILLER_TIERS.indexOf(a.tier) - KILLER_TIERS.indexOf(b.tier) || a.rank - b.rank);
    } else {
      filtered.sort((a, b) => a.rank - b.rank); // best first
    }

    killerCount.textContent = `Showing ${filtered.length} of ${KILLERS.length} killers`;

    if (!filtered.length) {
      killersContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">🔪</span><h3>No killers found</h3></div>`;
      return;
    }
    killersContainer.innerHTML = filtered.map(killerCard).join("");
  }

  function killerCard(k) {
    const perksHtml = (k.perks && k.perks.length)
      ? `<div class="surv-perk-list">${k.perks.map(n => {
          const kp = KILLER_PERK_BY_NAME[n.toLowerCase()];
          const tier = kp ? kp.tier : "";
          const idAttr = kp ? ` data-killer-perk-id="${kp.id}"` : "";
          return `<button class="surv-perk-mini"${idAttr} style="background:${tierBgColor(tier)}">
              <span class="surv-perk-icon-wrap">
                <img src="${perkIconUrl(kp ? kp.name : n)}" alt="" class="surv-perk-icon" loading="lazy"
                     onerror="this.style.display='none';this.parentElement.classList.add('no-icon')">
              </span>
            </button>`;
        }).join("")}</div>`
      : "";
    return `
      <article class="killer-card" id="killer-${k.rank}">
        <div class="killer-card-header">
          ${k.portrait ? `<span class="char-portrait-wrap killer-portrait-wrap">${portraitHtml(k, "char-portrait")}</span>` : ""}
          <span class="killer-rank">#${k.rank}</span>
          <span class="killer-name">${esc(k.name)}</span>
          <span class="tier-badge badge-${esc(k.tier)}">${esc(k.tier)}</span>
        </div>
        <p class="killer-power">${esc(k.power)}</p>
        <div class="killer-detail killer-strengths">
          <strong>Strengths</strong>${esc(k.strengths)}
        </div>
        <div class="killer-detail killer-weaknesses">
          <strong>Weaknesses</strong>${esc(k.weaknesses)}
        </div>
        ${perksHtml}
        <div class="killer-price">${esc(k.status)} · ${esc(k.price)}</div>
      </article>`;
  }

  killerSearch.addEventListener("input", renderKillers);
  killerSort.addEventListener("change", renderKillers);
  renderKillers();

  // ═══════════════════════════════════════════════════════════════════════════
  // KILLER PERKS SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const kperkSearch     = document.getElementById("kperk-search");
  const kperkCatFilter  = document.getElementById("kperk-category-filter");
  const kperkCharFilter = document.getElementById("kperk-character-filter");
  const kperkCount      = document.getElementById("kperk-count");
  const kperksContainer = document.getElementById("killerperks-container");

  // Populate dropdowns
  [...new Set(KILLER_PERKS.map(p => p.category).filter(Boolean))].sort().forEach(c => {
    kperkCatFilter.appendChild(Object.assign(document.createElement("option"), { value: c, textContent: c }));
  });
  [...new Set(KILLER_PERKS.map(p => p.character).filter(Boolean))].sort().forEach(c => {
    kperkCharFilter.appendChild(Object.assign(document.createElement("option"), { value: c, textContent: c }));
  });

  let activeKperkTier = "all";
  document.querySelectorAll("[data-kperk-tier]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeKperkTier = chip.dataset.kperkTier;
      document.querySelectorAll("[data-kperk-tier]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderKillerPerks();
    });
  });

  function renderKillerPerks() {
    const query   = kperkSearch.value.toLowerCase().trim();
    const catVal  = kperkCatFilter.value;
    const charVal = kperkCharFilter.value;

    const filtered = KILLER_PERKS.filter(p => {
      if (activeKperkTier !== "all" && p.tier !== activeKperkTier) return false;
      if (catVal  && p.category  !== catVal)  return false;
      if (charVal && p.character !== charVal) return false;
      if (query) {
        const hay = (p.name + " " + p.character + " " + p.category + " " + p.description).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    kperkCount.textContent = `Showing ${filtered.length} of ${KILLER_PERKS.length} killer perks`;

    if (!filtered.length) {
      kperksContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔪</span>
          <h3>No perks found in the fog…</h3>
          <p>No killer perks match your search. Try clearing some filters.</p>
        </div>`;
      return;
    }

    const grouped = Object.fromEntries(TIER_ORDER.map(t => [t, []]));
    filtered.forEach(p => { if (grouped[p.tier]) grouped[p.tier].push(p); });

    let html = "";
    TIER_ORDER.forEach(tier => {
      const tierPerks = grouped[tier];
      if (!tierPerks.length) return;
      const color = tierColor(tier);
      html += `
        <div class="tier-group">
          <h2 class="tier-group-header" style="color:${color}">
            <span class="tier-badge ${tierBadgeClass(tier)}">${esc(tier)}</span>
            <span class="tier-count">(${tierPerks.length})</span>
          </h2>
          <div class="perk-grid">${tierPerks.map(killerPerkCard).join("")}</div>
        </div>`;
    });

    kperksContainer.innerHTML = html;
  }

  function killerPerkCard(p) {
    const killerObj = KILLER_BY_NAME[p.character.toLowerCase()];
    const charHtml  = killerObj
      ? `<button class="character-link perk-character kperk-killer-link" data-killer-rank="${killerObj.rank}">${esc(p.character)}</button>`
      : `<span class="perk-character">${esc(p.character)}</span>`;
    return `
      <article class="perk-card" id="kperk-${p.id}">
        <div class="perk-card-header">
          ${perkIconHtml(p.name, "perk-card-icon")}
          <div class="perk-card-header-text">
            <span class="perk-name">${esc(p.name)}</span>
            <span class="tier-badge ${tierBadgeClass(p.tier)}">${esc(p.tier)}</span>
          </div>
        </div>
        <div class="perk-meta">
          ${charHtml}
          ${p.category ? `<span class="perk-category">${esc(p.category)}</span>` : ""}
        </div>
        <p class="perk-desc">${descHtml(p.description)}</p>
        ${versionBtnHtml(p, "killer")}
      </article>`;
  }

  function navigateToKillerPerk(id) {
    const p = KILLER_PERK_BY_ID[id];
    if (!p) return;
    activeKperkTier = "all";
    document.querySelectorAll("[data-kperk-tier]").forEach(c => c.classList.toggle("active", c.dataset.kperkTier === "all"));
    kperkSearch.value = "";
    kperkCatFilter.value  = "";
    kperkCharFilter.value = "";
    showSection("killerperks");
    renderKillerPerks();
    requestAnimationFrame(() => {
      const el = document.getElementById("kperk-" + id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("card-highlight");
      void el.offsetWidth;
      el.classList.add("card-highlight");
      el.addEventListener("animationend", () => el.classList.remove("card-highlight"), { once: true });
    });
  }

  function navigateToKillerCard(rank) {
    activeKillerTier = "all";
    document.querySelectorAll("[data-killer-tier]").forEach(c => c.classList.toggle("active", c.dataset.killerTier === "all"));
    killerSearch.value = "";
    killerSort.value = "rank";
    showSection("killers");
    renderKillers();
    requestAnimationFrame(() => {
      const el = document.getElementById("killer-" + rank);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("card-highlight");
      void el.offsetWidth;
      el.classList.add("card-highlight");
      el.addEventListener("animationend", () => el.classList.remove("card-highlight"), { once: true });
    });
  }

  // Delegate killer-perk-tag clicks and killer card links from perk cards
  document.addEventListener("click", e => {
    const kpt = e.target.closest("[data-killer-perk-id]");
    if (kpt) { navigateToKillerPerk(parseInt(kpt.dataset.killerPerkId, 10)); return; }
    const kkl = e.target.closest(".kperk-killer-link");
    if (kkl) { navigateToKillerCard(parseInt(kkl.dataset.killerRank, 10)); return; }
  });

  // Tooltip for killer perk tags on killer cards
  document.addEventListener("mouseover", e => {
    const kpt = e.target.closest("[data-killer-perk-id]");
    if (kpt) {
      const p = KILLER_PERK_BY_ID[parseInt(kpt.dataset.killerPerkId, 10)];
      if (p) {
        tooltip.innerHTML = `
          <div class="tooltip-name">${esc(p.name)}</div>
          <div class="tooltip-meta">
            <span class="tier-badge ${tierBadgeClass(p.tier)}">${esc(p.tier)}</span>
            <span class="tooltip-char">${esc(p.character)}</span>
          </div>
          <div class="tooltip-desc">${descHtml(p.description)}</div>
          <div class="tooltip-hint">Click to view perk</div>`;
        tooltip.style.borderColor = tierColor(p.tier);
        const rect = kpt.getBoundingClientRect();
        const tipW = 300, tipH = 200;
        let x = rect.left, y = rect.bottom + 8;
        if (x + tipW > window.innerWidth  - 8) x = window.innerWidth  - tipW - 8;
        if (y + tipH > window.innerHeight - 8) y = rect.top - tipH - 8;
        if (x < 8) x = 8;
        tooltip.style.left = x + "px";
        tooltip.style.top  = y + "px";
        tooltip.classList.add("visible");
        tooltip.setAttribute("aria-hidden", "false");
        tooltipVisible = true;
      }
    }
  });

  document.addEventListener("mouseout", e => {
    if (e.target.closest("[data-killer-perk-id]")) hideTooltip();
  });

  kperkSearch.addEventListener("input", renderKillerPerks);
  kperkCatFilter.addEventListener("change", renderKillerPerks);
  kperkCharFilter.addEventListener("change", renderKillerPerks);
  renderKillerPerks();

  // ═══════════════════════════════════════════════════════════════════════════
  // SURVIVORS SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const survivorSearch      = document.getElementById("survivor-search");
  const survivorCount       = document.getElementById("survivor-count");
  const survivorsContainer  = document.getElementById("survivors-container");
  const survivorSort        = document.getElementById("survivor-sort");
  let activeSurvivorFilter  = "all";

  document.querySelectorAll("[data-survivor-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeSurvivorFilter = chip.dataset.survivorFilter;
      document.querySelectorAll("[data-survivor-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderSurvivors();
    });
  });

  function renderSurvivors() {
    const query = survivorSearch.value.toLowerCase().trim();
    let filtered = SURVIVORS.filter(s => {
      if (activeSurvivorFilter !== "all" && s.status !== activeSurvivorFilter) return false;
      if (query) {
        const hay = (s.name + " " + s.notes + " " + (s.perks || []).join(" ")).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // Sort: rank 1 = best, rank 52 = worst
    const sortBy = survivorSort.value;
    if (sortBy === "best")  filtered.sort((a, b) => a.rank - b.rank);       // 1 → 52
    if (sortBy === "worst") filtered.sort((a, b) => b.rank - a.rank);       // 52 → 1
    if (sortBy === "name")  filtered.sort((a, b) => a.name.localeCompare(b.name));

    survivorCount.textContent = `Showing ${filtered.length} of ${SURVIVORS.length} survivors`;

    if (!filtered.length) {
      survivorsContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">👤</span><h3>No survivors found</h3></div>`;
      return;
    }
    survivorsContainer.innerHTML = filtered.map(survivorCard).join("");
  }

  // Build lookup: survivor name (lowercase) → array of perk objects
  const SURV_PERKS_MAP = {};
  PERKS.forEach(p => {
    if (!p.character || p.character.toLowerCase().includes("base game")) return;
    const key = p.character.toLowerCase();
    if (!SURV_PERKS_MAP[key]) SURV_PERKS_MAP[key] = [];
    SURV_PERKS_MAP[key].push(p);
  });

  function survivorCard(s) {
    const noiseClass  = (s.noise || "").toLowerCase().includes("loud") ? "loud" : "quiet";
    const sizeClass   = (s.modelSize || "").toLowerCase().split(" ")[0];
    const statusClass = (s.status || "").toLowerCase();

    const charPerks = SURV_PERKS_MAP[s.name.toLowerCase()] || [];
    const perkMinis = charPerks.map(p => `
        <button class="surv-perk-mini synergy-link" data-perk-id="${p.id}"
                style="background:${tierBgColor(p.tier)}">
          <span class="surv-perk-icon-wrap">
            <img src="${perkIconUrl(p.name)}" alt="" class="surv-perk-icon" loading="lazy"
                 onerror="this.style.display='none';this.parentElement.classList.add('no-icon')">
          </span>
        </button>`).join("");

    return `
      <article class="survivor-card" id="survivor-${s.rank}">
        <div class="survivor-card-header">
          ${s.portrait ? `<span class="char-portrait-wrap survivor-portrait-wrap">${portraitHtml(s, "char-portrait")}</span>` : ""}
          <span class="survivor-rank">#${s.rank}</span>
          <span class="survivor-name">${esc(s.name)}</span>
        </div>
        <div class="survivor-tags">
          ${s.status    ? `<span class="survivor-tag ${statusClass}">${esc(s.status)}</span>` : ""}
          ${s.modelSize ? `<span class="survivor-tag ${sizeClass}">${esc(s.modelSize)} model</span>` : ""}
          ${s.noise     ? `<span class="survivor-tag ${noiseClass}">${esc(s.noise)}</span>` : ""}
        </div>
        ${s.notes ? `<p class="survivor-notes">${esc(s.notes)}</p>` : ""}
        ${perkMinis ? `<div class="surv-perk-list">${perkMinis}</div>` : ""}
        ${s.price ? `<div class="survivor-price">${esc(s.price)}</div>` : ""}
      </article>`;
  }

  survivorSearch.addEventListener("input", renderSurvivors);
  survivorSort.addEventListener("change", renderSurvivors);
  renderSurvivors();

  // ═══════════════════════════════════════════════════════════════════════════
  // PERK VALUE INDEX SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const valuePodium    = document.getElementById("value-podium");
  const valueBasegame  = document.getElementById("value-basegame");
  const valueContainer = document.getElementById("value-container");
  const valueSort      = document.getElementById("value-sort");
  let activeValueFilter = "all";

  // Separate base game from rankable characters
  const BASE_GAME = CHAR_VALUE.find(c => c.name === "Base game (all)");
  const RANKED    = CHAR_VALUE.filter(c => c.name !== "Base game (all)");

  // Value tier thresholds — computed from actual data range
  const scores   = RANKED.map(c => c.totalScore);
  const maxScore = Math.max(...scores);
  function valueTier(score) {
    const pct = score / maxScore;
    if (pct >= 0.72) return "S";
    if (pct >= 0.50) return "A";
    if (pct >= 0.30) return "B";
    if (pct >= 0.14) return "C";
    return "D";
  }
  const VALUE_TIER_LABELS = {
    S: { label: "S — Essential", color: "#d4af37", desc: "Must-unlock characters with top-tier, widely-synergised perks" },
    A: { label: "A — High Value", color: "#4caf50", desc: "Strong perks that appear frequently as recommendations" },
    B: { label: "B — Solid",      color: "#3f7fbf", desc: "Good perks worth unlocking when you get to them" },
    C: { label: "C — Situational",color: "#8a8a8a", desc: "Niche perks; some gems in specific builds" },
    D: { label: "D — Skip",       color: "#b71c1c", desc: "Low-impact perks; rarely worth prioritising" },
  };

  document.querySelectorAll("[data-value-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeValueFilter = chip.dataset.valueFilter;
      document.querySelectorAll("[data-value-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderValueIndex();
    });
  });
  valueSort.addEventListener("change", renderValueIndex);

  function sortedRanked() {
    let list = RANKED.filter(c => {
      if (activeValueFilter === "Free") return c.status === "Free";
      if (activeValueFilter === "Paid") return c.status === "Paid";
      return true;
    });
    const by = valueSort.value;
    if (by === "tier")    list.sort((a, b) => b.tierScore    - a.tierScore);
    if (by === "synergy") list.sort((a, b) => b.synergyScore - a.synergyScore);
    if (by === "name")    list.sort((a, b) => a.name.localeCompare(b.name));
    if (by === "total")   list.sort((a, b) => b.totalScore   - a.totalScore);
    return list;
  }

  function renderValueIndex() {
    const list = sortedRanked();
    const topList = RANKED.slice(0, 3); // podium always uses global top 3

    // ── Podium ──────────────────────────────────────────────────────────────
    const medals = ["🥇", "🥈", "🥉"];
    const podiumClasses = ["gold", "silver", "bronze"];
    valuePodium.innerHTML = topList.map((c, i) => {
      const statusCls = c.status === "Free" ? "tier-verygood" : "tier-niche";
      const statusLbl = c.status || "";
      return `
        <div class="podium-card ${podiumClasses[i]}">
          <span class="podium-status"><span class="tier-badge ${statusCls}">${esc(statusLbl)}</span></span>
          <span class="podium-medal">${medals[i]}</span>
          <div class="podium-rank">#${c.rank}</div>
          <div class="podium-name">${esc(c.name)}</div>
          <div class="podium-score">${c.totalScore}</div>
          <div class="podium-score-label">total score</div>
          <div class="podium-breakdown">Tier ${c.tierScore} · Synergy ${c.synergyScore}</div>
          <div class="podium-best">Best: <em>${esc(c.bestPerk)}</em></div>
        </div>`;
    }).join("");

    // ── Base game notice ─────────────────────────────────────────────────────
    if (BASE_GAME) {
      valueBasegame.innerHTML = `
        <strong>Base Game Perks (${BASE_GAME.perkCount} perks, Score ${BASE_GAME.totalScore})</strong>
        — These perks are free for all players and not included in the ranking above.
        Notable: ${BASE_GAME.perks.slice(0, 5).map(p => `<em>${esc(p.name)}</em> (${esc(p.tier)})`).join(", ")} and more.`;
    }

    // ── Tier groups ──────────────────────────────────────────────────────────
    if (!list.length) {
      valueContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">🕯️</span><h3>No characters match this filter</h3></div>`;
      return;
    }

    const tierOrder = ["S", "A", "B", "C", "D"];
    const grouped = Object.fromEntries(tierOrder.map(t => [t, []]));
    list.forEach(c => grouped[valueTier(c.totalScore)].push(c));

    let html = "";
    tierOrder.forEach(vt => {
      const chars = grouped[vt];
      if (!chars.length) return;
      const meta = VALUE_TIER_LABELS[vt];
      html += `
        <div class="value-tier-group">
          <h3 class="value-tier-header" style="color:${meta.color}">
            <span class="tier-badge badge-${vt}" style="color:${meta.color};border-color:${meta.color};font-size:0.9rem">${vt}</span>
            ${esc(meta.label)}
            <span class="value-tier-desc">${esc(meta.desc)}</span>
          </h3>
          <div class="value-grid">
            ${chars.map(c => charCard(c, maxScore)).join("")}
          </div>
        </div>`;
    });
    valueContainer.innerHTML = html;
  }

  function charCard(c, maxScore) {
    const tierW    = Math.round((c.tierScore    / maxScore) * 100);
    const synW     = Math.round((c.synergyScore / maxScore) * 100);
    const statusCls = c.status === "Free" ? "tier-verygood" : "tier-niche";
    const perkRows  = c.perks.map(p => `
      <div class="char-perk-row">
        <span class="tier-badge ${tierBadgeClass(p.tier)}" style="font-size:0.6rem;padding:0.1rem 0.35rem">${esc(p.tier)}</span>
        <span class="char-perk-name" data-perk-id="${p.id}">${esc(p.name)}</span>
        <span class="synergy-pill${p.synergyCount === 0 ? " zero" : ""}">${p.synergyCount > 0 ? `cited ${p.synergyCount}×` : "0 cites"}</span>
      </div>`).join("");

    return `
      <article class="char-card" id="char-${c.rank}">
        <div class="char-card-header">
          <span class="char-rank">#${c.rank}</span>
          <span class="char-name">${esc(c.name)}</span>
          <span class="tier-badge ${statusCls}">${esc(c.status || "")}</span>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar-labels">
            <span>Tier <strong style="color:#d4af37">${c.tierScore}</strong></span>
            <span class="score-total-label">Total <strong>${c.totalScore}</strong></span>
            <span>Synergy <strong style="color:#6aab7a">${c.synergyScore}</strong></span>
          </div>
          <div class="score-bar-track">
            <div class="score-bar-tier"  style="width:${tierW}%"></div>
            <div class="score-bar-syn"   style="width:${Math.min(synW, 100 - tierW)}%"></div>
          </div>
        </div>
        <div class="char-perk-list">${perkRows}</div>
      </article>`;
  }

  // Click on perk name in char card → navigate to that perk
  document.addEventListener("click", e => {
    const pn = e.target.closest(".char-perk-name");
    if (pn && pn.dataset.perkId) navigateToPerk(parseInt(pn.dataset.perkId, 10));
  });

  renderValueIndex();

  // ═══════════════════════════════════════════════════════════════════════════
  // THEORYCRAFT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const theorySlots = [null, null, null, null];

  function categoryToRole(cat) {
    if (!cat) return "";
    const first = cat.split("/")[0].trim().toLowerCase();
    const MAP = {
      "stealth": "Stealth", "chase": "Chase", "exhaustion": "Chase",
      "general speed": "Chase", "healing": "Healer", "passive heal": "Healer",
      "altruism": "Healer", "generator": "Gen Rush", "skill checks": "Gen Rush",
      "boon": "Boon", "anti-tunnel": "Defensive", "anti-slug": "Defensive",
      "endurance": "Defensive", "end-game": "End Game", "information": "Intel",
      "rescue": "Support", "hook support": "Support", "hook": "Support",
      "team": "Support", "item": "Item", "chest": "Chest",
      "distraction": "Distraction", "trap": "Trap",
    };
    return MAP[first] || cat.split("/")[0];
  }

  const theorySlotEls  = document.querySelectorAll(".theory-slot");
  const theorySynBox   = document.getElementById("theory-synergies");
  const theorySynList  = document.getElementById("theory-synergy-list");
  const theoryGrid     = document.getElementById("theory-perk-grid");
  const theorySearch   = document.getElementById("theory-search");
  const theoryCatSel   = document.getElementById("theory-category");
  const theoryCharSel  = document.getElementById("theory-character");
  const theoryAnalysis = document.getElementById("theory-analysis");
  const theoryClearBtn = document.getElementById("theory-clear");

  // Strategy → category sets
  const STRATEGY_CATS = {
    stealth:  new Set(["Stealth","Stealth/Chase","Stealth/Healing","Stealth/Team","Chase/Stealth","Information/Stealth","Boon/Stealth"]),
    healing:  new Set(["Healing","Healing/Chest","Healing/Stealth","Healing/Utility","Boon/Healing","Chase/Healing","Chest/Healing","Altruism","Altruism/BP","Passive Heal"]),
    gen:      new Set(["Generator","Generator/Team","Generator/Totem","Item/Generator","Information/Gen","Chest/Generator","Trap/Gen","Skill Checks"]),
    tunnel:   new Set(["Anti-Tunnel","Anti-Slug","Anti-Slug/Endurance","Anti-Slug/Mobility","Boon/Anti-Slug","Endurance"]),
    chase:    new Set(["Chase","Chase/Exhaustion","Chase/Flashlight","Chase/Healing","Chase/Information","Chase/Stealth","Chase/Stun","Chase/Team","Exhaustion","Exhaustion Recovery","Exhaustion/Support","Trap/Chase","General Speed"]),
    endgame:  new Set(["End-Game","End-Game/Selfish"]),
    info:     new Set(["Information","Information/Chase","Information/Gen","Information/Rescue","Information/Risk","Information/Stealth","Hook/Information","Boon/Information","Chest/Information","Distraction/Info","Chase/Information"]),
    team:     new Set(["Rescue","Rescue/Mobility","Rescue/Wiggle","Hook Support","Team","Team Support","Team Utility","Chase/Team","Altruism","Altruism/BP"]),
  };
  const STRATEGY_NAMES = {
    stealth: "Stealth", healing: "Healing / Sustain", gen: "Gen Rush",
    tunnel: "Anti-Tunnel", chase: "Chase", endgame: "End-Game",
    info: "Information", team: "Team / Rescue",
  };
  const STRATEGY_DESCS = {
    stealth:  "Stay off the killer's radar. Move quietly, avoid detection during repairs and rescues.",
    healing:  "Invest in recovery. Keep yourself and teammates healthy to outlast killer pressure.",
    gen:      "Push generators fast. Complete objectives quickly and force the killer to spread thin.",
    tunnel:   "Deny the killer easy repeat hooks. Protect against being singled out and stay in longer.",
    chase:    "Built for the loop. Buy time for your team through stamina and superior chase mechanics.",
    endgame:  "Activates when the gates are powered. Hold on and escape in the final push.",
    info:     "See everything. Use information advantages to track the killer and coordinate rescues.",
    team:     "Carry your team. Rescue efficiently, take hits for others, and make up for bad plays.",
  };

  // Populate category + character dropdowns
  const theoryCats  = [...new Set(PERKS.map(p => p.category).filter(Boolean))].sort();
  const theoryChars = [...new Set(PERKS.map(p => p.character).filter(Boolean))].sort();
  theoryCats.forEach(c  => theoryCatSel.insertAdjacentHTML("beforeend",  `<option value="${esc(c)}">${esc(c)}</option>`));
  theoryChars.forEach(c => theoryCharSel.insertAdjacentHTML("beforeend", `<option value="${esc(c)}">${esc(c)}</option>`));

  let theoryTierFilter = "all";
  let theoryStratFilter = "all";

  document.querySelectorAll("[data-theory-tier]").forEach(chip => {
    chip.addEventListener("click", () => {
      theoryTierFilter = chip.dataset.theoryTier;
      document.querySelectorAll("[data-theory-tier]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderTheoryGrid();
    });
  });

  document.querySelectorAll("[data-strategy]").forEach(chip => {
    chip.addEventListener("click", () => {
      theoryStratFilter = chip.dataset.strategy;
      document.querySelectorAll("[data-strategy]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderTheoryGrid();
    });
  });

  theorySearch.addEventListener("input",  renderTheoryGrid);
  theoryCatSel.addEventListener("change", renderTheoryGrid);
  theoryCharSel.addEventListener("change",renderTheoryGrid);

  theoryClearBtn.addEventListener("click", () => {
    theorySlots.fill(null);
    renderSlots();
    renderSynergySuggestions();
    renderBuildAnalysis();
    renderTheoryGrid();
    theoryClearBtn.style.display = "none";
  });

  // ── Slot management ─────────────────────────────────────────────────────────
  function addPerkToSlot(perk) {
    if (theorySlots.some(s => s && s.id === perk.id)) return;
    const empty = theorySlots.indexOf(null);
    if (empty === -1) return;
    theorySlots[empty] = perk;
    renderSlots();
    renderSynergySuggestions();
    renderBuildAnalysis();
    renderTheoryGrid();
    theoryClearBtn.style.display = "";
  }

  function removePerkFromSlot(i) {
    theorySlots[i] = null;
    renderSlots();
    renderSynergySuggestions();
    renderBuildAnalysis();
    renderTheoryGrid();
    if (!theorySlots.some(Boolean)) theoryClearBtn.style.display = "none";
  }

  function renderSlots() {
    theorySlotEls.forEach((el, i) => {
      const p = theorySlots[i];
      if (p) {
        const role = categoryToRole(p.category);
        el.className = "theory-slot filled";
        delete el.dataset.perkId;
        el.innerHTML = `
          <div class="slot-card-header">
            ${role ? `<span class="slot-role-tag">${esc(role)}</span>` : ""}
            <button class="slot-remove" data-slot="${i}" title="Remove">✕</button>
          </div>
          <div class="slot-card-body">
            ${perkIconHtml(p.name, "slot-perk-icon")}
            <div class="slot-card-text">
              <span class="slot-perk-name">${esc(p.name)}</span>
              <div class="slot-card-meta">
                <span class="tier-badge ${tierBadgeClass(p.tier)} slot-tier-badge" style="font-size:0.6rem">${esc(p.tier)}</span>
                <span class="slot-perk-char">${esc(p.character || "Base game")}</span>
              </div>
            </div>
          </div>
          <p class="slot-perk-desc">${descHtml(p.description || "")}</p>`;
      } else {
        el.className = "theory-slot empty";
        delete el.dataset.perkId;
        el.innerHTML = `<span class="slot-label">Perk ${i + 1}</span><span class="slot-hint">_ empty</span>`;
      }
    });
  }

  document.getElementById("theory-slots").addEventListener("click", e => {
    const removeBtn = e.target.closest(".slot-remove");
    if (removeBtn) { removePerkFromSlot(parseInt(removeBtn.dataset.slot)); return; }
    const slot = e.target.closest(".theory-slot.filled");
    if (slot) navigateToPerk(theorySlots[parseInt(slot.dataset.slot)].id);
  });

  // ── Build analysis ─────────────────────────────────────────────────────────
  function renderBuildAnalysis() {
    const filled = theorySlots.filter(Boolean);
    if (filled.length < 2) { theoryAnalysis.style.display = "none"; return; }

    const scores = {};
    for (const [strat, cats] of Object.entries(STRATEGY_CATS)) {
      scores[strat] = filled.filter(p => cats.has(p.category)).length;
    }
    const ranked = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) { theoryAnalysis.style.display = "none"; return; }

    const [topStrat, topCount] = ranked[0];
    const secondary = ranked.slice(1, 3).filter(([, v]) => v > 0)
      .map(([s]) => STRATEGY_NAMES[s]).join(" + ");
    const secondaryLine = secondary ? `<span class="analysis-secondary">Secondary: ${secondary}</span>` : "";

    const bars = ranked.slice(0, 4).map(([s, v]) => `
      <div class="analysis-bar-row">
        <span class="analysis-bar-label">${STRATEGY_NAMES[s] || s}</span>
        <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${Math.round((v / filled.length) * 100)}%"></div></div>
        <span class="analysis-bar-count">${v}/${filled.length}</span>
      </div>`).join("");

    theoryAnalysis.style.display = "";
    theoryAnalysis.innerHTML = `
      <div class="analysis-header">
        <span class="analysis-badge">${esc(STRATEGY_NAMES[topStrat] || topStrat)}</span>
        ${secondaryLine}
      </div>
      <p class="analysis-desc">${STRATEGY_DESCS[topStrat] || ""}</p>
      <div class="analysis-bars">${bars}</div>`;
  }

  // ── Synergy suggestions ─────────────────────────────────────────────────────
  function renderSynergySuggestions() {
    const filled = theorySlots.filter(Boolean);
    if (!filled.length) { theorySynBox.style.display = "none"; return; }

    const suggestCounts = {};
    const inBuild = new Set(filled.map(p => p.name.toLowerCase()));
    filled.forEach(p => {
      if (!p.synergy) return;
      p.synergy.split(",").forEach(part => {
        const raw = part.match(/^([^(]+)/)?.[1]?.trim().toLowerCase();
        if (!raw || inBuild.has(raw)) return;
        const candidate = PERK_BY_NAME[raw];
        if (candidate) suggestCounts[candidate.id] = (suggestCounts[candidate.id] || 0) + 1;
      });
    });

    const suggestions = Object.entries(suggestCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, count]) => ({ perk: PERK_BY_ID[parseInt(id)], count }))
      .filter(s => s.perk);

    if (!suggestions.length) { theorySynBox.style.display = "none"; return; }

    theorySynBox.style.display = "";
    theorySynList.innerHTML = suggestions.map(({ perk, count }) => `
      <button class="theory-suggestion" data-perk-id="${perk.id}">
        <span class="tier-badge ${tierBadgeClass(perk.tier)}" style="font-size:0.6rem">${esc(perk.tier)}</span>
        <span>${esc(perk.name)}</span>
        <span class="sug-count">×${count}</span>
      </button>`).join("");
  }

  theorySynList.addEventListener("click", e => {
    const btn = e.target.closest(".theory-suggestion");
    if (!btn) return;
    const perk = PERK_BY_ID[parseInt(btn.dataset.perkId)];
    if (!perk) return;
    if (theorySlots.includes(null)) addPerkToSlot(perk);
    else navigateToPerk(perk.id);
  });

  // ── Perk picker grid ─────────────────────────────────────────────────────────
  function getSuggestionIds() {
    const filled = theorySlots.filter(Boolean);
    const ids = new Set();
    filled.forEach(p => {
      if (!p.synergy) return;
      p.synergy.split(",").forEach(part => {
        const raw = part.match(/^([^(]+)/)?.[1]?.trim().toLowerCase();
        const c = raw && PERK_BY_NAME[raw];
        if (c) ids.add(c.id);
      });
    });
    return ids;
  }

  function renderTheoryGrid() {
    const q    = theorySearch.value.toLowerCase().trim();
    const cat  = theoryCatSel.value;
    const char = theoryCharSel.value;
    const sugIds = getSuggestionIds();
    const inBuildIds = new Set(theorySlots.filter(Boolean).map(p => p.id));
    const stratCats = theoryStratFilter !== "all" ? STRATEGY_CATS[theoryStratFilter] : null;

    let filtered = PERKS.filter(p => {
      if (theoryTierFilter !== "all" && p.tier !== theoryTierFilter) return false;
      if (stratCats && !stratCats.has(p.category)) return false;
      if (cat  && p.category  !== cat)  return false;
      if (char && p.character !== char) return false;
      if (q && !p.name.toLowerCase().includes(q) &&
               !p.character.toLowerCase().includes(q) &&
               !(p.description||"").toLowerCase().includes(q)) return false;
      return true;
    });

    const tierOrder = { "Excellent": 0, "Very Good": 1, "Decent": 2, "Weak/Niche": 3, "Terrible": 4 };
    filtered.sort((a, b) => {
      const aSug = sugIds.has(a.id) ? 0 : 1;
      const bSug = sugIds.has(b.id) ? 0 : 1;
      if (aSug !== bSug) return aSug - bSug;
      return (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5) || a.name.localeCompare(b.name);
    });

    if (!filtered.length) {
      theoryGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🕯️</span><h3>No perks match</h3></div>`;
      return;
    }

    theoryGrid.innerHTML = filtered.map(p => {
      const inBuild = inBuildIds.has(p.id);
      const isSug   = sugIds.has(p.id) && !inBuild;
      return `
        <div class="theory-perk-item${inBuild ? " in-build" : ""}${isSug ? " is-suggestion" : ""}"
             data-perk-id="${p.id}">
          ${perkIconHtml(p.name, "tpi-icon")}
          <span class="tpi-name">${esc(p.name)}</span>
          <div class="tpi-meta">
            <span class="tier-badge ${tierBadgeClass(p.tier)}" style="font-size:0.6rem;padding:0.1rem 0.3rem">${esc(p.tier)}</span>
            <span class="tpi-char">${esc(p.character || "Base game")}</span>
          </div>
        </div>`;
    }).join("");
  }

  theoryGrid.addEventListener("click", e => {
    const item = e.target.closest(".theory-perk-item");
    if (!item || item.classList.contains("in-build")) return;
    const perk = PERK_BY_ID[parseInt(item.dataset.perkId)];
    if (perk) addPerkToSlot(perk);
  });

  renderTheoryGrid();

  // ── Allow "theory" as a valid hash section ───────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  // KILLER PERK VALUE INDEX SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const kvaluePodium    = document.getElementById("kvalue-podium");
  const kvalueGeneral   = document.getElementById("kvalue-general");
  const kvalueContainer = document.getElementById("kvalue-container");
  const kvalueSort      = document.getElementById("kvalue-sort");
  let activeKValueFilter = "all";

  const K_GENERAL = KILLER_CHAR_VALUE.find(c => c.name === "General (all killers)");
  const K_RANKED  = KILLER_CHAR_VALUE.filter(c => c.name !== "General (all killers)");

  const kScores   = K_RANKED.map(c => c.totalScore);
  const kMaxScore = Math.max(...kScores);
  function kValueTier(score) {
    const pct = score / kMaxScore;
    if (pct >= 0.72) return "S";
    if (pct >= 0.50) return "A";
    if (pct >= 0.30) return "B";
    if (pct >= 0.14) return "C";
    return "D";
  }

  document.querySelectorAll("[data-kvalue-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      activeKValueFilter = chip.dataset.kvalueFilter;
      document.querySelectorAll("[data-kvalue-filter]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderKillerValueIndex();
    });
  });
  kvalueSort.addEventListener("change", renderKillerValueIndex);

  function sortedKRanked() {
    let list = K_RANKED.filter(c => {
      if (activeKValueFilter === "Free") return c.status === "Free";
      if (activeKValueFilter === "Paid") return c.status === "Paid";
      return true;
    });
    const by = kvalueSort.value;
    if (by === "tier")  list.sort((a, b) => b.tierScore  - a.tierScore);
    if (by === "name")  list.sort((a, b) => a.name.localeCompare(b.name));
    if (by === "total") list.sort((a, b) => b.totalScore - a.totalScore);
    return list;
  }

  function renderKillerValueIndex() {
    const list = sortedKRanked();
    const topList = K_RANKED.slice(0, 3);

    const medals = ["🥇", "🥈", "🥉"];
    const podiumClasses = ["gold", "silver", "bronze"];
    kvaluePodium.innerHTML = topList.map((c, i) => {
      const statusCls = c.status === "Free" ? "tier-verygood" : "tier-niche";
      return `
        <div class="podium-card ${podiumClasses[i]}">
          <span class="podium-status"><span class="tier-badge ${statusCls}">${esc(c.status || "")}</span></span>
          <span class="podium-medal">${medals[i]}</span>
          <div class="podium-rank">#${c.rank}</div>
          <div class="podium-name">${esc(c.name)}</div>
          <div class="podium-score">${c.totalScore}</div>
          <div class="podium-score-label">tier score</div>
          <div class="podium-best">Best: <em>${esc(c.bestPerk)}</em></div>
        </div>`;
    }).join("");

    if (K_GENERAL) {
      kvalueGeneral.innerHTML = `
        <strong>General Perks (${K_GENERAL.perkCount} perks, Score ${K_GENERAL.totalScore})</strong>
        — These perks are usable by every killer and not included in the ranking above.
        Notable: ${K_GENERAL.perks.slice(0, 5).map(p => `<em>${esc(p.name)}</em> (${esc(p.tier)})`).join(", ")} and more.`;
    }

    if (!list.length) {
      kvalueContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">🔪</span><h3>No killers match this filter</h3></div>`;
      return;
    }

    const tierOrder = ["S", "A", "B", "C", "D"];
    const VALUE_TIER_LABELS_K = {
      S: { label: "S — Essential", color: "#d4af37", desc: "Must-unlock — top-tier perks usable on any killer" },
      A: { label: "A — High Value", color: "#4caf50", desc: "Strong perks worth prioritising early" },
      B: { label: "B — Solid",      color: "#3f7fbf", desc: "Good perks worth picking up eventually" },
      C: { label: "C — Situational",color: "#8a8a8a", desc: "Niche perks — useful in specific builds" },
      D: { label: "D — Skip",       color: "#b71c1c", desc: "Low-impact perks — rarely worth prestige" },
    };
    const grouped = Object.fromEntries(tierOrder.map(t => [t, []]));
    list.forEach(c => grouped[kValueTier(c.totalScore)].push(c));

    let html = "";
    tierOrder.forEach(vt => {
      const chars = grouped[vt];
      if (!chars.length) return;
      const meta = VALUE_TIER_LABELS_K[vt];
      html += `
        <div class="value-tier-group">
          <h3 class="value-tier-header" style="color:${meta.color}">
            <span class="tier-badge badge-${vt}" style="color:${meta.color};border-color:${meta.color};font-size:0.9rem">${vt}</span>
            ${esc(meta.label)}
            <span class="value-tier-desc">${esc(meta.desc)}</span>
          </h3>
          <div class="value-grid">
            ${chars.map(c => killerCharCard(c, kMaxScore)).join("")}
          </div>
        </div>`;
    });
    kvalueContainer.innerHTML = html;
  }

  function killerCharCard(c, maxScore) {
    const tierW    = Math.round((c.tierScore / maxScore) * 100);
    const statusCls = c.status === "Free" ? "tier-verygood" : "tier-niche";
    const perkRows  = c.perks.map(p => `
      <div class="char-perk-row">
        <span class="tier-badge ${tierBadgeClass(p.tier)}" style="font-size:0.6rem;padding:0.1rem 0.35rem">${esc(p.tier)}</span>
        <span class="char-perk-name kvalue-perk-link" data-killer-perk-id="${p.id}">${esc(p.name)}</span>
      </div>`).join("");

    return `
      <article class="char-card" id="kchar-${c.rank}">
        <div class="char-card-header">
          <span class="char-rank">#${c.rank}</span>
          <span class="char-name">${esc(c.name)}</span>
          <span class="tier-badge ${statusCls}">${esc(c.status || "")}</span>
        </div>
        <div class="score-bar-wrap">
          <div class="score-bar-labels">
            <span>Tier <strong style="color:#d4af37">${c.tierScore}</strong></span>
            <span class="score-total-label">Total <strong>${c.totalScore}</strong></span>
          </div>
          <div class="score-bar-track">
            <div class="score-bar-tier" style="width:${tierW}%"></div>
          </div>
        </div>
        <div class="char-perk-list">${perkRows}</div>
      </article>`;
  }

  document.addEventListener("click", e => {
    const kpn = e.target.closest(".kvalue-perk-link");
    if (kpn && kpn.dataset.killerPerkId) navigateToKillerPerk(parseInt(kpn.dataset.killerPerkId, 10));
  });

  renderKillerValueIndex();

  // ═══════════════════════════════════════════════════════════════════════════
  // KILLER THEORYCRAFT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const kTheorySlots = [null, null, null, null];

  function kCategoryToRole(cat) {
    if (!cat) return "";
    const MAP = {
      "gen control": "Gen Control", "hex": "Hex",
      "chase": "Chase", "stealth": "Stealth",
      "information": "Info", "end-game": "End-Game",
      "utility": "Utility",
    };
    return MAP[cat.toLowerCase()] || cat.split("/")[0];
  }

  const kTheorySlotEls  = document.querySelectorAll("#ktheory-slots .theory-slot");
  const kTheoryGrid     = document.getElementById("ktheory-perk-grid");
  const kTheorySearch   = document.getElementById("ktheory-search");
  const kTheoryCatSel   = document.getElementById("ktheory-category");
  const kTheoryCharSel  = document.getElementById("ktheory-character");
  const kTheoryAnalysis = document.getElementById("ktheory-analysis");
  const kTheoryClearBtn = document.getElementById("ktheory-clear");

  const K_STRATEGY_CATS = {
    genctrl: new Set(["Gen Control"]),
    chase:   new Set(["Chase"]),
    stealth: new Set(["Stealth"]),
    info:    new Set(["Information"]),
    hex:     new Set(["Hex"]),
    endgame: new Set(["End-Game"]),
    utility: new Set(["Utility"]),
  };
  const K_STRATEGY_NAMES = {
    genctrl: "Gen Control", chase: "Chase", stealth: "Stealth",
    info: "Information", hex: "Hex", endgame: "End-Game", utility: "Utility",
  };
  const K_STRATEGY_DESCS = {
    genctrl: "Lock down generators. Apply pressure that forces survivors off gens and snowballs early hooks.",
    chase:   "Dominate 1v1 loops. Built to end chases fast, leaving more time for map pressure.",
    stealth: "Hunt in silence. Approach without audio/visual cues and ambush unsuspecting survivors.",
    info:    "See everything. Track survivors across the map and anticipate their every move.",
    hex:     "Totem power. High-upside perks that reward keeping your totems alive.",
    endgame: "Seal the deal. Perks that activate at end-game to prevent any escape.",
    utility: "Flexible toolkit. Perks that provide value across multiple phases of the match.",
  };

  // Populate dropdowns
  const kTheoryCats  = [...new Set(KILLER_PERKS.map(p => p.category).filter(Boolean))].sort();
  const kTheoryChars = [...new Set(KILLER_PERKS.map(p => p.character).filter(Boolean))].sort();
  kTheoryCats.forEach(c  => kTheoryCatSel.insertAdjacentHTML("beforeend",  `<option value="${esc(c)}">${esc(c)}</option>`));
  kTheoryChars.forEach(c => kTheoryCharSel.insertAdjacentHTML("beforeend", `<option value="${esc(c)}">${esc(c)}</option>`));

  let kTheoryTierFilter = "all";
  let kTheoryStratFilter = "all";

  document.querySelectorAll("[data-ktheory-tier]").forEach(chip => {
    chip.addEventListener("click", () => {
      kTheoryTierFilter = chip.dataset.ktheoryTier;
      document.querySelectorAll("[data-ktheory-tier]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderKTheoryGrid();
    });
  });

  document.querySelectorAll("[data-kstrategy]").forEach(chip => {
    chip.addEventListener("click", () => {
      kTheoryStratFilter = chip.dataset.kstrategy;
      document.querySelectorAll("[data-kstrategy]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderKTheoryGrid();
    });
  });

  kTheorySearch.addEventListener("input",   renderKTheoryGrid);
  kTheoryCatSel.addEventListener("change",  renderKTheoryGrid);
  kTheoryCharSel.addEventListener("change", renderKTheoryGrid);

  kTheoryClearBtn.addEventListener("click", () => {
    kTheorySlots.fill(null);
    renderKSlots();
    renderKBuildAnalysis();
    renderKTheoryGrid();
    kTheoryClearBtn.style.display = "none";
  });

  function addKPerkToSlot(perk) {
    if (kTheorySlots.some(s => s && s.id === perk.id)) return;
    const empty = kTheorySlots.indexOf(null);
    if (empty === -1) return;
    kTheorySlots[empty] = perk;
    renderKSlots();
    renderKBuildAnalysis();
    renderKTheoryGrid();
    kTheoryClearBtn.style.display = "";
  }

  function removeKPerkFromSlot(i) {
    kTheorySlots[i] = null;
    renderKSlots();
    renderKBuildAnalysis();
    renderKTheoryGrid();
    if (!kTheorySlots.some(Boolean)) kTheoryClearBtn.style.display = "none";
  }

  function renderKSlots() {
    kTheorySlotEls.forEach((el, i) => {
      const p = kTheorySlots[i];
      if (p) {
        const role = kCategoryToRole(p.category);
        el.className = "theory-slot filled";
        el.innerHTML = `
          <div class="slot-card-header">
            ${role ? `<span class="slot-role-tag">${esc(role)}</span>` : ""}
            <button class="kslot-remove" data-kslot="${i}" title="Remove">✕</button>
          </div>
          <div class="slot-card-body">
            <div class="slot-card-text">
              <span class="slot-perk-name">${esc(p.name)}</span>
              <div class="slot-card-meta">
                <span class="tier-badge ${tierBadgeClass(p.tier)} slot-tier-badge" style="font-size:0.6rem">${esc(p.tier)}</span>
                <span class="slot-perk-char">${esc(p.character || "General")}</span>
              </div>
            </div>
          </div>
          <p class="slot-perk-desc">${descHtml(p.description || "")}</p>`;
      } else {
        el.className = "theory-slot empty";
        el.innerHTML = `<span class="slot-label">Perk ${i + 1}</span><span class="slot-hint">_ empty</span>`;
      }
    });
  }

  document.getElementById("ktheory-slots").addEventListener("click", e => {
    const removeBtn = e.target.closest(".kslot-remove");
    if (removeBtn) { removeKPerkFromSlot(parseInt(removeBtn.dataset.kslot)); return; }
    const slot = e.target.closest(".theory-slot.filled");
    if (slot) {
      const idx = parseInt(slot.dataset.kslot);
      const p = kTheorySlots[idx];
      if (p) navigateToKillerPerk(p.id);
    }
  });

  function renderKBuildAnalysis() {
    const filled = kTheorySlots.filter(Boolean);
    if (filled.length < 2) { kTheoryAnalysis.style.display = "none"; return; }

    const scores = {};
    for (const [strat, cats] of Object.entries(K_STRATEGY_CATS)) {
      scores[strat] = filled.filter(p => cats.has(p.category)).length;
    }
    const ranked = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) { kTheoryAnalysis.style.display = "none"; return; }

    const [topStrat, ] = ranked[0];
    const secondary = ranked.slice(1, 3).filter(([, v]) => v > 0)
      .map(([s]) => K_STRATEGY_NAMES[s]).join(" + ");
    const secondaryLine = secondary ? `<span class="analysis-secondary">Secondary: ${secondary}</span>` : "";

    const bars = ranked.slice(0, 4).map(([s, v]) => `
      <div class="analysis-bar-row">
        <span class="analysis-bar-label">${K_STRATEGY_NAMES[s] || s}</span>
        <div class="analysis-bar-track"><div class="analysis-bar-fill" style="width:${Math.round((v / filled.length) * 100)}%"></div></div>
        <span class="analysis-bar-count">${v}/${filled.length}</span>
      </div>`).join("");

    kTheoryAnalysis.style.display = "";
    kTheoryAnalysis.innerHTML = `
      <div class="analysis-header">
        <span class="analysis-badge">${esc(K_STRATEGY_NAMES[topStrat] || topStrat)}</span>
        ${secondaryLine}
      </div>
      <p class="analysis-desc">${K_STRATEGY_DESCS[topStrat] || ""}</p>
      <div class="analysis-bars">${bars}</div>`;
  }

  function renderKTheoryGrid() {
    const q    = kTheorySearch.value.toLowerCase().trim();
    const cat  = kTheoryCatSel.value;
    const char = kTheoryCharSel.value;
    const inBuildIds = new Set(kTheorySlots.filter(Boolean).map(p => p.id));
    const stratCats  = kTheoryStratFilter !== "all" ? K_STRATEGY_CATS[kTheoryStratFilter] : null;

    let filtered = KILLER_PERKS.filter(p => {
      if (kTheoryTierFilter !== "all" && p.tier !== kTheoryTierFilter) return false;
      if (stratCats && !stratCats.has(p.category)) return false;
      if (cat  && p.category  !== cat)  return false;
      if (char && p.character !== char) return false;
      if (q && !p.name.toLowerCase().includes(q) &&
               !p.character.toLowerCase().includes(q) &&
               !(p.description||"").toLowerCase().includes(q)) return false;
      return true;
    });

    const tierOrder = { "Excellent": 0, "Very Good": 1, "Decent": 2, "Weak/Niche": 3, "Terrible": 4 };
    filtered.sort((a, b) => (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5) || a.name.localeCompare(b.name));

    if (!filtered.length) {
      kTheoryGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🔪</span><h3>No perks match</h3></div>`;
      return;
    }

    kTheoryGrid.innerHTML = filtered.map(p => {
      const inBuild = inBuildIds.has(p.id);
      return `
        <div class="theory-perk-item${inBuild ? " in-build" : ""}" data-kperk-id="${p.id}">
          <span class="tpi-name">${esc(p.name)}</span>
          <div class="tpi-meta">
            <span class="tier-badge ${tierBadgeClass(p.tier)}" style="font-size:0.6rem;padding:0.1rem 0.3rem">${esc(p.tier)}</span>
            <span class="tpi-char">${esc(p.character || "General")}</span>
          </div>
        </div>`;
    }).join("");
  }

  kTheoryGrid.addEventListener("click", e => {
    const item = e.target.closest(".theory-perk-item[data-kperk-id]");
    if (!item || item.classList.contains("in-build")) return;
    const perk = KILLER_PERK_BY_ID[parseInt(item.dataset.kperkId)];
    if (perk) addKPerkToSlot(perk);
  });

  renderKTheoryGrid();

  // ═══════════════════════════════════════════════════════════════════════════
  // ABOUT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const tierDefs = [
    { tier: "Excellent",  color: "#d4af37", desc: "Meta-defining — bring every game" },
    { tier: "Very Good",  color: "#4caf50", desc: "Excellent — strong recommendations" },
    { tier: "Decent",     color: "#3f7fbf", desc: "Solid — reliable in most matches" },
    { tier: "Weak/Niche", color: "#8a8a8a", desc: "Situational — useful in specific builds" },
    { tier: "Terrible",   color: "#b71c1c", desc: "Avoid — detrimental or nearly useless" },
  ];

  document.getElementById("tier-legend").innerHTML = tierDefs.map(t => `
    <div class="tier-legend-row">
      <span class="tier-badge ${tierBadgeClass(t.tier)}" style="color:${t.color};border-color:${t.color}">${esc(t.tier)}</span>
      <span class="tier-legend-desc">${esc(t.desc)}</span>
    </div>`).join("");

})();
