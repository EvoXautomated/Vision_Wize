import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validSvixSignature } from './transports.js';

const key = Buffer.from('clave-de-prueba-para-el-webhook');
const secret = `whsec_${key.toString('base64')}`;
const body = Buffer.from('{"type":"email.delivered","data":{"email_id":"abc"}}');
const now = 1_800_000_000_000;
const ts = String(now / 1000);
const sign = (id: string, timestamp: string, raw: Buffer) =>
  `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${raw.toString()}`).digest('base64')}`;

describe('validSvixSignature (webhook de Resend)', () => {
  beforeEach(() => { process.env.RESEND_WEBHOOK_SECRET = secret; });
  afterEach(() => { delete process.env.RESEND_WEBHOOK_SECRET; });

  it('acepta una firma correcta, también entre varias', () => {
    expect(validSvixSignature(body, 'msg_1', ts, sign('msg_1', ts, body), now)).toBe(true);
    expect(validSvixSignature(body, 'msg_1', ts, `v1,AAAA ${sign('msg_1', ts, body)}`, now)).toBe(true);
  });
  it('rechaza un cuerpo cambiado, otro id o una firma ajena', () => {
    expect(validSvixSignature(Buffer.from('{}'), 'msg_1', ts, sign('msg_1', ts, body), now)).toBe(false);
    expect(validSvixSignature(body, 'msg_2', ts, sign('msg_1', ts, body), now)).toBe(false);
    expect(validSvixSignature(body, 'msg_1', ts, 'v1,AAAA', now)).toBe(false);
  });
  it('rechaza un aviso antiguo (reenvío)', () => {
    const old = String(now / 1000 - 600);
    expect(validSvixSignature(body, 'msg_1', old, sign('msg_1', old, body), now)).toBe(false);
  });
  it('sin secreto configurado no acepta nada', () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect(validSvixSignature(body, 'msg_1', ts, sign('msg_1', ts, body), now)).toBe(false);
  });
});
