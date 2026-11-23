import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuthUser } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { toUserJson } from '../users/user.json.js';
import { LoginDto } from './auth.dto.js';

// PIN de 4 dígitos: tras MAX_FAILED intentos el usuario queda bloqueado un rato.
const MAX_FAILED = 5;
const LOCK_MINUTES = 5;

const notLocked = () => ({
  OR: [{ pinLockedUntil: null }, { pinLockedUntil: { lte: new Date() } }],
});

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    config: ConfigService,
  ) {
    this.ttlMs = Number(config.get('SESSION_TTL_HOURS', 12)) * 3_600_000;
  }

  /** Equipo activo para la pantalla de PIN del iPad. */
  async team() {
    const users = await this.prisma.user.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { fullName: 'asc' },
    });
    return users.map((u) => {
      const { id, fullName, initials, role } = toUserJson(u);
      return { id, fullName, initials, role };
    });
  }

  /**
   * Cada intento reserva un hueco en `failedPinCount` con un UPDATE
   * condicional antes de bcrypt: el límite vale también con intentos concurrentes.
   */
  async login({ userId, pin }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active || user.deletedAt || !user.pinHash) {
      throw new UnauthorizedException('Usuario o PIN incorrecto');
    }
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      throw this.lockedError(user.pinLockedUntil);
    }
    const reserved = await this.prisma.user.updateMany({
      where: { id: user.id, failedPinCount: { lt: MAX_FAILED }, ...notLocked() },
      data: { failedPinCount: { increment: 1 } },
    });
    if (reserved.count === 0) throw await this.currentLockError(user.id);

    const valid = await bcrypt.compare(pin, user.pinHash);
    if (!valid) {
      await this.prisma.user.updateMany({
        where: { id: user.id, failedPinCount: { gte: MAX_FAILED } },
        data: {
          failedPinCount: 0,
          pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
        },
      });
      throw new UnauthorizedException('Usuario o PIN incorrecto');
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction(async (tx) => {
      const reset = await tx.user.updateMany({
        where: { id: user.id, ...notLocked() },
        data: { failedPinCount: 0, pinLockedUntil: null },
      });
      if (reset.count === 0) throw await this.currentLockError(user.id);
      await tx.session.create({
        data: {
          tokenHash: hashToken(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + this.ttlMs),
        },
      });
    });
    return {
      token,
      user: toUserJson(user),
      grants: await this.settings.grantsFor(user.role),
    };
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
    });
    return {
      user: toUserJson(user),
      grants: await this.settings.grantsFor(user.role),
    };
  }

  private async currentLockError(userId: string) {
    const { pinLockedUntil } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { pinLockedUntil: true },
    });
    return this.lockedError(
      pinLockedUntil ?? new Date(Date.now() + LOCK_MINUTES * 60_000),
    );
  }

  private lockedError(until: Date) {
    const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
    return new HttpException(
      `Demasiados intentos. Prueba de nuevo en ${minutes} minuto${minutes === 1 ? '' : 's'}`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  revokeUserSessions(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async authenticate(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active ||
      session.user.deletedAt
    ) {
      return null;
    }
    const { user } = session;
    return {
      id: user.id,
      fullName: user.fullName,
      initials: user.initials,
      role: user.role,
      sessionId: session.id,
    };
  }
}
