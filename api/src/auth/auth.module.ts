import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Global()
@Module({
  controllers: [AuthController, DevicesController],
  providers: [AuthService, DevicesService],
  exports: [AuthService],
})
export class AuthModule {}
