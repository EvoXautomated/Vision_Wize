import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { CreateVisitDto, UpdateVisitDto, VisitStatusDto } from './visits.dto.js';
import { VisitsService } from './visits.service.js';

@ApiTags('visits')
@ApiBearerAuth()
@Can('clients.read')
@Controller()
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('visits/active')
  active(@CurrentUser() me: AuthUser) {
    return this.visits.active(me);
  }

  @Get('clients/:clientId/visits')
  forClient(@Param('clientId') clientId: string, @CurrentUser() me: AuthUser) {
    return this.visits.forClient(clientId, me);
  }

  @Get('visits/:id')
  get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.visits.get(id, me);
  }

  @Post('visits')
  create(@Body() dto: CreateVisitDto, @CurrentUser() me: AuthUser) {
    return this.visits.create(dto, me);
  }

  @Patch('visits/:id')
  update(@Param('id') id: string, @Body() dto: UpdateVisitDto, @CurrentUser() me: AuthUser) {
    return this.visits.update(id, dto, me);
  }

  @Post('visits/:id/status')
  status(@Param('id') id: string, @Body() dto: VisitStatusDto, @CurrentUser() me: AuthUser) {
    return this.visits.setStatus(id, dto.status, me);
  }
}
