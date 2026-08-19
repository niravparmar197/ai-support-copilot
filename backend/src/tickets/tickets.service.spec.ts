import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import type { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const CUSTOMER_ID = 'customer-1';
const ACTOR_ID = 'staff-1';

function buildService(prismaOverrides: Record<string, unknown>) {
  const prisma = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
    ...prismaOverrides,
  };

  return { service: new TicketsService(prisma as unknown as PrismaService), prisma };
}

function fakeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    assignedUserId: null,
    subject: 'Help me',
    status: 'OPEN',
    priority: 'MEDIUM',
    category: null,
    sentiment: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    customer: { id: CUSTOMER_ID, name: 'Ada', email: 'ada@example.com' },
    assignedUser: null,
    ...overrides,
  };
}

describe('TicketsService', () => {
  it('creates a ticket scoped to the caller’s tenant, OPEN by default', async () => {
    const { service, prisma } = buildService({
      ticket: { create: jest.fn().mockResolvedValue(fakeTicket()) },
    });

    const result = await service.createForCustomer(TENANT_ID, CUSTOMER_ID, {
      subject: 'Help me',
    });

    expect(prisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          customerId: CUSTOMER_ID,
          status: 'OPEN',
          priority: 'MEDIUM',
        }),
      }),
    );
    expect(result.status).toBe('OPEN');
  });

  it('404s a customer fetching a ticket they don’t own', async () => {
    const { service } = buildService({
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue(fakeTicket({ customerId: 'someone-else' })),
      },
    });

    await expect(
      service.getForCustomer(TENANT_ID, CUSTOMER_ID, 'ticket-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s staff fetching a ticket from another tenant', async () => {
    const { service } = buildService({
      ticket: {
        findUnique: jest
          .fn()
          .mockResolvedValue(fakeTicket({ tenantId: 'tenant-2' })),
      },
    });

    await expect(
      service.getForTenant(TENANT_ID, 'ticket-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
