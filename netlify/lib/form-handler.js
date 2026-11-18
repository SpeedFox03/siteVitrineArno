import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import nodemailer from 'nodemailer';

const clean = (value) => typeof value === 'string' ? value.replace(/\0/g, '').trim() : '';
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
const validUUID = (value) => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export const openSubmissionStore = (env = process.env) => {
  const context = env.CONTEXT || 'dev';
  return getStore({
    name: context === 'production' ? 'form-submissions' : `form-submissions-${context}`,
    region: 'eu-central-1', consistency: 'strong',
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }),
  });
};

const validate = (kind, body) => {
  const errors = {};
  const fields = {};
  const required = (name, limit) => {
    fields[name] = clean(body[name]);
    if (!fields[name]) errors[name] = 'Champ requis';
    else if (fields[name].length > limit) errors[name] = `Maximum ${limit} caractères`;
  };
  if (kind === 'devis') {
    fields.formType = clean(body.formType);
    if (fields.formType === 'prive') {
      required('prenom', 80); required('nom', 80);
    } else if (fields.formType === 'pro') {
      required('societe', 140); required('tva', 32);
      if (fields.tva && !/^(?:[A-Za-z]{2})?[0-9.\s-]{8,20}$/.test(fields.tva)) errors.tva = 'Numéro de TVA invalide';
    } else {
      return { message: 'Type de formulaire invalide.' };
    }
    required('adresse', 200); required('intitule', 140); required('details', 4000);
  } else {
    required('nom', 120); required('message', 2000);
  }
  required('email', 160);
  if (fields.email && !validEmail(fields.email)) errors.email = 'Adresse e-mail invalide';
  return { fields, errors };
};

const smtpConfig = (kind, env) => {
  const host = clean(env.SMTP_HOST);
  const user = clean(env.SMTP_USER);
  const to = clean(kind === 'devis' ? env.DEVIS_TO_EMAIL : env.CONTACT_TO_EMAIL) || clean(env.DEVIS_TO_EMAIL);
  const port = Number(clean(env.SMTP_PORT) || 587);
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((key) => !clean(env[key]));
  if (!to) missing.push(kind === 'devis' ? 'DEVIS_TO_EMAIL' : 'CONTACT_TO_EMAIL (ou DEVIS_TO_EMAIL)');
  return {
    host, user, to, port, missing,
    invalidPort: !Number.isInteger(port) || port < 1 || port > 65535,
    invalidAddress: !validEmail(user) || !validEmail(to),
  };
};

const mailContent = (kind, fields, reference, config) => {
  const entries = kind === 'devis' ? [
    ['Type', fields.formType === 'prive' ? 'Privé' : 'Professionnel'],
    ...(fields.formType === 'prive'
      ? [['Prénom', fields.prenom], ['Nom', fields.nom]]
      : [['Société', fields.societe], ['TVA', fields.tva]]),
    ['E-mail', fields.email], ['Adresse', fields.adresse], ['Intitulé', fields.intitule],
  ] : [['Nom', fields.nom], ['E-mail', fields.email]];
  const details = kind === 'devis' ? fields.details : fields.message;
  const title = kind === 'devis' ? 'Demande de devis' : 'Message de contact';
  return {
    from: { name: 'Moment D.Art — Site', address: config.user },
    to: config.to, replyTo: fields.email,
    subject: `[${reference}] ${title}${kind === 'devis' ? ` [${fields.formType === 'prive' ? 'Privé' : 'Professionnel'}]` : ''}`,
    headers: { 'X-Momentdart-Reference': reference },
    text: [`Référence : ${reference}`, ...entries.map(([label, value]) => `${label} : ${value}`), '', details].join('\n'),
    html: `<p><strong>Référence :</strong> ${reference}</p>${entries.map(([label, value]) =>
      `<p><strong>${label} :</strong> ${escapeHtml(value)}</p>`).join('')}<hr><p>${escapeHtml(details).replace(/\n/g, '<br>')}</p>`,
  };
};

const savedResponse = (record) => {
  const accepted = record.notification.status === 'accepted';
  return json(accepted ? 200 : 202, {
    saved: true, reference: record.reference, notificationStatus: record.notification.status,
    message: accepted
      ? `Votre ${record.kind === 'devis' ? 'demande a bien été enregistrée' : 'message a bien été enregistré'}. Référence : ${record.reference}. Nous vous recontacterons dans les plus brefs délais.`
      : `Votre ${record.kind === 'devis' ? 'demande est enregistrée' : 'message est enregistré'} sous la référence ${record.reference}. Pour confirmer sa prise en charge, appelez Arno au +32 497 28 29 87 ou écrivez à contact@momentdart.be.`,
  });
};

