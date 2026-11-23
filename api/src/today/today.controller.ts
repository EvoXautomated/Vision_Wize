import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { ClientsService } from '../clients/clients.service.js';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { shopDate } from '../common/tz.js';
import { MessagesService } from '../messages/messages.service.js';
import { VisitsService } from '../visits/visits.service.js';

/** Pantalla «Hoy»: clientes en curso, citas del día y llamadas pendientes. */
@ApiTags('today')
@ApiBearerAuth()
@Controller('today')
export class TodayController {
  constructor(
    private readonly visits: VisitsService,
    private readonly appts: AppointmentsService,
    private readonly messages: MessagesService,
    private readonly clients: ClientsService,
  ) {}

  @Can('clients.read')
  @Get()
  async today(@CurrentUser() me: AuthUser) {
    const date = shopDate();
    const [visits, appointments, calls] = await Promise.all([
      this.visits.active(me),
      this.appts.range(date, date, me),
      this.clients.visibleWhere(me).then((v) => this.messages.callList(v)),
    ]);
    return { date, visits, appointments, pendingCalls: calls.length };
  }
}
