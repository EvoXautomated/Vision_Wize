import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ example: '1234' })
  @Matches(/^\d{4}$/, { message: 'El PIN son 4 dígitos' })
  pin: string;
}

export class EnrollDeviceDto {
  @ApiProperty({ example: '12345678' })
  @Matches(/^\d{8}$/, { message: 'El código son 8 dígitos' })
  code: string;

  @ApiProperty({ example: 'iPad de recepción' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}
