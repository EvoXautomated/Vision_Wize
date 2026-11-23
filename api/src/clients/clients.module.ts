import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { ImportService } from './import.service.js';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService, ImportService],
  exports: [ClientsService],
})
export class ClientsModule {}
