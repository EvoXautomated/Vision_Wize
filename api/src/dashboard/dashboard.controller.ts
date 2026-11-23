import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Can } from '../common/decorators.js';
import { addMonths, toDate } from '../common/normalize.js';
import { shopDate, shopDayStart } from '../common/tz.js';
import { AppointmentStatus, Channel, MessageStatus, Role, VisitStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY = 86_400_000;

/** Panel básico del dueño: clientes, visitas, revisiones, citas y mensajes. */
@ApiTags('dashboard')
@ApiBearerAuth()
@Can('settings.manage')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const today = shopDate();
    const monthStart = shopDayStart(`${today.slice(0, 8)}01`);
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * DAY);
    const todayDate = toDate(today)!;
    const alive = { deletedAt: null, mergedIntoId: null };
    const p = this.prisma;

    const [
      clients,
      newClients,
      visitsMonth,
      deliveredMonth,
      overdue,
      dueSoon,
      apptsNext7,
      arrived30,
      noShow30,
      messages30,
      pendingCalls,
      unsubscribed30,
      sellers,
      bySeller,
      newBySeller,
      weekly,
      tags,
    ] = await Promise.all([
      p.client.count({ where: alive }),
      p.client.count({ where: { ...alive, createdAt: { gte: monthStart } } }),
      p.visit.count({ where: { createdAt: { gte: monthStart }, status: { not: VisitStatus.cancelled } } }),
      p.visit.count({ where: { deliveredAt: { gte: monthStart } } }),
      p.client.count({ where: { ...alive, nextExamDue: { lte: todayDate } } }),
      p.client.count({ where: { ...alive, nextExamDue: { gt: todayDate, lte: addMonths(todayDate, 1) } } }),
      p.appointment.count({
        where: {
          startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) },
          status: { in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed] },
        },
      }),
      p.appointment.count({ where: { startsAt: { gte: last30, lt: now }, status: AppointmentStatus.arrived } }),
      p.appointment.count({ where: { startsAt: { gte: last30, lt: now }, status: AppointmentStatus.no_show } }),
      p.message.groupBy({
        by: ['status'],
        where: { createdAt: { gte: last30 }, channel: { in: [Channel.sms, Channel.email] } },
        _count: { _all: true },
      }),
      p.message.count({ where: { channel: Channel.call, status: MessageStatus.queued } }),
      p.client.count({ where: { unsubscribedAt: { gte: last30 } } }),
      p.user.findMany({
        where: { role: Role.seller, deletedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      p.visit.groupBy({ by: ['sellerId'], where: { deliveredAt: { gte: monthStart } }, _count: { _all: true } }),
      p.client.groupBy({ by: ['sellerId'], where: { ...alive, createdAt: { gte: monthStart } }, _count: { _all: true } }),
      p.$queryRaw<{ week: Date; visits: bigint }[]>`
        SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS visits
        FROM "Visit" WHERE "createdAt" >= ${new Date(now.getTime() - 8 * 7 * DAY)} AND status <> 'cancelled'
        GROUP BY 1 ORDER BY 1`,
      p.tag.findMany({
        include: { _count: { select: { clients: { where: { client: alive } } } } },
      }),
    ]);

    const msg = Object.fromEntries(messages30.map((m) => [m.status, m._count._all])) as Record<string, number>;
    const count = (rows: { sellerId: string | null; _count: { _all: number } }[], id: string) =>
      rows.find((r) => r.sellerId === id)?._count._all ?? 0;

    // Últimas 8 semanas, con las semanas sin visitas a 0.
    const weeks: { week: string; visits: number }[] = [];
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const w = new Date(monday.getTime() - i * 7 * DAY).toISOString().slice(0, 10);
      const row = weekly.find((r) => r.week.toISOString().slice(0, 10) === w);
      weeks.push({ week: w, visits: Number(row?.visits ?? 0) });
    }

    return {
      date: today,
      clients: { total: clients, newThisMonth: newClients },
      visits: { thisMonth: visitsMonth, deliveredThisMonth: deliveredMonth, weekly: weeks },
      exams: { overdue, dueNextMonth: dueSoon },
      appointments: {
        next7Days: apptsNext7,
        noShowRate30: arrived30 + noShow30 ? noShow30 / (arrived30 + noShow30) : null,
      },
      messages: {
        sent30: (msg.sent ?? 0) + (msg.delivered ?? 0),
        delivered30: msg.delivered ?? 0,
        failed30: msg.failed ?? 0,
        pending: msg.queued ?? 0,
        pendingCalls,
        unsubscribed30,
      },
      sellers: sellers.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        deliveredThisMonth: count(bySeller, s.id),
        newClientsThisMonth: count(newBySeller, s.id),
      })),
      tags: tags
        .map((t) => ({ name: t.name, color: t.color, clients: t._count.clients }))
        .sort((a, b) => b.clients - a.clients)
        .slice(0, 8),
    };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
