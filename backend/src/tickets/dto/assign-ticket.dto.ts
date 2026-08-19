import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Day 19. null (explicitly, not omitted) unassigns. TicketsService
// validates assignedUserId is a SUPPORT_USER in the caller's own tenant —
// not enforced by this DTO, same "validate the id belongs to the caller's
// scope in the service, not the DTO" pattern as CustomersService.
export class AssignTicketDto {
  @ApiProperty({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  assignedUserId: string | null;
}
