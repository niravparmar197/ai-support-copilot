import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../customer-auth/decorators/current-customer.decorator';
import { CustomerJwtAuthGuard } from '../../customer-auth/guards/customer-jwt-auth.guard';
import type { AuthenticatedCustomer } from '../../customer-auth/types/authenticated-customer.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateTicketDto } from '../../tickets/dto/create-ticket.dto';
import { CreateTicketMessageDto } from '../../tickets/dto/create-ticket-message.dto';
import { TicketMessageResponseDto } from '../../tickets/dto/ticket-message-response.dto';
import {
  PaginatedTicketsDto,
  TicketResponseDto,
} from '../../tickets/dto/ticket-response.dto';
import { TicketMessagesService } from '../../tickets/ticket-messages.service';
import { TicketsService } from '../../tickets/tickets.service';

@ApiTags('customer/tickets')
@Controller('customer/tickets')
@UseGuards(CustomerJwtAuthGuard)
export class CustomerTicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketMessagesService: TicketMessagesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({ status: 201, type: TicketResponseDto })
  create(
    @Body() dto: CreateTicketDto,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    return this.ticketsService.createForCustomer(
      customer.tenantId,
      customer.id,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List the caller’s own tickets (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedTicketsDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    return this.ticketsService.listForCustomer(
      customer.tenantId,
      customer.id,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ticket the caller owns' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({ status: 404, description: 'No ticket with that id owned by the caller.' })
  get(
    @Param('id') id: string,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    return this.ticketsService.getForCustomer(
      customer.tenantId,
      customer.id,
      id,
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List a ticket’s conversation thread' })
  @ApiResponse({ status: 200, type: [TicketMessageResponseDto] })
  @ApiResponse({ status: 404, description: 'No ticket with that id owned by the caller.' })
  listMessages(
    @Param('id') id: string,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    return this.ticketMessagesService.listForCustomer(
      customer.tenantId,
      customer.id,
      id,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a reply on a ticket' })
  @ApiResponse({ status: 201, type: TicketMessageResponseDto })
  @ApiResponse({ status: 404, description: 'No ticket with that id owned by the caller.' })
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentCustomer() customer: AuthenticatedCustomer,
  ) {
    return this.ticketMessagesService.createFromCustomer(
      customer.tenantId,
      customer.id,
      id,
      dto,
    );
  }
}
