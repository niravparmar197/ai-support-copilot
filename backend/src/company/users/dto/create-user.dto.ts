import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

// Deliberately no `role` field — mirrors CreateCompanyDto in spirit, but
// the role here isn't the caller's choice at all: UsersService hardcodes
// SUPPORT_USER server-side (D-014). Accepting a role field from the client
// would reopen exactly the privilege-escalation path D-014 exists to close.
export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  // Admin-provisioned, not the user's own choice — same reasoning and
  // minimum as CreateCompanyDto.temporaryPassword.
  @ApiProperty()
  @IsString()
  @MinLength(12)
  temporaryPassword: string;
}
