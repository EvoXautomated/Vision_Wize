import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ example: '1234' })
  @Matches(/^\d{4}$/, { message: 'El PIN son 4 dígitos' })
  pin: string;
}
