import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SendResult {
  ok: boolean;
  error?: string;
  /** Id del mensaje en el proveedor, para enlazar los avisos de entrega. */
  providerId?: string;
  /** Modo prueba: no se envió de verdad (faltan claves del proveedor). */
  dryRun?: boolean;
}

const log = new Logger('Messages');

/** Correo con Resend (https://resend.com). Sin RESEND_API_KEY: modo prueba. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  footer: string,
  /** Enlace de baja: añade las cabeceras de baja con un clic (RFC 8058). */
  unsubscribeUrl?: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    log.log(`[prueba] correo a ${to}: ${subject} — ${text}`);
    return { ok: true, dryRun: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: `${text}\n\n${footer}`,
      ...(unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {}),
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, providerId: data.id };
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
  // Twilio avisa de la entrega (delivered/undelivered) a esta URL pública.
  if (process.env.PUBLIC_API_URL?.startsWith('https://')) {
    params.set('StatusCallback', `${process.env.PUBLIC_API_URL}/v1/public/twilio/status`);
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${await res.text()}` };
  const data = (await res.json().catch(() => ({}))) as { sid?: string };
  return { ok: true, providerId: data.sid };
}

/**
 * Firma X-Twilio-Signature: HMAC-SHA1 (base64) de la URL completa seguida de
 * los parámetros POST ordenados por nombre (clave+valor), con el auth token.
 */
export function validTwilioSignature(url: string, params: Record<string, string>, signature: string | undefined) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
