import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { DashboardModule } from './dashboard/dashboard.controller.js';
import { PermissionsGuard } from './common/permissions.guard.js';
import { HealthController } from './health/health.controller.js';
import { MessagesModule } from './messages/messages.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { TagsModule } from './tags/tags.module.js';
import { TodayModule } from './today/today.module.js';
import { UsersModule } from './users/users.module.js';
import { VisitsModule } from './visits/visits.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    SettingsModule,
    AuthModule,
    MessagesModule,
    UsersModule,
    ClientsModule,
    TagsModule,
    VisitsModule,
    AppointmentsModule,
    TodayModule,
    CampaignsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    // Todo requiere sesión salvo @Public(); después se comprueba el permiso (@Can).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
