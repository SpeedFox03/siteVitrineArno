import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const prerender = false;

const requests = new Map<string, { count: number; resetAt: number }>();

const cleanString = (value: unknown) =>
  String(value ?? '')
    .replace(/\0/g, '')
    .trim();

const contactSchema = z.object({
  nom: z.string().trim().min(2, 'Champ requis').max(120),
  email: z.string().trim().email('Adresse e-mail invalide').max(160),
  message: z.string().trim().min(5, 'Champ requis').max(2000),
  website: z.string().trim().max(0).optional().or(z.literal(''))
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

  if (entry.count >= 5) return false;

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

const SMTP_HOST = import.meta.env.SMTP_HOST;
const SMTP_PORT = Number(import.meta.env.SMTP_PORT || 587);
const SMTP_USER = import.meta.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS;
const DEVIS_FROM_EMAIL = import.meta.env.DEVIS_FROM_EMAIL;
const DEVIS_TO_EMAIL = import.meta.env.DEVIS_TO_EMAIL;

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

    const parsed = contactSchema.safeParse(payload);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !errors[key]) errors[key] = issue.message;
      }
      return new Response(
        JSON.stringify({ message: 'Certains champs sont invalides.', errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !DEVIS_FROM_EMAIL || !DEVIS_TO_EMAIL) {
      return new Response(
        JSON.stringify({ message: 'Configuration e-mail incomplète sur le serveur.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { nom, email, message } = parsed.data;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"Moment D.Art - Contact" <${DEVIS_FROM_EMAIL}>`,
      to: DEVIS_TO_EMAIL,
      replyTo: email,
      subject: `[Contact] Message de ${nom}`,
      text: [`Nouveau message de contact`, '', `Nom : ${nom}`, `E-mail : ${email}`, '', 'Message :', message].join('\n'),
      html: `
        <h2>Nouveau message de contact</h2>
        <table cellpadding="8" cellspacing="0" border="0">
          <tr><td><strong>Nom</strong></td><td>${escapeHtml(nom)}</td></tr>
          <tr><td><strong>E-mail</strong></td><td>${escapeHtml(email)}</td></tr>
        </table>
        <h3>Message</h3>
        <p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>
      `
    });

    return new Response(
      JSON.stringify({ message: 'Votre message a bien été envoyé. Nous vous répondrons rapidement.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ERREUR API CONTACT :', error);
    return new Response(
      JSON.stringify({ message: error instanceof Error ? error.message : 'Impossible de traiter la demande.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
