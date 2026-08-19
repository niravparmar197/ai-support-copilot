import { Module } from '@nestjs/common';
import { TicketsModule } from '../../tickets/tickets.module';
import { CustomerTicketsController } from './tickets.controller';

@Module({
  imports: [TicketsModule],
  controllers: [CustomerTicketsController],
})
export class CustomerTicketsModule {}
