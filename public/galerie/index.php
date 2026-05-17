<?php
$dataFile = __DIR__ . '/../data/projets.json';
$projets  = file_exists($dataFile) ? (json_decode(file_get_contents($dataFile), true) ?? []) : [];

$cats = [
    'peinture-interieure'      => 'Peinture intérieure',
    'peinture-exterieure'      => 'Peinture extérieure',
    'peinture-decorative'      => 'Peinture décorative',
    'enduits-decoratifs'       => 'Enduits décoratifs',
    'revetement-mural'         => 'Revêtement mural',
    'revetement-de-sol'        => 'Revêtement de sol',
    'boiserie-et-ferronneries' => 'Boiseries & ferronneries',
];

// Catégories présentes dans les données
$categories = [];
foreach ($projets as $p) {
    $cat = $p['categorie'] ?? '';
    if ($cat && !in_array($cat, $categories)) $categories[] = $cat;
}

// CSS Astro générés
$cssFiles = glob(__DIR__ . '/../_astro/*.css') ?: [];

function card(array $p, array $cats): string {
    $label  = htmlspecialchars($cats[$p['categorie']] ?? $p['categorie']);
    $photos = $p['photos'] ?? [];
    $n      = count($photos);
    $slug   = htmlspecialchars($p['slug']);

    $slides = '';
    foreach ($photos as $i => $src) {
        $active  = $i === 0 ? ' is-active' : '';
        $loading = $i === 0 ? 'eager' : 'lazy';
        $alt     = htmlspecialchars($p['titre'] . ' à ' . $p['localisation'] . ($n > 1 ? " — photo " . ($i+1) : ''));
        $slides .= "<img src=\"" . htmlspecialchars($src) . "\" alt=\"{$alt}\" class=\"photo-slide{$active}\" loading=\"{$loading}\" draggable=\"false\">";
    }

    $photoCount = $n > 1 ? "<span class=\"photo-count\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\" fill=\"currentColor\"/><path d=\"M21 15l-5-5L5 21\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>{$n}</span>" : '';

    $dots = '';
    if ($n > 1) {
        $dots = '<div class="dots" aria-hidden="true">';
        for ($i = 0; $i < $n; $i++) {
            $dots .= '<span class="dot' . ($i === 0 ? ' is-active' : '') . '"></span>';
        }
        $dots .= '</div>';
    }

    $year = !empty($p['annee']) ? "<span class=\"year\">" . (int)$p['annee'] . "</span>" : '';

    $titre = htmlspecialchars($p['titre']);
    $loc   = htmlspecialchars($p['localisation']);
    $desc  = htmlspecialchars($p['titre'] . ' — ' . $p['localisation']);

    return <<<HTML
<article class="projet-card" data-projet-card data-category="{$p['categorie']}">
  <a href="/galerie/projet.php?slug={$slug}" class="card-link" aria-label="{$desc}">
    <div class="card-media">
      {$slides}
      <div class="card-overlay">
        <span class="category-badge">{$label}</span>
        {$photoCount}
      </div>
      <div class="card-hover-cta"><span>Voir le projet</span></div>
      {$dots}
    </div>
    <div class="card-info">
      <h3 class="card-title">{$titre}</h3>
      <p class="card-location">
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden="true"><path d="M5.5 0C3.015 0 1 2.015 1 4.5c0 3.375 4.5 8.5 4.5 8.5S10 7.875 10 4.5C10 2.015 7.985 0 5.5 0zm0 6.125A1.625 1.625 0 1 1 5.5 2.875a1.625 1.625 0 0 1 0 3.25z" fill="currentColor"/></svg>
        {$loc}
        {$year}
      </p>
    </div>
  </a>
</article>
HTML;
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Galerie — Moment D.Art</title>
<meta name="description" content="Découvrez nos réalisations en peinture intérieure, extérieure, enduits décoratifs, revêtements et boiseries. Projets réalisés à Neupré et en région liégeoise.">
<link rel="icon" type="image/png" href="/images/logo-premium-transparent.png">
<?php foreach ($cssFiles as $css): ?>
<link rel="stylesheet" href="/_astro/<?= htmlspecialchars(basename($css)) ?>">
<?php endforeach; ?>
<style>
  .page-hero { padding: 3rem 0 2rem; }
  .page-hero h1 { margin: .9rem 0 1.1rem; }

  .filter-bar-wrapper {
    position: sticky; top: 0; z-index: 10;
    background: rgba(246,242,235,.88);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--line);
    padding: .75rem 0;
  }
  .filter-bar {
    display: flex; gap: .5rem;
    overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
    padding-bottom: 2px;
  }
  .filter-bar::-webkit-scrollbar { display: none; }
  .filter-btn {
    display: inline-flex; align-items: center; gap: .4rem;
    white-space: nowrap; padding: .48rem 1rem; border-radius: 999px;
    border: 1.5px solid var(--line-strong); background: transparent;
    color: var(--muted); font-size: .78rem; font-weight: 600;
    cursor: pointer; transition: all .2s ease; font-family: inherit;
  }
  .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
  .filter-btn.is-active {
    background: var(--accent); border-color: var(--accent); color: #fff;
    box-shadow: 0 4px 12px rgba(177,138,104,.32);
  }
  .count { font-size: .68rem; font-weight: 700; opacity: .7; }
  .filter-btn.is-active .count { opacity: .85; }

  .galerie-section { padding-top: 2.5rem; }
  .projets-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  .grid-item { transition: opacity .3s ease, transform .3s ease; }
  .grid-item.is-hiding { opacity: 0; transform: scale(.96); pointer-events: none; }
  .grid-item.is-hidden { display: none; }
  .grid-item.is-showing { animation: fadeIn .35s ease forwards; }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  .empty-state { text-align: center; padding: 4rem 0; color: var(--muted); }

  /* ProjetCard styles */
  .projet-card {
    border-radius: var(--radius-lg); background: var(--surface-strong);
    overflow: hidden; border: 1px solid var(--line);
    transition: box-shadow .3s ease, transform .3s ease; will-change: transform;
  }
  .projet-card:hover { box-shadow: var(--shadow); transform: translateY(-3px); }
  .card-link { display: block; text-decoration: none; color: inherit; }
  .card-media { position: relative; aspect-ratio: 4/3; overflow: hidden; background: var(--bg-soft); }
  .photo-slide {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; opacity: 0; transition: opacity .75s ease;
    user-select: none; pointer-events: none;
  }
  .photo-slide.is-active { opacity: 1; }
  .card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg,rgba(18,13,8,.28) 0%,transparent 40%,transparent 60%,rgba(18,13,8,.18) 100%);
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: .85rem; pointer-events: none; z-index: 1;
  }
  .category-badge {
    font-size: .65rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    padding: .35rem .75rem; border-radius: 999px;
    background: rgba(255,255,255,.92); backdrop-filter: blur(12px);
    color: var(--accent-strong); border: 1px solid rgba(255,255,255,.5); white-space: nowrap;
  }
  .photo-count {
    display: flex; align-items: center; gap: .3rem;
    font-size: .7rem; font-weight: 600; color: rgba(255,255,255,.92);
    background: rgba(18,13,8,.45); backdrop-filter: blur(8px);
    padding: .32rem .62rem; border-radius: 999px;
  }
  .card-hover-cta {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .25s ease; z-index: 2;
  }
  .card-hover-cta span {
    font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #fff; background: var(--accent);
    padding: .65rem 1.4rem; border-radius: 999px;
    box-shadow: 0 8px 24px rgba(18,13,8,.28);
  }
  .projet-card:hover .card-hover-cta { opacity: 1; }
  .dots {
    position: absolute; bottom: .65rem; left: 50%; transform: translateX(-50%);
    display: flex; gap: 5px; z-index: 3;
  }
  .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(255,255,255,.45); transition: background .3s, transform .3s;
  }
  .dot.is-active { background: #fff; transform: scale(1.3); }
  .card-info { padding: 1rem 1.1rem 1.15rem; }
  .card-title { margin: 0 0 .35rem; font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.25; }
  .card-location { margin: 0; display: flex; align-items: center; gap: .35rem; font-size: .78rem; color: var(--muted); font-weight: 500; }
  .card-location svg { flex-shrink: 0; color: var(--accent); }
  .year { margin-left: auto; font-size: .72rem; font-weight: 600; color: var(--muted-2); }

  @media (max-width: 960px) { .projets-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 560px) { .projets-grid { grid-template-columns: 1fr; gap: 1rem; } }
</style>
</head>
<body>

<?php
// Inclure le header Astro généré si accessible, sinon header minimal
$headerFile = __DIR__ . '/../_includes/header.html';
?>
<header class="site-header" id="site-header">
  <div class="container header-inner">
    <a href="/" class="logo-link" aria-label="Moment D.Art — accueil">
      <img src="/images/logo-premium-transparent.png" alt="Moment D.Art" class="logo-img">
    </a>
    <nav class="main-nav" aria-label="Navigation principale">
      <a href="/services/" class="nav-link">Services</a>
      <a href="/realisations/" class="nav-link">Réalisations</a>
      <a href="/a-propos/" class="nav-link">À propos</a>
      <a href="/devis/" class="nav-cta">Devis gratuit</a>
    </nav>
  </div>
</header>

<section class="page-hero">
  <div class="container">
    <div class="card" style="padding:2rem">
      <span class="eyebrow">Galerie</span>
      <h1>Chaque chantier raconte une histoire.</h1>
      <p class="lead" style="max-width:58ch">Des intérieurs transformés, des extérieurs ravivés, des matières sublimées — voici les projets récents de Moment D.Art, classés par type d'intervention.</p>
    </div>
  </div>
</section>

<div class="filter-bar-wrapper" id="filter-bar">
  <div class="container">
    <div class="filter-bar" role="tablist" aria-label="Filtrer par catégorie">
      <button class="filter-btn is-active" data-filter="all" role="tab" aria-selected="true">
        Tous <span class="count"><?= count($projets) ?></span>
      </button>
      <?php foreach ($categories as $cat):
        $count = count(array_filter($projets, fn($p) => $p['categorie'] === $cat));
      ?>
      <button class="filter-btn" data-filter="<?= htmlspecialchars($cat) ?>" role="tab" aria-selected="false">
        <?= htmlspecialchars($cats[$cat] ?? $cat) ?> <span class="count"><?= $count ?></span>
      </button>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<section class="section galerie-section">
  <div class="container">
    <?php if (empty($projets)): ?>
    <p style="text-align:center;padding:4rem 0;color:var(--muted)">Aucun projet pour le moment.</p>
    <?php else: ?>
    <div class="projets-grid" id="projets-grid">
      <?php foreach ($projets as $p): ?>
      <div class="grid-item" data-item-category="<?= htmlspecialchars($p['categorie']) ?>">
        <?= card($p, $cats) ?>
      </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
    <div class="empty-state" id="empty-state" hidden>
      <p>Aucun projet dans cette catégorie pour le moment.</p>
    </div>
  </div>
</section>

<footer class="site-footer">
  <div class="container footer-inner">
    <p class="footer-copy">© <?= date('Y') ?> Moment D.Art · <a href="/mentions-legales/">Mentions légales</a></p>
  </div>
</footer>

<script>
// ── Slideshow ────────────────────────────────────────────────────────────────
document.querySelectorAll('[data-projet-card]').forEach(card => {
  const slides = card.querySelectorAll('.photo-slide');
  const dots   = card.querySelectorAll('.dot');
  if (slides.length <= 1) return;

  let current = 0, timer = null;
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
  new IntersectionObserver(e => e.forEach(x => x.isIntersecting ? start() : stop()), { threshold: .3 }).observe(card);
});

// ── Filtre ───────────────────────────────────────────────────────────────────
const btns      = document.querySelectorAll('.filter-btn');
const items     = document.querySelectorAll('.grid-item');
const emptyState = document.getElementById('empty-state');
let activeFilter = 'all';

const applyFilter = filter => {
  activeFilter = filter;
  btns.forEach(b => {
    const active = b.dataset.filter === filter;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', String(active));
  });

  const toShow = [], toHide = [];
  items.forEach(item => (filter === 'all' || item.dataset.itemCategory === filter ? toShow : toHide).push(item));

  toHide.forEach(item => {
    if (item.classList.contains('is-hidden')) return;
    item.classList.add('is-hiding');
    item.addEventListener('transitionend', () => {
      item.classList.remove('is-hiding'); item.classList.add('is-hidden');
    }, { once: true });
  });
  toShow.forEach(item => {
    item.classList.remove('is-hidden', 'is-hiding');
    item.classList.add('is-showing');
    item.addEventListener('animationend', () => item.classList.remove('is-showing'), { once: true });
  });

  if (emptyState) emptyState.hidden = toShow.length > 0;
};

btns.forEach(btn => btn.addEventListener('click', () => {
  const f = btn.dataset.filter ?? 'all';
  if (f !== activeFilter) applyFilter(f);
}));
</script>
</body>
</html>
