import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
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

  /**
   * Enlace de baja de los correos. Abrirlo solo muestra la confirmación: los
   * antivirus y las vistas previas visitan los enlaces, así que la baja se
   * hace con el botón (POST), que también atiende la baja con un clic del
   * programa de correo (cabecera List-Unsubscribe-Post).
   */
  @Public()
  @Get('public/unsubscribe/:clientId/:sig')
  unsubscribePage(@Param('clientId') id: string, @Param('sig') sig: string, @Res() res: Response) {
    this.messages.checkUnsubscribeLink(id, sig);
    res.type('html').send(
      page(
        'Darse de baja',
        '<p>¿Quiere dejar de recibir nuestros mensajes promocionales?</p>' +
          '<form method="post"><button type="submit">Sí, darme de baja</button></form>',
      ),
    );
  }

  @Public()
  @Post('public/unsubscribe/:clientId/:sig')
  @HttpCode(200)
  async unsubscribe(@Param('clientId') id: string, @Param('sig') sig: string, @Res() res: Response) {
    await this.messages.unsubscribe(id, sig);
    res.type('html').send(page('Listo', '<p>No volverá a recibir mensajes promocionales.</p>'));
  }
}

const page = (title: string, body: string) =>
  '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
  `<title>${title}</title>` +
  '<body style="font-family:system-ui;padding:3rem 1.5rem;text-align:center;line-height:1.5">' +
  `<h1>${title}</h1>${body}` +
  '<style>button{font:inherit;padding:.8rem 1.4rem;border:0;border-radius:.6rem;background:#111;color:#fff;cursor:pointer}</style>' +
  '</body></html>';
