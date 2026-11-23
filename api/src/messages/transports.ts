import { Logger } from '@nestjs/common';

export interface SendResult {
  ok: boolean;
  error?: string;
  /** Modo prueba: no se envió de verdad (faltan claves del proveedor). */
  dryRun?: boolean;
}

const log = new Logger('Messages');

/** Correo con Resend (https://resend.com). Sin RESEND_API_KEY: modo prueba. */
export async function sendEmail(to: string, subject: string, text: string, footer: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    log.log(`[prueba] correo a ${to}: ${subject} — ${text}`);
    return { ok: true, dryRun: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: `${text}\n\n${footer}` }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
}

/** SMS con Twilio. Sin TWILIO_*: modo prueba. */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM; // número o Messaging Service SID (MG…)
  if (!sid || !token || !from) {
    log.log(`[prueba] SMS a +${to}: ${body}`);
    return { ok: true, dryRun: true };
  }
  const params = new URLSearchParams({ To: `+${to}`, Body: body });
  params.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  return res.ok ? { ok: true } : { ok: false, error: `Twilio ${res.status}: ${await res.text()}` };
}
