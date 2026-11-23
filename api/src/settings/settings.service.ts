import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_PERMISSIONS,
  OWNER_ONLY,
  type OwnerOnly,
  type Permission,
  PERMISSIONS,
} from '../common/permissions.js';

/** Ajustes con sus valores por defecto. */
export const DEFAULT_SETTINGS = {
  business: {
    name: 'Mi Óptica',
    phone: '',
    email: '',
    address: '',
    website: '',
    googleReviewUrl: '',
  },
  /** Meses entre el último examen y el recordatorio de revisión. */
  examReminderMonths: 12,
  /** Días tras el primer aviso para el segundo, si no pidió cita (0 = sin segundo aviso). */
  secondReminderDays: 15,
  /** Duración por defecto de una cita (minutos). */
  appointmentMinutes: 30,
  /** Mensajes automáticos: cuáles están activos, horario de envío y textos. */
  messages: {
    enabled: {
      exam_reminder: true,
      appt_confirmation: true,
      appt_reminder: true,
      ready: true,
      welcome: true,
      birthday: true,
    } as Record<string, boolean>,
    /** Ventana de envío en hora local de la tienda (los avisos fuera de ella esperan). */
    sendFromHour: 9,
    /** SMS sin tildes (GSM-7): 160 caracteres por SMS en vez de 70. El correo las conserva. */
    smsPlainText: true,
    sendToHour: 20,
    signature: 'Mi Óptica',
    /** Textos con variables {nombre}, {optica}, {fecha}, {hora}, {telefono}, {resena}. */
    templates: {
      exam_reminder: 'Hola {nombre}, ya le toca su revisión de la vista en {optica}. ¿Le damos cita? Llame al {telefono}.',
      exam_reminder_2: 'Hola {nombre}, su revisión de la vista en {optica} sigue pendiente. Pida su cita al {telefono}.',
      appt_confirmation: 'Hola {nombre}, su cita en {optica} es el {fecha} a las {hora}. Para cambiarla llame al {telefono}.',
      appt_reminder: 'Hola {nombre}, le recordamos su cita mañana {fecha} a las {hora} en {optica}.',
      ready: 'Hola {nombre}, ¡sus lentes ya están listos! Puede pasar a recogerlos en {optica}.',
      welcome: 'Hola {nombre}, gracias por visitarnos en {optica}. Para lo que necesite, estamos al {telefono}.',
      birthday: '¡Feliz cumpleaños, {nombre}! Todo el equipo de {optica} le desea un gran día.',
    } as Record<string, string>,
  },
  /** Sobrescribe DEFAULT_PERMISSIONS: { 'clients.export': ['reception'] } */
  permissions: {} as Partial<Record<Permission, Role[]>>,
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

const CACHE_MS = 30_000;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Lo guardado sobre los valores por defecto, objeto a objeto (los defaults nuevos aparecen solos). */
function deepMerge(def: unknown, saved: unknown): unknown {
  if (!isObj(def) || !isObj(saved)) return saved;
  const out: Record<string, unknown> = { ...def };
  for (const [k, v] of Object.entries(saved)) out[k] = deepMerge(def[k], v);
  return out;
}

@Injectable()
export class SettingsService {
  private cache?: { at: number; value: Settings };

  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<Settings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.value;
    }
    const rows = await this.prisma.setting.findMany();
    const value = structuredClone(DEFAULT_SETTINGS) as Settings;
    for (const r of rows) {
      if (r.key in value) {
        const def = (DEFAULT_SETTINGS as Record<string, unknown>)[r.key];
        (value as Record<string, unknown>)[r.key] = deepMerge(def, r.value);
      }
    }
    this.cache = { at: Date.now(), value };
    return value;
  }

  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    return (await this.all())[key];
  }

  async set<K extends SettingKey>(key: K, value: Settings[K]) {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue },
      update: { value: value as Prisma.InputJsonValue },
    });
    this.cache = undefined;
    if (key === 'examReminderMonths') await this.recomputeExamDue(value as number);
  }

  /** Al cambiar los meses de revisión se mueve la próxima revisión de todos los clientes. */
  private recomputeExamDue(months: number) {
    return this.prisma.$executeRaw`
      UPDATE "Client"
      SET "nextExamDue" = ("lastExamAt" + make_interval(months => ${months}::int))::date
      WHERE "lastExamAt" IS NOT NULL`;
  }

  /** Permisos efectivos por rol (defaults + ajustes de la óptica). */
  async permissions(): Promise<Record<Permission, Role[]>> {
    const overrides = await this.get('permissions');
    return Object.fromEntries(
      PERMISSIONS.map((p) => [p, overrides[p] ?? DEFAULT_PERMISSIONS[p]]),
    ) as Record<Permission, Role[]>;
  }

  async can(role: Role, perm: Permission | OwnerOnly): Promise<boolean> {
    if (role === Role.owner) return true;
    if ((OWNER_ONLY as readonly string[]).includes(perm)) return false;
    return (await this.permissions())[perm as Permission].includes(role);
  }

  /** Lista de permisos que tiene un rol, para que la app muestre u oculte cosas. */
  async grantsFor(role: Role): Promise<string[]> {
    if (role === Role.owner) return [...PERMISSIONS, ...OWNER_ONLY];
    const perms = await this.permissions();
    return PERMISSIONS.filter((p) => perms[p].includes(role));
  }
}
