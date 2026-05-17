<?php
// Validation du slug
$slug = $_GET['slug'] ?? '';
if (!preg_match('/^[a-z0-9-]+$/', $slug)) {
    http_response_code(404);
    header('Location: /galerie/');
    exit;
}

// Chargement des données
$dataFile = __DIR__ . '/../data/projets.json';
if (!file_exists($dataFile)) {
    http_response_code(404);
    header('Location: /galerie/');
    exit;
}

$projets = json_decode(file_get_contents($dataFile), true) ?? [];
$projet  = null;
foreach ($projets as $p) {
    if ($p['slug'] === $slug) { $projet = $p; break; }
}

if (!$projet) {
    http_response_code(404);
    header('Location: /galerie/');
    exit;
}

$cats = [
    'peinture-interieure'      => 'Peinture intérieure',
    'peinture-exterieure'      => 'Peinture extérieure',
    'peinture-decorative'      => 'Peinture décorative',
    'enduits-decoratifs'       => 'Enduits décoratifs',
    'revetement-mural'         => 'Revêtement mural',
    'revetement-de-sol'        => 'Revêtement de sol',
    'boiserie-et-ferronneries' => 'Boiseries & ferronneries',
];
$catLabel = $cats[$projet['categorie']] ?? $projet['categorie'];
$photos   = $projet['photos'] ?? [];
$n        = count($photos);

// Inclure les CSS Astro générés
$cssFiles = glob(__DIR__ . '/../_astro/*.css');

$title = htmlspecialchars($projet['titre']) . ' — ' . htmlspecialchars($projet['localisation']) . ' · Moment D.Art';
$desc  = !empty($projet['description'])
    ? htmlspecialchars($projet['description'])
    : 'Projet de ' . htmlspecialchars($catLabel) . ' à ' . htmlspecialchars($projet['localisation']) . ' réalisé par Moment D.Art.';
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $title ?></title>
<meta name="description" content="<?= $desc ?>">
<meta name="robots" content="index, follow">
<link rel="icon" type="image/png" href="/images/logo-premium-transparent.png">
<?php foreach ($cssFiles as $css): ?>
<link rel="stylesheet" href="/_astro/<?= htmlspecialchars(basename($css)) ?>">
<?php endforeach; ?>
<style>
  /* ── Page ── */
  .projet-header {
    padding: 2.5rem 0 2rem;
    border-bottom: 1px solid var(--line);
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
  .back-link {
    display: inline-flex; align-items: center; gap: .5rem;
    font-size: .8rem; font-weight: 600; color: var(--muted);
    text-decoration: none; margin-bottom: 1.5rem;
    transition: color .2s;
  }
  .back-link:hover { color: var(--accent); }
  .projet-meta { max-width: 700px; }
  .category-pill {
    display: inline-block; font-size: .68rem; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase;
    color: var(--accent-strong); background: var(--accent-soft);
    padding: .3rem .8rem; border-radius: 999px; margin-bottom: .75rem;
  }
  .projet-meta h1 { margin: 0 0 .75rem; font-size: clamp(1.6rem,4vw,2.4rem); line-height: 1.15; }
  .meta-row {
    display: flex; align-items: center; gap: .75rem;
    flex-wrap: wrap; margin-bottom: 1rem;
  }
  .meta-tag {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .8rem; font-weight: 500; color: var(--muted);
  }
  .meta-tag svg { color: var(--accent); }
  .meta-tag + .meta-tag::before { content: '·'; color: var(--line-strong); }
  .projet-desc { margin: 0; font-size: .95rem; color: var(--muted); line-height: 1.65; max-width: 58ch; }

  /* ── Photos ── */
  .photos-section { padding: 2.5rem 0 4rem; }
  .photos-masonry { columns: 3; column-gap: 1rem; }
  .photo-item {
    display: block; width: 100%; break-inside: avoid; margin-bottom: 1rem;
    border-radius: 12px; overflow: hidden; cursor: zoom-in;
    border: none; padding: 0; background: var(--bg-soft); position: relative;
  }
  .photo-item::after {
    content: ''; position: absolute; inset: 0;
    background: rgba(18,13,8,0); transition: background .25s; border-radius: 12px;
  }
  .photo-item:hover::after { background: rgba(18,13,8,.12); }
  .photo-item img { display: block; width: 100%; height: auto; transition: transform .4s; user-select: none; }
  .photo-item:hover img { transform: scale(1.03); }

  /* ── Lightbox ── */
  .lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(12,9,6,.96);
    display: flex; align-items: center; justify-content: center;
    animation: lbIn .2s ease;
  }
  .lightbox[hidden] { display: none; }
  @keyframes lbIn { from { opacity: 0; } to { opacity: 1; } }
  .lb-content { max-width: min(90vw,1100px); max-height: 88vh; display: flex; align-items: center; justify-content: center; }
  .lb-content img {
    max-width: 100%; max-height: 88vh; object-fit: contain;
    border-radius: 12px; box-shadow: 0 32px 80px rgba(0,0,0,.6);
    animation: imgIn .25s ease; user-select: none; pointer-events: none;
  }
  @keyframes imgIn { from { opacity:0; transform:scale(.97); } to { opacity:1; transform:scale(1); } }
  .lb-close {
    position: fixed; top: 1.25rem; right: 1.25rem;
    width: 44px; height: 44px; border-radius: 50%; border: none;
    background: rgba(255,255,255,.1); color: rgba(255,255,255,.9);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background .2s; z-index: 10;
  }
  .lb-close:hover { background: rgba(255,255,255,.2); }
  .lb-nav {
    position: fixed; top: 50%; transform: translateY(-50%);
    width: 52px; height: 52px; border-radius: 50%; border: none;
    background: rgba(255,255,255,.1); color: rgba(255,255,255,.9);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background .2s; z-index: 10;
  }
  .lb-nav:hover { background: rgba(255,255,255,.2); }
  .lb-prev { left: 1.25rem; }
  .lb-next { right: 1.25rem; }
  .lb-counter {
    position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
    font-size: .8rem; color: rgba(255,255,255,.55); font-weight: 500; letter-spacing: .08em;
  }
  @media (max-width: 860px) {
    .photos-masonry { columns: 2; }
    .lb-prev { left: .5rem; } .lb-next { right: .5rem; }
  }
  @media (max-width: 560px) {
    .photos-masonry { columns: 1; }
    .projet-meta h1 { font-size: 1.6rem; }
  }
