import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, diff } from '../audit/audit.service.js';
import { ClientsService } from '../clients/clients.service.js';
import type { AuthUser } from '../common/decorators.js';
import { toDate, ymd } from '../common/normalize.js';
import { VISIT_TARGETS } from '../common/permissions.js';
import { shopDate, shopDayRange } from '../common/tz.js';
import { AppointmentStatus, Prisma, Role, VisitStatus } from '../generated/prisma/client.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { CreateVisitDto, UpdateVisitDto } from './visits.dto.js';

/** Orden del recorrido de una visita. */
export const FLOW: VisitStatus[] = [
  VisitStatus.reception,
  VisitStatus.exam,
  VisitStatus.sale,
  VisitStatus.ready,
  VisitStatus.delivered,
];

const visitInclude = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true, sellerId: true } },
  seller: { select: { id: true, fullName: true, initials: true } },
  doctor: { select: { id: true, fullName: true, initials: true } },
} satisfies Prisma.VisitInclude;

type VisitRow = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

export const toVisitJson = (v: VisitRow, canSales: boolean) => ({
  id: v.id,
  status: v.status,
  client: { ...v.client, fullName: `${v.client.firstName} ${v.client.lastName}`.trim() },
  seller: v.seller,
  doctor: v.doctor,
  examDate: ymd(v.examDate),
  frame: canSales ? v.frame : undefined,
  notes: v.notes,
  appointmentId: v.appointmentId,
  statusAt: v.statusAt,
  readyAt: v.readyAt,
  deliveredAt: v.deliveredAt,
  createdAt: v.createdAt,
});

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clients: ClientsService,
    private readonly settings: SettingsService,
    private readonly messages: MessagesService,
  ) {}

  private canSales(user: AuthUser) {
    return this.settings.can(user.role, 'sales.read');
  }

  async get(id: string, user: AuthUser) {
    const v = await this.prisma.visit.findUnique({ where: { id }, include: visitInclude });
    if (!v) throw new NotFoundException('Visita no encontrada');
    await this.clients.findVisible(v.clientId, user); // misma visibilidad que la ficha
    return toVisitJson(v, await this.canSales(user));
  }

  async forClient(clientId: string, user: AuthUser) {
    await this.clients.findVisible(clientId, user);
    const rows = await this.prisma.visit.findMany({
      where: { clientId },
      include: visitInclude,
      orderBy: { createdAt: 'desc' },
    });
    const canSales = await this.canSales(user);
    return rows.map((v) => toVisitJson(v, canSales));
  }

  /** Pantalla «Hoy»: visitas en curso más las entregadas o canceladas hoy. */
  async active(user: AuthUser) {
    const [start] = shopDayRange(shopDate());
    const visible = await this.clients.visibleWhere(user);
    const rows = await this.prisma.visit.findMany({
      where: {
        client: visible,
        OR: [
          { status: { in: [VisitStatus.reception, VisitStatus.exam, VisitStatus.sale, VisitStatus.ready] } },
          { statusAt: { gte: start } },
        ],
      },
      include: visitInclude,
      orderBy: { createdAt: 'asc' },
    });
    const canSales = await this.canSales(user);
    return rows.map((v) => toVisitJson(v, canSales));
  }

  async create(dto: CreateVisitDto, user: AuthUser) {
    const client = await this.clients.findVisible(dto.clientId, user);
    const open = await this.prisma.visit.findFirst({
      where: { clientId: client.id, status: { in: [VisitStatus.reception, VisitStatus.exam, VisitStatus.sale] } },
    });
    if (open) throw new BadRequestException('Este cliente ya tiene una visita en curso');
    const visit = await this.prisma.$transaction(async (tx) => {
      if (dto.appointmentId) {
        const appt = await tx.appointment.findUnique({ where: { id: dto.appointmentId } });
        if (!appt || appt.clientId !== client.id) throw new BadRequestException('La cita no es de este cliente');
        await tx.appointment.update({ where: { id: appt.id }, data: { status: AppointmentStatus.arrived } });
        await this.audit.log(user.id, 'appointment', appt.id, 'status', { from: appt.status, to: 'arrived' }, tx);
      }
      const v = await tx.visit.create({
        data: {
          clientId: client.id,
          appointmentId: dto.appointmentId,
          sellerId: dto.sellerId ?? client.sellerId ?? (user.role === Role.seller ? user.id : null),
          notes: dto.notes,
        },
        include: visitInclude,
      });
      if (!client.firstVisitAt) {
        await tx.client.update({ where: { id: client.id }, data: { firstVisitAt: new Date() } });
      }
      await this.audit.log(user.id, 'visit', v.id, 'create', {}, tx);
      return v;
    });
    return toVisitJson(visit, await this.canSales(user));
  }

  async update(id: string, dto: UpdateVisitDto, user: AuthUser) {
    const before = await this.prisma.visit.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Visita no encontrada');
    await this.clients.findVisible(before.clientId, user);
    if (dto.examDate !== undefined && !(await this.settings.can(user.role, 'exam.write'))) {
      throw new ForbiddenException('No puedes cambiar la fecha del examen');
    }
    if (dto.frame !== undefined && !(await this.canSales(user))) {
      throw new ForbiddenException('No puedes registrar la montura');
    }
    if (dto.examDate && dto.examDate > shopDate()) {
      throw new BadRequestException('La fecha del examen no puede ser futura');
    }
    const data: Prisma.VisitUncheckedUpdateInput = {
      examDate: dto.examDate === undefined ? undefined : toDate(dto.examDate),
      frame: dto.frame,
      sellerId: dto.sellerId,
      doctorId: dto.doctorId === undefined && dto.examDate && user.role === Role.doctor ? user.id : dto.doctorId,
      notes: dto.notes,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.visit.update({ where: { id }, data });
      if (dto.examDate !== undefined) await this.clients.recomputeExam(tx, before.clientId);
      const changes = diff(
        { ...before, examDate: ymd(before.examDate) } as Record<string, unknown>,
        { ...data, examDate: dto.examDate } as Record<string, unknown>,
      );
      if (Object.keys(changes).length) await this.audit.log(user.id, 'visit', id, 'update', changes, tx);
    });
    return this.get(id, user);
  }

  async setStatus(id: string, status: VisitStatus, user: AuthUser) {
    const v = await this.prisma.visit.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Visita no encontrada');
    await this.clients.findVisible(v.clientId, user);
    if (v.status === status) return this.get(id, user);
    if (user.role !== Role.owner) {
      if (!VISIT_TARGETS[user.role].includes(status)) {
        throw new ForbiddenException('Tu rol no puede pasar la visita a ese estado');
      }
      if (v.status === VisitStatus.delivered || v.status === VisitStatus.cancelled) {
        throw new ForbiddenException('Solo el dueño puede reabrir una visita cerrada');
      }
      if (status !== VisitStatus.cancelled && FLOW.indexOf(status) < FLOW.indexOf(v.status)) {
        throw new ForbiddenException('Solo el dueño puede devolver una visita a un paso anterior');
      }
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.visit.update({
        where: { id },
        data: {
          status,
          statusAt: now,
          readyAt: status === VisitStatus.ready ? now : undefined,
          deliveredAt: status === VisitStatus.delivered ? now : undefined,
        },
      });
      // Si se cancela la visita, su examen deja de contar.
      if (status === VisitStatus.cancelled || v.status === VisitStatus.cancelled) {
        await this.clients.recomputeExam(tx, v.clientId);
      }
      await this.audit.log(user.id, 'visit', id, 'status', { from: v.status, to: status }, tx);
    });
    if (status === VisitStatus.ready) await this.messages.readyNotice(id);
    return this.get(id, user);
  }
}
