import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/decorators.js';
import { toGsm } from '../common/gsm.js';
import { addMonths, normalizeEmail, normalizePhone, toDate } from '../common/normalize.js';
import { shopDate } from '../common/tz.js';
import {
  CampaignStatus,
  Channel,
  ContactPref,
  MessageKind,
  MessageStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { MessagesService } from '../messages/messages.service.js';
import { sendEmail, sendSms } from '../messages/transports.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { CampaignDto, Segment } from './campaigns.dto.js';

const SMS_FOOTER = ' Resp. STOP para darse de baja.';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
    private readonly audit: AuditService,
    private readonly settingsService: SettingsService,
  ) {}

  // ───────────── Segmento ─────────────

  /** Clientes del segmento, sin mirar si se les puede escribir. */
  private async segmentWhere(seg: Segment): Promise<Prisma.ClientWhereInput> {
    const and: Prisma.ClientWhereInput[] = [{ deletedAt: null, mergedIntoId: null }];
    if (seg.tags?.length) {
      and.push({ tags: { some: { tag: { name: { in: seg.tags, mode: 'insensitive' } } } } });
    }
    if (seg.sellerId) and.push({ sellerId: seg.sellerId === 'none' ? null : seg.sellerId });
    const today = toDate(shopDate())!;
    if (seg.examOverdue) and.push({ nextExamDue: { lte: today } });
    if (seg.inactiveMonths) {
      const cutoff = addMonths(today, -seg.inactiveMonths);
      and.push({ createdAt: { lt: cutoff }, visits: { none: { createdAt: { gte: cutoff } } } });
    }
    if (seg.birthdayMonth) {
      const month = Number(shopDate().slice(5, 7));
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Client" WHERE "birthDate" IS NOT NULL AND EXTRACT(MONTH FROM "birthDate") = ${month}`;
      and.push({ id: { in: rows.map((r) => r.id) } });
    }
    return { AND: and };
  }

  /** Quién del segmento puede recibir por este canal: dato de contacto, permiso, sin baja y que quiera mensajes. */
  private reachable(channel: Channel): Prisma.ClientWhereInput {
    // «No quiere avisos» y «prefiere llamada» quedan fuera aunque haya consentimiento.
    const wantsMessages = { contactPref: { in: [ContactPref.sms, ContactPref.email] }, unsubscribedAt: null };
    return channel === Channel.sms
      ? { ...wantsMessages, phone: { not: null }, smsConsentAt: { not: null } }
      : { ...wantsMessages, email: { not: null }, emailConsentAt: { not: null } };
  }

  /** Cuántos entran en el segmento, a cuántos se puede escribir y por qué no al resto. */
  async preview(seg: Segment, channel: Channel) {
    const where = await this.segmentWhere(seg);
    const [matched, reachable, unsubscribed, sample] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.count({ where: { AND: [where, this.reachable(channel)] } }),
      this.prisma.client.count({ where: { AND: [where, { unsubscribedAt: { not: null } }] } }),
      this.prisma.client.findMany({
        where: { AND: [where, this.reachable(channel)] },
        select: { firstName: true, lastName: true },
        take: 5,
        orderBy: { lastName: 'asc' },
      }),
    ]);
    return {
      matched,
      reachable,
      unsubscribed,
      // Sin teléfono/correo, sin consentimiento para este canal o que no quieren mensajes.
      noConsent: matched - reachable - unsubscribed,
      sample: sample.map((c) => `${c.firstName} ${c.lastName}`.trim()),
    };
  }

  // ───────────── Campañas ─────────────

  async list() {
    const campaigns = await this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = campaigns.map((c) => c.id);
    const grouped = await this.prisma.message.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
    });
    const stats = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const s = stats.get(g.campaignId!) ?? {};
      s[g.status] = g._count._all;
      stats.set(g.campaignId!, s);
    }
    // Bajas: destinatarios que se dieron de baja después del envío.
    const unsub = await Promise.all(
      campaigns.map((c) =>
        c.sentAt
          ? this.prisma.message.count({
              where: { campaignId: c.id, client: { unsubscribedAt: { gte: c.sentAt } } },
            })
          : 0,
      ),
    );
    return campaigns.map((c, i) => {
      const s = stats.get(c.id) ?? {};
      return {
        ...c,
        stats: {
          queued: s.queued ?? 0,
          sent: (s.sent ?? 0) + (s.delivered ?? 0),
          delivered: s.delivered ?? 0,
          failed: s.failed ?? 0,
          unsubscribed: unsub[i],
        },
      };
    });
  }

  private async draft(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaña no encontrada');
    return c;
  }

  private validate(dto: CampaignDto) {
    if (dto.channel === Channel.call) throw new BadRequestException('Elige SMS o correo');
    if (dto.channel === Channel.email && !dto.subject?.trim()) {
      throw new BadRequestException('El correo necesita un asunto');
    }
  }

  async create(dto: CampaignDto, user: AuthUser) {
    this.validate(dto);
    const c = await this.prisma.campaign.create({
      data: {
        name: dto.name.trim(),
        channel: dto.channel,
        subject: dto.subject?.trim() || null,
        body: dto.body.trim(),
        segment: (dto.segment ?? {}) as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });
    await this.audit.log(user.id, 'campaign', c.id, 'create', { name: c.name });
    return c;
  }

  async update(id: string, dto: CampaignDto, user: AuthUser) {
    const c = await this.draft(id);
    if (c.status !== CampaignStatus.draft) throw new BadRequestException('Una campaña enviada no se puede cambiar');
    this.validate(dto);
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        channel: dto.channel,
        subject: dto.subject?.trim() || null,
        body: dto.body.trim(),
        segment: (dto.segment ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.audit.log(user.id, 'campaign', id, 'update');
    return updated;
  }

  async remove(id: string, user: AuthUser) {
    const c = await this.draft(id);
    if (c.status !== CampaignStatus.draft) throw new BadRequestException('Una campaña enviada no se puede borrar');
    await this.prisma.campaign.delete({ where: { id } });
    await this.audit.log(user.id, 'campaign', id, 'delete', { name: c.name });
  }

  /** Envío de prueba a un teléfono o correo cualquiera (no cuenta en los resultados). */
  async test(id: string, to: string, user: AuthUser) {
    const c = await this.draft(id);
    const { business, messages } = await this.settingsService.all();
    const vars: Record<string, string> = {
      nombre: user.fullName.split(' ')[0],
      optica: messages.signature || business.name,
      telefono: business.phone,
      resena: business.googleReviewUrl,
    };
    const body = c.body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
    let res;
    if (c.channel === Channel.sms) {
      const phone = normalizePhone(to);
      if (!phone || phone.length < 11) throw new BadRequestException('Teléfono no válido');
      const text = `[PRUEBA] ${body}${SMS_FOOTER}`;
      res = await sendSms(phone, messages.smsPlainText ? toGsm(text) : text);
    } else {
      const email = normalizeEmail(to);
      if (!email?.includes('@')) throw new BadRequestException('Correo no válido');
      res = await sendEmail(email, `[PRUEBA] ${c.subject ?? business.name}`, body, business.name);
    }
    if (!res.ok) throw new BadRequestException(`No se pudo enviar: ${res.error}`);
    return { ok: true, dryRun: !!res.dryRun };
  }

  /** Envía la campaña: un mensaje por cliente alcanzable del segmento. */
  async send(id: string, user: AuthUser) {
    const c = await this.draft(id);
    if (c.status !== CampaignStatus.draft) throw new BadRequestException('Esta campaña ya se envió');
    const where = await this.segmentWhere(c.segment as Segment);
    const clients = await this.prisma.client.findMany({ where: { AND: [where, this.reachable(c.channel)] } });
    if (!clients.length) throw new BadRequestException('No hay nadie a quien enviar en este grupo');

    const data: Prisma.MessageCreateManyInput[] = [];
    for (const client of clients) {
      data.push({
        clientId: client.id,
        campaignId: c.id,
        kind: MessageKind.campaign,
        channel: c.channel,
        to: c.channel === Channel.sms ? client.phone : client.email,
        subject: c.subject,
        body: await this.messages.render(c.body, client),
        status: MessageStatus.queued,
        dedupeKey: `camp:${c.id}:${client.id}`,
      });
    }
    // Marcar como enviada y crear los mensajes van juntos: un segundo clic no
    // la duplica y, si algo falla, la campaña sigue en borrador.
    const claimed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.campaign.updateMany({
        where: { id, status: CampaignStatus.draft },
        data: { status: CampaignStatus.sent, sentAt: new Date(), recipients: clients.length },
      });
      if (!claim.count) return false;
      await tx.message.createMany({ data, skipDuplicates: true });
      return true;
    });
    if (!claimed) throw new BadRequestException('Esta campaña ya se envió');
    await this.audit.log(user.id, 'campaign', id, 'send', { recipients: clients.length });
    // El envío sigue en segundo plano (no bloquea la pantalla). Fuera del
    // horario de envío quedan en cola y salen en la siguiente ventana.
    void this.messages.flushAll();
    return { recipients: clients.length };
  }
}
