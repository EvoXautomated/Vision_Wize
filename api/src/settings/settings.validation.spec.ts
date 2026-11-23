import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings.service.js';
import { settingError } from './settings.validation.js';

describe('settingError', () => {
  it('acepta los valores por defecto', () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) expect(settingError(key, value)).toBeNull();
  });
  it.each([
    ['desconocido', 1],
    ['examReminderMonths', 0],
    ['examReminderMonths', 1.5],
    ['appointmentMinutes', '30'],
    ['business', { name: 'x', otro: 'y' }],
    ['business', { name: 5 }],
    ['messages', { sendFromHour: 20, sendToHour: 9 }],
    ['messages', { sendFromHour: '9' }],
    ['messages', { templates: { ready: 5 } }],
    ['messages', { templates: { inventada: 'hola' } }],
    ['messages', { enabled: { ready: 'sí' } }],
    ['permissions', { 'clients.export': ['jefe'] }],
    ['permissions', { 'users.manage': ['seller'] }],
  ])('rechaza %s = %j', (key, value) => expect(settingError(key, value)).toEqual(expect.any(String)));
  it('acepta permisos y mensajes parciales válidos', () => {
    expect(settingError('permissions', { 'clients.export': ['reception'] })).toBeNull();
    expect(settingError('messages', { signature: 'Vision Wize', sendFromHour: 10 })).toBeNull();
  });
});
