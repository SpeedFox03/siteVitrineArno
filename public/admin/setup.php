<?php
/**
 * SETUP — à exécuter UNE SEULE FOIS après upload sur OVH.
 * Visite /admin/setup.php dans ton navigateur, puis supprime ce fichier.
 */
$configFile = __DIR__ . '/config.php';

// Génération d'un mot de passe aléatoire sécurisé (jamais stocké en clair)
$chars    = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
$password = '';
for ($i = 0; $i < 18; $i++) {
    $password .= $chars[random_int(0, strlen($chars) - 1)];
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$content = <<<PHP
<?php
define('ADMIN_HASH',    '{$hash}');
define('SESSION_NAME',  'mda_admin');
define('SESSION_HOURS', 8);
define('DATA_FILE',     __DIR__ . '/../data/projets.json');
define('UPLOAD_DIR',    __DIR__ . '/../uploads/projets/');
define('UPLOAD_URL',    '/uploads/projets/');
define('MAX_FILE_SIZE', 8 * 1024 * 1024);
PHP;

file_put_contents($configFile, $content);
?>
<!doctype html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Setup — Moment D.Art Admin</title>
<style>body{font-family:sans-serif;background:#1a1510;color:#f7f3ec;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:#252018;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:2.5rem;max-width:480px;text-align:center}h1{color:#b18a68;margin:0 0 1rem;font-size:1.4rem}.pwd{font-family:monospace;font-size:1.1rem;background:#1a1510;padding:.8rem 1.4rem;border-radius:8px;margin:1.2rem 0;color:#f7f3ec;border:1px solid rgba(177,138,104,.3);display:inline-block;word-break:break-all}.warn{background:rgba(177,138,104,.12);border:1px solid rgba(177,138,104,.3);border-radius:8px;padding:1rem;margin-top:1.5rem;font-size:.9rem;line-height:1.6;color:#d4b896}.btn{display:inline-block;margin-top:1.5rem;padding:.8rem 1.8rem;background:#b18a68;color:#fff;border-radius:999px;font-weight:700;text-decoration:none;font-size:.9rem}</style>
</head>
<body>
<div class="box">
  <h1>✓ Admin configuré</h1>
  <p>Ton mot de passe administrateur :</p>
  <div class="pwd"><?= htmlspecialchars($password) ?></div>
  <p style="font-size:.85rem;color:#91877b">Note-le maintenant — il ne sera <strong>jamais</strong> affiché à nouveau.</p>
  <div class="warn">
    ⚠️ <strong>Supprime ce fichier immédiatement</strong> depuis ton gestionnaire de fichiers OVH :<br>
    <code style="font-size:.82rem">/admin/setup.php</code>
  </div>
  <a href="/admin/" class="btn">Aller à l'administration →</a>
</div>
</body>
</html>
