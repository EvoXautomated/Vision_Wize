import { Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { DevicesService } from './devices.service.js';

/** Dispositivos autorizados a entrar con PIN (solo el dueño). */
@ApiTags('devices')
@ApiBearerAuth()
@Can('users.manage')
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Headers('x-device-token') token: string | undefined) {
    return this.devices.list(token);
  }

  /** Código de un solo uso (10 minutos) para autorizar otro dispositivo. */
  @Post('pairing-code')
  async pairingCode(@CurrentUser() me: AuthUser) {
    const res = await this.devices.pairingCode(me.id);
    await this.audit.log(me.id, 'device', 'pairing', 'create');
    return res;
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @Param('id') id: string,
    @Headers('x-device-token') token: string | undefined,
    @CurrentUser() me: AuthUser,
  ) {
    await this.devices.revoke(id, token);
    await this.audit.log(me.id, 'device', id, 'delete');
  }
}
