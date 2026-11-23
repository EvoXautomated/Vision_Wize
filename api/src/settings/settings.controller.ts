import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { Can, CurrentUser, type AuthUser } from '../common/decorators.js';
import { PERMISSIONS } from '../common/permissions.js';
import { DEFAULT_SETTINGS, SettingsService, type SettingKey } from './settings.service.js';

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
    const roles = Object.values(Role) as string[];
    for (const [key, value] of Object.entries(body)) {
      if (!(key in DEFAULT_SETTINGS)) {
        throw new BadRequestException(`Ajuste desconocido: ${key}`);
      }
      const def = DEFAULT_SETTINGS[key as SettingKey];
      if (typeof def === 'number' && (typeof value !== 'number' || value < 0)) {
        throw new BadRequestException(`${key} debe ser un número positivo`);
      }
      if (key === 'permissions') {
        for (const [p, r] of Object.entries(value as object)) {
          if (!(PERMISSIONS as string[]).includes(p) || !Array.isArray(r) || r.some((x) => !roles.includes(x))) {
            throw new BadRequestException(`Permiso no válido: ${p}`);
          }
        }
      }
      if (typeof def === 'object' && (typeof value !== 'object' || value === null)) {
        throw new BadRequestException(`${key} debe ser un objeto`);
      }
      await this.settings.set(key as SettingKey, value as never);
      await this.audit.log(user.id, 'setting', key, 'update', { value });
    }
    return this.settings.all();
  }
}
