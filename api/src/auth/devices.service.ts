import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const PAIRING_MINUTES = 10;
const MAX_PAIRING_ATTEMPTS = 5;
const SEEN_EVERY_MS = 3_600_000;

/** Código de error para que la app muestre la pantalla de autorizar el dispositivo. */
export const DEVICE_NOT_TRUSTED = 'device_not_trusted';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Dispositivos de confianza. Un PIN de 4 dígitos no aguanta intentos desde
 * cualquier parte de internet: el equipo y el PIN solo se pueden usar desde un
 * dispositivo autorizado. El primero se autoriza solo, con el primer PIN
 * correcto; los demás, con un código que genera el dueño.
 * `DEVICE_TRUST=false` lo desactiva (desarrollo, o para recuperar el acceso si
 * se pierde el único dispositivo).
 */
@Injectable()
export class DevicesService {
  private readonly enforced: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.enforced = config.get<string>('DEVICE_TRUST', 'true') !== 'false';
  }

  private async find(token: string | undefined) {
    if (!token) return null;
    const device = await this.prisma.device.findUnique({ where: { tokenHash: sha(token) } });
    return device && !device.revokedAt ? device : null;
  }

  /**
   * Puerta de las rutas públicas del PIN. Devuelve el dispositivo, o
   * `bootstrap` si todavía no se ha autorizado ninguno (instalación nueva).
   */
  async gate(token: string | undefined): Promise<{ deviceId: string | null; bootstrap: boolean }> {
    if (!this.enforced) return { deviceId: null, bootstrap: false };
    const device = await this.find(token);
    if (device) {
      if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > SEEN_EVERY_MS) {
        await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      }
      return { deviceId: device.id, bootstrap: false };
    }
    if ((await this.prisma.device.count()) === 0) return { deviceId: null, bootstrap: true };
    throw new ForbiddenException({
      message: 'Este dispositivo no está autorizado. Pide un código al dueño.',
      code: DEVICE_NOT_TRUSTED,
    });
  }

  private async create(name: string) {
    const token = randomBytes(32).toString('base64url');
    const device = await this.prisma.device.create({
      data: { name: name.trim().slice(0, 60) || 'Dispositivo', tokenHash: sha(token), lastSeenAt: new Date() },
    });
    return { token, device };
  }

  /** Instalación nueva: el primer PIN correcto autoriza ese dispositivo. */
  enrollFirst() {
    return this.create('Primer dispositivo');
  }

  /** Código de 8 dígitos para autorizar otro dispositivo. Anula los anteriores. */
  async pairingCode(userId: string) {
    const code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000);
    await this.prisma.$transaction([
      this.prisma.devicePairing.deleteMany({}),
      this.prisma.devicePairing.create({ data: { codeHash: sha(code), expiresAt, createdById: userId } }),
    ]);
    return { code, expiresAt };
  }

  async enroll(code: string, name: string) {
    const invalid = () => new ForbiddenException('Código incorrecto o caducado. Pide uno nuevo al dueño.');
    const pairing = await this.prisma.devicePairing.findFirst({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!pairing) throw invalid();
    // Cada intento reserva su hueco antes de comparar: el tope vale con intentos concurrentes.
    const reserved = await this.prisma.devicePairing.updateMany({
      where: { id: pairing.id, usedAt: null, attempts: { lt: MAX_PAIRING_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (!reserved.count) throw invalid();
    if (!timingSafeEqual(Buffer.from(sha(code)), Buffer.from(pairing.codeHash))) throw invalid();
    const used = await this.prisma.devicePairing.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!used.count) throw invalid();
    const { token, device } = await this.create(name);
    return { deviceToken: token, device: { id: device.id, name: device.name } };
  }

  async list(currentToken: string | undefined) {
    const current = await this.find(currentToken);
    const rows = await this.prisma.device.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      current: d.id === current?.id,
    }));
  }

  /** Quita la autorización y cierra las sesiones abiertas desde ese dispositivo. */
  async revoke(id: string, currentToken: string | undefined) {
    const current = await this.find(currentToken);
    if (current?.id === id) throw new BadRequestException('No puedes quitar el dispositivo que estás usando');
    const now = new Date();
    const done = await this.prisma.device.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
    if (!done.count) throw new NotFoundException('Dispositivo no encontrado');
    await this.prisma.session.updateMany({ where: { deviceId: id, revokedAt: null }, data: { revokedAt: now } });
  }
}
