(async () => {
  const res = await fetch('strains.json');
  const data = await res.json();

  const grid = document.getElementById('grid');
  const statsEl = document.getElementById('stats');
  const searchEl = document.getElementById('search');
  const sectionFilters = document.getElementById('sectionFilters');
  const phenoFilters = document.getElementById('phenoFilters');
  const rarityFilters = document.getElementById('rarityFilters');
  const lineageFilters = document.getElementById('lineageFilters');
  const clearBtn = document.getElementById('clearFilters');
  const resultCount = document.getElementById('resultCount');
  const subtotalEl = document.getElementById('subtotal');
  const valDisclaimerEl = document.getElementById('valDisclaimer');
  const sortEl = document.getElementById('sort');
  const viewToggle = document.querySelector('.view-toggle');

  const state = {
    section: 'ALL',
    pheno: null,
    rarity: 0,   // 0 = any
    lineage: new Set(),
    q: '',
    sort: 'section',
    view: 'expanded',
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmtK = (n) => n == null ? '—' : n.toLocaleString();
  const fmtMoney = (n) => n == null ? '—' : '$' + n.toLocaleString();
  const rarityFlames = (n) => '🔥'.repeat(Math.max(1, Math.min(5, n||1)));

  // ---- Stats ----
  const counts = { SEALED: 0, OPEN: 0, OTHER: 0, BONUS: 0 };
  data.strains.forEach(s => {
    const sec = (s.section || '').split('/')[0];
    if (counts[sec] !== undefined) counts[sec]++;
  });
  const v = data.meta.valuation || {};
  statsEl.innerHTML = `
    <span class="stat"><b>${data.strains.length}</b> strains</span>
    <span class="stat"><b>${counts.SEALED}</b> sealed</span>
    <span class="stat"><b>${counts.OPEN}</b> open</span>
    <span class="stat"><b>${counts.OTHER}</b> other</span>
    <span class="stat"><b>${counts.BONUS}</b> bonus</span>
    <span class="stat value"><b>$${fmtK(v.totalLow)}–$${fmtK(v.totalHigh)}</b> est. retail</span>
  `;
  if (v.disclaimer) valDisclaimerEl.textContent = v.disclaimer;

  // ---- Phenotype filter ----
  (data.meta.phenoTypes || []).forEach(p => {
    const b = document.createElement('button');
    b.textContent = p;
    b.dataset.pheno = p;
    b.addEventListener('click', () => {
      state.pheno = (state.pheno === p) ? null : p;
      render();
    });
    phenoFilters.appendChild(b);
  });

  // ---- Rarity filter ----
  rarityFilters.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.rarity = parseInt(b.dataset.rarity, 10) || 0;
      render();
    });
  });

  // ---- Lineage filter chips ----
  const tagCounts = {};
  data.strains.forEach(s => (s.lineageTags || []).forEach(t => tagCounts[t] = (tagCounts[t]||0) + 1));
  const sortedTags = Object.entries(tagCounts).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  sortedTags.forEach(([t, n]) => {
    const b = document.createElement('button');
    b.innerHTML = `${escapeHtml(t)} <span style="opacity:0.6">·${n}</span>`;
    b.dataset.tag = t;
    b.addEventListener('click', () => {
      if (state.lineage.has(t)) state.lineage.delete(t);
      else state.lineage.add(t);
      render();
    });
    lineageFilters.appendChild(b);
  });

  // ---- Section filter ----
  sectionFilters.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.section = b.dataset.filter;
      render();
    });
  });

  // ---- Sort ----
  sortEl.addEventListener('change', () => { state.sort = sortEl.value; render(); });

  // ---- View toggle ----
  viewToggle.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      state.view = b.dataset.view;
      render();
    });
  });

  clearBtn.addEventListener('click', () => {
    state.section = 'ALL';
    state.pheno = null;
    state.rarity = 0;
    state.lineage.clear();
    state.q = '';
    searchEl.value = '';
    render();
  });

  searchEl.addEventListener('input', e => { state.q = e.target.value; render(); });

  function matches(s) {
    const secPrimary = (s.section || '').split('/')[0];
    if (state.section !== 'ALL' && secPrimary !== state.section) return false;
    if (state.pheno && s.phenoType !== state.pheno) return false;
    if (state.rarity && s.rarity !== state.rarity) return false;
    for (const t of state.lineage) {
      if (!(s.lineageTags || []).includes(t)) return false;
    }
    if (state.q) {
      const q = state.q.trim().toLowerCase();
      const hay = [
        s.name, s.breeder, s.genetics, s.profile, s.notes,
        s.section, s.phenoType, s.seedType,
        s.rarityReason,
        ...(s.lineageTags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  // ---- Sort comparators ----
  const SECTION_ORDER = { SEALED: 0, OPEN: 1, OTHER: 2, BONUS: 3 };
  const PHENO_ORDER = { 'Indica-leaning': 0, 'Balanced hybrid': 1, 'Hybrid': 2, 'Sativa-leaning': 3, 'Autoflower': 4 };
  const SORTS = {
    'section': (a,b) => (SECTION_ORDER[a.section.split('/')[0]] ?? 9) - (SECTION_ORDER[b.section.split('/')[0]] ?? 9) || a.name.localeCompare(b.name),
    'name': (a,b) => a.name.localeCompare(b.name),
    'name-desc': (a,b) => b.name.localeCompare(a.name),
    'value-desc': (a,b) => (b.estMid||0) - (a.estMid||0),
    'value-asc': (a,b) => (a.estMid||0) - (b.estMid||0),
    'rarity-desc': (a,b) => (b.rarity||0) - (a.rarity||0) || (b.estMid||0) - (a.estMid||0),
    'rarity-asc': (a,b) => (a.rarity||0) - (b.rarity||0),
    'seeds-desc': (a,b) => (b.seedsPerPack||0) - (a.seedsPerPack||0),
    'seeds-asc': (a,b) => (a.seedsPerPack||0) - (b.seedsPerPack||0),
    'breeder': (a,b) => (a.breeder||'').localeCompare(b.breeder||''),
    'pheno': (a,b) => (PHENO_ORDER[a.phenoType] ?? 9) - (PHENO_ORDER[b.phenoType] ?? 9) || a.name.localeCompare(b.name),
  };

  // ---- Render helpers ----
  function imgRow(s) {
    const packImgs = (s.images && s.images.length)
      ? s.images.map(i => `<div class="imgbox pack-box"><img class="pack" loading="lazy" src="thumb/${i}.jpg" data-full="img/${i}.jpg" alt="${escapeHtml(s.name)} pack"></div>`).join('')
      : `<div class="imgbox pack-box"><div class="placeholder">No pack photo</div></div>`;
    const budClass = s.strainImageIsLineage ? 'imgbox bud-box lineage-ref' : 'imgbox bud-box';
    const budImg = s.strainImage
      ? `<div class="${budClass}"><img class="pack" loading="lazy" src="${escapeHtml(s.strainImage)}" data-full="${escapeHtml(s.strainImage)}" alt="${escapeHtml(s.name)} flower"></div>`
      : `<div class="imgbox bud-box"><div class="placeholder">No strain photo</div></div>`;
    return packImgs + budImg;
  }

  function expandedCard(s) {
    const secPrimary = (s.section || '').split('/')[0];
    const breederText = escapeHtml(s.breeder || '');
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">${breederText}</a>`
      : breederText;
    const geneticsHtml = s.genetics
      ? `<b>Genetics:</b> ${escapeHtml(s.genetics)}`
      : '<b>Genetics:</b> —';
    const tags = (s.lineageTags || []).map(t =>
      `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`
    ).join('');
    const valLine = s.estPerPackLow != null
      ? `<div class="value-row">
           <span class="per">${fmtMoney(s.estPerPackLow)}–${fmtMoney(s.estPerPackHigh)} · 1 pack · ${s.seedsPerPack} seeds (${fmtMoney(s.pricePerSeedLow)}–${fmtMoney(s.pricePerSeedHigh)}/seed)</span>
           <span class="val">${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}</span>
         </div>`
      : '';
    const footerLinks = [];
    if (s.breederUrl) footerLinks.push(`<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">Breeder</a>`);
    if (s.seedfinderUrl) footerLinks.push(`<a href="${escapeHtml(s.seedfinderUrl)}" target="_blank" rel="noopener" title="Direct seedfinder strain page via DuckDuckGo !ducky redirect">seedfinder.eu</a>`);
    if (s.geneticsSearchUrl) footerLinks.push(`<a href="${escapeHtml(s.geneticsSearchUrl)}" target="_blank" rel="noopener" title="Google search: genetics / reviews (Leafly, AllBud, breeder blogs)">Genetics search</a>`);
    return `
      <article class="card">
        <div class="img-row">${imgRow(s)}</div>
        <div class="body">
          <div class="meta-row">
            <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
            <span class="qty">${escapeHtml(s.quantity)} seeds</span>
            <span class="seedtype">${escapeHtml(s.seedType)}</span>
            ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
            ${s.rarity ? `<span class="rarity" title="${escapeHtml(s.rarityReason || '')}">${rarityFlames(s.rarity)}×${s.rarity}</span>` : ''}
          </div>
          <h3>${escapeHtml(s.name)}</h3>
          <div class="breeder">${breederHtml}</div>
          <div class="genetics">${geneticsHtml}</div>
          <dl class="kv">
            ${s.flowerTime && s.flowerTime !== 'N/A' ? `<dt>Flower</dt><dd>${escapeHtml(s.flowerTime)}</dd>` : ''}
            ${s.thc && s.thc !== 'N/A' ? `<dt>THC</dt><dd>${escapeHtml(s.thc)}</dd>` : ''}
          </dl>
          ${valLine}
          ${tags ? `<div class="tag-row">${tags}</div>` : ''}
          ${s.profile ? `<p class="profile">${escapeHtml(s.profile)}</p>` : ''}
          ${s.notes ? `<p class="notes">${escapeHtml(s.notes)}</p>` : ''}
          ${footerLinks.length ? `<div class="card-footer">${footerLinks.join('')}</div>` : ''}
        </div>
      </article>`;
  }

  function listCard(s) {
    const secPrimary = (s.section || '').split('/')[0];
    const breederText = escapeHtml(s.breeder || '');
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">${breederText}</a>`
      : breederText;
    return `
      <article class="card">
        <div class="img-row">${imgRow(s)}</div>
        <div class="body">
          <h3>${escapeHtml(s.name)}</h3>
          <div class="list-meta">
            <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
            <span class="qty">${escapeHtml(s.quantity)}×${escapeHtml(s.seedType)}</span>
            ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
          </div>
          <div class="breeder">${breederHtml}</div>
          <div class="list-rarity">
            <span class="rarity" title="${escapeHtml(s.rarityReason || '')}">${rarityFlames(s.rarity)}</span>
          </div>
          <div class="list-value">
            ${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}
            <span class="per">${fmtMoney(s.pricePerSeedLow)}–${fmtMoney(s.pricePerSeedHigh)}/seed</span>
          </div>
        </div>
      </article>`;
  }

  function syncFilterUI() {
    sectionFilters.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.filter === state.section));
    phenoFilters.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.pheno === state.pheno));
    rarityFilters.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', parseInt(b.dataset.rarity,10) === state.rarity));
    lineageFilters.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', state.lineage.has(b.dataset.tag)));
    viewToggle.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.view === state.view));
    const anyFilter = state.section !== 'ALL' || state.pheno || state.rarity || state.lineage.size || state.q;
    clearBtn.hidden = !anyFilter;
  }

  function render() {
    syncFilterUI();
    const filtered = data.strains.filter(matches);
    filtered.sort(SORTS[state.sort] || SORTS.section);

    const renderCard = state.view === 'list' ? listCard : expandedCard;
    grid.className = 'grid' + (state.view === 'list' ? ' list-view' : '');
    grid.innerHTML = filtered.map(renderCard).join('')
      || `<p style="color:var(--muted);padding:2rem;text-align:center;">No strains match these filters.</p>`;

    const sumLow = filtered.reduce((a,s) => a + (s.estTotalLow || 0), 0);
    const sumHigh = filtered.reduce((a,s) => a + (s.estTotalHigh || 0), 0);
    resultCount.textContent = `${filtered.length} strain${filtered.length !== 1 ? 's' : ''}`;
    subtotalEl.textContent = filtered.length
      ? `Subtotal: $${sumLow.toLocaleString()} – $${sumHigh.toLocaleString()}`
      : '';
  }

  // Delegate clicks on in-card lineage tags + pack images
  grid.addEventListener('click', (e) => {
    const t = e.target;
    if (t.classList.contains('pack')) {
      lbImg.src = t.dataset.full;
      lb.classList.remove('hidden');
      return;
    }
    if (t.classList.contains('tag')) {
      const tag = t.dataset.tag;
      if (state.lineage.has(tag)) state.lineage.delete(tag);
      else state.lineage.add(tag);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    }
  });

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');

  render();
})();
