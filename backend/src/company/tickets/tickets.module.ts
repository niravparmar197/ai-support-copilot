import { Module } from '@nestjs/common';
import { TicketsModule } from '../../tickets/tickets.module';
import { CompanyTicketsController } from './tickets.controller';

@Module({
  imports: [TicketsModule],
  controllers: [CompanyTicketsController],
})
export class CompanyTicketsModule {}
