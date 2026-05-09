import nodemailer from 'nodemailer';

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clean = (v) => String(v ?? '').replace(/\0/g, '').trim();

const isValidVat = (v) => /^[A-Za-z]{2}?[0-9.\s-]{8,20}$/.test(v.trim());

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Requête invalide.' }) };
  }

  // Honeypot
  if (body.website) {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Votre demande a bien été envoyée.' }) };
  }

  const type = clean(body.formType);
  const email = clean(body.email).slice(0, 160);
  const adresse = clean(body.adresse).slice(0, 200);
  const intitule = clean(body.intitule).slice(0, 140);
  const details = clean(body.details).slice(0, 4000);

  const errors = {};

  if (type === 'prive') {
    const prenom = clean(body.prenom).slice(0, 80);
    const nom = clean(body.nom).slice(0, 80);
    if (!prenom) errors.prenom = 'Champ requis';
    if (!nom) errors.nom = 'Champ requis';
  } else if (type === 'pro') {
    const societe = clean(body.societe).slice(0, 140);
    const tva = clean(body.tva).slice(0, 32);
    if (!societe) errors.societe = 'Champ requis';
    if (!tva) errors.tva = 'Champ requis';
    else if (!isValidVat(tva)) errors.tva = 'Numéro de TVA invalide';
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'Type de formulaire invalide.' }) };
  }

  if (!email) errors.email = 'Champ requis';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Adresse e-mail invalide';
  if (!adresse) errors.adresse = 'Champ requis';
  if (!intitule) errors.intitule = 'Champ requis';
  if (!details) errors.details = 'Champ requis';

  if (Object.keys(errors).length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Veuillez corriger les champs indiqués.', errors }),
    };
  }

  const identite =
    type === 'prive'
      ? `${clean(body.prenom)} ${clean(body.nom)}`
      : `${clean(body.societe)} (TVA : ${clean(body.tva)})`;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const typeLabel = type === 'prive' ? 'Privé' : 'Professionnel';

  await transporter.sendMail({
    from: `"Moment D.Art — Site" <${process.env.SMTP_USER}>`,
    to: process.env.DEVIS_TO_EMAIL,
    replyTo: email,
    subject: `Demande de devis [${typeLabel}] — ${identite}`,
    text: [
      `Type : ${typeLabel}`,
      `Identité : ${identite}`,
      `E-mail : ${email}`,
      `Adresse : ${adresse}`,
      `Intitulé : ${intitule}`,
      '',
      details,
    ].join('\n'),
    html: `
      <p><strong>Type :</strong> ${escapeHtml(typeLabel)}</p>
      <p><strong>Identité :</strong> ${escapeHtml(identite)}</p>
      <p><strong>E-mail :</strong> ${escapeHtml(email)}</p>
      <p><strong>Adresse :</strong> ${escapeHtml(adresse)}</p>
      <p><strong>Intitulé :</strong> ${escapeHtml(intitule)}</p>
      <hr>
      <p>${escapeHtml(details).replace(/\n/g, '<br>')}</p>
    `,
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Votre demande a bien été envoyée.' }),
  };
};
