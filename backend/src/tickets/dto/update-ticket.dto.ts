import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

// Staff-facing (PATCH /company/tickets/:id). Deliberately no
// assignedUserId here — assignment is its own endpoint
// (POST /company/tickets/:id/assign, Day 19), same reasoning as
// User's deactivate/activate being separate from its generic update.
// No transition-graph enforcement on status — any enum value is
// accepted; a real state machine is a scope boundary being called out,
// not silently decided away.
export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
