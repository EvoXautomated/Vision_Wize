import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { Role } from '../generated/prisma/client.js';
import { normalizeEmail, normalizePhone } from '../common/normalize.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { initialsOf, toUserJson } from './user.json.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
    });
    return users.map(toUserJson);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        initials: initialsOf(dto.fullName),
        role: dto.role,
        email: normalizeEmail(dto.email),
        phone: normalizePhone(dto.phone),
        pinHash: await bcrypt.hash(dto.pin, 10),
      },
    });
    await this.audit.log(actorId, 'user', user.id, 'create', {
      fullName: user.fullName,
      role: user.role,
    });
    return toUserJson(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Usuario no encontrado');
    const losesOwner =
      before.role === Role.owner &&
      ((dto.role && dto.role !== Role.owner) || dto.active === false);
    if (losesOwner) await this.assertAnotherOwner(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        initials: dto.fullName ? initialsOf(dto.fullName) : undefined,
        role: dto.role,
        email: dto.email === undefined ? undefined : normalizeEmail(dto.email),
        phone: dto.phone === undefined ? undefined : normalizePhone(dto.phone),
        active: dto.active,
        pinHash: dto.pin ? await bcrypt.hash(dto.pin, 10) : undefined,
        ...(dto.pin ? { failedPinCount: 0, pinLockedUntil: null } : {}),
      },
    });
    // Cambio de PIN, rol o desactivación: cierra sus sesiones abiertas.
    if (dto.pin || dto.role || dto.active === false) {
      await this.auth.revokeUserSessions(id);
    }
    await this.audit.log(actorId, 'user', id, 'update', {
      ...dto,
      pin: dto.pin ? '••••' : undefined,
    });
    return toUserJson(user);
  }

  async remove(id: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (id === actorId) throw new BadRequestException('No puedes darte de baja a ti mismo');
    if (user.role === Role.owner) await this.assertAnotherOwner(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await this.auth.revokeUserSessions(id);
    await this.audit.log(actorId, 'user', id, 'delete');
  }

  private async assertAnotherOwner(exceptId: string) {
    const others = await this.prisma.user.count({
      where: { role: Role.owner, active: true, deletedAt: null, id: { not: exceptId } },
    });
    if (!others) throw new BadRequestException('Debe quedar al menos un dueño activo');
  }
}