// Inject dependencies so tests never use production storage or SMTP credentials.
export const createFormHandler = (kind, {
  env = process.env,
  openStore = () => openSubmissionStore(env),
  createTransport = (options) => nodemailer.createTransport(options),
  log = console,
} = {}) => async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Méthode non autorisée.' });
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}';
    if (Buffer.byteLength(raw) > 24000) return json(413, { message: 'La demande est trop volumineuse.' });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    if (Object.values(body).some((value) => typeof value !== 'string')) throw new Error('Invalid field');
  } catch {
    return json(400, { message: 'Requête invalide.' });
  }
  if (clean(body.website)) return json(200, { message: 'Votre demande a bien été envoyée.' });
  const { fields, errors, message } = validate(kind, body);
  if (message) return json(400, { message });
  if (Object.keys(errors).length) return json(400, { message: 'Veuillez corriger les champs indiqués.', errors });
  if (body.requestId !== undefined && !validUUID(body.requestId)) return json(400, { message: 'Référence de demande invalide.' });

  const reference = `${kind === 'devis' ? 'DEV' : 'CON'}-${(body.requestId || randomUUID()).toLowerCase()}`;
  const fingerprint = createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  const record = {
    reference, kind, receivedAt: new Date().toISOString(), fields, fingerprint,
    notification: { status: 'pending' },
  };
  let store;
  try {
    store = openStore(event);
    // Atomic creation prevents simultaneous clicks/retries from sending two e-mails.
    const { modified } = await store.setJSON(reference, record, { onlyIfNew: true });
    if (!modified) {
      const existing = await store.get(reference, { type: 'json' });
      if (!existing || existing.fingerprint !== fingerprint) {
        return json(409, { message: 'Cette référence est déjà utilisée pour une autre demande.' });
      }
      return savedResponse(existing);
    }
  } catch {
    log.error(`[${kind}] storage_failed`, { reference });
    return json(503, {
      saved: false, reference,
      message: `Impossible de confirmer l’enregistrement de votre demande. Votre saisie est conservée : réessayez ou contactez Arno au +32 497 28 29 87. Référence : ${reference}.`,
    });
  }
  log.info(`[${kind}] saved`, { reference, formType: fields.formType || 'contact' });

  let transporter;
  try {
    const config = smtpConfig(kind, env);
    if (config.missing.length || config.invalidPort || config.invalidAddress) {
      log.error(`[${kind}] Invalid SMTP configuration`, {
        reference, missing: config.missing, invalidPort: config.invalidPort, invalidAddress: config.invalidAddress,
      });
      record.notification = { status: 'failed', code: 'SMTP_CONFIG' };
    } else {
      transporter = createTransport({
        host: config.host, port: config.port, secure: config.port === 465,
        auth: { user: config.user, pass: env.SMTP_PASS },
        connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, dnsTimeout: 5000,
      });
      const info = await transporter.sendMail(mailContent(kind, fields, reference, config));
      const accepted = info.accepted?.some((recipient) =>
        clean(typeof recipient === 'string' ? recipient : recipient.address).toLowerCase() === config.to.toLowerCase());
      if (!accepted) throw Object.assign(new Error('Recipient not accepted'), { code: 'ERECIPIENT' });
      record.notification = { status: 'accepted', messageId: info.messageId };
      log.info(`[${kind}] smtp_accepted`, { reference, messageId: info.messageId });
    }
  } catch (error) {
    // Never log SMTP response text, message contents, addresses, or passwords.
    const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code) ? error.code : 'SMTP_ERROR';
    record.notification = { status: 'failed', code };
    log.error(`[${kind}] smtp_failed`, { reference, code });
  } finally {
    try { transporter?.close(); } catch { /* Preserve the saved outcome if cleanup fails. */ }
  }
  record.notification.updatedAt = new Date().toISOString();
  try {
    await store.setJSON(reference, record);
  } catch {
    // Original pending record stays recoverable; never send again automatically.
    log.error(`[${kind}] notification_status_save_failed`, { reference, status: record.notification.status });
  }
  return savedResponse(record);
};

// Native Netlify Request/Response functions receive the full Blobs runtime context.
export const createNetlifyHandler = (kind) => {
  const handler = createFormHandler(kind);
  return async (request) => {
    const result = await handler({ httpMethod: request.method, body: await request.text() });
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  };
};
