import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { VisitStatus } from '../generated/prisma/client.js';

export class CreateVisitDto {
  @ApiProperty() @IsString() clientId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appointmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateVisitDto {
  /** Solo la fecha del examen; nunca graduación ni diagnóstico. null la borra. */
  @ApiPropertyOptional({ example: '2026-11-22' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) examDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) frame?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() doctorId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class VisitStatusDto {
  @ApiProperty({ enum: VisitStatus }) @IsEnum(VisitStatus) status: VisitStatus;
}
