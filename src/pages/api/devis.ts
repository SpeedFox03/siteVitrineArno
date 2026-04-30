import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const prerender = false;

const requests = new Map<string, { count: number; resetAt: number }>();

const cleanString = (value: unknown) =>
  String(value ?? '')
    .replace(/\0/g, '')
    .trim();

const baseSchema = z.object({
  formType: z.enum(['prive', 'pro']),
  email: z.string().trim().email('Adresse e-mail invalide').max(160),
  adresse: z.string().trim().min(3, 'Champ requis').max(200),
  intitule: z.string().trim().min(3, 'Champ requis').max(140),
  details: z.string().trim().min(10, 'Champ requis').max(4000),
  website: z.string().trim().max(0).optional().or(z.literal(''))
});

const privateSchema = baseSchema.extend({
  formType: z.literal('prive'),
  prenom: z.string().trim().min(2, 'Champ requis').max(80),
  nom: z.string().trim().min(2, 'Champ requis').max(80)
});

const proSchema = baseSchema.extend({
  formType: z.literal('pro'),
  societe: z.string().trim().min(2, 'Champ requis').max(140),
  tva: z
    .string()
    .trim()
    .min(8, 'Numéro de TVA invalide')
    .max(32, 'Numéro de TVA invalide')
    .regex(/^[A-Za-z]{2}?[0-9.\s-]{8,20}$/, 'Numéro de TVA invalide')
});

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
};

const checkRateLimit = (ip: string) => {
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count += 1;
  return true;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const fieldErrorMap = (issues: z.ZodIssue[]) => {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }

  return errors;
};

const SMTP_HOST = import.meta.env.SMTP_HOST;
const SMTP_PORT = Number(import.meta.env.SMTP_PORT || 587);
const SMTP_USER = import.meta.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS;
const DEVIS_FROM_EMAIL = import.meta.env.DEVIS_FROM_EMAIL;
const DEVIS_TO_EMAIL = import.meta.env.DEVIS_TO_EMAIL;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !DEVIS_FROM_EMAIL || !DEVIS_TO_EMAIL) {
  console.warn('Variables SMTP manquantes : vérifiez votre fichier .env');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);

    if (origin && new URL(origin).host !== url.host) {
      return new Response(
        JSON.stringify({ message: 'Requête non autorisée.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ip = getClientIp(request);

    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ message: 'Trop de tentatives. Réessayez plus tard.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await request.formData();

    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, cleanString(value)])
    );

    if (payload.website) {
      return new Response(
        JSON.stringify({ message: 'Requête refusée.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const schema = payload.formType === 'pro' ? proSchema : privateSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          message: 'Certains champs sont invalides.',
          errors: fieldErrorMap(parsed.error.issues)
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !DEVIS_FROM_EMAIL || !DEVIS_TO_EMAIL) {
      return new Response(
        JSON.stringify({
          message: "Configuration e-mail incomplète sur le serveur."
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data;

    const subjectPrefix = data.formType === 'pro' ? '[Devis pro]' : '[Devis privé]';
    const subject = `${subjectPrefix} ${data.intitule}`;

    const text =
      data.formType === 'pro'
        ? [
            'Nouvelle demande de devis — Professionnel',
            '',
            `Société : ${data.societe}`,
            `TVA : ${data.tva}`,
            `E-mail : ${data.email}`,
            `Adresse : ${data.adresse}`,
            `Intitulé : ${data.intitule}`,
            '',
            'Détails :',
            data.details
          ].join('\n')
        : [
            'Nouvelle demande de devis — Privé',
            '',
            `Prénom : ${data.prenom}`,
            `Nom : ${data.nom}`,
            `E-mail : ${data.email}`,
            `Adresse : ${data.adresse}`,
            `Intitulé : ${data.intitule}`,
            '',
            'Détails :',
            data.details
          ].join('\n');

    const html =
      data.formType === 'pro'
        ? `
          <h2>Nouvelle demande de devis — Professionnel</h2>
          <table cellpadding="8" cellspacing="0" border="0">
            <tr><td><strong>Société</strong></td><td>${escapeHtml(data.societe)}</td></tr>
            <tr><td><strong>TVA</strong></td><td>${escapeHtml(data.tva)}</td></tr>
            <tr><td><strong>E-mail</strong></td><td>${escapeHtml(data.email)}</td></tr>
            <tr><td><strong>Adresse</strong></td><td>${escapeHtml(data.adresse)}</td></tr>
            <tr><td><strong>Intitulé</strong></td><td>${escapeHtml(data.intitule)}</td></tr>
          </table>
          <h3>Détails</h3>
          <p>${escapeHtml(data.details).replaceAll('\n', '<br>')}</p>
        `
        : `
          <h2>Nouvelle demande de devis — Privé</h2>
          <table cellpadding="8" cellspacing="0" border="0">
            <tr><td><strong>Prénom</strong></td><td>${escapeHtml(data.prenom)}</td></tr>
            <tr><td><strong>Nom</strong></td><td>${escapeHtml(data.nom)}</td></tr>
            <tr><td><strong>E-mail</strong></td><td>${escapeHtml(data.email)}</td></tr>
            <tr><td><strong>Adresse</strong></td><td>${escapeHtml(data.adresse)}</td></tr>
            <tr><td><strong>Intitulé</strong></td><td>${escapeHtml(data.intitule)}</td></tr>
          </table>
          <h3>Détails</h3>
          <p>${escapeHtml(data.details).replaceAll('\n', '<br>')}</p>
        `;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // port 587 = STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Moment D.Art - Devis" <${DEVIS_FROM_EMAIL}>`,
      to: DEVIS_TO_EMAIL,
      replyTo: data.email,
      subject,
      text,
      html
    });

    const clientName = data.formType === 'pro' ? data.societe : `${data.prenom} ${data.nom}`;
    const confirmSubject = `Votre demande de devis a bien été reçue — Moment D.Art`;
    const confirmText = [
      `Bonjour ${clientName},`,
      '',
      `Nous avons bien reçu votre demande de devis concernant : ${data.intitule}`,
      '',
      'Arno Momin vous recontactera dans les plus brefs délais.',
      '',
      'Moment D.Art · Arno Momin · Rue des Moges · 4120 Neupré'
    ].join('\n');
    const confirmHtml = `
      <p>Bonjour ${escapeHtml(clientName)},</p>
      <p>Nous avons bien reçu votre demande de devis concernant : <strong>${escapeHtml(data.intitule)}</strong>.</p>
      <p>Arno Momin vous recontactera dans les plus brefs délais.</p>
      <hr style="border:none;border-top:1px solid #e0d9cf;margin:1.5rem 0">
      <p style="color:#7a6b5e;font-size:0.88rem">Moment D.Art · Arno Momin · Rue des Moges · 4120 Neupré</p>
    `;

    await transporter.sendMail({
      from: `"Moment D.Art" <${DEVIS_FROM_EMAIL}>`,
      to: data.email,
      subject: confirmSubject,
      text: confirmText,
      html: confirmHtml
    });

    return new Response(
      JSON.stringify({
        message: 'Votre demande a bien été envoyée.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ERREUR API DEVIS :', error);

    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : 'Impossible de traiter la demande.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};