import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { ImportService } from './import.service.js';

@Module({
  controllers: [ClientsController, CallsController],
  providers: [ClientsService, ImportService],
  exports: [ClientsService],
})
export class ClientsModule {}
