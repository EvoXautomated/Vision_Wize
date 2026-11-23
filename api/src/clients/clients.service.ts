import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService, diff } from '../audit/audit.service.js';
import type { AuthUser } from '../common/decorators.js';
import {
  addMonths,
  fold,
  normalizeEmail,
  normalizePhone,
  toDate,
  ymd,
} from '../common/normalize.js';
import { shopDate } from '../common/tz.js';
import {
  ContactPref,
  Prisma,
  Role,
  VisitStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  CreateClientDto,
  DuplicatesQuery,
  ListClientsQuery,
  UpdateClientDto,
} from './clients.dto.js';

type Tx = Prisma.TransactionClient;

export const searchKeyOf = (first: string, last: string) => fold(`${first} ${last}`);

const clientInclude = {
  tags: { include: { tag: true } },
  seller: { select: { id: true, fullName: true, initials: true } },
} satisfies Prisma.ClientInclude;

type ClientRow = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

export const toClientJson = (c: ClientRow) => ({
  id: c.id,
  firstName: c.firstName,
  lastName: c.lastName,
  fullName: `${c.firstName} ${c.lastName}`.trim(),
  phone: c.phone,
  email: c.email,
  birthDate: ymd(c.birthDate),
  address: c.address,
  contactPref: c.contactPref,
  smsConsentAt: c.smsConsentAt,
  emailConsentAt: c.emailConsentAt,
  unsubscribedAt: c.unsubscribedAt,
  seller: c.seller,
  priorExamAt: ymd(c.priorExamAt),
  lastExamAt: ymd(c.lastExamAt),
  nextExamDue: ymd(c.nextExamDue),
  firstVisitAt: c.firstVisitAt,
  source: c.source,
  extra: c.extra,
  tags: c.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

/** Ficha de otra vendedora en un aviso de duplicado: nombre y vendedora, nada más. */
const restrictedJson = (c: ClientRow) => ({
  ...toClientJson(c),
  phone: null,
  email: null,
  birthDate: null,
  address: null,
  smsConsentAt: null,
  emailConsentAt: null,
  unsubscribedAt: null,
  priorExamAt: null,
  lastExamAt: null,
  nextExamDue: null,
  firstVisitAt: null,
  source: null,
  extra: {},
  tags: [],
  restricted: true,
});

/** Campos que se copian de la ficha unida si la ficha que queda no los tiene. */
const FILLABLE = [
  'phone',
  'email',
  'birthDate',
  'address',
  'sellerId',
  'source',
  'smsConsentAt',
  'emailConsentAt',
  'firstVisitAt',
] as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────── Visibilidad ─────────────

  /** Filtro de fichas visibles para el usuario (la vendedora sin permiso ve solo las suyas). */
  async visibleWhere(user: AuthUser): Promise<Prisma.ClientWhereInput> {
    const base = { deletedAt: null, mergedIntoId: null };
    if (!(await this.settings.can(user.role, 'clients.readAll'))) {
      return { ...base, sellerId: user.id };
    }
    return base;
  }

  async findVisible(id: string, user: AuthUser) {
    const client = await this.prisma.client.findFirst({
      where: { id, ...(await this.visibleWhere(user)) },
      include: clientInclude,
    });
    if (!client) {
      // Ficha unida: devuelve a dónde se fue para que la app redirija.
      const merged = await this.prisma.client.findUnique({
        where: { id },
        select: { mergedIntoId: true },
      });
      if (merged?.mergedIntoId) {
        throw new ConflictException({ message: 'Ficha unida a otra', mergedIntoId: merged.mergedIntoId });
      }
      throw new NotFoundException('Cliente no encontrado');
    }
    return client;
  }

  // ───────────── Listado y búsqueda ─────────────

  async list(query: ListClientsQuery, user: AuthUser) {
    const where: Prisma.ClientWhereInput = { AND: [await this.visibleWhere(user)] };
    const and = where.AND as Prisma.ClientWhereInput[];
    const q = query.q?.trim();
    if (q) and.push(this.searchWhere(q));
    if (query.tag) and.push({ tags: { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } });
    if (query.sellerId) and.push({ sellerId: query.sellerId === 'none' ? null : query.sellerId });
    const today = toDate(shopDate())!;
    if (query.exam === 'overdue') and.push({ nextExamDue: { lte: today } });
    if (query.exam === 'due_soon') {
      and.push({ nextExamDue: { gt: today, lte: addMonths(today, 1) } });
    }
    const limit = query.limit ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: clientInclude,
        orderBy: q ? [{ updatedAt: 'desc' }] : [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: limit,
        skip: query.offset ?? 0,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { items: items.map(toClientJson), total };
  }

  /** Búsqueda por teléfono (dígitos), correo (con @), nombre (cada palabra) o etiqueta. */
  private searchWhere(q: string): Prisma.ClientWhereInput {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3 && digits.length >= q.replace(/[\s()+.-]/g, '').length) {
      return { phone: { contains: digits } };
    }
    if (q.includes('@')) return { email: { contains: q.toLowerCase() } };
    const words = q.split(/\s+/).filter(Boolean);
    return {
      OR: [
        {
          AND: words.map((w) => ({
            searchKey: { contains: fold(w) },
          })),
        },
        { email: { contains: q.toLowerCase() } },
        { tags: { some: { tag: { name: { equals: q, mode: 'insensitive' } } } } },
      ],
    };
  }

  // ───────────── Duplicados ─────────────

  /** Posibles duplicados: mismo teléfono, mismo correo o mismo nombre completo. */
  async duplicates(q: DuplicatesQuery, user: AuthUser) {
    const phone = normalizePhone(q.phone);
    const email = normalizeEmail(q.email);
    const or: Prisma.ClientWhereInput[] = [];
    if (phone) or.push({ phone });
    if (email) or.push({ email });
    if (q.firstName?.trim() && q.lastName?.trim()) {
      or.push({
        firstName: { equals: q.firstName.trim(), mode: 'insensitive' },
        lastName: { equals: q.lastName.trim(), mode: 'insensitive' },
      });
    }
    if (!or.length) return [];
    const rows = await this.prisma.client.findMany({
      where: {
        OR: or,
        deletedAt: null,
        mergedIntoId: null,
        ...(q.excludeId ? { id: { not: q.excludeId } } : {}),
      },
      include: clientInclude,
      take: 10,
    });
    // De una ficha que el usuario no puede ver (otra vendedora) solo se dice
    // que existe y de quién es, sin sus datos.
    const visible = await this.visibleWhere(user);
    const canSee = (c: ClientRow) => !('sellerId' in visible) || c.sellerId === user.id;
    return rows.map((c) => ({
      ...(canSee(c) ? toClientJson(c) : restrictedJson(c)),
      matches: [
        phone && c.phone === phone ? 'phone' : null,
        email && c.email === email ? 'email' : null,
        q.firstName &&
        q.lastName &&
        fold(c.firstName) === fold(q.firstName) &&
        fold(c.lastName) === fold(q.lastName)
          ? 'name'
          : null,
      ].filter(Boolean),
    }));
  }

  // ───────────── Alta y edición ─────────────

  private phoneOf(raw: string | null | undefined) {
    const phone = normalizePhone(raw);
    if (phone && (phone.length < 11 || phone.length > 15)) throw new BadRequestException('Teléfono no válido');
    return phone;
  }

  async create(dto: CreateClientDto, user: AuthUser) {
    if (!dto.force) {
      const dups = await this.duplicates(dto, user);
      if (dups.length) {
        throw new ConflictException({
          message: 'Puede que este cliente ya exista',
          duplicates: dups,
        });
      }
    }
    if (dto.priorExamAt && !(await this.settings.can(user.role, 'exam.write'))) {
      throw new ForbiddenException('No puedes poner la fecha del examen');
    }
    const now = new Date();
    const client = await this.prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          searchKey: searchKeyOf(dto.firstName, dto.lastName),
          phone: this.phoneOf(dto.phone),
          email: normalizeEmail(dto.email),
          birthDate: toDate(dto.birthDate),
          address: dto.address?.trim() || null,
          contactPref: dto.contactPref ?? ContactPref.sms,
          smsConsentAt: dto.smsConsent ? now : null,
          emailConsentAt: dto.emailConsent ? now : null,
          sellerId: dto.sellerId ?? (user.role === Role.seller ? user.id : null),
          source: dto.source?.trim() || null,
          extra: (dto.extra ?? {}) as Prisma.InputJsonValue,
          priorExamAt: toDate(dto.priorExamAt),
        },
      });
      if (dto.tags?.length) await this.setTags(tx, c.id, dto.tags);
      if (dto.priorExamAt) await this.recomputeExam(tx, c.id);
      await this.audit.log(user.id, 'client', c.id, 'create', {
        smsConsent: !!dto.smsConsent,
        emailConsent: !!dto.emailConsent,
      }, tx);
      return c;
    });
    return toClientJson(await this.findVisible(client.id, user));
  }

  async update(id: string, dto: UpdateClientDto, user: AuthUser) {
    const before = await this.findVisible(id, user);
    if (dto.priorExamAt !== undefined && !(await this.settings.can(user.role, 'exam.write'))) {
      throw new ForbiddenException('No puedes cambiar la fecha del examen');
    }
    const now = new Date();
    const data: Prisma.ClientUncheckedUpdateInput = {
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phone: dto.phone === undefined ? undefined : this.phoneOf(dto.phone),
      email: dto.email === undefined ? undefined : normalizeEmail(dto.email),
      birthDate: dto.birthDate === undefined ? undefined : toDate(dto.birthDate),
      address: dto.address === undefined ? undefined : dto.address.trim() || null,
      contactPref: dto.contactPref,
      sellerId: dto.sellerId,
      source: dto.source === undefined ? undefined : dto.source.trim() || null,
      extra: dto.extra as Prisma.InputJsonValue | undefined,
      searchKey:
        dto.firstName !== undefined || dto.lastName !== undefined
          ? searchKeyOf(dto.firstName ?? before.firstName, dto.lastName ?? before.lastName)
          : undefined,
      priorExamAt: dto.priorExamAt === undefined ? undefined : toDate(dto.priorExamAt),
    };
    // Consentimiento: se guarda la fecha en que se da; retirarlo la borra.
    if (dto.smsConsent !== undefined) {
      data.smsConsentAt = dto.smsConsent ? (before.smsConsentAt ?? now) : null;
    }
    if (dto.emailConsent !== undefined) {
      data.emailConsentAt = dto.emailConsent ? (before.emailConsentAt ?? now) : null;
    }
    if (dto.unsubscribed !== undefined) {
      data.unsubscribedAt = dto.unsubscribed ? (before.unsubscribedAt ?? now) : null;
    }
    if (dto.phone !== undefined || dto.email !== undefined) {
      const dups = dto.force
        ? []
        : (await this.duplicates({ phone: dto.phone, email: dto.email, excludeId: id }, user))
            .filter((d) => d.matches.some((m) => m !== 'name'));
      if (dups.length) {
        throw new ConflictException({
          message: 'Ese teléfono o correo ya es de otro cliente',
          duplicates: dups,
        });
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data });
      if (dto.tags) await this.setTags(tx, id, dto.tags);
      if (dto.priorExamAt !== undefined) await this.recomputeExam(tx, id);
      const changes = diff(before as unknown as Record<string, unknown>, data as Record<string, unknown>);
      delete changes.searchKey;
      if (dto.tags) {
        changes.tags = { from: before.tags.map((t) => t.tag.name), to: dto.tags };
      }
      if (dto.priorExamAt !== undefined) {
        changes.priorExamAt = { from: ymd(before.priorExamAt), to: dto.priorExamAt };
      }
      if (Object.keys(changes).length) {
        await this.audit.log(user.id, 'client', id, 'update', changes, tx);
      }
    });
    return toClientJson(await this.findVisible(id, user));
  }

  async remove(id: string, user: AuthUser) {
    await this.findVisible(id, user);
    await this.prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(user.id, 'client', id, 'delete');
  }

  /** Reemplaza las etiquetas de un cliente (las que no existen se crean). */
  private async setTags(tx: Tx, clientId: string, names: string[]) {
    const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const tags = await Promise.all(
      clean.map(async (name) => {
        const existing = await tx.tag.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        });
        return existing ?? tx.tag.create({ data: { name } });
      }),
    );
    await tx.clientTag.deleteMany({ where: { clientId } });
    if (tags.length) {
      await tx.clientTag.createMany({
        data: tags.map((t) => ({ clientId, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  // ───────────── Examen y revisión ─────────────

  /**
   * Último examen = el más reciente entre el examen anterior al sistema
   * (priorExamAt) y los de sus visitas. La próxima revisión se recalcula
   * siempre: si se corrige una fecha, el aviso se mueve con ella.
   */
  async recomputeExam(tx: Tx, clientId: string) {
    const months = await this.settings.get('examReminderMonths');
    const latest = await tx.visit.findFirst({
      where: { clientId, examDate: { not: null }, status: { not: VisitStatus.cancelled } },
      orderBy: { examDate: 'desc' },
      select: { examDate: true },
    });
    const { priorExamAt } = await tx.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { priorExamAt: true },
    });
    const dates = [priorExamAt, latest?.examDate].filter((d): d is Date => !!d);
    const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    await tx.client.update({
      where: { id: clientId },
      data: { lastExamAt: last, nextExamDue: last ? addMonths(last, months) : null },
    });
  }

  // ───────────── Unir fichas ─────────────

  /** Une `sourceId` en `targetId`: todo el historial pasa a la ficha que queda. */
  async merge(targetId: string, sourceId: string, user: AuthUser) {
    if (targetId === sourceId) throw new BadRequestException('Elige dos fichas distintas');
    const target = await this.findVisible(targetId, user);
    const source = await this.findVisible(sourceId, user);
    await this.prisma.$transaction(async (tx) => {
      const fill: Record<string, unknown> = {};
      for (const k of FILLABLE) {
        if (target[k] == null && source[k] != null) fill[k] = source[k];
      }
      if (source.unsubscribedAt && !target.unsubscribedAt) {
        fill.unsubscribedAt = source.unsubscribedAt; // la baja se respeta siempre
      }
      fill.extra = { ...(source.extra as object), ...(target.extra as object) };
      await tx.client.update({ where: { id: targetId }, data: fill });
      for (const model of ['note', 'visit', 'appointment', 'message'] as const) {
        await (tx[model] as unknown as Prisma.NoteDelegate).updateMany({
          where: { clientId: sourceId },
          data: { clientId: targetId },
        });
      }
      const sourceTags = await tx.clientTag.findMany({ where: { clientId: sourceId } });
      await tx.clientTag.createMany({
        data: sourceTags.map((t) => ({ clientId: targetId, tagId: t.tagId })),
        skipDuplicates: true,
      });
      await tx.clientTag.deleteMany({ where: { clientId: sourceId } });
      await tx.client.update({
        where: { id: sourceId },
        data: { mergedIntoId: targetId, deletedAt: new Date() },
      });
      if (!target.priorExamAt || (source.priorExamAt && source.priorExamAt > target.priorExamAt)) {
        await tx.client.update({ where: { id: targetId }, data: { priorExamAt: source.priorExamAt ?? target.priorExamAt } });
      }
      await this.recomputeExam(tx, targetId);
      await this.audit.log(user.id, 'client', targetId, 'merge', {
        sourceId,
        sourceName: `${source.firstName} ${source.lastName}`,
        filled: Object.keys(fill).filter((k) => k !== 'extra'),
      }, tx);
      await this.audit.log(user.id, 'client', sourceId, 'merged_into', { targetId }, tx);
    });
    return toClientJson(await this.findVisible(targetId, user));
  }

  // ───────────── Notas y línea de tiempo ─────────────

  async addNote(clientId: string, body: string, user: AuthUser) {
    await this.findVisible(clientId, user);
    const note = await this.prisma.note.create({
      data: { clientId, authorId: user.id, body: body.trim() },
      include: { author: { select: { id: true, fullName: true } } },
    });
    await this.prisma.client.update({ where: { id: clientId }, data: { updatedAt: new Date() } });
    return note;
  }

  async timeline(clientId: string, user: AuthUser) {
    await this.findVisible(clientId, user);
    const canSales = await this.settings.can(user.role, 'sales.read');
    const [notes, visits, appointments, messages] = await Promise.all([
      this.prisma.note.findMany({
        where: { clientId },
        include: { author: { select: { fullName: true } } },
      }),
      this.prisma.visit.findMany({
        where: { clientId },
        include: {
          seller: { select: { fullName: true } },
          doctor: { select: { fullName: true } },
        },
      }),
      this.prisma.appointment.findMany({ where: { clientId } }),
      this.prisma.message.findMany({ where: { clientId } }),
    ]);
    const ids = [clientId, ...visits.map((v) => v.id), ...appointments.map((a) => a.id)];
    const logs = await this.prisma.auditLog.findMany({
      where: { entityId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as string[];
    const actors = new Map(
      (await this.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true },
      })).map((u) => [u.id, u.fullName]),
    );

    type Item = { at: Date; type: string; title: string; detail?: string | null; by?: string | null };
    const items: Item[] = [];
    for (const n of notes) {
      items.push({ at: n.createdAt, type: 'note', title: 'Nota', detail: n.body, by: n.author.fullName });
    }
    for (const v of visits) {
      items.push({
        at: v.createdAt,
        type: 'visit',
        title: 'Llegó a la tienda',
        detail: [
          v.examDate ? `Examen: ${ymd(v.examDate)}` : null,
          canSales && v.frame ? `Montura: ${v.frame}` : null,
          v.seller ? `Vendedora: ${v.seller.fullName}` : null,
        ].filter(Boolean).join(' · ') || null,
      });
    }
    for (const a of appointments) {
      items.push({
        at: a.createdAt,
        type: 'appointment',
        title: `Cita agendada para el ${a.startsAt.toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: process.env.SHOP_TZ ?? 'America/New_York' })}`,
        detail: a.notes,
      });
    }
    for (const m of messages) {
      items.push({
        at: m.sentAt ?? m.createdAt,
        type: 'message',
        title: `${MESSAGE_LABEL[m.kind] ?? 'Mensaje'} (${m.channel === 'call' ? 'llamada' : m.channel}) · ${
          m.error?.startsWith('Modo prueba') ? 'modo prueba, no salió' : (MESSAGE_STATUS[m.status] ?? m.status)
        }`,
        detail: m.channel === 'call' ? null : m.body,
      });
    }
    for (const l of logs) {
      const title = auditTitle(l.entity, l.action, l.changes as Record<string, unknown>, canSales);
      if (title) items.push({ at: l.createdAt, type: 'change', title, by: l.actorId ? actors.get(l.actorId) : null });
    }
    return items.sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  // ───────────── Exportación ─────────────

  async exportRows(user: AuthUser) {
    const rows = await this.prisma.client.findMany({
      where: await this.visibleWhere(user),
      include: clientInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map(toClientJson);
  }
}

const MESSAGE_LABEL: Record<string, string> = {
  exam_reminder: 'Recordatorio de revisión',
  exam_reminder_2: 'Segundo recordatorio de revisión',
  appt_confirmation: 'Confirmación de cita',
  appt_reminder: 'Recordatorio de cita',
  ready: 'Lentes listos',
  welcome: 'Bienvenida',
  birthday: 'Felicitación de cumpleaños',
  campaign: 'Campaña',
  test: 'Prueba',
};

const MESSAGE_STATUS: Record<string, string> = {
  queued: 'en cola',
  sent: 'enviado',
  delivered: 'entregado',
  failed: 'falló',
  skipped: 'no enviado',
  done: 'hecho',
};

const VISIT_STATUS_LABEL: Record<string, string> = {
  reception: 'Recepción',
  exam: 'Examen',
  sale: 'Venta',
  ready: 'Lentes listos',
  delivered: 'Entregado',
  cancelled: 'Cancelada',
};

const FIELD_LABEL: Record<string, string> = {
  firstName: 'nombre',
  lastName: 'apellido',
  phone: 'teléfono',
  email: 'correo',
  birthDate: 'cumpleaños',
  address: 'dirección',
  contactPref: 'preferencia de aviso',
  smsConsentAt: 'consentimiento SMS',
  emailConsentAt: 'consentimiento de correo',
  unsubscribedAt: 'baja de mensajes',
  sellerId: 'vendedora',
  source: 'cómo nos conoció',
  tags: 'etiquetas',
  priorExamAt: 'fecha del examen anterior',
  examDate: 'fecha del examen',
  doctorId: 'médico',
  notes: 'notas',
  durationMin: 'duración',
  frame: 'montura',
  startsAt: 'hora de la cita',
};

function auditTitle(
  entity: string,
  action: string,
  changes: Record<string, unknown>,
  canSales: boolean,
): string | null {
  if (entity === 'client') {
    if (action === 'create') return 'Ficha creada';
    if (action === 'delete') return 'Ficha eliminada';
    if (action === 'merge') return `Se unió la ficha de ${String(changes.sourceName ?? 'otro cliente')}`;
    if (action === 'update') {
      const fields = Object.keys(changes).map((k) => FIELD_LABEL[k] ?? k);
      return fields.length ? `Cambió ${fields.join(', ')}` : null;
    }
  }
  if (entity === 'visit') {
    if (action === 'status') {
      return `Visita: ${VISIT_STATUS_LABEL[String(changes.to)] ?? String(changes.to)}`;
    }
    if (action === 'update') {
      const fields = Object.keys(changes)
        .filter((k) => canSales || k !== 'frame')
        .map((k) => FIELD_LABEL[k] ?? k);
      return fields.length ? `Visita: cambió ${fields.join(', ')}` : null;
    }
  }
  if (entity === 'appointment') {
    if (action === 'update' && changes.startsAt) return 'Cita movida';
    if (action === 'status') {
      const s: Record<string, string> = {
        confirmed: 'Cita confirmada',
        cancelled: 'Cita cancelada',
        no_show: 'No vino a la cita',
        arrived: 'Llegó a su cita',
      };
      return s[String(changes.to)] ?? null;
    }
  }
  return null;
}
