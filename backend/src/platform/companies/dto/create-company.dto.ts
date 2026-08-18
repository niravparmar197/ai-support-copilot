import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  adminName: string;

  @ApiProperty()
  @IsEmail()
  adminEmail: string;

  // Admin-provisioned, not the user's own choice — held to a slightly
  // higher minimum than the general login password (MinLength(8) in
  // LoginDto), since it's a credential a Super Admin is typing/generating
  // on someone else's behalf.
  @ApiProperty()
  @IsString()
  @MinLength(12)
  temporaryPassword: string;
}
