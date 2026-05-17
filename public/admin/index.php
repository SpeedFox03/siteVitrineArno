<?php
// ── Bootstrap ────────────────────────────────────────────────────────────────
if (!file_exists(__DIR__ . '/config.php')) {
    die('<p style="font-family:sans-serif;padding:2rem">Config manquant — visitez <a href="/admin/setup.php">/admin/setup.php</a> d\'abord.</p>');
}
require_once __DIR__ . '/config.php';

session_name(SESSION_NAME);
session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict']);
session_start();

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['csrf'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function csrf_ok(): bool {
    return isset($_POST['csrf'], $_SESSION['csrf'])
        && hash_equals($_SESSION['csrf'], $_POST['csrf']);
}

function logged_in(): bool {
    if (empty($_SESSION['auth'])) return false;
    if (time() > ($_SESSION['expires'] ?? 0)) { session_destroy(); return false; }
    return true;
}

function redirect(string $url): never {
    header('Location: ' . $url);
    exit;
}

function read_projets(): array {
    if (!file_exists(DATA_FILE)) return [];
    return json_decode(file_get_contents(DATA_FILE), true) ?? [];
}

function write_projets(array $data): void {
    file_put_contents(DATA_FILE, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function slugify(string $s): string {
    $s = mb_strtolower($s, 'UTF-8');
    $s = str_replace(
        ['à','â','ä','é','è','ê','ë','î','ï','ô','ö','ù','û','ü','ç','œ','æ'],
        ['a','a','a','e','e','e','e','i','i','o','o','u','u','u','c','oe','ae'], $s
    );
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);

// ── POST actions ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // Login — pas besoin d'être connecté
    if ($action === 'login') {
        if (!csrf_ok()) redirect('/admin/');
        if (ADMIN_HASH === '') {
            $_SESSION['flash'] = ['t' => 'error', 'm' => 'Panneau non initialisé. Visitez /admin/setup.php'];
            redirect('/admin/');
        }
        if (password_verify($_POST['password'] ?? '', ADMIN_HASH)) {
            session_regenerate_id(true);
            $_SESSION['auth']    = true;
            $_SESSION['expires'] = time() + SESSION_HOURS * 3600;
            redirect('/admin/');
        }
        $_SESSION['flash'] = ['t' => 'error', 'm' => 'Mot de passe incorrect.'];
        redirect('/admin/');
    }

    // Toutes les autres actions nécessitent d'être connecté + CSRF valide
    if (!logged_in() || !csrf_ok()) redirect('/admin/');

    if ($action === 'logout') {
        session_destroy();
        redirect('/admin/');
    }

    if ($action === 'add-project') {
        $titre       = trim($_POST['titre'] ?? '');
        $localisation = trim($_POST['localisation'] ?? '');
        $categorie   = $_POST['categorie'] ?? '';
        $description = trim($_POST['description'] ?? '');
        $annee       = (int) ($_POST['annee'] ?? 0);
        $valid_cats  = ['peinture-interieure','peinture-exterieure','peinture-decorative',
                         'enduits-decoratifs','revetement-mural','revetement-de-sol','boiserie-et-ferronneries'];

        if (!$titre || !$localisation || !in_array($categorie, $valid_cats)) {
            $_SESSION['flash'] = ['t' => 'error', 'm' => 'Tous les champs obligatoires sont requis.'];
            redirect('/admin/');
        }

        $slug    = slugify($titre . '-' . $localisation);
        $projets = read_projets();

        if (in_array($slug, array_column($projets, 'slug'))) {
            $slug .= '-' . substr(uniqid(), -4);
        }

        $nouveau = [
            'slug'         => $slug,
            'titre'        => $titre,
            'localisation' => $localisation,
            'categorie'    => $categorie,
            'photos'       => [],
        ];
        if ($description) $nouveau['description'] = $description;
        if ($annee > 2000 && $annee <= (int) date('Y') + 1) $nouveau['annee'] = $annee;

        $projets[] = $nouveau;
        write_projets($projets);

        $dir = UPLOAD_DIR . $slug . '/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $_SESSION['flash'] = ['t' => 'success', 'm' => "Projet « {$titre} » créé avec succès."];
        redirect('/admin/');
    }

    if ($action === 'delete-project') {
        $slug    = preg_replace('/[^a-z0-9-]/', '', $_POST['slug'] ?? '');
        $projets = read_projets();
        $idx     = null;
        foreach ($projets as $i => $p) { if ($p['slug'] === $slug) { $idx = $i; break; } }

        if ($idx === null) { $_SESSION['flash'] = ['t' => 'error', 'm' => 'Projet introuvable.']; redirect('/admin/'); }

        $titre = $projets[$idx]['titre'];
        $dir   = UPLOAD_DIR . $slug . '/';
        if (is_dir($dir)) {
            foreach (glob($dir . '*') as $f) { if (is_file($f)) unlink($f); }
            rmdir($dir);
        }

        array_splice($projets, $idx, 1);
        write_projets($projets);
        $_SESSION['flash'] = ['t' => 'success', 'm' => "Projet « {$titre} » supprimé."];
        redirect('/admin/');
    }

    if ($action === 'upload-images') {
        $slug    = preg_replace('/[^a-z0-9-]/', '', $_POST['slug'] ?? '');
        $projets = read_projets();
        $idx     = null;
        foreach ($projets as $i => $p) { if ($p['slug'] === $slug) { $idx = $i; break; } }

        if ($idx === null) redirect('/admin/');

        $dir = UPLOAD_DIR . $slug . '/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $ok = 0; $ko = 0;
        $files = $_FILES['photos'] ?? [];
        $n = count($files['name'] ?? []);

        for ($i = 0; $i < $n; $i++) {
            if ($files['error'][$i] !== UPLOAD_ERR_OK) { $ko++; continue; }
            if ($files['size'][$i] > MAX_FILE_SIZE) { $ko++; continue; }

            $mime = mime_content_type($files['tmp_name'][$i]);
            $exts = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (!isset($exts[$mime])) { $ko++; continue; }

            $filename = uniqid('photo_', true) . '.' . $exts[$mime];
            if (move_uploaded_file($files['tmp_name'][$i], $dir . $filename)) {
                $projets[$idx]['photos'][] = UPLOAD_URL . $slug . '/' . $filename;
                $ok++;
            } else { $ko++; }
        }

        write_projets($projets);
        $msg = "{$ok} photo(s) ajoutée(s).";
        if ($ko) $msg .= " {$ko} rejetée(s) (taille, format ou erreur).";
        $_SESSION['flash'] = ['t' => $ko ? 'warning' : 'success', 'm' => $msg];
        redirect('/admin/?open=' . urlencode($slug));
    }

    if ($action === 'delete-image') {
        $slug    = preg_replace('/[^a-z0-9-]/', '', $_POST['slug'] ?? '');
        $photo   = $_POST['photo'] ?? '';
        $projets = read_projets();
        $idx     = null;
        foreach ($projets as $i => $p) { if ($p['slug'] === $slug) { $idx = $i; break; } }

        if ($idx !== null) {
            if (str_starts_with($photo, UPLOAD_URL)) {
                $path = __DIR__ . '/../' . ltrim($photo, '/');
                if (file_exists($path)) unlink($path);
            }
            $projets[$idx]['photos'] = array_values(array_filter($projets[$idx]['photos'], fn($x) => $x !== $photo));
            write_projets($projets);
        }
        redirect('/admin/?open=' . urlencode($slug));
    }
}

// ── Data ─────────────────────────────────────────────────────────────────────
$is_auth  = logged_in();
$projets  = $is_auth ? read_projets() : [];
$needs_setup = ADMIN_HASH === '';

$cats = [
    'peinture-interieure'      => 'Peinture intérieure',
    'peinture-exterieure'      => 'Peinture extérieure',
    'peinture-decorative'      => 'Peinture décorative',
    'enduits-decoratifs'       => 'Enduits décoratifs',
    'revetement-mural'         => 'Revêtement mural',
    'revetement-de-sol'        => 'Revêtement de sol',
    'boiserie-et-ferronneries' => 'Boiseries & ferronneries',
];
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Administration — Moment D.Art</title>
<meta name="robots" content="noindex, nofollow">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #1a1510;
    --surface: #252018;
    --surface2:#2e2820;
    --accent:  #b18a68;
    --accent2: #c9a07c;
    --text:    #f7f3ec;
    --muted:   #91877b;
    --muted2:  #6b6059;
    --line:    rgba(255,255,255,.07);
    --line2:   rgba(255,255,255,.12);
    --danger:  #c0392b;
    --success: #2ecc71;
    --warn:    #e67e22;
    --radius:  12px;
    --radius-sm: 8px;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  /* ── Layout ── */
  .admin-wrap { max-width: 1100px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }

  /* ── Header ── */
  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--line2);
    gap: 1rem;
    flex-wrap: wrap;
  }
  .admin-logo { display: flex; align-items: center; gap: 0.75rem; }
  .admin-logo-icon {
    width: 36px; height: 36px;
    background: var(--accent);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem;
  }
  .admin-logo h1 { font-size: 1rem; font-weight: 700; color: var(--text); }
  .admin-logo span { font-size: 0.72rem; color: var(--muted); display: block; }

  /* ── Flash ── */
  .flash {
    padding: 0.85rem 1.1rem;
    border-radius: var(--radius-sm);
    margin-bottom: 1.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .flash.success { background: rgba(46,204,113,.12); border: 1px solid rgba(46,204,113,.25); color: #2ecc71; }
  .flash.error   { background: rgba(192,57,43,.12);  border: 1px solid rgba(192,57,43,.25);  color: #e74c3c; }
  .flash.warning { background: rgba(230,126,34,.12); border: 1px solid rgba(230,126,34,.25); color: #e67e22; }

  /* ── Login ── */
  .login-wrap {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 2rem;
  }
  .login-box {
    background: var(--surface);
    border: 1px solid var(--line2);
    border-radius: 18px;
    padding: 2.5rem;
    width: 100%;
    max-width: 380px;
  }
  .login-box h2 { font-size: 1.2rem; margin-bottom: 0.4rem; color: var(--accent); }
  .login-box p  { color: var(--muted); font-size: 0.82rem; margin-bottom: 1.75rem; }
  .field { margin-bottom: 1rem; }
  .field label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--muted); margin-bottom: 0.4rem; letter-spacing: .04em; text-transform: uppercase; }
  .field input, .field select, .field textarea {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--line2);
    border-radius: var(--radius-sm);
    color: var(--text);
    padding: 0.7rem 0.9rem;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: border-color .2s;
  }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); }
  .field textarea { resize: vertical; min-height: 80px; }
  .field select option { background: var(--surface); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.65rem 1.4rem;
    border-radius: 999px;
    font-size: 0.82rem; font-weight: 700; font-family: inherit;
    cursor: pointer; border: none; text-decoration: none;
    transition: opacity .2s, transform .15s;
    white-space: nowrap;
  }
  .btn:hover { opacity: .88; transform: translateY(-1px); }
  .btn:active { transform: none; }
  .btn-primary  { background: var(--accent); color: #fff; }
  .btn-danger   { background: rgba(192,57,43,.15); color: #e74c3c; border: 1px solid rgba(192,57,43,.25); }
  .btn-ghost    { background: var(--surface2); color: var(--text); border: 1px solid var(--line2); }
  .btn-sm { padding: 0.4rem 0.9rem; font-size: 0.75rem; }
  .btn-full { width: 100%; justify-content: center; }

  /* ── Section title ── */
  .section-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.25rem; gap: 1rem;
  }
  .section-head h2 { font-size: 1rem; font-weight: 700; color: var(--text); }
  .badge {
    display: inline-block;
    background: var(--surface2);
    color: var(--muted);
    font-size: 0.68rem; font-weight: 700;
    padding: 0.2rem 0.55rem; border-radius: 999px;
    border: 1px solid var(--line2);
  }

  /* ── Project grid ── */
  .projets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .projet-card {
    background: var(--surface);
    border: 1px solid var(--line2);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color .2s;
  }
  .projet-card:hover { border-color: rgba(177,138,104,.3); }

  .card-thumb {
    aspect-ratio: 16/9;
    background: var(--surface2);
    overflow: hidden;
    position: relative;
  }
  .card-thumb img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .card-thumb-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted2);
    font-size: 0.75rem;
  }
  .card-cat-badge {
    position: absolute; top: 0.6rem; left: 0.6rem;
    background: rgba(26,21,16,.75);
    backdrop-filter: blur(8px);
    color: var(--accent2);
    font-size: 0.62rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    padding: 0.28rem 0.65rem; border-radius: 999px;
    border: 1px solid rgba(177,138,104,.2);
  }

  .card-body { padding: 1rem; }
  .card-title { font-size: 0.92rem; font-weight: 700; margin-bottom: 0.25rem; }
  .card-sub   { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.9rem; }
  .card-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(12,9,6,.82);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
    opacity: 0; pointer-events: none;
    transition: opacity .2s;
  }
  .modal-overlay.is-open { opacity: 1; pointer-events: all; }
  .modal {
    background: var(--surface);
    border: 1px solid var(--line2);
    border-radius: 18px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(12px);
    transition: transform .25s;
  }
  .modal-overlay.is-open .modal { transform: none; }
  .modal-head {
    padding: 1.4rem 1.5rem 1rem;
    border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
  }
  .modal-head h3 { font-size: 1rem; font-weight: 700; }
  .modal-close {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--surface2); border: none; color: var(--muted);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background .2s, color .2s;
  }
  .modal-close:hover { background: var(--line2); color: var(--text); }
  .modal-body { padding: 1.5rem; }
  .modal-foot { padding: 1rem 1.5rem; border-top: 1px solid var(--line); display: flex; gap: 0.75rem; justify-content: flex-end; }

  /* ── Photo list in modal ── */
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.6rem;
    margin-bottom: 1.25rem;
  }
  .photo-item {
    position: relative; border-radius: var(--radius-sm); overflow: hidden;
    aspect-ratio: 1; background: var(--surface2);
  }
  .photo-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-delete {
    position: absolute; top: 4px; right: 4px;
    width: 24px; height: 24px; border-radius: 50%;
    background: rgba(192,57,43,.85);
    border: none; color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; line-height: 1;
    opacity: 0; transition: opacity .2s;
  }
  .photo-item:hover .photo-delete { opacity: 1; }

  /* ── Upload zone ── */
  .upload-zone {
    border: 2px dashed var(--line2);
    border-radius: var(--radius);
    padding: 2rem 1rem;
    text-align: center;
    cursor: pointer;
    transition: border-color .2s, background .2s;
  }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--accent); background: rgba(177,138,104,.06); }
  .upload-zone input { display: none; }
  .upload-zone p { color: var(--muted); font-size: 0.82rem; margin-top: 0.5rem; }
  .upload-icon { font-size: 2rem; margin-bottom: 0.5rem; }
  .upload-preview { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; justify-content: center; }
  .upload-preview img { width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line2); }

  /* ── Setup warning ── */
  .setup-warn {
    background: rgba(230,126,34,.1);
    border: 1px solid rgba(230,126,34,.3);
    border-radius: var(--radius);
    padding: 1.25rem 1.5rem;
    color: var(--warn);
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .setup-warn a { color: var(--accent); }

  /* ── Empty state ── */
  .empty-state {
    text-align: center; padding: 3rem 1rem;
    background: var(--surface);
    border: 1px dashed var(--line2);
    border-radius: var(--radius);
    color: var(--muted);
  }
  .empty-state p { margin-top: 0.5rem; font-size: 0.85rem; }

  /* ── Toast ── */
  .site-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    font-size: 0.78rem; color: var(--muted); text-decoration: none;
    border: 1px solid var(--line2); border-radius: 999px;
    padding: 0.4rem 0.9rem;
    transition: border-color .2s, color .2s;
  }
  .site-link:hover { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>

<?php if (!$is_auth): ?>
<!-- ══ LOGIN ══════════════════════════════════════════════════════════════ -->
<div class="login-wrap">
  <div class="login-box">
    <h2>Moment D.Art</h2>
    <p>Panneau d'administration — accès restreint</p>

    <?php if ($needs_setup): ?>
    <div class="setup-warn">
      ⚙️ Panneau non initialisé.<br>
      Visitez <a href="/admin/setup.php">/admin/setup.php</a> pour configurer le mot de passe.
    </div>
    <?php else: ?>

    <?php if ($flash): ?>
    <div class="flash <?= $flash['t'] ?>" style="margin-bottom:1.25rem">
      <?= $flash['t'] === 'error' ? '✕' : '✓' ?> <?= htmlspecialchars($flash['m']) ?>
    </div>
    <?php endif; ?>

    <form method="POST" action="/admin/">
      <input type="hidden" name="csrf"   value="<?= $csrf ?>">
      <input type="hidden" name="action" value="login">
      <div class="field">
        <label for="password">Mot de passe</label>
        <input type="password" id="password" name="password" autofocus autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top:.5rem">Se connecter</button>
    </form>
    <?php endif; ?>
  </div>
</div>

<?php else: ?>
<!-- ══ DASHBOARD ══════════════════════════════════════════════════════════ -->
<div class="admin-wrap">

  <!-- Header -->
  <header class="admin-header">
    <div class="admin-logo">
      <div class="admin-logo-icon">🎨</div>
      <div>
        <h1>Moment D.Art</h1>
        <span>Administration</span>
      </div>
    </div>
    <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
      <a href="/" class="site-link" target="_blank">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Voir le site
      </a>
      <form method="POST" action="/admin/" style="display:inline">
        <input type="hidden" name="csrf"   value="<?= $csrf ?>">
        <input type="hidden" name="action" value="logout">
        <button type="submit" class="btn btn-ghost btn-sm">Déconnexion</button>
      </form>
    </div>
  </header>

  <?php if ($flash): ?>
  <div class="flash <?= $flash['t'] ?>">
    <?= $flash['t'] === 'success' ? '✓' : ($flash['t'] === 'error' ? '✕' : '⚠') ?> <?= htmlspecialchars($flash['m']) ?>
  </div>
  <?php endif; ?>

  <!-- Section projets -->
  <div class="section-head">
    <h2>Projets <span class="badge"><?= count($projets) ?></span></h2>
    <button class="btn btn-primary" onclick="openModal('modal-add')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
      Nouveau projet
    </button>
  </div>

  <?php if (empty($projets)): ?>
  <div class="empty-state">
    <div style="font-size:2rem">📂</div>
    <p>Aucun projet pour le moment.<br>Cliquez sur « Nouveau projet » pour commencer.</p>
  </div>
  <?php else: ?>
  <div class="projets-grid">
    <?php foreach ($projets as $p): ?>
    <div class="projet-card">
      <div class="card-thumb">
        <?php if (!empty($p['photos'])): ?>
          <img src="<?= htmlspecialchars($p['photos'][0]) ?>" alt="<?= htmlspecialchars($p['titre']) ?>" loading="lazy">
        <?php else: ?>
          <div class="card-thumb-empty">Aucune photo</div>
        <?php endif; ?>
        <span class="card-cat-badge"><?= htmlspecialchars($cats[$p['categorie']] ?? $p['categorie']) ?></span>
      </div>
      <div class="card-body">
        <div class="card-title"><?= htmlspecialchars($p['titre']) ?></div>
        <div class="card-sub">
          <?= htmlspecialchars($p['localisation']) ?>
          <?php if (!empty($p['annee'])): ?> · <?= $p['annee'] ?><?php endif; ?>
          · <?= count($p['photos']) ?> photo<?= count($p['photos']) !== 1 ? 's' : '' ?>
        </div>
        <div class="card-actions">
          <button class="btn btn-ghost btn-sm"
            onclick="openPhotos(<?= htmlspecialchars(json_encode($p), ENT_QUOTES) ?>)">
            📷 Photos
          </button>
          <button class="btn btn-danger btn-sm"
            onclick="confirmDelete(<?= htmlspecialchars(json_encode($p['slug']), ENT_QUOTES) ?>, <?= htmlspecialchars(json_encode($p['titre']), ENT_QUOTES) ?>)">
            Supprimer
          </button>
        </div>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

</div><!-- /admin-wrap -->

<!-- ══ MODAL — Nouveau projet ══════════════════════════════════════════════ -->
<div class="modal-overlay" id="modal-add" onclick="maybeClose(event, 'modal-add')">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-add-title">
    <div class="modal-head">
      <h3 id="modal-add-title">Nouveau projet</h3>
      <button class="modal-close" onclick="closeModal('modal-add')" aria-label="Fermer">✕</button>
    </div>
    <form method="POST" action="/admin/" enctype="multipart/form-data">
      <div class="modal-body">
        <input type="hidden" name="csrf"   value="<?= $csrf ?>">
        <input type="hidden" name="action" value="add-project">
        <div class="field">
          <label for="titre">Titre <span style="color:#e74c3c">*</span></label>
          <input type="text" id="titre" name="titre" required placeholder="ex : Remise en blanc complète">
        </div>
        <div class="field">
          <label for="localisation">Localisation <span style="color:#e74c3c">*</span></label>
          <input type="text" id="localisation" name="localisation" required placeholder="ex : Neupré">
        </div>
        <div class="field">
          <label for="categorie">Catégorie <span style="color:#e74c3c">*</span></label>
          <select id="categorie" name="categorie" required>
            <option value="">— Choisir —</option>
            <?php foreach ($cats as $slug => $label): ?>
            <option value="<?= $slug ?>"><?= $label ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
          <div class="field">
            <label for="annee">Année</label>
            <input type="number" id="annee" name="annee" min="2015" max="<?= date('Y') + 1 ?>" placeholder="<?= date('Y') ?>">
          </div>
        </div>
        <div class="field">
          <label for="description">Description</label>
          <textarea id="description" name="description" placeholder="Description du projet (optionnel)"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="closeModal('modal-add')">Annuler</button>
        <button type="submit" class="btn btn-primary">Créer le projet</button>
      </div>
    </form>
  </div>
</div>

<!-- ══ MODAL — Gérer les photos ══════════════════════════════════════════════ -->
<div class="modal-overlay" id="modal-photos" onclick="maybeClose(event, 'modal-photos')">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-photos-title">
    <div class="modal-head">
      <h3 id="modal-photos-title">Photos</h3>
      <button class="modal-close" onclick="closeModal('modal-photos')" aria-label="Fermer">✕</button>
    </div>
    <div class="modal-body">
      <div class="photo-grid" id="photo-grid"></div>

      <!-- Upload form -->
      <form method="POST" action="/admin/" enctype="multipart/form-data" id="upload-form">
        <input type="hidden" name="csrf"   value="<?= $csrf ?>">
        <input type="hidden" name="action" value="upload-images">
        <input type="hidden" name="slug"   id="upload-slug">
        <div class="upload-zone" id="upload-zone" onclick="document.getElementById('upload-input').click()">
          <div class="upload-icon">📤</div>
          <strong>Cliquer pour ajouter des photos</strong>
          <p>JPG, PNG ou WebP · max 8 Mo par fichier</p>
          <div class="upload-preview" id="upload-preview"></div>
          <input type="file" id="upload-input" name="photos[]" multiple accept="image/jpeg,image/png,image/webp" onchange="previewFiles(this)">
        </div>
      </form>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" onclick="closeModal('modal-photos')">Fermer</button>
      <button type="button" class="btn btn-primary" onclick="document.getElementById('upload-form').submit()">
        Uploader les photos
      </button>
    </div>
  </div>
</div>

<!-- ══ MODAL — Confirmer suppression ════════════════════════════════════════ -->
<div class="modal-overlay" id="modal-delete" onclick="maybeClose(event, 'modal-delete')">
  <div class="modal" style="max-width:380px" role="dialog" aria-modal="true">
    <div class="modal-head">
      <h3>Supprimer le projet ?</h3>
      <button class="modal-close" onclick="closeModal('modal-delete')" aria-label="Fermer">✕</button>
    </div>
    <form method="POST" action="/admin/">
      <div class="modal-body">
        <input type="hidden" name="csrf"   value="<?= $csrf ?>">
        <input type="hidden" name="action" value="delete-project">
        <input type="hidden" name="slug"   id="delete-slug">
        <p style="color:var(--muted);font-size:.88rem;line-height:1.6">
          Vous êtes sur le point de supprimer le projet <strong id="delete-name" style="color:var(--text)"></strong>.
          Les photos uploadées seront également supprimées. Cette action est irréversible.
        </p>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="closeModal('modal-delete')">Annuler</button>
        <button type="submit" class="btn btn-danger">Supprimer définitivement</button>
      </div>
    </form>
  </div>
</div>

<?php endif; ?>

<script>
// ── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('is-open');
  document.body.style.overflow = '';
}
function maybeClose(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.is-open').forEach(m => closeModal(m.id));
  }
});

