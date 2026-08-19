import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { PrismaService } from '../../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const CUSTOMER_ID = 'customer-1';

function buildService(prismaOverrides: Record<string, unknown>) {
  const prisma = {
    customer: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
    ...prismaOverrides,
  };

  return { service: new OrdersService(prisma as unknown as PrismaService), prisma };
}

describe('OrdersService', () => {
  it('404s for a customer id from another tenant', async () => {
    const { service } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: CUSTOMER_ID, tenantId: 'tenant-2' }),
      },
    });

    await expect(
      service.listForCustomer(TENANT_ID, CUSTOMER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for a customer id that does not exist', async () => {
    const { service } = buildService({
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.listForCustomer(TENANT_ID, CUSTOMER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty array for a customer with no orders', async () => {
    const { service } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: CUSTOMER_ID, tenantId: TENANT_ID }),
      },
      order: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await service.listForCustomer(TENANT_ID, CUSTOMER_ID);

    expect(result).toEqual([]);
  });

  it('scopes the order query to (tenantId, customerId) and nests payments as strings', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'order-1',
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalAmount: { toString: () => '49.99' },
        status: 'PAID',
        createdAt: new Date('2026-01-01'),
        payments: [
          {
            id: 'payment-1',
            amount: { toString: () => '49.99' },
            status: 'SUCCEEDED',
            method: 'card',
            createdAt: new Date('2026-01-01'),
          },
        ],
      },
    ]);
    const { service, prisma } = buildService({
      customer: {
        findUnique: jest.fn().mockResolvedValue({ id: CUSTOMER_ID, tenantId: TENANT_ID }),
      },
      order: { findMany },
    });

    const result = await service.listForCustomer(TENANT_ID, CUSTOMER_ID);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, customerId: CUSTOMER_ID },
      }),
    );
    expect(result[0].totalAmount).toBe('49.99');
    expect(result[0].payments[0].amount).toBe('49.99');
  });
});
