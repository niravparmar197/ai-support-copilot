import { Injectable, NotFoundException } from '@nestjs/common';
import type { Ticket, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { AssignTicketDto } from './dto/assign-ticket.dto';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import type {
  PaginatedTicketsDto,
  TicketResponseDto,
} from './dto/ticket-response.dto';
import type { UpdateTicketDto } from './dto/update-ticket.dto';

const TICKET_INCLUDE = {
  customer: { select: { id: true, name: true, email: true } },
  assignedUser: { select: { id: true, name: true, email: true } },
} as const;

type TicketWithRelations = Ticket & {
  customer: { id: string; name: string; email: string };
  assignedUser: { id: string; name: string | null; email: string } | null;
};

// Shared by both CompanyTicketsController (staff) and
// CustomerTicketsController (customer) — unlike CustomerAuthService/
// AuthService (D-029), this is plain parameterized CRUD with no stateful
// security logic to duplicate, so one service backing two
// differently-scoped controllers is the simpler, more maintainable choice
// (see the accompanying DECISIONS.md entry for the full contrast).
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCustomer(
    tenantId: string,
    customerId: string,
    dto: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          tenantId,
          customerId,
          subject: dto.subject,
          priority: dto.priority ?? 'MEDIUM',
          status: 'OPEN',
        },
        include: TICKET_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: customerId,
          action: 'ticket.created',
          targetType: 'ticket',
          targetId: created.id,
          metadata: { subject: dto.subject },
        },
      });

      return created;
    });

    return toTicketResponse(ticket);
  }

  async listForCustomer(
    tenantId: string,
    customerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedTicketsDto> {
    return this.list({ tenantId, customerId }, query);
  }

  async getForCustomer(
    tenantId: string,
    customerId: string,
    id: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    if (!ticket || ticket.tenantId !== tenantId || ticket.customerId !== customerId) {
      throw new NotFoundException();
    }

    return toTicketResponse(ticket);
  }

  async listForTenant(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedTicketsDto> {
    return this.list({ tenantId }, query);
  }

  async getForTenant(tenantId: string, id: string): Promise<TicketResponseDto> {
    return toTicketResponse(await this.findTenantTicket(tenantId, id));
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateTicketDto,
    actorId: string,
  ): Promise<TicketResponseDto> {
    await this.findTenantTicket(tenantId, id);

    const ticket = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id },
        data: dto,
        include: TICKET_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'ticket.updated',
          targetType: 'ticket',
          targetId: id,
          metadata: { ...dto },
        },
      });

      return updated;
    });

    return toTicketResponse(ticket);
  }

  /**
   * Day 19. Assigning an OPEN ticket moves it to ASSIGNED; unassigning an
   * ASSIGNED ticket moves it back to OPEN. A ticket already past that
   * (IN_PROGRESS, WAITING_FOR_CUSTOMER, ...) only has its assignee
   * changed — reassignment/unassignment doesn't reset triage progress.
   * This status coupling is a real product-behavior call, not something
   * requested outright; see DECISIONS.md.
   */
  async assignTicket(
    tenantId: string,
    id: string,
    dto: AssignTicketDto,
    actorId: string,
  ): Promise<TicketResponseDto> {
    const existing = await this.findTenantTicket(tenantId, id);
    const assignedUserId = dto.assignedUserId;

    if (assignedUserId !== null) {
      const target = await this.prisma.user.findUnique({
        where: { id: assignedUserId },
      });

      if (!target || target.tenantId !== tenantId || target.role !== 'SUPPORT_USER') {
        throw new NotFoundException();
      }
    }

    const statusUpdate = this.nextStatusForAssignment(
      existing.status,
      assignedUserId,
    );

    const ticket = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id },
        data: {
          assignedUserId,
          ...(statusUpdate ? { status: statusUpdate } : {}),
        },
        include: TICKET_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: assignedUserId ? 'ticket.assigned' : 'ticket.unassigned',
          targetType: 'ticket',
          targetId: id,
          metadata: { assignedUserId },
        },
      });

      return updated;
    });

    return toTicketResponse(ticket);
  }

  private nextStatusForAssignment(
    currentStatus: TicketStatus,
    assignedUserId: string | null,
  ): TicketStatus | undefined {
    if (assignedUserId !== null && currentStatus === 'OPEN') {
      return 'ASSIGNED';
    }

    if (assignedUserId === null && currentStatus === 'ASSIGNED') {
      return 'OPEN';
    }

    return undefined;
  }

  private async list(
    where: { tenantId: string; customerId?: string },
    query: PaginationQueryDto,
  ): Promise<PaginatedTicketsDto> {
    const { page, pageSize } = query;

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: TICKET_INCLUDE,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map(toTicketResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // 404, not 403, for a wrong-tenant id — same "don't confirm existence of
  // something the caller has no business seeing" as UsersService/
  // CustomersService.
  private async findTenantTicket(
    tenantId: string,
    id: string,
  ): Promise<TicketWithRelations> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: TICKET_INCLUDE,
    });

    if (!ticket || ticket.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    return ticket;
  }
}

function toTicketResponse(ticket: TicketWithRelations): TicketResponseDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    sentiment: ticket.sentiment,
    customer: ticket.customer,
    assignedUser: ticket.assignedUser,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
