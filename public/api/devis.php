<?php
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Méthode non autorisée.']);
    exit;
}

// Honeypot anti-spam
if (!empty($_POST['website'])) {
    echo json_encode(['message' => 'Votre demande a bien été envoyée.']);
    exit;
}

$type     = trim($_POST['formType'] ?? 'prive');
$email    = trim($_POST['email']    ?? '');
$adresse  = trim($_POST['adresse']  ?? '');
$intitule = trim($_POST['intitule'] ?? '');
$details  = trim($_POST['details']  ?? '');

$errors = [];

if ($type === 'prive') {
    $prenom = trim($_POST['prenom'] ?? '');
    $nom    = trim($_POST['nom']    ?? '');
    if (strlen($prenom) < 2) $errors['prenom'] = 'Champ requis';
    if (strlen($nom)    < 2) $errors['nom']    = 'Champ requis';
    $identite  = trim($prenom . ' ' . $nom);
    $typeLabel = 'Privé';
} else {
    $societe = trim($_POST['societe'] ?? '');
    $tva     = trim($_POST['tva']     ?? '');
    if (strlen($societe) < 2) $errors['societe'] = 'Champ requis';
    if (empty($tva)) {
        $errors['tva'] = 'Champ requis';
    } elseif (!preg_match('/^[A-Za-z]{0,2}[\d.\s\-]{8,20}$/', $tva)) {
        $errors['tva'] = 'Numéro de TVA invalide';
    }
    $identite  = trim($societe) . ' (TVA : ' . trim($tva) . ')';
    $typeLabel = 'Professionnel';
}

if (empty($email)) {
    $errors['email'] = 'Champ requis';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Adresse e-mail invalide';
}
if (strlen($adresse)  < 3) $errors['adresse']  = 'Champ requis';
if (strlen($intitule) < 3) $errors['intitule'] = 'Champ requis';
if (strlen($details)  < 10) $errors['details']  = 'Champ requis';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['errors' => $errors, 'message' => 'Veuillez corriger les champs indiqués.']);
    exit;
}

function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$to = 'contact@momentdart.be';

// ── Email vers Moment D.Art ──────────────────────────────────────────────
$subject_in = '=?UTF-8?B?' . base64_encode("[Devis {$typeLabel}] {$intitule}") . '?=';

$rows = ($type === 'pro')
    ? '<tr><td><strong>Société</strong></td><td>' . e($societe) . '</td></tr>'
      . '<tr><td><strong>TVA</strong></td><td>' . e($tva) . '</td></tr>'
    : '<tr><td><strong>Prénom</strong></td><td>' . e($prenom) . '</td></tr>'
      . '<tr><td><strong>Nom</strong></td><td>' . e($nom) . '</td></tr>';

$html_in = '<!DOCTYPE html><html lang="fr"><body style="font-family:sans-serif;color:#241d17;max-width:600px;margin:auto;padding:2rem">'
    . "<h2 style=\"color:#7A5C3E\">Nouvelle demande de devis — {$typeLabel}</h2>"
    . '<table cellpadding="8" cellspacing="0" border="0" style="width:100%">'
    . $rows
    . '<tr><td style="width:110px"><strong>E-mail</strong></td><td><a href="mailto:' . e($email) . '">' . e($email) . '</a></td></tr>'
    . '<tr><td><strong>Adresse</strong></td><td>' . e($adresse) . '</td></tr>'
    . '<tr><td><strong>Intitulé</strong></td><td>' . e($intitule) . '</td></tr>'
    . '</table>'
    . '<h3 style="margin-top:1.5rem">Détails</h3>'
    . '<p style="white-space:pre-wrap;background:#f7f3ec;padding:1rem;border-radius:8px">' . e($details) . '</p>'
    . '<hr style="border:none;border-top:1px solid #e0d9cf;margin-top:2rem">'
    . '<p style="color:#9c8879;font-size:0.82rem">Moment D.Art · momentdart.be</p>'
    . '</body></html>';

$headers_in  = "From: noreply@momentdart.be\r\n";
$headers_in .= "Reply-To: {$email}\r\n";
$headers_in .= "MIME-Version: 1.0\r\n";
$headers_in .= "Content-Type: text/html; charset=UTF-8\r\n";

$sent = mail($to, $subject_in, $html_in, $headers_in);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['message' => "Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous écrire directement à contact@momentdart.be."]);
    exit;
}

// ── Email de confirmation au client ─────────────────────────────────────
$subject_conf = '=?UTF-8?B?' . base64_encode('Votre demande de devis a bien été reçue — Moment D.Art') . '?=';

$nom_client = ($type === 'pro') ? e($societe) : e($prenom);

$html_conf = '<!DOCTYPE html><html lang="fr"><body style="font-family:sans-serif;color:#241d17;max-width:600px;margin:auto;padding:2rem">'
    . "<p>Bonjour {$nom_client},</p>"
    . '<p>Nous avons bien reçu votre demande de devis concernant : <strong>' . e($intitule) . '</strong>.</p>'
    . '<p>Moment D.Art vous recontactera dans les plus brefs délais.</p>'
    . '<hr style="border:none;border-top:1px solid #e0d9cf;margin:1.5rem 0">'
    . '<p style="color:#9c8879;font-size:0.82rem">Moment D.Art · Rue des Moges · 4120 Neupré · <a href="https://momentdart.be" style="color:#7A5C3E">momentdart.be</a></p>'
    . '</body></html>';

$headers_conf  = "From: Moment D.Art <contact@momentdart.be>\r\n";
$headers_conf .= "MIME-Version: 1.0\r\n";
$headers_conf .= "Content-Type: text/html; charset=UTF-8\r\n";

mail($email, $subject_conf, $html_conf, $headers_conf);

echo json_encode(['message' => 'Votre demande a bien été envoyée. Nous vous recontacterons dans les plus brefs délais.']);
