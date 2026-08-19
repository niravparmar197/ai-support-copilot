import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

// No authorType field — hardcoded server-side per endpoint
// (CompanyTicketsController -> SUPPORT, CustomerTicketsController ->
// CUSTOMER), same "closed by construction" pattern as CreateUserDto's
// missing role field (D-027).
export class CreateTicketMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
