import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module.js';
import { VisitsModule } from '../visits/visits.module.js';
import { TodayController } from './today.controller.js';

@Module({ imports: [VisitsModule, AppointmentsModule], controllers: [TodayController] })
export class TodayModule {}
