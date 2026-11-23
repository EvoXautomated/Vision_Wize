import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Channel } from '../generated/prisma/client.js';

/** A quién va la campaña. Todos los filtros se combinan (Y). Vacío = todos. */
export class Segment {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ description: 'Id de vendedora o "none"' }) @IsOptional() @IsString() sellerId?: string;
  @ApiPropertyOptional({ description: 'Cumplen años este mes' }) @IsOptional() @IsBoolean() birthdayMonth?: boolean;
  @ApiPropertyOptional({ description: 'Sin visitas en los últimos N meses' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) inactiveMonths?: number;
  @ApiPropertyOptional({ description: 'Con la revisión vencida' }) @IsOptional() @IsBoolean() examOverdue?: boolean;
}

export class CampaignDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
  @ApiProperty({ enum: ['sms', 'email'] }) @IsIn(['sms', 'email']) channel: Channel;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) body: string;
  @ApiPropertyOptional({ type: Segment }) @IsOptional() @ValidateNested() @Type(() => Segment) segment?: Segment;
}

export class PreviewDto {
  @ApiProperty({ enum: ['sms', 'email'] }) @IsIn(['sms', 'email']) channel: Channel;
  @ApiPropertyOptional({ type: Segment }) @IsOptional() @ValidateNested() @Type(() => Segment) segment?: Segment;
}

export class TestDto {
  @ApiProperty({ description: 'Teléfono o correo de prueba' }) @IsString() @MinLength(3) to: string;
}
