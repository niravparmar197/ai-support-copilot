import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AssignTicketDto } from '../../tickets/dto/assign-ticket.dto';
import { CreateTicketMessageDto } from '../../tickets/dto/create-ticket-message.dto';
import { TicketMessageResponseDto } from '../../tickets/dto/ticket-message-response.dto';
import {
  PaginatedTicketsDto,
  TicketResponseDto,
} from '../../tickets/dto/ticket-response.dto';
import { UpdateTicketDto } from '../../tickets/dto/update-ticket.dto';
import { TicketMessagesService } from '../../tickets/ticket-messages.service';
import { TicketsService } from '../../tickets/tickets.service';

// user.tenantId! below: @Roles() (COMPANY_ADMIN/SUPPORT_USER only)
// guarantees a non-null tenantId (D-008), same reasoning as
// UsersController/CustomersController.
@ApiTags('company/tickets')
@Controller('company/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN', 'SUPPORT_USER')
export class CompanyTicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketMessagesService: TicketMessagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the caller’s company tickets (paginated)' })
  @ApiResponse({ status: 200, type: PaginatedTicketsDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.listForTenant(user.tenantId!, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ticket' })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No ticket with that id in the caller’s company.',
  })
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.getForTenant(user.tenantId!, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a ticket’s status/priority/category',
  })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No ticket with that id in the caller’s company.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.updateForTenant(
      user.tenantId!,
      id,
      dto,
      user.id,
    );
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary:
      'Assign (or unassign, with assignedUserId: null) a ticket to a Support User',
  })
  @ApiResponse({ status: 200, type: TicketResponseDto })
  @ApiResponse({
    status: 404,
    description:
      'No ticket with that id, or no Support User with that id, in the caller’s company.',
  })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.assignTicket(
      user.tenantId!,
      id,
      dto,
      user.id,
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List a ticket’s conversation thread' })
  @ApiResponse({ status: 200, type: [TicketMessageResponseDto] })
  @ApiResponse({
    status: 404,
    description: 'No ticket with that id in the caller’s company.',
  })
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketMessagesService.listForStaff(user.tenantId!, id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a reply on a ticket' })
  @ApiResponse({ status: 201, type: TicketMessageResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No ticket with that id in the caller’s company.',
  })
  createMessage(
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketMessagesService.createFromStaff(
      user.tenantId!,
      id,
      dto,
      user.id,
    );
  }
}
