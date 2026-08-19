import { ConflictException, NotFoundException } from '@nestjs/common';
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

  describe('updateForTenant status transitions (D-031)', () => {
    it('allows a valid transition', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const update = jest.fn().mockResolvedValue(fakeTicket({ status: 'IN_PROGRESS' }));
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket), update },
      });

      await service.updateForTenant(TENANT_ID, 'ticket-1', { status: 'IN_PROGRESS' }, ACTOR_ID);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
      );
    });

    it('rejects an invalid transition with 409', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket) },
      });

      await expect(
        service.updateForTenant(TENANT_ID, 'ticket-1', { status: 'RESOLVED' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects moving out of CLOSED entirely', async () => {
      const ticket = fakeTicket({ status: 'CLOSED' });
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket) },
      });

      await expect(
        service.updateForTenant(TENANT_ID, 'ticket-1', { status: 'OPEN' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows updating priority/category without touching status', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const update = jest.fn().mockResolvedValue(fakeTicket({ priority: 'HIGH' }));
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket), update },
      });

      await service.updateForTenant(TENANT_ID, 'ticket-1', { priority: 'HIGH' }, ACTOR_ID);

      expect(update).toHaveBeenCalled();
    });
  });

  describe('assignTicket', () => {
    it('moves an OPEN ticket to ASSIGNED when assigning a Support User', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const supportUser = { id: 'support-1', tenantId: TENANT_ID, role: 'SUPPORT_USER' };
      const update = jest.fn().mockResolvedValue(fakeTicket({ status: 'ASSIGNED' }));
      const { service, prisma } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket), update },
        user: { findUnique: jest.fn().mockResolvedValue(supportUser) },
      });

      await service.assignTicket(
        TENANT_ID,
        'ticket-1',
        { assignedUserId: 'support-1' },
        ACTOR_ID,
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedUserId: 'support-1', status: 'ASSIGNED' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'ticket.assigned' }) }),
      );
    });

    it('moves an ASSIGNED ticket back to OPEN when unassigned', async () => {
      const ticket = fakeTicket({ status: 'ASSIGNED', assignedUserId: 'support-1' });
      const update = jest.fn().mockResolvedValue(fakeTicket({ status: 'OPEN' }));
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket), update },
      });

      await service.assignTicket(
        TENANT_ID,
        'ticket-1',
        { assignedUserId: null },
        ACTOR_ID,
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedUserId: null, status: 'OPEN' }),
        }),
      );
    });

    it('does not touch status when reassigning a ticket already in progress', async () => {
      const ticket = fakeTicket({ status: 'IN_PROGRESS', assignedUserId: 'support-1' });
      const supportUser = { id: 'support-2', tenantId: TENANT_ID, role: 'SUPPORT_USER' };
      const update = jest.fn().mockResolvedValue(fakeTicket({ status: 'IN_PROGRESS' }));
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket), update },
        user: { findUnique: jest.fn().mockResolvedValue(supportUser) },
      });

      await service.assignTicket(
        TENANT_ID,
        'ticket-1',
        { assignedUserId: 'support-2' },
        ACTOR_ID,
      );

      const callArgs = update.mock.calls[0][0];
      expect(callArgs.data.assignedUserId).toBe('support-2');
      expect(callArgs.data.status).toBeUndefined();
    });

    it('404s assigning to a user who is not a Support User in the tenant', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const companyAdmin = { id: 'admin-1', tenantId: TENANT_ID, role: 'COMPANY_ADMIN' };
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket) },
        user: { findUnique: jest.fn().mockResolvedValue(companyAdmin) },
      });

      await expect(
        service.assignTicket(TENANT_ID, 'ticket-1', { assignedUserId: 'admin-1' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s assigning to a Support User from another tenant', async () => {
      const ticket = fakeTicket({ status: 'OPEN' });
      const otherTenantSupport = { id: 'support-3', tenantId: 'tenant-2', role: 'SUPPORT_USER' };
      const { service } = buildService({
        ticket: { findUnique: jest.fn().mockResolvedValue(ticket) },
        user: { findUnique: jest.fn().mockResolvedValue(otherTenantSupport) },
      });

      await expect(
        service.assignTicket(TENANT_ID, 'ticket-1', { assignedUserId: 'support-3' }, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
