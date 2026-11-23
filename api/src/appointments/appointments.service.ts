import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, diff } from '../audit/audit.service.js';
import { ClientsService } from '../clients/clients.service.js';
import type { AuthUser } from '../common/decorators.js';
import { shopDayRange } from '../common/tz.js';
import { AppointmentStatus, Prisma } from '../generated/prisma/client.js';
import { MessagesService } from '../messages/messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto.js';

const include = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  doctor: { select: { id: true, fullName: true, initials: true } },
  visit: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

type Row = Prisma.AppointmentGetPayload<{ include: typeof include }>;

const toJson = (a: Row) => ({
  id: a.id,
  startsAt: a.startsAt,
  endsAt: new Date(a.startsAt.getTime() + a.durationMin * 60_000),
  durationMin: a.durationMin,
  status: a.status,
  client: { ...a.client, fullName: `${a.client.firstName} ${a.client.lastName}`.trim() },
  doctor: a.doctor,
  notes: a.notes,
  visit: a.visit,
  confirmationSentAt: a.confirmationSentAt,
  reminderSentAt: a.reminderSentAt,
});

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clients: ClientsService,
    private readonly settings: SettingsService,
    private readonly messages: MessagesService,
  ) {}

  async range(from: string, to: string, user: AuthUser) {
    const [start] = shopDayRange(from);
    const [, end] = shopDayRange(to);
    const rows = await this.prisma.appointment.findMany({
      where: { startsAt: { gte: start, lt: end }, client: await this.clients.visibleWhere(user) },
      include,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map(toJson);
  }

  async forClient(clientId: string, user: AuthUser) {
    await this.clients.findVisible(clientId, user);
    const rows = await this.prisma.appointment.findMany({ where: { clientId }, include, orderBy: { startsAt: 'desc' } });
    return rows.map(toJson);
  }

  async create(dto: CreateAppointmentDto, user: AuthUser) {
    await this.clients.findVisible(dto.clientId, user);
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() < Date.now() - 15 * 60_000) throw new BadRequestException('La cita no puede ser en el pasado');
    const a = await this.prisma.appointment.create({
      data: {
        clientId: dto.clientId,
        startsAt,
        durationMin: dto.durationMin ?? (await this.settings.get('appointmentMinutes')),
        doctorId: dto.doctorId ?? null,
        notes: dto.notes,
        createdById: user.id,
      },
      include,
    });
    await this.audit.log(user.id, 'appointment', a.id, 'create', { startsAt: a.startsAt });
    await this.messages.appointmentConfirmation(a.id);
    return toJson(a);
  }

  private async load(id: string, user: AuthUser) {
    const a = await this.prisma.appointment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cita no encontrada');
    await this.clients.findVisible(a.clientId, user);
    return a;
  }

  async update(id: string, dto: UpdateAppointmentDto, user: AuthUser) {
    const before = await this.load(id, user);
    const data = {
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      durationMin: dto.durationMin,
      doctorId: dto.doctorId,
      notes: dto.notes,
      // Al moverla, el recordatorio de 24 h vuelve a salir para la nueva hora.
      ...(dto.startsAt ? { reminderSentAt: null } : {}),
    };
    const a = await this.prisma.appointment.update({ where: { id }, data, include });
    const changes = diff(before as unknown as Record<string, unknown>, data);
    delete changes.reminderSentAt;
    if (Object.keys(changes).length) await this.audit.log(user.id, 'appointment', id, 'update', changes);
    if (changes.startsAt) await this.messages.appointmentConfirmation(id);
    return toJson(a);
  }

  async setStatus(id: string, status: AppointmentStatus, user: AuthUser) {
    const before = await this.load(id, user);
    if (before.status === AppointmentStatus.arrived) throw new BadRequestException('El cliente ya llegó a esta cita');
    const a = await this.prisma.appointment.update({ where: { id }, data: { status }, include });
    await this.audit.log(user.id, 'appointment', id, 'status', { from: before.status, to: status });
    return toJson(a);
  }
}