</style>
</head>
<body>

<!-- Header minimal avec navigation -->
<header style="position:sticky;top:0;z-index:100;background:rgba(246,242,235,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);padding:.75rem 0">
  <div class="container" style="display:flex;align-items:center;justify-content:space-between">
    <a href="/" style="display:flex;align-items:center;gap:.6rem;text-decoration:none;color:inherit">
      <img src="/images/logo-premium-transparent.png" alt="Moment D.Art" style="height:32px;width:auto">
    </a>
    <nav style="display:flex;gap:1rem">
      <a href="/galerie/" style="font-size:.82rem;font-weight:600;color:var(--muted);text-decoration:none;transition:color .2s" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'">Galerie</a>
      <a href="/#contact" style="font-size:.82rem;font-weight:600;color:var(--muted);text-decoration:none;transition:color .2s" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'">Contact</a>
    </nav>
  </div>
</header>

<div class="projet-header">
  <div class="container">
    <a href="/galerie/" class="back-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Retour à la galerie
    </a>
    <div class="projet-meta">
      <span class="category-pill"><?= htmlspecialchars($catLabel) ?></span>
      <h1><?= htmlspecialchars($projet['titre']) ?></h1>
      <div class="meta-row">
        <span class="meta-tag">
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
            <path d="M6 0C3.79 0 2 1.79 2 4c0 3 4 8.5 4 8.5S10 7 10 4c0-2.21-1.79-4-4-4zm0 5.5A1.5 1.5 0 1 1 6 2.5a1.5 1.5 0 0 1 0 3z" fill="currentColor"/>
          </svg>
          <?= htmlspecialchars($projet['localisation']) ?>
        </span>
        <?php if (!empty($projet['annee'])): ?>
        <span class="meta-tag"><?= $projet['annee'] ?></span>
        <?php endif; ?>
        <span class="meta-tag"><?= $n ?> photo<?= $n > 1 ? 's' : '' ?></span>
      </div>
      <?php if (!empty($projet['description'])): ?>
      <p class="projet-desc"><?= htmlspecialchars($projet['description']) ?></p>
      <?php endif; ?>
    </div>
  </div>
</div>

<section class="photos-section">
  <div class="container">
    <div class="photos-masonry">
      <?php foreach ($photos as $i => $src): ?>
      <button class="photo-item" data-index="<?= $i ?>" aria-label="Voir photo <?= $i + 1 ?> sur <?= $n ?>" type="button">
        <img src="<?= htmlspecialchars($src) ?>" alt="<?= htmlspecialchars($projet['titre']) ?> à <?= htmlspecialchars($projet['localisation']) ?> — photo <?= $i + 1 ?>" loading="<?= $i < 4 ? 'eager' : 'lazy' ?>">
      </button>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Lightbox -->
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Visionneuse" hidden>
  <button class="lb-close" id="lb-close" aria-label="Fermer" type="button">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
  </button>
  <button class="lb-nav lb-prev" id="lb-prev" aria-label="Photo précédente" type="button">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="lb-content"><img src="" alt="" id="lb-img"></div>
  <button class="lb-nav lb-next" id="lb-next" aria-label="Photo suivante" type="button">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="lb-counter" id="lb-counter"></div>
</div>

<script>
const photos  = <?= json_encode($photos) ?>;
const titre   = <?= json_encode($projet['titre']) ?>;
const lb      = document.getElementById('lightbox');
const lbImg   = document.getElementById('lb-img');
const lbClose = document.getElementById('lb-close');
const lbPrev  = document.getElementById('lb-prev');
const lbNext  = document.getElementById('lb-next');
const lbCount = document.getElementById('lb-counter');
const items   = document.querySelectorAll('.photo-item');
let cur = 0;

const update = () => {
  lbImg.src = photos[cur];
  lbImg.alt = titre + ' — photo ' + (cur + 1);
  lbCount.textContent = (cur + 1) + ' / ' + photos.length;
};
const open  = i => { cur = i; update(); lb.hidden = false; document.body.style.overflow = 'hidden'; lbClose.focus(); };
const close = () => { lb.hidden = true; document.body.style.overflow = ''; items[cur]?.focus(); };
const prev  = () => { cur = (cur - 1 + photos.length) % photos.length; update(); };
const next  = () => { cur = (cur + 1) % photos.length; update(); };

items.forEach((el, i) => el.addEventListener('click', () => open(i)));
lbClose.addEventListener('click', close);
lbPrev.addEventListener('click', prev);
lbNext.addEventListener('click', next);
lb.addEventListener('click', e => { if (e.target === lb) close(); });
document.addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
});
</script>
</body>
</html>
