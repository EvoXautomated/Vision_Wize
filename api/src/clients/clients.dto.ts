import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ContactPref } from '../generated/prisma/client.js';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateClientDto {
  @ApiProperty() @IsString() @MinLength(1) firstName: string;
  @ApiProperty() @IsString() @MinLength(1) lastName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail({}, { message: 'Correo no válido' }) email?: string;
  @ApiPropertyOptional({ example: '1985-04-12' })
  @IsOptional() @Matches(YMD, { message: 'Fecha con formato aaaa-mm-dd' })
  birthDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ enum: ContactPref }) @IsOptional() @IsEnum(ContactPref) contactPref?: ContactPref;
  /** true: el cliente acepta SMS ahora (se guarda la fecha). false: lo retira. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() smsConsent?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailConsent?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() unsubscribed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional({ type: [String], description: 'Nombres de etiqueta' })
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsObject() extra?: Record<string, unknown>;
  /** Fecha de un examen anterior al sistema (cliente que ya venía). null la borra. */
  @ApiPropertyOptional() @IsOptional() @Matches(YMD) priorExamAt?: string | null;
  /** Crear aunque haya posibles duplicados. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() force?: boolean;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ListClientsQuery {
  @ApiPropertyOptional({ description: 'Nombre, teléfono, correo o etiqueta' })
  @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tag?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sellerId?: string;
  @ApiPropertyOptional({ enum: ['overdue', 'due_soon'] })
  @IsOptional() @IsString() exam?: 'overdue' | 'due_soon';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class DuplicatesQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() birthDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() excludeId?: string;
}

export class MergeDto {
  /** Ficha que desaparece: su historial pasa a la ficha de la URL. */
  @ApiProperty() @IsString() sourceId: string;
}

export class NoteDto {
  @ApiProperty() @IsString() @MinLength(1) body: string;
}

export class ImportDto {
  /** Filas ya leídas del Excel/CSV: [{ firstName, lastName, phone, … }] */
  @ApiProperty() @IsArray() rows: Record<string, unknown>[];
  /** true: solo valida y devuelve el informe, sin guardar. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dryRun?: boolean;
}
