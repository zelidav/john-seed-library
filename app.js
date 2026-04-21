(async () => {
  const res = await fetch('strains.json');
  const data = await res.json();
  const grid = document.getElementById('grid');
  const statsEl = document.getElementById('stats');
  const searchEl = document.getElementById('search');
  const filterBtns = document.querySelectorAll('.filters button');
  let currentFilter = 'ALL';
  let currentSearch = '';

  // Stats
  const counts = { SEALED: 0, OPEN: 0, OTHER: 0, BONUS: 0 };
  data.strains.forEach(s => {
    const sec = (s.section || '').split('/')[0];
    if (counts[sec] !== undefined) counts[sec]++;
  });
  statsEl.innerHTML = `
    <span class="stat"><b>${data.strains.length}</b> strains</span>
    <span class="stat"><b>${counts.SEALED}</b> sealed</span>
    <span class="stat"><b>${counts.OPEN}</b> open</span>
    <span class="stat"><b>${counts.OTHER}</b> other</span>
    <span class="stat"><b>${counts.BONUS}</b> bonus / unlisted</span>
  `;

  const render = () => {
    const q = currentSearch.trim().toLowerCase();
    const filtered = data.strains.filter(s => {
      const secPrimary = (s.section || '').split('/')[0];
      if (currentFilter !== 'ALL' && secPrimary !== currentFilter) return false;
      if (!q) return true;
      const hay = [s.name, s.breeder, s.genetics, s.profile, s.notes, s.section]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });

    grid.innerHTML = filtered.map(s => {
      const secPrimary = (s.section || '').split('/')[0];
      const imgs = (s.images && s.images.length)
        ? s.images.map(i => `<div class="imgbox"><img class="pack" loading="lazy" src="thumb/${i}.jpg" data-full="img/${i}.jpg" alt="${escapeHtml(s.name)}"></div>`).join('')
        : `<div class="imgbox"><div class="placeholder">No pack photo · listed on inventory card</div></div>`;

      return `
        <article class="card">
          <div class="img-row">${imgs}</div>
          <div class="body">
            <div class="meta-row">
              <span class="badge badge-${secPrimary}">${s.section}</span>
              <span class="qty">×${s.quantity}</span>
              <span class="seedtype">${s.seedType}</span>
            </div>
            <h3>${escapeHtml(s.name)}</h3>
            <div class="breeder">${escapeHtml(s.breeder || '')}</div>
            <div class="genetics"><b>Genetics:</b> ${escapeHtml(s.genetics || '—')}</div>
            <dl class="kv">
              ${s.flowerTime && s.flowerTime !== 'N/A' ? `<dt>Flower</dt><dd>${escapeHtml(s.flowerTime)}</dd>` : ''}
              ${s.thc && s.thc !== 'N/A' ? `<dt>THC</dt><dd>${escapeHtml(s.thc)}</dd>` : ''}
            </dl>
            ${s.profile ? `<p class="profile">${escapeHtml(s.profile)}</p>` : ''}
            ${s.notes ? `<p class="notes">${escapeHtml(s.notes)}</p>` : ''}
          </div>
        </article>`;
    }).join('');

    if (!filtered.length) {
      grid.innerHTML = `<p style="color:var(--muted);padding:2rem;text-align:center;">No strains match your filter.</p>`;
    }
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));

  filterBtns.forEach(b => b.addEventListener('click', () => {
    filterBtns.forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    currentFilter = b.dataset.filter;
    render();
  }));
  searchEl.addEventListener('input', e => { currentSearch = e.target.value; render(); });

  // Lightbox
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  grid.addEventListener('click', (e) => {
    const t = e.target;
    if (t.tagName === 'IMG' && t.classList.contains('pack')) {
      lbImg.src = t.dataset.full;
      lb.classList.remove('hidden');
    }
  });

  render();
})();
