import { Global, Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { TwilioController } from './twilio.controller.js';

@Global()
@Module({
  controllers: [MessagesController, TwilioController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
