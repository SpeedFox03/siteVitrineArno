const SERVICE_LABELS = {
  'peinture-interieure':    'Peinture intérieure',
  'peinture-exterieure':    'Peinture extérieure',
  'peinture-decorative':    'Peinture décorative',
  'enduits-decoratifs':     'Enduits décoratifs',
  'revetement-mural':       'Revêtement mural',
  'revetement-de-sol':      'Revêtement de sol',
  'boiserie-et-ferronneries': 'Boiseries & ferronneries',
};

function buildCard(projet) {
  const label = SERVICE_LABELS[projet.categorie] || projet.categorie;
  const hasMultiple = projet.photos.length > 1;

  const slides = projet.photos.map((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `${projet.titre} à ${projet.localisation}${hasMultiple ? ` — photo ${i + 1}` : ''}`;
    img.className = 'photo-slide' + (i === 0 ? ' is-active' : '');
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.draggable = false;
    return img.outerHTML;
  }).join('');

  const dots = hasMultiple
    ? `<div class="dots" aria-hidden="true">${projet.photos.map((_, i) => `<span class="dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}</div>`
    : '';

  const photoCount = hasMultiple
    ? `<span class="photo-count"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>${projet.photos.length}</span>`
    : '';

  const year = projet.annee ? `<span class="year">${projet.annee}</span>` : '';

  const article = document.createElement('article');
  article.className = 'projet-card';
  article.setAttribute('data-projet-card', '');
  article.setAttribute('data-category', projet.categorie);
  article.innerHTML = `
    <a href="/galerie/projet.php?slug=${projet.slug}" class="card-link" aria-label="${projet.titre} — ${projet.localisation}">
      <div class="card-media">
        ${slides}
        <div class="card-overlay">
          <span class="category-badge">${label}</span>
          ${photoCount}
        </div>
        <div class="card-hover-cta"><span>Voir le projet</span></div>
        ${dots}
      </div>
      <div class="card-info">
        <h3 class="card-title">${projet.titre}</h3>
        <p class="card-location">
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden="true"><path d="M5.5 0C3.015 0 1 2.015 1 4.5c0 3.375 4.5 8.5 4.5 8.5S10 7.875 10 4.5C10 2.015 7.985 0 5.5 0zm0 6.125A1.625 1.625 0 1 1 5.5 2.875a1.625 1.625 0 0 1 0 3.25z" fill="currentColor"/></svg>
          ${projet.localisation}
          ${year}
        </p>
      </div>
    </a>`;
  return article;
}

function initSliders(container) {
  container.querySelectorAll('[data-projet-card]').forEach(card => {
    const slides = card.querySelectorAll('.photo-slide');
    const dots   = card.querySelectorAll('.dot');
    if (slides.length <= 1) return;

    let current = 0;
    let timer = null;

    const goTo = n => {
      slides[current].classList.remove('is-active');
      dots[current]?.classList.remove('is-active');
      current = ((n % slides.length) + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      dots[current]?.classList.add('is-active');
    };

    const start = () => { if (!timer) timer = setInterval(() => goTo(current + 1), 3200); };
    const stop  = () => { if (timer) { clearInterval(timer); timer = null; } };

    card.addEventListener('mouseenter', stop);
    card.addEventListener('mouseleave', start);

    new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting ? start() : stop()),
      { threshold: 0.3 }
    ).observe(card);
  });
}

export async function initGallery({ gridId, filterBarId, emptyStateId }) {
  const grid       = document.getElementById(gridId);
  const filterBar  = document.getElementById(filterBarId);
  const emptyState = document.getElementById(emptyStateId);
  if (!grid) return;

  let projets = [];
  try {
    const res = await fetch('/api/projets.php');
    if (!res.ok) throw new Error();
    projets = await res.json();
  } catch {
    grid.innerHTML = '<p style="text-align:center;padding:3rem;color:var(--muted)">Erreur de chargement des projets.</p>';
    return;
  }

  // Update filter button counts
  if (filterBar) {
    const counts = { all: projets.length };
    projets.forEach(p => { counts[p.categorie] = (counts[p.categorie] || 0) + 1; });
    filterBar.querySelectorAll('[data-filter]').forEach(btn => {
      const countEl = btn.querySelector('.count');
      if (countEl) countEl.textContent = counts[btn.dataset.filter] ?? 0;
    });
  }

  // Render cards
  grid.innerHTML = '';
  const items = projets.map(projet => {
    const wrapper = document.createElement('div');
    wrapper.className = 'grid-item';
    wrapper.dataset.itemCategory = projet.categorie;
    wrapper.appendChild(buildCard(projet));
    grid.appendChild(wrapper);
    return wrapper;
  });

  initSliders(grid);

  // Filter logic
  if (!filterBar) return;
  let activeFilter = 'all';

  const applyFilter = filter => {
    activeFilter = filter;
    filterBar.querySelectorAll('[data-filter]').forEach(btn => {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    const toShow = [], toHide = [];
    items.forEach(item => (filter === 'all' || item.dataset.itemCategory === filter ? toShow : toHide).push(item));

    toHide.forEach(item => {
      if (item.classList.contains('is-hidden')) return;
      item.classList.add('is-hiding');
      item.addEventListener('transitionend', () => {
        item.classList.remove('is-hiding');
        item.classList.add('is-hidden');
      }, { once: true });
    });

    toShow.forEach(item => {
      item.classList.remove('is-hidden', 'is-hiding');
      item.classList.add('is-showing');
      item.addEventListener('animationend', () => item.classList.remove('is-showing'), { once: true });
    });

    if (emptyState) emptyState.hidden = toShow.length > 0;
  };

  filterBar.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter ?? 'all';
      if (f !== activeFilter) applyFilter(f);
    });
  });
}
