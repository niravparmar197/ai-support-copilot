import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Customer-facing (POST /customer/tickets). No status field — every new
// ticket starts OPEN, not the caller's choice. No category/sentiment
// either — those are AI-assigned later (Day 25+), not something a
// customer sets at creation.
export class CreateTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