// ── Delete confirm ──────────────────────────────────────────────────────────
function confirmDelete(slug, titre) {
  document.getElementById('delete-slug').value = slug;
  document.getElementById('delete-name').textContent = titre;
  openModal('modal-delete');
}

// ── Photos modal ─────────────────────────────────────────────────────────────
function openPhotos(projet) {
  document.getElementById('modal-photos-title').textContent = 'Photos — ' + projet.titre;
  document.getElementById('upload-slug').value = projet.slug;
  document.getElementById('upload-preview').innerHTML = '';

  const grid = document.getElementById('photo-grid');
  grid.innerHTML = '';

  if (!projet.photos || projet.photos.length === 0) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:.82rem;grid-column:1/-1">Aucune photo pour ce projet.</p>';
  } else {
    projet.photos.forEach(src => {
      const item = document.createElement('div');
      item.className = 'photo-item';
      item.innerHTML = `
        <img src="${src}" alt="" loading="lazy">
        <form method="POST" action="/admin/" style="display:contents">
          <input type="hidden" name="csrf"   value="<?= $csrf ?>">
          <input type="hidden" name="action" value="delete-image">
          <input type="hidden" name="slug"   value="${projet.slug}">
          <input type="hidden" name="photo"  value="${src}">
          <button type="submit" class="photo-delete" title="Supprimer cette photo" onclick="return confirm('Supprimer cette photo ?')">✕</button>
        </form>`;
      grid.appendChild(item);
    });
  }

  openModal('modal-photos');
}

// ── Upload preview ────────────────────────────────────────────────────────────
function previewFiles(input) {
  const preview = document.getElementById('upload-preview');
  preview.innerHTML = '';
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
const zone = document.getElementById('upload-zone');
const inp  = document.getElementById('upload-input');
if (zone && inp) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const dt = new DataTransfer();
    Array.from(inp.files).forEach(f => dt.items.add(f));
    Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
    inp.files = dt.files;
    previewFiles(inp);
  });
}

// ── Auto-rouvrir la modale photos après upload/suppression ────────────────────
const allProjets = <?= json_encode($projets ?? []) ?>;
const openSlug = new URLSearchParams(location.search).get('open');
if (openSlug) {
  const p = allProjets.find(x => x.slug === openSlug);
  if (p) {
    history.replaceState(null, '', '/admin/');
    openPhotos(p);
  }
}
</script>
</body>
</html>
