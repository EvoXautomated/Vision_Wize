import { Body, Controller, ForbiddenException, Headers, HttpCode, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators.js';
import { Channel, MessageStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validSvixSignature } from './transports.js';

interface ResendEvent {
  type?: string;
  data?: { email_id?: string };
}

/** Webhook de Resend: entrega, rebote y queja de spam de cada correo. */
@ApiExcludeController()
@Public()
@Controller('public/resend')
export class ResendController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  @HttpCode(204)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') id: string | undefined,
    @Headers('svix-timestamp') timestamp: string | undefined,
    @Headers('svix-signature') signature: string | undefined,
    @Body() event: ResendEvent,
  ) {
    if (!validSvixSignature(req.rawBody, id, timestamp, signature)) throw new ForbiddenException();
    const providerId = event.data?.email_id;
    if (!providerId) return;
    const where = { providerId, channel: Channel.email };

    if (event.type === 'email.delivered') {
      await this.prisma.message.updateMany({
        where: { ...where, status: MessageStatus.sent },
        data: { status: MessageStatus.delivered },
      });
    } else if (event.type === 'email.bounced') {
      await this.prisma.message.updateMany({
        where: { ...where, status: { in: [MessageStatus.sent, MessageStatus.delivered] } },
        data: { status: MessageStatus.failed, error: 'Correo rebotado: la dirección no existe o no admite mensajes' },
      });
    } else if (event.type === 'email.complained') {
      // Lo marcó como spam: se le da de baja, igual que si hubiera pulsado el enlace.
      const message = await this.prisma.message.findUnique({ where: { providerId }, select: { clientId: true } });
      if (!message?.clientId) return;
      const done = await this.prisma.client.updateMany({
        where: { id: message.clientId, unsubscribedAt: null },
        data: { unsubscribedAt: new Date() },
      });
      if (!done.count) return;
      await this.prisma.auditLog.create({
        data: {
          entity: 'client',
          entityId: message.clientId,
          action: 'update',
          changes: { unsubscribedAt: { from: null, to: 'marcó un correo como spam' } },
        },
      });
    }
  }
}
