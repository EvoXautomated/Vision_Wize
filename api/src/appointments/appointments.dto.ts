import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty() @IsString() clientId: string;
  @ApiProperty({ example: '2026-11-25T15:00:00.000Z' }) @IsDateString() startsAt: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(240) durationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() doctorId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() startsAt?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(240) durationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() doctorId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class AppointmentStatusDto {
  @ApiProperty({ enum: ['scheduled', 'confirmed', 'cancelled', 'no_show'] })
  @IsIn(['scheduled', 'confirmed', 'cancelled', 'no_show'])
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show';
}

export class RangeQuery {
  @ApiProperty({ example: '2026-11-22' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) from: string;
  @ApiProperty({ example: '2026-11-29', description: 'Incluido' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) to: string;
}
