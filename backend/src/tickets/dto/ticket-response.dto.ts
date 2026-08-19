import { ApiProperty } from '@nestjs/swagger';
import type { TicketPriority, TicketStatus } from '@prisma/client';

// Denormalized customer/assignedUser summaries — mirrors
// CompanyListItemDto.adminEmail — so the frontend doesn't need a second
// round-trip to show "who is this from" / "who's it assigned to".
export class TicketCustomerSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class TicketAssignedUserSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty() email: string;
}

export class TicketResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() subject: string;
  @ApiProperty() status: TicketStatus;
  @ApiProperty() priority: TicketPriority;
  @ApiProperty({ nullable: true, type: String }) category: string | null;
  @ApiProperty({ nullable: true, type: String }) sentiment: string | null;
  @ApiProperty({ type: TicketCustomerSummaryDto }) customer: TicketCustomerSummaryDto;
  @ApiProperty({ type: TicketAssignedUserSummaryDto, nullable: true })
  assignedUser: TicketAssignedUserSummaryDto | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedTicketsDto {
  @ApiProperty({ type: [TicketResponseDto] }) data: TicketResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) pagination: PaginationMetaDto;
}
