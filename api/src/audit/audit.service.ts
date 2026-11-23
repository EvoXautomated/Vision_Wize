import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    actorId: string | null,
    entity: string,
    entityId: string,
    action: string,
    changes: Record<string, unknown> = {},
    tx: Tx = this.prisma,
  ) {
    return tx.auditLog.create({
      data: {
        actorId,
        entity,
        entityId,
        action,
        changes: JSON.parse(JSON.stringify(changes)) as Prisma.InputJsonValue,
      },
    });
  }
}

/** Campos que cambian entre `before` y `after` (solo las claves de `after`). */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, to] of Object.entries(after)) {
    if (to === undefined) continue;
    const from = before[k];
    const a = from instanceof Date ? from.toISOString() : from;
    const b = to instanceof Date ? to.toISOString() : to;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}
