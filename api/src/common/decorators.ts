import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import type { OwnerOnly, Permission } from './permissions.js';

export interface AuthUser {
  id: string;
  fullName: string;
  initials: string;
  role: Role;
  sessionId: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
/** Endpoint accesible sin token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CAN_KEY = 'can';
/** Exige un permiso (el dueño siempre pasa). */
export const Can = (permission: Permission | OwnerOnly) =>
  SetMetadata(CAN_KEY, permission);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
