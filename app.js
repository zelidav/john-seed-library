(async () => {
  const res = await fetch('strains.json');
  const data = await res.json();

  const grid = document.getElementById('grid');
  const statsEl = document.getElementById('stats');
  const searchEl = document.getElementById('search');
  const sectionFilters = document.getElementById('sectionFilters');
  const phenoFilters = document.getElementById('phenoFilters');
  const rarityFilters = document.getElementById('rarityFilters');
  const availFilters = document.getElementById('availFilters');
  const lineageFilters = document.getElementById('lineageFilters');
  const clearBtn = document.getElementById('clearFilters');
  const exportBtn = document.getElementById('exportEdits');
  const resultCount = document.getElementById('resultCount');
  const subtotalEl = document.getElementById('subtotal');
  const valDisclaimerEl = document.getElementById('valDisclaimer');
  const sortEl = document.getElementById('sort');
  const viewToggle = document.querySelector('.view-toggle');
  const detailModal = document.getElementById('detail');
  const detailContent = document.getElementById('detailContent');
  const rarityScaleEl = document.getElementById('rarityScaleEl');
  const availScaleEl = document.getElementById('availScaleEl');

  // Pricing/valuation is hidden by default. Set window.JSL_SHOW_PRICING=true
  // in DevTools to bring it back, or flip the const below.
  const SHOW_PRICING = typeof window !== 'undefined' && window.JSL_SHOW_PRICING === true;

  const state = {
    section: 'ALL',
    pheno: null,
    rarity: 0,
    avail: '',
    lineage: new Set(),
    q: '',
    sort: 'section',
    sort2: 'name',
    view: 'expanded',
  };

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmtK = (n) => n == null ? '—' : n.toLocaleString();
  const fmtMoney = (n) => n == null ? '—' : '$' + n.toLocaleString();
  const rarityFlames = (n) => '🔥'.repeat(Math.max(1, Math.min(5, n||1)));

  // ─────── Client-side re-analysis logic (mirrors enhance.py) ───────
  const LINEAGE_MAP = {
    'Runtz family':      ['runtz', 'zkittlez × gelato'],
    'Zkittlez':          ['zkittlez'],
    'Gelato':            ['gelato'],
    'OGKB':              ['ogkb', 'og kush breath'],
    'Cookies / GSC':     ['cookies', 'gsc', 'girl scout', 'forum cut'],
    'OG Kush':           ['og kush', 'triangle kush', 'josh d', 'sfv', 'hells angels'],
    'Chem / Diesel':     ['chem brulée', 'chem d', 'chem brulee', 'diesel', 'motor breath', 'motorbreath', 'copper chem'],
    'Sherbet':           ['sherbet', 'sherb', 'sunset strip'],
    'Biscotti':          ['biscotti'],
    'Freshies (CC)':     ['freshies', 'fresh baked', 'sunset freshies', 'hitmaker'],
    'BlowPops (Envy)':   ['blowpops', 'blow pops'],
    'GMO / Garlic':      ['gmo', 'garlic', 'gmoz'],
    'Wedding Cake':      ['wedding cake', 'triangle mints'],
    'Kush Mints':        ['kush mints', 'animal mints'],
    'Animal Cookies':    ['animal cookies'],
    'Haze':              ['haze'],
    'Papaya / Guava':    ['papaya', 'guava', 'guavaz'],
    'Forbidden Fruit':   ['forbidden fruit', 'fpog', 'cherry pie', 'tangie'],
    'Stankasaurus':      ['stankasaurus'],
    'Kush (Hindu/OG)':   ['hindu kush'],
    'Bubba Kush':        ['bubba kush'],
    'CBD':               ['cbd'],
    'Fruity Pebbles':    ['fruity pebbles', 'fpog'],
    'Grape':             ['grape pie', 'grape blow'],
    'Skunk':             ['skunk'],
    'Landrace / Heritage': ['mendo purps', 'sfv og'],
    'Banana':            ['banana'],
    "Ripley's OG":       ["ripley's", '3 bears og'],
    'Acai':              ['acai'],
  };
  function computeLineageTags(strain) {
    const hay = [strain.name, strain.breeder, strain.genetics, strain.profile, strain.notes]
      .filter(Boolean).join(' ').toLowerCase();
    const tags = new Set();
    for (const [tag, terms] of Object.entries(LINEAGE_MAP)) {
      if (terms.some(t => hay.includes(t))) tags.add(tag);
    }
    const st = (strain.seedType || '').toUpperCase();
    if (st.includes('AUTO')) tags.add('Autoflower');
    if (st.includes('S1') || hay.includes('self')) tags.add('S1 (self)');
    if (st.includes('FEM')) tags.add('Feminized');
    return [...tags].sort();
  }
  function computePhenotype(strain) {
    const text = `${strain.profile || ''} ${strain.notes || ''}`.toLowerCase();
    if (/indica-dominant|indica dom|indica-leaning/.test(text)) return 'Indica-leaning';
    if (/sativa-dominant|sativa dom|sativa-leaning/.test(text)) return 'Sativa-leaning';
    if (/balanced/.test(text)) return 'Balanced hybrid';
    if (/hybrid/.test(text)) return 'Hybrid';
    if ((strain.seedType || '').toLowerCase().includes('auto')) return 'Autoflower';
    return 'Hybrid';
  }
  function cleanName(name) {
    return (name || '').replace(/[\[\](){}]/g, '').replace(/\s*[×x]\s*/g, ' x ').replace(/\s+/g, ' ').trim();
  }
  function cleanBreeder(b) {
    if (!b) return '';
    return b.replace(/\([^)]*\)/g, '').split(/\s+\/\s+|\s+—\s+/)[0].replace(/\s+/g, ' ').trim();
  }
  function stripBreederNoise(b) {
    return (b || '').replace(/\b(unknown|craft|small-batch|various|pheno-hunter|cross|cuts? exist)\b/gi, '').trim();
  }
  function computeSeedfinderUrl(name, breeder) {
    const b = stripBreederNoise(cleanBreeder(breeder));
    const q = b ? `${cleanName(name)} ${b} site:seedfinder.eu` : `${cleanName(name)} site:seedfinder.eu`;
    return `https://www.google.com/search?q=${encodeURIComponent(q).replace(/%20/g, '+')}`;
  }
  function computeGeneticsSearchUrl(name, breeder) {
    const b = stripBreederNoise(cleanBreeder(breeder));
    const q = b ? `${cleanName(name)} ${b} cannabis strain genetics lineage` : `${cleanName(name)} cannabis strain genetics lineage`;
    return `https://www.google.com/search?q=${encodeURIComponent(q).replace(/%20/g, '+')}`;
  }
  function computeImagesSearchUrl(name, breeder) {
    const b = stripBreederNoise(cleanBreeder(breeder));
    const q = b ? `${cleanName(name)} ${b} cannabis bud flower` : `${cleanName(name)} cannabis bud flower`;
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q).replace(/%20/g, '+')}`;
  }

  // ─────── localStorage edit persistence ───────
  const EDITS_KEY = 'jsl-edits-v1';
  function loadEdits() {
    try { return JSON.parse(localStorage.getItem(EDITS_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveEdits(edits) {
    localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  }
  function clearEdit(key) {
    const edits = loadEdits();
    delete edits[key];
    saveEdits(edits);
  }
  function strainKey(s) {
    // original name is a stable ID even if edited
    return s._origName || s.name;
  }

  // Apply edits from localStorage over base strain records + recompute derived fields
  function hydrateStrains() {
    const edits = loadEdits();
    data.strains.forEach(s => {
      s._origName = s._origName || s.name;
      const key = s._origName;
      if (edits[key]) {
        const e = edits[key];
        s._edited = true;
        if (e.name != null) s.name = e.name;
        if (e.genetics != null) s.genetics = e.genetics;
        // Re-derive URLs + tags + phenotype from edited fields
        s.lineageTags = computeLineageTags(s);
        s.phenoType = computePhenotype(s);
        s.seedfinderUrl = computeSeedfinderUrl(s.name, s.breeder);
        s.geneticsSearchUrl = computeGeneticsSearchUrl(s.name, s.breeder);
      }
      s.imagesSearchUrl = computeImagesSearchUrl(s.name, s.breeder);
    });
  }
  hydrateStrains();

  // ─────── Stats + disclaimer ───────
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
    ${SHOW_PRICING ? `<span class="stat value"><b>$${fmtK(v.totalLow)}–$${fmtK(v.totalHigh)}</b> est. retail</span>` : ''}
  `;
  if (valDisclaimerEl) {
    valDisclaimerEl.textContent = SHOW_PRICING && v.disclaimer
      ? v.disclaimer
      : 'Pricing data is hidden in this view. Open DevTools and run window.JSL_SHOW_PRICING=true then refresh to display per-pack/per-seed estimates.';
  }

  // ─────── Rarity + availability scale docs ───────
  if (data.meta.rarityScale) {
    rarityScaleEl.innerHTML = Object.entries(data.meta.rarityScale)
      .sort((a,b) => parseInt(b[0]) - parseInt(a[0]))
      .map(([n, info]) =>
        `<div class="row">
          <div class="tier">${rarityFlames(parseInt(n))}×${n} · ${escapeHtml(info.label)}</div>
          <div class="desc">${escapeHtml(info.desc)}</div>
        </div>`
      ).join('');
  }
  if (data.meta.availabilityScale) {
    availScaleEl.innerHTML = Object.entries(data.meta.availabilityScale)
      .map(([k, info]) =>
        `<div class="row">
          <div class="tier">${info.emoji} ${escapeHtml(info.label)}</div>
          <div class="desc">${escapeHtml(info.desc)}</div>
        </div>`
      ).join('');
  }

  // ─────── Filter setup ───────
  (data.meta.phenoTypes || []).forEach(p => {
    const b = document.createElement('button');
    b.textContent = p;
    b.dataset.pheno = p;
    b.addEventListener('click', () => { state.pheno = (state.pheno === p) ? null : p; render(); });
    phenoFilters.appendChild(b);
  });
  rarityFilters.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { state.rarity = parseInt(b.dataset.rarity, 10) || 0; render(); }));
  availFilters.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { state.avail = b.dataset.avail || ''; render(); }));

  const tagCounts = {};
  data.strains.forEach(s => (s.lineageTags || []).forEach(t => tagCounts[t] = (tagCounts[t]||0) + 1));
  const sortedTags = Object.entries(tagCounts).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));
  sortedTags.forEach(([t, n]) => {
    const b = document.createElement('button');
    b.innerHTML = `${escapeHtml(t)} <span style="opacity:0.6">·${n}</span>`;
    b.dataset.tag = t;
    b.addEventListener('click', () => {
      if (state.lineage.has(t)) state.lineage.delete(t); else state.lineage.add(t);
      render();
    });
    lineageFilters.appendChild(b);
  });

  sectionFilters.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { state.section = b.dataset.filter; render(); }));
  sortEl.addEventListener('change', () => { state.sort = sortEl.value; render(); });
  const sort2El = document.getElementById('sort2');
  sort2El.value = state.sort2;
  sort2El.addEventListener('change', () => { state.sort2 = sort2El.value; render(); });
  viewToggle.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));

  clearBtn.addEventListener('click', () => {
    state.section = 'ALL'; state.pheno = null; state.rarity = 0; state.avail = '';
    state.lineage.clear(); state.q = ''; searchEl.value = ''; render();
  });
  searchEl.addEventListener('input', e => { state.q = e.target.value; render(); });

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(loadEdits(), null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'john-seed-library-edits.json';
    a.click();
  });

  // ─────── Matching + sorting ───────
  function matches(s) {
    const secPrimary = (s.section || '').split('/')[0];
    if (state.section !== 'ALL' && secPrimary !== state.section) return false;
    if (state.pheno && s.phenoType !== state.pheno) return false;
    if (state.rarity && s.rarity !== state.rarity) return false;
    if (state.avail && (s.availability?.code || '') !== state.avail) return false;
    for (const t of state.lineage) if (!(s.lineageTags || []).includes(t)) return false;
    if (state.q) {
      const q = state.q.trim().toLowerCase();
      const hay = [
        s.name, s.breeder, s.genetics, s.profile, s.notes,
        s.section, s.phenoType, s.seedType,
        s.rarityReason, s.availability?.label, s.availability?.note,
        ...(s.lineageTags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  const SECTION_ORDER = { SEALED: 0, OPEN: 1, OTHER: 2, BONUS: 3 };
  const PHENO_ORDER = { 'Indica-leaning': 0, 'Balanced hybrid': 1, 'Hybrid': 2, 'Sativa-leaning': 3, 'Autoflower': 4 };
  const AVAIL_ORDER = { 'in-stock': 0, 'limited': 1, 'sold-out': 2, 'discontinued': 3, 'tester': 4, 'unreleased': 5 };
  // Core comparators — pure two-element compare, no built-in tie-breakers,
  // so they compose cleanly when user picks a secondary sort key.
  const SORTS = {
    'section': (a,b) => (SECTION_ORDER[a.section.split('/')[0]] ?? 9) - (SECTION_ORDER[b.section.split('/')[0]] ?? 9),
    'name': (a,b) => a.name.localeCompare(b.name),
    'name-desc': (a,b) => b.name.localeCompare(a.name),
    'value-desc': (a,b) => (b.estMid||0) - (a.estMid||0),
    'value-asc': (a,b) => (a.estMid||0) - (b.estMid||0),
    'rarity-desc': (a,b) => (b.rarity||0) - (a.rarity||0),
    'rarity-asc': (a,b) => (a.rarity||0) - (b.rarity||0),
    'avail': (a,b) => (AVAIL_ORDER[a.availability?.code] ?? 9) - (AVAIL_ORDER[b.availability?.code] ?? 9),
    'seeds-desc': (a,b) => (b.seedsPerPack||0) - (a.seedsPerPack||0),
    'seeds-asc': (a,b) => (a.seedsPerPack||0) - (b.seedsPerPack||0),
    'breeder': (a,b) => (a.breeder||'').localeCompare(b.breeder||''),
    'pheno': (a,b) => (PHENO_ORDER[a.phenoType] ?? 9) - (PHENO_ORDER[b.phenoType] ?? 9),
  };
  function composedSort(primary, secondary) {
    const p = SORTS[primary] || SORTS.section;
    const s = secondary && SORTS[secondary];
    const nameTie = SORTS.name;
    return (a, b) => p(a, b) || (s ? s(a, b) : 0) || nameTie(a, b);
  }

  // ─────── Render helpers ───────
  // Single source of truth for the small availability badge shown on cards
  function renderAvailBadge(s) {
    if (!s.availability) return '';
    const a = s.availability;
    const lastSeen = a.lastSeen ? ` · last seen ${escapeHtml(a.lastSeen)}` : '';
    const tip = `${a.note || ''}${a.retailer ? ' · ' + a.retailer : ''}${lastSeen}`;
    const buyHint = (a.code === 'in-stock' || a.code === 'limited') && a.retailerUrl
      ? ` <span style="opacity:0.7">→ buy</span>` : '';
    return `<span class="avail avail-${a.code}" title="${escapeHtml(tip)}">${a.emoji} ${escapeHtml(a.label)}${buyHint}</span>`;
  }

  function imgRow(s) {
    const packImgs = (s.images && s.images.length)
      ? s.images.map(i => `<div class="imgbox pack-box"><img class="pack" loading="lazy" src="thumb/${i}.jpg" data-full="img/${i}.jpg" alt="${escapeHtml(s.name)} pack"></div>`).join('')
      : `<div class="imgbox pack-box"><div class="placeholder">No pack photo</div></div>`;
    const budClass = s.strainImageIsLineage ? 'imgbox bud-box lineage-ref' : 'imgbox bud-box';
    const budInner = s.strainImage
      ? `<img class="pack" loading="lazy" src="${escapeHtml(s.strainImage)}" data-full="${escapeHtml(s.strainImage)}" alt="${escapeHtml(s.name)} flower">`
      : `<div class="placeholder">No strain photo</div>`;
    const morePhotos = `<a class="more-photos" href="${escapeHtml(s.imagesSearchUrl)}" target="_blank" rel="noopener" title="Google Images: more flower photos">🔍 more</a>`;
    const budImg = `<div class="${budClass}">${budInner}${morePhotos}</div>`;
    return packImgs + budImg;
  }
  function expandedCard(s, idx) {
    const secPrimary = (s.section || '').split('/')[0];
    const breederText = escapeHtml(s.breeder || '');
    const breederIcon = s.breederLinkType === 'direct' ? '↗' : '🔍';
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${s.breederLinkType === 'direct' ? 'Verified breeder site' : 'Google search for breeder'}">${breederText} <span style="opacity:0.5">${breederIcon}</span></a>`
      : breederText;
    const geneticsHtml = s.genetics ? `<b>Genetics:</b> ${escapeHtml(s.genetics)}` : '<b>Genetics:</b> —';
    const tags = (s.lineageTags || []).map(t =>
      `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');
    const valLine = (SHOW_PRICING && s.estPerPackLow != null)
      ? `<div class="value-row">
           <span class="per">${fmtMoney(s.estPerPackLow)}–${fmtMoney(s.estPerPackHigh)} · 1 pack · ${s.seedsPerPack} seeds (${fmtMoney(s.pricePerSeedLow)}–${fmtMoney(s.pricePerSeedHigh)}/seed)</span>
           <span class="val">${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}</span>
         </div>` : '';
    const footerLinks = [];
    if (s.breederUrl) {
      const label = s.breederLinkType === 'direct' ? 'Breeder ↗' : 'Breeder 🔍';
      const title = s.breederLinkType === 'direct' ? 'Verified breeder site' : 'Google search for breeder (no verified site URL)';
      footerLinks.push(`<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${title}">${label}</a>`);
    }
    if (s.seedfinderUrl) footerLinks.push(`<a href="${escapeHtml(s.seedfinderUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Google search restricted to seedfinder.eu — top result is the strain page when one exists">🔍 seedfinder.eu</a>`);
    if (s.geneticsSearchUrl) footerLinks.push(`<a href="${escapeHtml(s.geneticsSearchUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Google search: genetics / reviews (Leafly, AllBud, breeder blogs, IG)">🔍 Genetics</a>`);
    if (s.imagesSearchUrl) footerLinks.push(`<a href="${escapeHtml(s.imagesSearchUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Google Images: flower photos">🔍 Flower photos</a>`);
    const edited = s._edited ? `<span class="edited-tag" title="Name/genetics edited locally">EDITED</span>` : '';
    const avail = renderAvailBadge(s);
    return `
      <article class="card" data-idx="${idx}">
        <div class="img-row">${imgRow(s)}</div>
        <div class="body">
          <div class="meta-row">
            <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
            <span class="qty">${escapeHtml(s.quantity)} seeds</span>
            <span class="seedtype">${escapeHtml(s.seedType)}</span>
            ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
            ${s.rarity ? `<span class="rarity" title="${escapeHtml(s.rarityReason || '')}">${rarityFlames(s.rarity)}×${s.rarity}</span>` : ''}
            ${avail}${(s.availability?.code === 'in-stock' || s.availability?.code === 'limited') && s.availability?.retailerUrl
              ? ` <a class="buy-link" href="${escapeHtml(s.availability.retailerUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${escapeHtml(s.availability.retailer || '')} — open listing">Buy ↗</a>` : ''}
          </div>
          <h3>${escapeHtml(s.name)}${edited}</h3>
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
  function listCard(s, idx) {
    const secPrimary = (s.section || '').split('/')[0];
    const breederText = escapeHtml(s.breeder || '');
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${breederText}</a>`
      : breederText;
    const avail = renderAvailBadge(s);
    const edited = s._edited ? `<span class="edited-tag">EDITED</span>` : '';
    return `
      <article class="card" data-idx="${idx}">
        <div class="img-row">${imgRow(s)}</div>
        <div class="body">
          <h3>${escapeHtml(s.name)}${edited}</h3>
          <div class="list-meta">
            <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
            <span class="qty">${escapeHtml(s.quantity)}×${escapeHtml(s.seedType)}</span>
            ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
          </div>
          <div class="breeder">${breederHtml}</div>
          <div class="list-rarity">
            <span class="rarity" title="${escapeHtml(s.rarityReason || '')}">${rarityFlames(s.rarity)}</span>
          </div>
          <div class="list-avail">${avail}</div>
          ${SHOW_PRICING ? `<div class="list-value">
            ${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}
            <span class="per">${fmtMoney(s.pricePerSeedLow)}–${fmtMoney(s.pricePerSeedHigh)}/seed</span>
          </div>` : `<div class="list-value"></div>`}
        </div>
      </article>`;
  }

  function syncFilterUI() {
    sectionFilters.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.filter === state.section));
    phenoFilters.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.pheno === state.pheno));
    rarityFilters.querySelectorAll('button').forEach(b => b.classList.toggle('on', parseInt(b.dataset.rarity,10) === state.rarity));
    availFilters.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.avail || '') === state.avail));
    lineageFilters.querySelectorAll('button').forEach(b => b.classList.toggle('on', state.lineage.has(b.dataset.tag)));
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
    const anyFilter = state.section !== 'ALL' || state.pheno || state.rarity || state.avail || state.lineage.size || state.q;
    clearBtn.hidden = !anyFilter;
    exportBtn.hidden = Object.keys(loadEdits()).length === 0;
  }

  function render() {
    syncFilterUI();
    const filtered = data.strains.filter(matches);
    filtered.sort(composedSort(state.sort, state.sort2));
    const renderCard = state.view === 'list' ? listCard : expandedCard;
    grid.className = 'grid' + (state.view === 'list' ? ' list-view' : '');
    grid.innerHTML = filtered.map((s) => renderCard(s, data.strains.indexOf(s))).join('')
      || `<p style="color:var(--muted);padding:2rem;text-align:center;">No strains match these filters.</p>`;
    resultCount.textContent = `${filtered.length} strain${filtered.length !== 1 ? 's' : ''}`;
    if (SHOW_PRICING) {
      const sumLow = filtered.reduce((a,s) => a + (s.estTotalLow || 0), 0);
      const sumHigh = filtered.reduce((a,s) => a + (s.estTotalHigh || 0), 0);
      subtotalEl.textContent = filtered.length
        ? `Subtotal: $${sumLow.toLocaleString()} – $${sumHigh.toLocaleString()}` : '';
    } else {
      subtotalEl.textContent = '';
    }
  }

  // ─────── Detail modal ───────
  function openDetail(idx) {
    const s = data.strains[idx];
    if (!s) return;
    const secPrimary = (s.section || '').split('/')[0];
    const breederIconD = s.breederLinkType === 'direct' ? '↗' : '🔍';
    const breederTitle = s.breederLinkType === 'direct' ? 'Verified breeder site' : 'Google search for breeder';
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener" title="${breederTitle}">${escapeHtml(s.breeder || '')} <span style="opacity:0.5">${breederIconD}</span></a>`
      : escapeHtml(s.breeder || '');
    const tags = (s.lineageTags || []).map(t =>
      `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');

    // Images
    const packImg = (s.images && s.images.length)
      ? `<div class="dimg-box pack-box"><img src="img/${s.images[0]}.jpg" data-full="img/${s.images[0]}.jpg" alt="${escapeHtml(s.name)} pack"></div>`
      : `<div class="dimg-box pack-box"><div class="placeholder">No pack photo — listed on handwritten inventory card only</div></div>`;
    const budClass = s.strainImageIsLineage ? 'dimg-box bud-box lineage-ref' : 'dimg-box bud-box';
    const budInner = s.strainImage
      ? `<img src="${escapeHtml(s.strainImage)}" data-full="${escapeHtml(s.strainImage)}" alt="${escapeHtml(s.name)} flower">`
      : `<div class="placeholder">No strain photo available from Leafly / AllBud / seedfinder</div>`;
    const budImg = `<div class="${budClass}">${budInner}<a class="dimg-more" href="${escapeHtml(s.imagesSearchUrl)}" target="_blank" rel="noopener">🔍 More flower photos (Google)</a></div>`;

    // Rarity breakdown
    let rarityHtml = '';
    if (s.rarityBreakdown && s.rarityBreakdown.length) {
      const breakdownRows = s.rarityBreakdown.map(([label, delta]) => {
        const sign = delta > 0 ? '+' : '';
        return `<li><span class="label">${escapeHtml(label)}</span><span class="delta">${sign}${delta}</span></li>`;
      }).join('');
      rarityHtml = `
        <div class="detail-section rarity-detail">
          <h3>Rarity: ${rarityFlames(s.rarity)}×${s.rarity} · ${escapeHtml(s.rarityReason || '')}</h3>
          <p style="font-size:0.85rem;color:var(--muted);margin:0.3rem 0 0.6rem;">
            A 1–5 opinionated score of how hard this strain is to acquire. Scoring factors below sum/cap at 5.
          </p>
          <ul class="rarity-breakdown">${breakdownRows}
            <li><span class="label"><strong>Final rarity score</strong></span><span class="delta total">${s.rarity} / 5</span></li>
          </ul>
        </div>`;
    }

    // Availability — with retailer link + last-seen + sourcing tag
    let availHtml = '';
    if (s.availability) {
      const a = s.availability;
      const sourceTag = a.source === 'researched'
        ? `<span class="source-tag" title="From real-time retail research across breeder shops, Strainly, GLG, Neptune, Seed Cellar, Seeds Here Now, etc.">researched</span>`
        : a.source === 'curated'
        ? `<span class="source-tag curated" title="Curated estimate based on breeder reputation and distribution patterns">curated</span>`
        : `<span class="source-tag fallback" title="Inferred from breeder tier — no specific data">inferred</span>`;
      const retailerLine = (a.retailer || a.retailerUrl)
        ? `<p style="margin:0.5rem 0 0;font-size:0.88rem;">
             <strong>Retailer:</strong>
             ${a.retailerUrl
               ? `<a href="${escapeHtml(a.retailerUrl)}" target="_blank" rel="noopener">${escapeHtml(a.retailer || a.retailerUrl)}</a>`
               : escapeHtml(a.retailer || '')}
             ${a.lastSeen ? `<span style="color:var(--muted);"> · last seen ${escapeHtml(a.lastSeen)}</span>` : ''}
           </p>`
        : '';
      const buyButton = (a.code === 'in-stock' || a.code === 'limited') && a.retailerUrl
        ? `<p style="margin:0.7rem 0 0;">
             <a class="buy-button" href="${escapeHtml(a.retailerUrl)}" target="_blank" rel="noopener">
               🛒 Open ${escapeHtml(a.retailer || 'listing')}
             </a>
           </p>` : '';
      availHtml = `
        <div class="detail-section avail-detail">
          <h3>Availability: ${a.emoji} ${escapeHtml(a.label)} ${sourceTag}</h3>
          <p style="margin:0.3rem 0 0;font-size:0.92rem;">${escapeHtml(a.note || '')}</p>
          ${retailerLine}
          ${buyButton}
        </div>`;
    }

    // Valuation (hidden by default — toggle SHOW_PRICING to reveal)
    let valHtml = '';
    if (SHOW_PRICING && s.estPerPackLow != null) {
      valHtml = `
        <div class="detail-section value-detail">
          <h3>Estimated value</h3>
          <p style="margin:0.3rem 0;font-size:0.92rem;">
            <strong>${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}</strong> for one pack of ${s.seedsPerPack} seeds
            (${fmtMoney(s.pricePerSeedLow)}–${fmtMoney(s.pricePerSeedHigh)} per seed).
          </p>
          <p style="margin:0.3rem 0 0;color:var(--muted);font-size:0.82rem;">
            Mid-market retail for the ${escapeHtml(cleanBreeder(s.breeder) || 'breeder')} tier,
            adjusted for seed count (${s.seedsPerPack} seeds), seed type (${escapeHtml(s.seedType)}),
            and tester/freebie flags. Hype drops trade above this range on aftermarket.
          </p>
        </div>`;
    }

    // Footer links
    const footerLinks = [];
    if (s.breederUrl) {
      const lbl = s.breederLinkType === 'direct' ? 'Breeder ↗' : 'Breeder 🔍';
      footerLinks.push(`<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">${lbl}</a>`);
    }
    if (s.seedfinderUrl) footerLinks.push(`<a href="${escapeHtml(s.seedfinderUrl)}" target="_blank" rel="noopener">🔍 seedfinder.eu</a>`);
    if (s.geneticsSearchUrl) footerLinks.push(`<a href="${escapeHtml(s.geneticsSearchUrl)}" target="_blank" rel="noopener">🔍 Genetics search</a>`);
    if (s.imagesSearchUrl) footerLinks.push(`<a href="${escapeHtml(s.imagesSearchUrl)}" target="_blank" rel="noopener">🔍 Flower photos (Google Images)</a>`);

    const edited = s._edited ? `<span class="edited-tag">EDITED LOCALLY</span>` : '';

    detailContent.innerHTML = `
      <div class="dimg-row">${packImg}${budImg}</div>

      <div class="meta-row">
        <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
        <span class="qty">${escapeHtml(s.quantity)} seeds</span>
        <span class="seedtype">${escapeHtml(s.seedType)}</span>
        ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
        ${s.rarity ? `<span class="rarity">${rarityFlames(s.rarity)}×${s.rarity}</span>` : ''}
        ${s.availability ? `<span class="avail">${s.availability.emoji} ${escapeHtml(s.availability.label)}</span>` : ''}
      </div>

      <h2>${escapeHtml(s.name)}${edited}</h2>
      <div class="breeder">${breederHtml}</div>

      <div class="edit-block" id="editBlock">
        <div class="edit-header">
          <span>Edit strain · changes re-run lineage / URL analysis</span>
          <div class="edit-actions">
            <button class="reset" type="button" id="editReset" ${s._edited ? '' : 'hidden'}>↺ Reset to original</button>
            <button class="save" type="button" id="editSave" disabled>Save</button>
          </div>
        </div>
        <label>Name</label>
        <input type="text" id="editName" value="${escapeHtml(s.name)}">
        <label>Genetics / lineage</label>
        <textarea id="editGenetics">${escapeHtml(s.genetics || '')}</textarea>
      </div>

      ${rarityHtml}
      ${availHtml}
      ${valHtml}

      ${s.profile ? `<div class="detail-section"><h3>Profile</h3><p>${escapeHtml(s.profile)}</p></div>` : ''}
      ${s.notes ? `<div class="detail-section"><h3>Notes</h3><p style="font-style:italic;">${escapeHtml(s.notes)}</p></div>` : ''}
      ${tags ? `<div class="detail-section"><h3>Lineage / family tags</h3><div class="tag-row">${tags}</div></div>` : ''}

      ${footerLinks.length ? `<div class="card-footer">${footerLinks.join('')}</div>` : ''}
    `;

    // Edit handlers
    const nameInput = document.getElementById('editName');
    const genInput = document.getElementById('editGenetics');
    const saveBtn = document.getElementById('editSave');
    const resetBtn = document.getElementById('editReset');
    const origName = s._origName || s.name;

    const onChange = () => {
      const changed = (nameInput.value !== s.name) || (genInput.value !== (s.genetics || ''));
      saveBtn.disabled = !changed;
    };
    nameInput.addEventListener('input', onChange);
    genInput.addEventListener('input', onChange);

    saveBtn.addEventListener('click', () => {
      const edits = loadEdits();
      edits[origName] = edits[origName] || {};
      const newName = nameInput.value.trim();
      const newGen = genInput.value.trim();
      if (newName && newName !== origName) edits[origName].name = newName; else delete edits[origName].name;
      if (newGen) edits[origName].genetics = newGen; else delete edits[origName].genetics;
      if (Object.keys(edits[origName]).length === 0) delete edits[origName];
      saveEdits(edits);
      // Re-apply and re-open
      hydrateStrains();
      render();
      openDetail(idx);
    });
    resetBtn?.addEventListener('click', () => {
      clearEdit(origName);
      hydrateStrains();
      render();
      openDetail(idx);
    });

    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeDetail() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  detailModal.querySelector('.detail-backdrop').addEventListener('click', closeDetail);
  detailModal.querySelector('.detail-close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) closeDetail();
  });

  // ─────── Click delegation ───────
  document.body.addEventListener('click', (e) => {
    const t = e.target;
    // Pack image → lightbox (don't open detail)
    if (t.classList.contains('pack')) {
      lbImg.src = t.dataset.full;
      lb.classList.remove('hidden');
      e.stopPropagation();
      return;
    }
    // Lineage tag in card → toggle filter
    if (t.classList.contains('tag')) {
      const tag = t.dataset.tag;
      if (state.lineage.has(tag)) state.lineage.delete(tag); else state.lineage.add(tag);
      e.stopPropagation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
      return;
    }
    // "More photos" / external links inside cards — let them through
    if (t.tagName === 'A' || t.closest('a')) return;
    // Card click (excluding inner anchors/tags/imgs above) → open detail
    const card = t.closest('.card');
    if (card && !detailModal.contains(card)) {
      const idx = parseInt(card.dataset.idx, 10);
      if (!isNaN(idx)) openDetail(idx);
    }
  });

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  lb.addEventListener('click', () => lb.classList.add('hidden'));

  render();
})();
