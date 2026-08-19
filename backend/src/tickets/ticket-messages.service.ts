import { Injectable } from '@nestjs/common';
import type { MessageAuthorType, TicketMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import type { TicketMessageResponseDto } from './dto/ticket-message-response.dto';
import { TicketsService } from './tickets.service';

// Shared by CompanyTicketsController and CustomerTicketsController, same
// reasoning as TicketsService/D-030 — plain CRUD, no stateful logic to
// duplicate. Delegates ticket-scoping to TicketsService.getForTenant/
// getForCustomer (both throw 404 for a ticket the caller can't see)
// instead of re-implementing that check here.
@Injectable()
export class TicketMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async createFromStaff(
    tenantId: string,
    ticketId: string,
    dto: CreateTicketMessageDto,
    authorId: string,
  ): Promise<TicketMessageResponseDto> {
    await this.ticketsService.getForTenant(tenantId, ticketId);
    return this.create(tenantId, ticketId, 'SUPPORT', authorId, dto);
  }

  async createFromCustomer(
    tenantId: string,
    customerId: string,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketMessageResponseDto> {
    await this.ticketsService.getForCustomer(tenantId, customerId, ticketId);
    return this.create(tenantId, ticketId, 'CUSTOMER', customerId, dto);
  }

  async listForStaff(
    tenantId: string,
    ticketId: string,
  ): Promise<TicketMessageResponseDto[]> {
    await this.ticketsService.getForTenant(tenantId, ticketId);
    return this.list(ticketId);
  }

  async listForCustomer(
    tenantId: string,
    customerId: string,
    ticketId: string,
  ): Promise<TicketMessageResponseDto[]> {
    await this.ticketsService.getForCustomer(tenantId, customerId, ticketId);
    return this.list(ticketId);
  }

  private async create(
    tenantId: string,
    ticketId: string,
    authorType: MessageAuthorType,
    authorId: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketMessageResponseDto> {
    const message = await this.prisma.ticketMessage.create({
      data: { tenantId, ticketId, authorType, authorId, content: dto.content },
    });

    const [response] = await this.resolveAuthorNames([message]);
    return response;
  }

  private async list(ticketId: string): Promise<TicketMessageResponseDto[]> {
    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return this.resolveAuthorNames(messages);
  }

  /**
   * Batched, not per-message — authorId has no DB relation (D-014), so
   * there's no `include` to lean on. Groups by authorType, does one
   * Customer.findMany and one User.findMany covering every message in the
   * list, then maps back. O(2) queries regardless of thread length.
   */
  private async resolveAuthorNames(
    messages: TicketMessage[],
  ): Promise<TicketMessageResponseDto[]> {
    const customerIds = [
      ...new Set(
        messages
          .filter((m) => m.authorType === 'CUSTOMER' && m.authorId)
          .map((m) => m.authorId as string),
      ),
    ];
    const supportIds = [
      ...new Set(
        messages
          .filter((m) => m.authorType === 'SUPPORT' && m.authorId)
          .map((m) => m.authorId as string),
      ),
    ];

    const [customers, users] = await Promise.all([
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      supportIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: supportIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const nameById = new Map<string, string | null>();
    for (const c of customers) nameById.set(c.id, c.name);
    for (const u of users) nameById.set(u.id, u.name);

    return messages.map((message) => ({
      id: message.id,
      authorType: message.authorType,
      authorName: message.authorId ? (nameById.get(message.authorId) ?? null) : null,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }
}
