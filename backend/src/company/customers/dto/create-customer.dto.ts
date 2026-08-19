import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  // Added Day 17 (D-029) — every Customer now needs a password to use the
  // customer portal. Provisioned by staff at creation time, same pattern
  // as CreateUserDto.temporaryPassword.
  @ApiProperty()
  @IsString()
  @MinLength(12)
  temporaryPassword: string;
}
