import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from './customers.service';
import type { PrismaService } from '../../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const ACTOR_ID = 'actor-1';

function duplicateEmailError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: { target: ['tenant_id', 'email'] },
  });
}

function buildService(prismaOverrides: Record<string, unknown>) {
  const prisma = {
    customer: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
    ...prismaOverrides,
  };

  return { service: new CustomersService(prisma as unknown as PrismaService), prisma };
}

function fakeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    tenantId: TENANT_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('CustomersService', () => {
  it('creates a customer scoped to the caller’s tenant', async () => {
    const { service, prisma } = buildService({
      customer: { create: jest.fn().mockResolvedValue(fakeCustomer()) },
    });

    const result = await service.createCustomer(
      TENANT_ID,
      { name: 'Ada Lovelace', email: 'ada@example.com', temporaryPassword: 'a-very-long-password' },
      ACTOR_ID,
    );

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT_ID }) }),
    );
    expect(result.email).toBe('ada@example.com');
  });

  it('maps a duplicate (tenantId, email) violation to 409 Conflict on create', async () => {
    const { service } = buildService({
      customer: { create: jest.fn().mockRejectedValue(duplicateEmailError()) },
    });

    await expect(
      service.createCustomer(
        TENANT_ID,
        { name: 'Ada', email: 'ada@example.com', temporaryPassword: 'a-very-long-password' },
        ACTOR_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a duplicate email violation to 409 Conflict on update too', async () => {
    const { service } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue(fakeCustomer()),
        update: jest.fn().mockRejectedValue(duplicateEmailError()),
      },
    });

    await expect(
      service.updateCustomer(TENANT_ID, 'customer-1', { email: 'taken@example.com' }, ACTOR_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404s updating a customer from another tenant', async () => {
    const { service } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue(fakeCustomer({ tenantId: 'tenant-2' })),
      },
    });

    await expect(
      service.updateCustomer(TENANT_ID, 'customer-1', { name: 'New Name' }, ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s deleting a customer that does not exist', async () => {
    const { service } = buildService({
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.deleteCustomer(TENANT_ID, 'customer-1', ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only the caller’s tenant customers', async () => {
    const { service, prisma } = buildService({
      customer: {
        findMany: jest.fn().mockResolvedValue([fakeCustomer()]),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    const result = await service.listCustomers(TENANT_ID, { page: 1, pageSize: 20 });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
    expect(result.data).toHaveLength(1);
  });
});
