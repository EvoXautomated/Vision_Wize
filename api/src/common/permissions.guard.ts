import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SettingsService } from '../settings/settings.service.js';
import { AuthUser, CAN_KEY } from './decorators.js';
import type { OwnerOnly, Permission } from './permissions.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const perm = this.reflector.getAllAndOverride<
      Permission | OwnerOnly | undefined
    >(CAN_KEY, [context.getHandler(), context.getClass()]);
    if (!perm) return true;
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;
    return this.settings.can(user.role, perm);
  }
}
