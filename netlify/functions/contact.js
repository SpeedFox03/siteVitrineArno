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
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
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

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim() || process.env.DEVIS_TO_EMAIL?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || 587);
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((key) => !process.env[key]?.trim());
  if (!to) missing.push('CONTACT_TO_EMAIL (ou DEVIS_TO_EMAIL)');
  const failure = {
    statusCode: 503,
    headers,
    body: JSON.stringify({ message: "L’envoi est momentanément indisponible. Contactez-nous directement à contact@momentdart.be." }),
  };

  if (missing.length || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('[contact] Invalid SMTP configuration', { missing, invalidPort: !Number.isInteger(port) || port < 1 || port > 65535 });
    return failure;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: process.env.SMTP_PASS },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      dnsTimeout: 5000,
    });

    await transporter.sendMail({
      from: { name: 'Moment D.Art — Site', address: user },
      to,
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
  } catch (error) {
    // Do not log SMTP responses or message contents: they may contain personal data.
    console.error('[contact] SMTP send failed', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
    });
    return failure;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: 'Votre message a bien été envoyé.' }),
  };
};
