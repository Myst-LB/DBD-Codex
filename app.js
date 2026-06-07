// The Codex of the Fog — app.js
// All data loaded from data.js (globals: PERKS, KILLERS, SURVIVORS, BUILDS, META)

(function () {
  "use strict";

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  const PERK_BY_NAME     = Object.fromEntries(PERKS.map(p => [p.name.toLowerCase(), p]));
  const PERK_BY_ID       = Object.fromEntries(PERKS.map(p => [p.id, p]));
  const SURVIVOR_BY_NAME = Object.fromEntries(SURVIVORS.map(s => [s.name.toLowerCase(), s]));

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

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  const hash = window.location.hash.replace("#", "") || "perks";
  showSection(["perks","builds","killers","survivors","value","about"].includes(hash) ? hash : "perks", false);

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
      <div class="tooltip-desc">${esc(perk.description)}</div>
      <div class="tooltip-hint">Click to view perk</div>`;

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
    const sl = e.target.closest(".synergy-link");
    if (sl) { navigateToPerk(parseInt(sl.dataset.perkId, 10)); return; }
    const cl = e.target.closest(".character-link");
    if (cl) { navigateToSurvivor(cl.dataset.survivorName); return; }
  });

  document.addEventListener("mouseover", e => {
    const sl = e.target.closest(".synergy-link");
    if (sl) {
      const perk = PERK_BY_ID[parseInt(sl.dataset.perkId, 10)];
      if (perk) showTooltip(perk, sl);
    }
  });

  document.addEventListener("mouseout", e => {
    if (e.target.closest(".synergy-link")) hideTooltip();
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
            <span>(${perks.length})</span>
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
          <span class="perk-name">${esc(p.name)}</span>
          <span class="tier-badge ${tierBadgeClass(p.tier)}">${esc(p.tier)}</span>
        </div>
        <div class="perk-meta">
          ${characterHtml}
          ${p.category ? `<span class="perk-category">${esc(p.category)}</span>` : ""}
        </div>
        <p class="perk-desc">${esc(p.description)}</p>
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
      <div class="build-perks">🔮 ${buildSynergyHtml(b.perks)}</div>
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
    return `
      <article class="killer-card" id="killer-${k.rank}">
        <div class="killer-card-header">
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
        <div class="killer-price">${esc(k.status)} · ${esc(k.price)}</div>
      </article>`;
  }

  killerSearch.addEventListener("input", renderKillers);
  killerSort.addEventListener("change", renderKillers);
  renderKillers();

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

  function survivorCard(s) {
    const noiseClass  = (s.noise || "").toLowerCase().includes("loud") ? "loud" : "quiet";
    const sizeClass   = (s.modelSize || "").toLowerCase().split(" ")[0]; // "large", "medium", "small"
    const statusClass = (s.status || "").toLowerCase();
    const perksList   = (s.perks || []).filter(Boolean).join(" · ");
    return `
      <article class="survivor-card" id="survivor-${s.rank}">
        <div class="survivor-card-header">
          <span class="survivor-rank">#${s.rank}</span>
          <span class="survivor-name">${esc(s.name)}</span>
        </div>
        <div class="survivor-tags">
          ${s.status    ? `<span class="survivor-tag ${statusClass}">${esc(s.status)}</span>` : ""}
          ${s.modelSize ? `<span class="survivor-tag ${sizeClass}">${esc(s.modelSize)} model</span>` : ""}
          ${s.noise     ? `<span class="survivor-tag ${noiseClass}">${esc(s.noise)}</span>` : ""}
        </div>
        ${s.notes ? `<p class="survivor-notes">${esc(s.notes)}</p>` : ""}
        ${perksList ? `<div class="survivor-perks">Perks: ${esc(perksList)}</div>` : ""}
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
