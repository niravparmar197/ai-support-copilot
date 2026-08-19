import { Module } from '@nestjs/common';
import { TicketMessagesService } from './ticket-messages.service';
import { TicketsService } from './tickets.service';

@Module({
  providers: [TicketsService, TicketMessagesService],
  exports: [TicketsService, TicketMessagesService],
})
export class TicketsModule {}
