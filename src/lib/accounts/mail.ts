/**
 * Invitation emails. Sent through Resend when RESEND_API_KEY and MAIL_FROM are set (e.g. MAIL_FROM =
 * "LabVerse <no-reply@your-domain>"); otherwise nothing is sent and the admin shares the link (copy / mailto).
 */
import { getSecret } from 'astro:env/server';
import { platform } from '@/site.config';

const env = (k: string) => getSecret(k) || undefined;
export const mailEnabled = () => Boolean(env('RESEND_API_KEY') && env('MAIL_FROM'));

export function inviteText(o: { name: string; module: string | null; role: string; link: string; from: string }) {
  const where = o.module ? `the ${o.module} module` : platform.name;
  return {
    subject: `${o.from} invited you to ${where} on ${platform.name}`,
    body: `Hi ${o.name || 'there'},\n\n${o.from} invited you to join ${where} on ${platform.name} as ${o.role}.\n\nOpen this link to set up your account (it works once and expires in 14 days):\n${o.link}\n\n— ${platform.name}`,
  };
}

/** true when the email was handed to the provider */
export async function sendMail(to: string, subject: string, body: string): Promise<boolean> {
  if (!mailEnabled()) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env('MAIL_FROM'), to: [to], subject, text: body }),
    });
    return r.ok;
  } catch (error) {
    console.error('[mail] send failed', error);
    return false;
  }
}
