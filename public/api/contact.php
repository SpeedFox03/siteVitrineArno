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
    echo json_encode(['message' => 'Votre message a bien été envoyé.']);
    exit;
}

$nom     = trim($_POST['nom']     ?? '');
$email   = trim($_POST['email']   ?? '');
$message = trim($_POST['message'] ?? '');

$errors = [];
if (strlen($nom) < 2)     $errors['nom']     = 'Champ requis';
if (empty($email)) {
    $errors['email'] = 'Champ requis';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors['email'] = 'Adresse e-mail invalide';
}
if (strlen($message) < 5) $errors['message'] = 'Champ requis';

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(['errors' => $errors, 'message' => 'Veuillez corriger les champs indiqués.']);
    exit;
}

$to = 'contact@momentdart.be';

function e(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// ── Email vers Moment D.Art ──────────────────────────────────────────────
$subject_in = '=?UTF-8?B?' . base64_encode('[Contact] Message de ' . $nom) . '?=';

$html_in = '<!DOCTYPE html><html lang="fr"><body style="font-family:sans-serif;color:#241d17;max-width:600px;margin:auto;padding:2rem">'
    . '<h2 style="color:#7A5C3E">Nouveau message de contact</h2>'
    . '<table cellpadding="8" cellspacing="0" border="0" style="width:100%">'
    . '<tr><td style="width:110px"><strong>Nom</strong></td><td>' . e($nom) . '</td></tr>'
    . '<tr><td><strong>E-mail</strong></td><td><a href="mailto:' . e($email) . '">' . e($email) . '</a></td></tr>'
    . '</table>'
    . '<h3 style="margin-top:1.5rem">Message</h3>'
    . '<p style="white-space:pre-wrap;background:#f7f3ec;padding:1rem;border-radius:8px">' . e($message) . '</p>'
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

echo json_encode(['message' => 'Votre message a bien été envoyé. Nous vous répondrons rapidement.']);
