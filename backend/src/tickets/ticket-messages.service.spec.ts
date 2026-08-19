import { TicketMessagesService } from './ticket-messages.service';
import type { TicketsService } from './tickets.service';
import type { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const TICKET_ID = 'ticket-1';

function buildService(
  prismaOverrides: Record<string, unknown>,
  ticketsServiceOverrides: Record<string, unknown> = {},
) {
  const prisma: Record<string, any> = {
    ticketMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    ticket: { update: jest.fn() },
    auditLog: { create: jest.fn() },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...prismaOverrides,
  };
  prisma.$transaction = jest.fn(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return (arg as (tx: unknown) => Promise<unknown>)(prisma);
  });
  const ticketsService = {
    getForTenant: jest.fn().mockResolvedValue({ id: TICKET_ID, status: 'OPEN' }),
    getForCustomer: jest.fn().mockResolvedValue({ id: TICKET_ID, status: 'OPEN' }),
    ...ticketsServiceOverrides,
  };

  return {
    service: new TicketMessagesService(
      prisma as unknown as PrismaService,
      ticketsService as unknown as TicketsService,
    ),
    prisma,
    ticketsService,
  };
}

function fakeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message-1',
    tenantId: TENANT_ID,
    ticketId: TICKET_ID,
    authorType: 'SUPPORT',
    authorId: 'staff-1',
    content: 'How can I help?',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('TicketMessagesService', () => {
  it('hardcodes authorType SUPPORT for a staff-authored message', async () => {
    const { service, prisma, ticketsService } = buildService({
      ticketMessage: { create: jest.fn().mockResolvedValue(fakeMessage()) },
    });

    await service.createFromStaff(TENANT_ID, TICKET_ID, { content: 'Hi' }, 'staff-1');

    expect(ticketsService.getForTenant).toHaveBeenCalledWith(TENANT_ID, TICKET_ID);
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorType: 'SUPPORT', authorId: 'staff-1' }),
      }),
    );
  });

  it('hardcodes authorType CUSTOMER for a customer-authored message', async () => {
    const { service, prisma, ticketsService } = buildService({
      ticketMessage: {
        create: jest.fn().mockResolvedValue(fakeMessage({ authorType: 'CUSTOMER', authorId: 'customer-1' })),
      },
    });

    await service.createFromCustomer(TENANT_ID, 'customer-1', TICKET_ID, { content: 'Help!' });

    expect(ticketsService.getForCustomer).toHaveBeenCalledWith(TENANT_ID, 'customer-1', TICKET_ID);
    expect(prisma.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorType: 'CUSTOMER', authorId: 'customer-1' }),
      }),
    );
  });

  describe('customer-reply auto-transition (D-031)', () => {
    it('moves WAITING_FOR_CUSTOMER to IN_PROGRESS when the customer replies', async () => {
      const update = jest.fn().mockResolvedValue({});
      const { service, prisma } = buildService(
        {
          ticketMessage: { create: jest.fn().mockResolvedValue(fakeMessage()) },
          ticket: { update },
        },
        {
          getForCustomer: jest
            .fn()
            .mockResolvedValue({ id: TICKET_ID, status: 'WAITING_FOR_CUSTOMER' }),
        },
      );

      await service.createFromCustomer(TENANT_ID, 'customer-1', TICKET_ID, {
        content: 'Still broken',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: TICKET_ID },
        data: { status: 'IN_PROGRESS' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ticket.status_changed',
            metadata: expect.objectContaining({ trigger: 'customer_reply' }),
          }),
        }),
      );
    });

    it('leaves the status alone when the ticket is not WAITING_FOR_CUSTOMER', async () => {
      const update = jest.fn();
      const { service } = buildService(
        {
          ticketMessage: { create: jest.fn().mockResolvedValue(fakeMessage()) },
          ticket: { update },
        },
        {
          getForCustomer: jest.fn().mockResolvedValue({ id: TICKET_ID, status: 'IN_PROGRESS' }),
        },
      );

      await service.createFromCustomer(TENANT_ID, 'customer-1', TICKET_ID, {
        content: 'Just checking in',
      });

      expect(update).not.toHaveBeenCalled();
    });
  });

  it('propagates the 404 from TicketsService for a ticket outside the caller’s scope', async () => {
    const notFound = new Error('not found');
    const { service } = buildService(
      {},
      { getForTenant: jest.fn().mockRejectedValue(notFound) },
    );

    await expect(
      service.listForStaff(TENANT_ID, TICKET_ID),
    ).rejects.toBe(notFound);
  });

  it('resolves author names via one batched Customer/User lookup, not per message', async () => {
    const messages = [
      fakeMessage({ id: 'm1', authorType: 'SUPPORT', authorId: 'staff-1' }),
      fakeMessage({ id: 'm2', authorType: 'CUSTOMER', authorId: 'customer-1' }),
      fakeMessage({ id: 'm3', authorType: 'AI', authorId: null }),
    ];
    const customerFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'customer-1', name: 'Ada' }]);
    const userFindMany = jest
      .fn()
      .mockResolvedValue([{ id: 'staff-1', name: 'Sam' }]);
    const { service } = buildService({
      ticketMessage: { findMany: jest.fn().mockResolvedValue(messages) },
      customer: { findMany: customerFindMany },
      user: { findMany: userFindMany },
    });

    const result = await service.listForStaff(TENANT_ID, TICKET_ID);

    expect(customerFindMany).toHaveBeenCalledTimes(1);
    expect(userFindMany).toHaveBeenCalledTimes(1);
    expect(result.find((m) => m.id === 'm1')?.authorName).toBe('Sam');
    expect(result.find((m) => m.id === 'm2')?.authorName).toBe('Ada');
    expect(result.find((m) => m.id === 'm3')?.authorName).toBeNull();
  });
});
