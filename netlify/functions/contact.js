import nodemailer from 'nodemailer';

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clean = (v) => String(v ?? '').replace(/\0/g, '').trim();

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
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Votre message a bien été envoyé.' }) };
  }

  const nom = clean(body.nom).slice(0, 120);
  const email = clean(body.email).slice(0, 160);
  const message = clean(body.message).slice(0, 2000);

  const errors = {};
  if (!nom) errors.nom = 'Champ requis';
  if (!email) errors.email = 'Champ requis';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Adresse e-mail invalide';
  if (!message) errors.message = 'Champ requis';

  if (Object.keys(errors).length > 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: 'Veuillez corriger les champs indiqués.', errors }),
    };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Moment D.Art — Site" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_TO_EMAIL ?? process.env.DEVIS_TO_EMAIL,
    replyTo: email,
    subject: `Contact — ${nom}`,
    text: `Nom : ${nom}\nE-mail : ${email}\n\n${message}`,
    html: `
      <p><strong>Nom :</strong> ${escapeHtml(nom)}</p>
      <p><strong>E-mail :</strong> ${escapeHtml(email)}</p>
      <hr>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `,
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Votre message a bien été envoyé.' }),
  };
};
