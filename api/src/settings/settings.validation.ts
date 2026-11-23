import { PERMISSIONS } from '../common/permissions.js';
import { Role } from '../generated/prisma/client.js';
import { DEFAULT_SETTINGS, type SettingKey } from './settings.service.js';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

/** Claves de `value` que no existen en `allowed`. */
const extra = (value: Record<string, unknown>, allowed: object) =>
  Object.keys(value).filter((k) => !(k in allowed));

const NUMBERS: Partial<Record<SettingKey, [number, number, string]>> = {
  examReminderMonths: [1, 60, 'Los meses de revisión deben ser un número entero entre 1 y 60'],
  secondReminderDays: [0, 365, 'Los días del segundo aviso deben ser un número entero entre 0 y 365'],
  appointmentMinutes: [5, 240, 'La duración de la cita debe estar entre 5 y 240 minutos'],
};

/** Devuelve el motivo por el que el ajuste no es válido, o null si lo es. */
export function settingError(key: string, value: unknown): string | null {
  if (!(key in DEFAULT_SETTINGS)) return `Ajuste desconocido: ${key}`;
  const range = NUMBERS[key as SettingKey];
  if (range) return int(value, range[0], range[1]) ? null : range[2];
  if (!isObj(value)) return `${key} debe ser un objeto`;

  if (key === 'business') {
    const unknown = extra(value, DEFAULT_SETTINGS.business);
    if (unknown.length) return `Dato de la óptica desconocido: ${unknown[0]}`;
    return Object.values(value).every((v) => text(v, 200)) ? null : 'Los datos de la óptica deben ser textos de hasta 200 caracteres';
  }

  if (key === 'permissions') {
    const roles = Object.values(Role) as string[];
    for (const [perm, list] of Object.entries(value)) {
      if (!(PERMISSIONS as string[]).includes(perm) || !Array.isArray(list) || list.some((r) => !roles.includes(r))) {
        return `Permiso no válido: ${perm}`;
      }
    }
    return null;
  }

  // messages
  const def = DEFAULT_SETTINGS.messages;
  const unknown = extra(value, def);
  if (unknown.length) return `Ajuste de mensajes desconocido: ${unknown[0]}`;
  const { enabled, sendFromHour, sendToHour, smsPlainText, signature, templates } = value;
  if (enabled !== undefined && (!isObj(enabled) || extra(enabled, def.enabled).length || Object.values(enabled).some((v) => typeof v !== 'boolean'))) {
    return 'Los mensajes activos no son válidos';
  }
  for (const hour of [sendFromHour, sendToHour]) {
    if (hour !== undefined && !int(hour, 0, 24)) return 'El horario de envío debe ir de 0 a 24 horas';
  }
  const from = (sendFromHour ?? def.sendFromHour) as number;
  const to = (sendToHour ?? def.sendToHour) as number;
  if (from >= to) return 'El horario de envío debe empezar antes de terminar';
  if (smsPlainText !== undefined && typeof smsPlainText !== 'boolean') return 'smsPlainText debe ser verdadero o falso';
  if (signature !== undefined && !text(signature, 60)) return 'La firma debe ser un texto de hasta 60 caracteres';
  if (templates !== undefined && (!isObj(templates) || extra(templates, def.templates).length || Object.values(templates).some((v) => !text(v, 1000)))) {
    return 'Las plantillas deben ser textos de hasta 1000 caracteres';
  }
  return null;
}
