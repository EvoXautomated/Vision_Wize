import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Public } from '../common/decorators.js';
import { EnrollDeviceDto, LoginDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { DevicesService } from './devices.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly devices: DevicesService,
  ) {}

  @Public()
  @Get('team')
  team(@Headers('x-device-token') device: string | undefined) {
    return this.auth.team(device);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('x-device-token') device: string | undefined) {
    return this.auth.login(dto, device);
  }

  /** Autoriza este dispositivo con el código que genera el dueño en Ajustes. */
  @Public()
  @Post('devices/enroll')
  enroll(@Body() dto: EnrollDeviceDto) {
    return this.devices.enroll(dto.code, dto.name);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }
}
