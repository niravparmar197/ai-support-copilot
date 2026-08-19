import { ApiProperty } from '@nestjs/swagger';
import type { MessageAuthorType } from '@prisma/client';

export class TicketMessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['CUSTOMER', 'SUPPORT', 'AI'] }) authorType: MessageAuthorType;
  // Resolved at read time (TicketMessagesService), not stored — authorId
  // is polymorphic/unFK'd (D-014), so there's no join to do it for us.
  // null for AI (no author row) or if the author record was deleted.
  @ApiProperty({ nullable: true, type: String }) authorName: string | null;
  @ApiProperty() content: string;
  @ApiProperty() createdAt: Date;
}
