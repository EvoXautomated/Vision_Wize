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

const SVIX_TOLERANCE_S = 300;

/**
 * Firma de los webhooks de Resend (Svix): HMAC-SHA256 en base64 de
 * `id.timestamp.cuerpo` con el secreto `whsec_…` (base64). La cabecera puede
 * traer varias firmas `v1,<firma>` separadas por espacios, y el aviso caduca
 * a los 5 minutos para que no se pueda reenviar uno antiguo.
 */
export function validSvixSignature(
  rawBody: Buffer | undefined,
  id: string | undefined,
  timestamp: string | undefined,
  signature: string | undefined,
  now = Date.now(),
) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !rawBody || !id || !timestamp || !signature) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now / 1000 - sentAt) > SVIX_TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody.toString('utf8')}`).digest();
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const got = Buffer.from(value, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
