import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { toDate, ymd } from '../common/normalize.js';
import { SHOP_TZ, shopDate } from '../common/tz.js';
import {
  AppointmentStatus,
  Channel,
  type Client,
  ContactPref,
  MessageKind,
  MessageStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { toGsm } from '../common/gsm.js';
import { sendEmail, sendSms } from './transports.js';

/** Mensajes de seguimiento/marketing: se respeta la baja. */
const MARKETING: MessageKind[] = [
  MessageKind.exam_reminder,
  MessageKind.exam_reminder_2,
  MessageKind.welcome,
  MessageKind.birthday,
  MessageKind.campaign,
];

/** Si no se le puede escribir, van a la lista «por llamar». */
const CALL_FALLBACK: MessageKind[] = [
  MessageKind.exam_reminder,
  MessageKind.exam_reminder_2,
  MessageKind.ready,
];

const SUBJECTS: Partial<Record<MessageKind, string>> = {
  exam_reminder: 'Es hora de su revisión de la vista',
  exam_reminder_2: 'Su revisión de la vista sigue pendiente',
  appt_confirmation: 'Su cita está confirmada',
  appt_reminder: 'Recordatorio de su cita',
  ready: 'Sus lentes están listos',
  welcome: 'Gracias por su visita',
  birthday: '¡Feliz cumpleaños!',
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('es-US', { timeZone: SHOP_TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString('es-US', { timeZone: SHOP_TZ, hour: 'numeric', minute: '2-digit' });

const shopHour = (d = new Date()) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TZ, hour: 'numeric', hourCycle: 'h23' }).format(d));

export interface EnqueueInput {
  client: Client;
  kind: MessageKind;
  /** Evita repetir el mismo aviso (p. ej. `exam:<cliente>:<fecha examen>`). */
  dedupeKey?: string;
  vars?: Record<string, string>;
  /** Texto propio (campañas); si no, la plantilla del tipo. */
  body?: string;
  subject?: string;
  campaignId?: string;
}

@Injectable()
export class MessagesService {
  private readonly log = new Logger(MessagesService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────── Canal y texto ─────────────

  /** Canal por el que se le puede escribir, o el motivo por el que no. */
  channelFor(client: Client, kind: MessageKind): { channel: Channel; to: string | null } | { skip: string } {
    if (MARKETING.includes(kind) && client.unsubscribedAt) return { skip: 'El cliente se dio de baja' };
    const sms = client.phone && client.smsConsentAt ? client.phone : null;
    // El correo de servicio (cita, lentes listos) no necesita consentimiento de marketing.
    const email = client.email && (client.emailConsentAt || !MARKETING.includes(kind)) ? client.email : null;
    const order: Channel[] =
      client.contactPref === ContactPref.email ? [Channel.email, Channel.sms]
        : client.contactPref === ContactPref.sms ? [Channel.sms, Channel.email]
          : [];
    for (const ch of order) {
      if (ch === Channel.sms && sms) return { channel: ch, to: sms };
      if (ch === Channel.email && email) return { channel: ch, to: email };
    }
    if (CALL_FALLBACK.includes(kind) && client.phone && client.contactPref !== ContactPref.none) {
      return { channel: Channel.call, to: client.phone };
    }
    return { skip: client.contactPref === ContactPref.none ? 'No quiere avisos' : 'Sin teléfono o correo con permiso' };
  }

  async render(template: string, client: Client, vars: Record<string, string> = {}) {
    const { business, messages } = await this.settings.all();
    const all: Record<string, string> = {
      nombre: client.firstName,
      optica: messages.signature || business.name,
      telefono: business.phone,
      resena: business.googleReviewUrl,
      ...vars,
    };
    return template.replace(/\{(\w+)\}/g, (m, k: string) => all[k] ?? m);
  }

  /** Crea el mensaje (o lo marca como no enviado y por qué). Idempotente con `dedupeKey`. */
  async enqueue(input: EnqueueInput) {
    const { client, kind } = input;
    const { messages } = await this.settings.all();
    const target = this.channelFor(client, kind);
    const template = input.body ?? messages.templates[kind] ?? '';
    const body = await this.render(template, client, input.vars);
    const subject = input.subject ?? SUBJECTS[kind] ?? null;
    try {
      return await this.prisma.message.create({
        data: {
          clientId: client.id,
          kind,
          dedupeKey: input.dedupeKey,
          campaignId: input.campaignId,
          body,
          subject,
          ...('skip' in target
            ? { channel: Channel.sms, status: MessageStatus.skipped, error: target.skip }
            : { channel: target.channel, to: target.to }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null; // ya enviado
      throw e;
    }
  }

  private isEnabled(kind: string, enabled: Record<string, boolean>) {
    const k = kind === 'exam_reminder_2' ? 'exam_reminder' : kind;
    return enabled[k] !== false;
  }

  // ───────────── Disparadores ─────────────

  async readyNotice(visitId: string) {
    const { messages } = await this.settings.all();
    if (!this.isEnabled('ready', messages.enabled)) return;
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId }, include: { client: true } });
    if (!visit) return;
    await this.enqueue({ client: visit.client, kind: MessageKind.ready, dedupeKey: `ready:${visit.id}` });
    await this.flush();
  }

  async appointmentConfirmation(appointmentId: string) {
    const { messages } = await this.settings.all();
    if (!this.isEnabled('appt_confirmation', messages.enabled)) return;
    const a = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { client: true } });
    if (!a) return;
    const m = await this.enqueue({
      client: a.client,
      kind: MessageKind.appt_confirmation,
      // Si se mueve la cita, se confirma la nueva hora.
      dedupeKey: `apptc:${a.id}:${a.startsAt.toISOString()}`,
      vars: { fecha: fmtDate(a.startsAt), hora: fmtTime(a.startsAt) },
    });
    if (m) await this.prisma.appointment.update({ where: { id: a.id }, data: { confirmationSentAt: new Date() } });
    await this.flush();
  }

  /** Recordatorio 24 h antes, para citas de entre 20 y 28 horas desde ahora. */
  async appointmentReminders() {
    const now = Date.now();
    const appts = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed] },
        startsAt: { gte: new Date(now + 20 * 3_600_000), lte: new Date(now + 28 * 3_600_000) },
        reminderSentAt: null,
        client: { deletedAt: null, mergedIntoId: null },
      },
      include: { client: true },
    });
    for (const a of appts) {
      await this.enqueue({
        client: a.client,
        kind: MessageKind.appt_reminder,
        dedupeKey: `apptr:${a.id}:${a.startsAt.toISOString()}`,
        vars: { fecha: fmtDate(a.startsAt), hora: fmtTime(a.startsAt) },
      });
      await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: new Date() } });
    }
    return appts.length;
  }

  /** Clientes sin cita futura (si ya pidieron cita, no se les recuerda). */
  private noFutureAppointment(): Prisma.ClientWhereInput {
    return {
      appointments: {
        none: {
          startsAt: { gte: new Date() },
          status: { in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed] },
        },
      },
    };
  }

  /** Revisión anual (y segundo aviso), bienvenida y cumpleaños. Idempotente. */
  async dailyFollowUps() {
    const { messages, secondReminderDays } = await this.settings.all();
    const todayYmd = shopDate();
    const today = toDate(todayYmd)!;
    const alive = { deletedAt: null, mergedIntoId: null };
    let count = 0;

    if (this.isEnabled('exam_reminder', messages.enabled)) {
      // Solo los vencidos en los últimos 60 días: una importación antigua no dispara cientos de avisos.
      const due = await this.prisma.client.findMany({
        where: {
          ...alive,
          ...this.noFutureAppointment(),
          nextExamDue: { lte: today, gte: new Date(today.getTime() - 60 * 86_400_000) },
        },
      });
      for (const c of due) {
        if (await this.enqueue({ client: c, kind: MessageKind.exam_reminder, dedupeKey: `exam:${c.id}:${ymd(c.lastExamAt)}` })) count++;
      }

      if (secondReminderDays > 0) {
        const firsts = await this.prisma.message.findMany({
          where: {
            kind: MessageKind.exam_reminder,
            status: { in: [MessageStatus.sent, MessageStatus.delivered, MessageStatus.done] },
            createdAt: { lte: new Date(Date.now() - secondReminderDays * 86_400_000) },
            client: { ...alive, ...this.noFutureAppointment(), nextExamDue: { lte: today } },
          },
          include: { client: true },
        });
        for (const m of firsts) {
          const c = m.client!;
          // Solo si sigue pendiente el mismo examen del primer aviso.
          if (m.dedupeKey !== `exam:${c.id}:${ymd(c.lastExamAt)}`) continue;
          if (await this.enqueue({ client: c, kind: MessageKind.exam_reminder_2, dedupeKey: `exam2:${c.id}:${ymd(c.lastExamAt)}` })) count++;
        }
      }
    }

    if (this.isEnabled('welcome', messages.enabled)) {
      const fresh = await this.prisma.client.findMany({
        where: { ...alive, firstVisitAt: { gte: new Date(Date.now() - 3 * 86_400_000), lte: new Date(Date.now() - 3_600_000) } },
      });
      for (const c of fresh) {
        if (await this.enqueue({ client: c, kind: MessageKind.welcome, dedupeKey: `welcome:${c.id}` })) count++;
      }
    }

    if (this.isEnabled('birthday', messages.enabled)) {
      const [, mm, dd] = todayYmd.split('-').map(Number);
      const ids = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Client"
        WHERE "deletedAt" IS NULL AND "mergedIntoId" IS NULL AND "birthDate" IS NOT NULL
          AND EXTRACT(MONTH FROM "birthDate") = ${mm} AND EXTRACT(DAY FROM "birthDate") = ${dd}`;
      const people = await this.prisma.client.findMany({ where: { id: { in: ids.map((r) => r.id) } } });
      for (const c of people) {
        if (await this.enqueue({ client: c, kind: MessageKind.birthday, dedupeKey: `bday:${c.id}:${todayYmd.slice(0, 4)}` })) count++;
      }
    }
    return count;
  }

  // ───────────── Envío ─────────────

  /** Envía lo que está en cola, solo dentro del horario de envío de la tienda. */
  async flush(force = false) {
    const { messages, business } = await this.settings.all();
    const hour = shopHour();
    if (!force && (hour < messages.sendFromHour || hour >= messages.sendToHour)) return 0;
    const queued = await this.prisma.message.findMany({
      where: { status: MessageStatus.queued, channel: { in: [Channel.email, Channel.sms] } },
      include: { client: { select: { unsubscribedAt: true, deletedAt: true } } },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });
    for (const m of queued) {
      // Reserva atómica: si otro envío ya lo tomó, se salta (sin SMS duplicados).
      const claimed = await this.prisma.message.updateMany({
        where: { id: m.id, status: MessageStatus.queued },
        data: { status: MessageStatus.sent, sentAt: new Date() },
      });
      if (!claimed.count) continue;
      // Pudo darse de baja (o borrarse la ficha) mientras esperaba en cola.
      if (m.client && (m.client.deletedAt || (MARKETING.includes(m.kind) && m.client.unsubscribedAt))) {
        await this.prisma.message.update({
          where: { id: m.id },
          data: { status: MessageStatus.skipped, sentAt: null, error: 'Se dio de baja antes del envío' },
        });
        continue;
      }
      const smsText = MARKETING.includes(m.kind) ? `${m.body} Resp. STOP para darse de baja.` : m.body;
      const smsBody = messages.smsPlainText ? toGsm(smsText) : smsText;
      const res =
        m.channel === Channel.sms
          ? await sendSms(m.to!, smsBody)
          : await sendEmail(m.to!, m.subject ?? business.name, m.body, this.emailFooter(m.clientId, business.name));
      await this.prisma.message.update({
        where: { id: m.id },
        data: res.ok
          ? {
              status: MessageStatus.sent,
              sentAt: new Date(),
              providerId: res.providerId ?? null,
              // Se guarda el texto tal como lo recibió el cliente.
              ...(m.channel === Channel.sms ? { body: smsBody } : {}),
              error: res.dryRun ? 'Modo prueba: sin proveedor configurado' : null,
            }
          : { status: MessageStatus.failed, error: res.error?.slice(0, 500) },
      });
    }
    return queued.length;
  }

  private emailFooter(clientId: string | null, name: string) {
    const base = process.env.PUBLIC_API_URL ?? 'http://localhost:4000';
    if (!clientId) return name;
    return `${name}\nPara no recibir más correos: ${base}/v1/public/unsubscribe/${clientId}/${this.unsubscribeSig(clientId)}`;
  }

  unsubscribeSig(clientId: string) {
    return createHmac('sha256', process.env.APP_SECRET ?? 'dev-secret').update(clientId).digest('base64url').slice(0, 22);
  }

  async unsubscribe(clientId: string, sig: string) {
    const expected = Buffer.from(this.unsubscribeSig(clientId));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) throw new NotFoundException();
    await this.prisma.client.updateMany({
      where: { id: clientId, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { entity: 'client', entityId: clientId, action: 'update', changes: { unsubscribedAt: { from: null, to: 'enlace del correo' } } },
    });
  }

  /** Envía la cola entera por tandas (campañas grandes), sin solaparse con el reloj. */
  async flushAll() {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < 50; i++) {
        if (!(await this.flush())) break;
      }
    } catch (e) {
      this.log.error(e);
    } finally {
      this.running = false;
    }
  }

  /** Cada 10 minutos: seguimiento diario (idempotente), recordatorios de cita y envío. */
  @Cron(CronExpression.EVERY_10_MINUTES, { disabled: process.env.DISABLE_CRON === 'true' })
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const { messages } = await this.settings.all();
      if (shopHour() >= messages.sendFromHour) await this.dailyFollowUps();
      await this.appointmentReminders();
      for (let i = 0; i < 50; i++) {
        if (!(await this.flush())) break;
      }
    } catch (e) {
      this.log.error(e);
    } finally {
      this.running = false;
    }
  }

  // ───────────── Lista «por llamar» y registro ─────────────

  /** Avisos pendientes de llamar, solo de los clientes que `visible` deja ver. */
  async callList(visible: Prisma.ClientWhereInput) {
    const rows = await this.prisma.message.findMany({
      where: { channel: Channel.call, status: MessageStatus.queued, client: visible },
      include: { client: { select: { id: true, firstName: true, lastName: true, phone: true, lastExamAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      createdAt: m.createdAt,
      body: m.body,
      client: { ...m.client!, lastExamAt: ymd(m.client!.lastExamAt) },
    }));
  }

  async markCalled(id: string, outcome: string | undefined, visible: Prisma.ClientWhereInput) {
    const done = await this.prisma.message.updateMany({
      where: { id, channel: Channel.call, status: MessageStatus.queued, client: visible },
      data: { status: MessageStatus.done, sentAt: new Date(), error: outcome ?? null },
    });
    if (!done.count) throw new NotFoundException('Llamada no encontrada');
  }

  async recent(limit = 100) {
    return this.prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}

