import { Body, Controller, ForbiddenException, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators.js';
import { normalizePhone } from '../common/normalize.js';
import { MessageStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validTwilioSignature } from './transports.js';

const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'BAJA', 'PARAR'];
const START_WORDS = ['START', 'UNSTOP', 'YES', 'ALTA'];

/** Webhooks de Twilio: estado de entrega de cada SMS y respuestas STOP/START. */
@ApiExcludeController()
@Public()
@Controller('public/twilio')
export class TwilioController {
  constructor(private readonly prisma: PrismaService) {}

  private check(req: Request, signature: string | undefined, body: Record<string, string>) {
    const url = `${process.env.PUBLIC_API_URL ?? ''}${req.originalUrl}`;
    if (!validTwilioSignature(url, body, signature)) throw new ForbiddenException();
  }

  @Post('status')
  @HttpCode(204)
  async status(
    @Req() req: Request,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: Record<string, string>,
  ) {
    this.check(req, signature, body);
    const map: Record<string, MessageStatus> = {
      delivered: MessageStatus.delivered,
      undelivered: MessageStatus.failed,
      failed: MessageStatus.failed,
    };
    const status = map[body.MessageStatus];
    if (!status || !body.MessageSid) return;
    await this.prisma.message.updateMany({
      where: { providerId: body.MessageSid },
      data: {
        status,
        error: status === MessageStatus.failed ? `Twilio ${body.ErrorCode ?? body.MessageStatus}` : null,
      },
    });
  }

  /** SMS entrante: STOP da de baja (Twilio ya bloquea el número; aquí se refleja en la ficha). */
  @Post('inbound')
  async inbound(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: Record<string, string>,
  ) {
    this.check(req, signature, body);
    const word = (body.Body ?? '').trim().toUpperCase();
    const phone = normalizePhone(body.From);
    if (phone && STOP_WORDS.includes(word)) {
      const clients = await this.prisma.client.findMany({ where: { phone, unsubscribedAt: null }, select: { id: true } });
      await this.prisma.client.updateMany({ where: { phone, unsubscribedAt: null }, data: { unsubscribedAt: new Date(), smsConsentAt: null } });
      await this.prisma.auditLog.createMany({
        data: clients.map((c) => ({
          entity: 'client',
          entityId: c.id,
          action: 'update',
          changes: { unsubscribedAt: { from: null, to: 'respondió STOP por SMS' } },
        })),
      });
    } else if (phone && START_WORDS.includes(word)) {
      await this.prisma.client.updateMany({ where: { phone }, data: { unsubscribedAt: null, smsConsentAt: new Date() } });
    }
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}
