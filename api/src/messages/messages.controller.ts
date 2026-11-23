import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Can, Public } from '../common/decorators.js';
import { MessagesService } from './messages.service.js';

@ApiTags('messages')
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @ApiBearerAuth()
  @Can('settings.manage')
  @Get('messages')
  recent() {
    return this.messages.recent();
  }

  /** Ejecuta el seguimiento y el envío ahora (para probar sin esperar al reloj). */
  @ApiBearerAuth()
  @Can('settings.manage')
  @Post('messages/run')
  async run() {
    const created = await this.messages.dailyFollowUps();
    const reminders = await this.messages.appointmentReminders();
    const sent = await this.messages.flush(true);
    return { created, reminders, sent };
  }

  /** Enlace de baja de los correos. */
  @Public()
  @Get('public/unsubscribe/:clientId/:sig')
  async unsubscribe(@Param('clientId') id: string, @Param('sig') sig: string, @Res() res: Response) {
    await this.messages.unsubscribe(id, sig);
    res.type('html').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:3rem;text-align:center"><h1>Listo</h1><p>No volverá a recibir mensajes promocionales.</p></body>');
  }
}
