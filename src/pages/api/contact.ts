import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { cleanString, createRateLimiter, escapeHtml, fieldErrorMap, getClientIp, jsonResponse } from '../../utils/api';

export const prerender = false;

const rateLimiter = createRateLimiter();

const contactSchema = z.object({
  nom: z.string().trim().min(2, 'Champ requis').max(120),
  email: z.string().trim().email('Adresse e-mail invalide').max(160),
  message: z.string().trim().min(5, 'Champ requis').max(2000),
  website: z.string().trim().max(0).optional().or(z.literal(''))
});

const SMTP_HOST = import.meta.env.SMTP_HOST;
const SMTP_PORT = Number(import.meta.env.SMTP_PORT || 587);
const SMTP_USER = import.meta.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS;
const FROM_EMAIL = import.meta.env.DEVIS_FROM_EMAIL;
const TO_EMAIL = import.meta.env.DEVIS_TO_EMAIL;

export const POST: APIRoute = async ({ request }) => {
  try {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);

    if (origin && new URL(origin).host !== url.host) {
      return jsonResponse({ message: 'Requête non autorisée.' }, 403);
    }

    if (!rateLimiter(getClientIp(request))) {
      return jsonResponse({ message: 'Trop de tentatives. Réessayez plus tard.' }, 429);
    }

    const formData = await request.formData();
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, cleanString(value)])
    );

    if (payload.website) {
      return jsonResponse({ message: 'Requête refusée.' }, 400);
    }

    const parsed = contactSchema.safeParse(payload);

    if (!parsed.success) {
      return jsonResponse({
        message: 'Certains champs sont invalides.',
        errors: fieldErrorMap(parsed.error.issues)
      }, 400);
    }

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL || !TO_EMAIL) {
      return jsonResponse({ message: 'Configuration e-mail incomplète sur le serveur.' }, 500);
    }

    const { nom, email, message } = parsed.data;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });

    await transporter.sendMail({
      from: `"Moment D.Art - Contact" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      replyTo: email,
      subject: `[Contact] Message de ${nom}`,
      text: ['Nouveau message de contact', '', `Nom : ${nom}`, `E-mail : ${email}`, '', 'Message :', message].join('\n'),
      html: `<h2>Nouveau message de contact</h2><table cellpadding="8" cellspacing="0" border="0"><tr><td><strong>Nom</strong></td><td>${escapeHtml(nom)}</td></tr><tr><td><strong>E-mail</strong></td><td>${escapeHtml(email)}</td></tr></table><h3>Message</h3><p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>`
    });

    return jsonResponse({ message: 'Votre message a bien été envoyé. Nous vous répondrons rapidement.' }, 200);
  } catch (error) {
    console.error('ERREUR API CONTACT :', error);
    return jsonResponse({ message: 'Une erreur est survenue. Veuillez réessayer.' }, 500);
  }
};
