import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { AppointmentStatus } from '../generated/prisma/client.js';
import { AppointmentStatusDto, CreateAppointmentDto, RangeQuery, UpdateAppointmentDto } from './appointments.dto.js';
import { AppointmentsService } from './appointments.service.js';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller()
export class AppointmentsController {
  constructor(private readonly appts: AppointmentsService) {}

  @Can('clients.read')
  @Get('appointments')
  range(@Query() q: RangeQuery, @CurrentUser() me: AuthUser) {
    return this.appts.range(q.from, q.to, me);
  }

  @Can('clients.read')
  @Get('clients/:clientId/appointments')
  forClient(@Param('clientId') id: string, @CurrentUser() me: AuthUser) {
    return this.appts.forClient(id, me);
  }

  @Can('appointments.write')
  @Post('appointments')
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() me: AuthUser) {
    return this.appts.create(dto, me);
  }

  @Can('appointments.write')
  @Patch('appointments/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @CurrentUser() me: AuthUser) {
    return this.appts.update(id, dto, me);
  }

  @Can('appointments.write')
  @Post('appointments/:id/status')
  status(@Param('id') id: string, @Body() dto: AppointmentStatusDto, @CurrentUser() me: AuthUser) {
    return this.appts.setStatus(id, dto.status as AppointmentStatus, me);
  }
}
