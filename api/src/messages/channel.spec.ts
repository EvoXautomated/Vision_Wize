import { describe, expect, it } from 'vitest';
import type { Client } from '../generated/prisma/client.js';
import { MessagesService } from './messages.service.js';

const service = new MessagesService(null as never, null as never);
const now = new Date();
const client = (patch: Partial<Client>) =>
  ({ phone: '13055550101', email: 'a@example.com', contactPref: 'sms', smsConsentAt: now, emailConsentAt: now, unsubscribedAt: null, ...patch }) as Client;

describe('channelFor', () => {
  it('usa el canal preferido si hay permiso', () => {
    expect(service.channelFor(client({}), 'exam_reminder')).toEqual({ channel: 'sms', to: '13055550101' });
    expect(service.channelFor(client({ contactPref: 'email' }), 'exam_reminder')).toEqual({ channel: 'email', to: 'a@example.com' });
  });
  it('sin permiso de SMS pasa al correo', () => {
    expect(service.channelFor(client({ smsConsentAt: null }), 'birthday')).toEqual({ channel: 'email', to: 'a@example.com' });
  });
  it('la baja corta el marketing pero no los avisos de servicio', () => {
    expect(service.channelFor(client({ unsubscribedAt: now }), 'campaign')).toHaveProperty('skip');
    expect(service.channelFor(client({ unsubscribedAt: now }), 'ready')).toEqual({ channel: 'sms', to: '13055550101' });
  });
  it('el correo de servicio no necesita permiso de marketing', () => {
    expect(service.channelFor(client({ contactPref: 'email', emailConsentAt: null }), 'appt_confirmation')).toEqual({ channel: 'email', to: 'a@example.com' });
    expect(service.channelFor(client({ contactPref: 'email', emailConsentAt: null, smsConsentAt: null }), 'welcome')).toHaveProperty('skip');
  });
  it('sin permiso de nada, la revisión va a la lista por llamar', () => {
    expect(service.channelFor(client({ smsConsentAt: null, emailConsentAt: null }), 'exam_reminder')).toEqual({ channel: 'call', to: '13055550101' });
  });
  it('quien no quiere avisos no recibe nada', () => {
    expect(service.channelFor(client({ contactPref: 'none' }), 'exam_reminder')).toEqual({ skip: 'No quiere avisos' });
    expect(service.channelFor(client({ contactPref: 'none' }), 'ready')).toHaveProperty('skip');
  });
});
