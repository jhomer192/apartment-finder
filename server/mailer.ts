import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from './config.js';

export class MailUnavailableError extends Error {}

let cached: Transporter | null = null;

function transporter(): Transporter {
  const smtp = config.smtp;
  if (!smtp) {
    throw new MailUnavailableError(
      'Email sign-in is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.',
    );
  }
  if (!cached) {
    cached = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }
  return cached;
}

export function mailConfigured(): boolean {
  return config.smtp !== null;
}

export async function sendSignInLink(email: string, url: string, expiresAt: number): Promise<void> {
  const expires = new Date(expiresAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  await transporter().sendMail({
    from: config.mailFrom,
    to: email,
    subject: 'Your Apartment Finder sign-in link',
    text: [
      'Sign in to Apartment Finder:',
      url,
      '',
      `This link works once and expires ${expires} PT.`,
      'If you did not request it, ignore this email — it cannot be used without opening it.',
    ].join('\n'),
    html: [
      '<p>Sign in to Apartment Finder:</p>',
      `<p><a href="${url}">${url}</a></p>`,
      `<p>This link works once and expires ${expires} PT.</p>`,
      '<p>If you did not request it, ignore this email — it cannot be used without opening it.</p>',
    ].join('\n'),
  });
}
