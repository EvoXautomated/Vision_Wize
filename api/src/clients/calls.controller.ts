import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { MessagesService } from '../messages/messages.service.js';
import { ClientsService } from './clients.service.js';

class CalledDto {
  @IsOptional() @IsString() @MaxLength(200) outcome?: string;
}

/** Lista «por llamar»: avisos para clientes sin SMS ni correo con permiso. */
@ApiTags('calls')
@ApiBearerAuth()
@Can('clients.read')
@Controller('calls')
export class CallsController {
  constructor(
    private readonly messages: MessagesService,
    private readonly clients: ClientsService,
  ) {}

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    return this.messages.callList(await this.clients.visibleWhere(me));
  }

  @Post(':id/done')
  @HttpCode(204)
  async done(@Param('id') id: string, @Body() dto: CalledDto, @CurrentUser() me: AuthUser) {
    await this.messages.markCalled(id, dto.outcome, await this.clients.visibleWhere(me));
  }
}
