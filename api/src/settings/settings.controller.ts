import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { Can, CurrentUser, type AuthUser } from '../common/decorators.js';
import { SettingsService, type SettingKey } from './settings.service.js';
import { settingError } from './settings.validation.js';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  all() {
    return this.settings.all();
  }

  /** Cambia uno o varios ajustes: { examReminderMonths: 12, business: {...} } */
  @Can('settings.manage')
  @Put()
  async update(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    // Se valida todo antes de guardar nada.
    for (const [key, value] of Object.entries(body)) {
      const error = settingError(key, value);
      if (error) throw new BadRequestException(error);
    }
    for (const [key, value] of Object.entries(body)) {
      await this.settings.set(key as SettingKey, value as never);
      await this.audit.log(user.id, 'setting', key, 'update', { value });
    }
    return this.settings.all();
  }
}
