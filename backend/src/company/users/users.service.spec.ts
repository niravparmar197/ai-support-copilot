import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../../prisma/prisma.service';

const TENANT_ID = 'tenant-1';
const ACTOR_ID = 'actor-1';

function buildService(prismaOverrides: Record<string, unknown>) {
  const prisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
    ...prismaOverrides,
  };

  return { service: new UsersService(prisma as unknown as PrismaService), prisma };
}

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    tenantId: TENANT_ID,
    email: 'support@example.com',
    name: 'Support User',
    role: 'SUPPORT_USER',
    status: 'ACTIVE',
    mustResetPassword: true,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('UsersService', () => {
  it('creates a Support User scoped to the caller’s tenant', async () => {
    const created = fakeUser();
    const { service, prisma } = buildService({
      user: {
        create: jest.fn().mockResolvedValue(created),
      },
    });

    const result = await service.createUser(
      TENANT_ID,
      { name: 'Support User', email: 'support@example.com', temporaryPassword: 'a-very-long-password' },
      ACTOR_ID,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_ID, role: 'SUPPORT_USER' }),
      }),
    );
    expect(result.email).toBe('support@example.com');
  });

  it('deactivates a user and revokes their sessions', async () => {
    const active = fakeUser({ status: 'ACTIVE' });
    const inactive = fakeUser({ status: 'INACTIVE' });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(inactive);
    const { service, prisma } = buildService({
      user: { findUnique, update: jest.fn() },
    });

    const result = await service.deactivateUser(TENANT_ID, 'user-1', ACTOR_ID);

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.status).toBe('INACTIVE');
  });

  it('is a no-op on an already-inactive user (idempotent)', async () => {
    const inactive = fakeUser({ status: 'INACTIVE' });
    const findUnique = jest.fn().mockResolvedValue(inactive);
    const { service, prisma } = buildService({
      user: { findUnique, update: jest.fn() },
    });

    await service.deactivateUser(TENANT_ID, 'user-1', ACTOR_ID);

    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('404s deactivating a user from another tenant', async () => {
    const otherTenantUser = fakeUser({ tenantId: 'tenant-2' });
    const { service } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue(otherTenantUser) },
    });

    await expect(
      service.deactivateUser(TENANT_ID, 'user-1', ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s deactivating a COMPANY_ADMIN (not a Support User)', async () => {
    const admin = fakeUser({ role: 'COMPANY_ADMIN' });
    const { service } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue(admin) },
    });

    await expect(
      service.deactivateUser(TENANT_ID, 'user-1', ACTOR_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
