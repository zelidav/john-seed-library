(async () => {
  const res = await fetch('strains.json');
  const data = await res.json();

  const grid = document.getElementById('grid');
  const statsEl = document.getElementById('stats');
  const searchEl = document.getElementById('search');
  const sectionFilters = document.getElementById('sectionFilters');
  const phenoFilters = document.getElementById('phenoFilters');
  const lineageFilters = document.getElementById('lineageFilters');
  const clearBtn = document.getElementById('clearFilters');
  const resultCount = document.getElementById('resultCount');
  const subtotalEl = document.getElementById('subtotal');
  const valDisclaimerEl = document.getElementById('valDisclaimer');

  const state = {
    section: 'ALL',
    pheno: null,
    lineage: new Set(),
    q: '',
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmtK = (n) => n == null ? '—' : n.toLocaleString();
  const fmtMoney = (n) => n == null ? '—' : '$' + n.toLocaleString();

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
    <span class="stat"><b>${counts.BONUS}</b> bonus / unlisted</span>
    <span class="stat value"><b>$${fmtK(v.totalLow)} – $${fmtK(v.totalHigh)}</b> est. retail value</span>
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

  clearBtn.addEventListener('click', () => {
    state.section = 'ALL';
    state.pheno = null;
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
    for (const t of state.lineage) {
      if (!(s.lineageTags || []).includes(t)) return false;
    }
    if (state.q) {
      const q = state.q.trim().toLowerCase();
      const hay = [
        s.name, s.breeder, s.genetics, s.profile, s.notes,
        s.section, s.phenoType, s.seedType,
        ...(s.lineageTags || []),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function cardHtml(s) {
    const secPrimary = (s.section || '').split('/')[0];
    const imgs = (s.images && s.images.length)
      ? s.images.map(i => `<div class="imgbox"><img class="pack" loading="lazy" src="thumb/${i}.jpg" data-full="img/${i}.jpg" alt="${escapeHtml(s.name)}"></div>`).join('')
      : `<div class="imgbox"><div class="placeholder">Listed on handwritten inventory card — no individual pack photo</div></div>`;

    const breederText = escapeHtml(s.breeder || '');
    const breederHtml = s.breederUrl
      ? `<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">${breederText}</a>`
      : breederText;

    const geneticsHtml = s.genetics
      ? `<b>Genetics:</b> ${escapeHtml(s.genetics)} <a class="sf" href="${escapeHtml(s.seedfinderUrl)}" target="_blank" rel="noopener" title="Search on seedfinder.eu">seedfinder ↗</a>`
      : '<b>Genetics:</b> —';

    const tags = (s.lineageTags || []).map(t =>
      `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`
    ).join('');

    const valLine = (s.packQty > 0 && s.estPerPackLow != null)
      ? `<div class="value-row">
           <span class="per">${fmtMoney(s.estPerPackLow)}–${fmtMoney(s.estPerPackHigh)} per pack × ${s.packQty}</span>
           <span class="val">${fmtMoney(s.estTotalLow)}–${fmtMoney(s.estTotalHigh)}</span>
         </div>`
      : '';

    const footerLinks = [];
    if (s.breederUrl) footerLinks.push(`<a href="${escapeHtml(s.breederUrl)}" target="_blank" rel="noopener">Breeder</a>`);
    if (s.seedfinderUrl) footerLinks.push(`<a href="${escapeHtml(s.seedfinderUrl)}" target="_blank" rel="noopener">seedfinder.eu</a>`);

    return `
      <article class="card">
        <div class="img-row">${imgs}</div>
        <div class="body">
          <div class="meta-row">
            <span class="badge badge-${secPrimary}">${escapeHtml(s.section)}</span>
            <span class="qty">×${escapeHtml(s.quantity)}</span>
            <span class="seedtype">${escapeHtml(s.seedType)}</span>
            ${s.phenoType ? `<span class="pheno">${escapeHtml(s.phenoType)}</span>` : ''}
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

  function syncFilterUI() {
    sectionFilters.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.filter === state.section);
    });
    phenoFilters.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.pheno === state.pheno);
    });
    lineageFilters.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', state.lineage.has(b.dataset.tag));
    });
    const anyFilter = state.section !== 'ALL' || state.pheno || state.lineage.size || state.q;
    clearBtn.hidden = !anyFilter;
  }

  function render() {
    syncFilterUI();
    const filtered = data.strains.filter(matches);
    grid.innerHTML = filtered.map(cardHtml).join('')
      || `<p style="color:var(--muted);padding:2rem;text-align:center;">No strains match these filters.</p>`;

    const sumLow = filtered.reduce((a,s) => a + (s.estTotalLow || 0), 0);
    const sumHigh = filtered.reduce((a,s) => a + (s.estTotalHigh || 0), 0);
    resultCount.textContent = `${filtered.length} strain${filtered.length !== 1 ? 's' : ''}`;
    subtotalEl.textContent = filtered.length
      ? `Subtotal: $${sumLow.toLocaleString()} – $${sumHigh.toLocaleString()}`
      : '';
  }

  // Delegate clicks on in-card lineage tags to toggle the lineage filter
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
