import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { CustomerAuthService } from './customer-auth.service';
import type { PrismaService } from '../prisma/prisma.service';

const TENANT_ID = 'tenant-1';

function fakeResponse() {
  return { cookie: jest.fn(), clearCookie: jest.fn() } as any;
}

function fakeConfigService() {
  return {
    getOrThrow: jest.fn((key: string) => `secret-for-${key}`),
  } as any;
}

function fakeJwtService(overrides: Record<string, unknown> = {}) {
  return {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
    ...overrides,
  } as any;
}

async function fakeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    tenantId: TENANT_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    passwordHash: await bcrypt.hash('correct-password', 4),
    mustResetPassword: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    tenant: { id: TENANT_ID, name: 'Acme', status: 'ACTIVE' },
    ...overrides,
  };
}

describe('CustomerAuthService', () => {
  describe('validateCustomer', () => {
    it('returns the customer on a correct password', async () => {
      const customer = await fakeCustomer();
      const prisma = {
        customer: { findMany: jest.fn().mockResolvedValue([customer]) },
      } as unknown as PrismaService;
      const service = new CustomerAuthService(
        prisma,
        fakeJwtService(),
        fakeConfigService(),
      );

      const result = await service.validateCustomer(
        'ada@example.com',
        'correct-password',
      );

      expect(result.id).toBe('customer-1');
    });

    it('rejects a wrong password with a generic message', async () => {
      const customer = await fakeCustomer();
      const prisma = {
        customer: { findMany: jest.fn().mockResolvedValue([customer]) },
      } as unknown as PrismaService;
      const service = new CustomerAuthService(
        prisma,
        fakeJwtService(),
        fakeConfigService(),
      );

      await expect(
        service.validateCustomer('ada@example.com', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses to log in when the email matches more than one tenant', async () => {
      const a = await fakeCustomer({ id: 'customer-1', tenantId: 'tenant-1' });
      const b = await fakeCustomer({ id: 'customer-2', tenantId: 'tenant-2' });
      const prisma = {
        customer: { findMany: jest.fn().mockResolvedValue([a, b]) },
      } as unknown as PrismaService;
      const service = new CustomerAuthService(
        prisma,
        fakeJwtService(),
        fakeConfigService(),
      );

      await expect(
        service.validateCustomer('ada@example.com', 'correct-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects login for a customer whose tenant is suspended', async () => {
      const customer = await fakeCustomer({
        tenant: { id: TENANT_ID, name: 'Acme', status: 'SUSPENDED' },
      });
      const prisma = {
        customer: { findMany: jest.fn().mockResolvedValue([customer]) },
      } as unknown as PrismaService;
      const service = new CustomerAuthService(
        prisma,
        fakeJwtService(),
        fakeConfigService(),
      );

      await expect(
        service.validateCustomer('ada@example.com', 'correct-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('creates a CustomerSession and sets both cookies', async () => {
      const customer = await fakeCustomer();
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        customerSession: { create },
      } as unknown as PrismaService;
      const service = new CustomerAuthService(
        prisma,
        fakeJwtService(),
        fakeConfigService(),
      );
      const res = fakeResponse();

      await service.login(customer as any, res, {});

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerId: customer.id }),
        }),
      );
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('rotates: revokes the old session and creates a new one', async () => {
      const customer = await fakeCustomer();
      const session = {
        id: 'session-1',
        customerId: customer.id,
        refreshTokenHash: await bcrypt.hash('the-refresh-token', 4),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };
      const update = jest.fn().mockResolvedValue({});
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        customerSession: {
          findUnique: jest.fn().mockResolvedValue(session),
          update,
          create,
          updateMany: jest.fn(),
        },
        customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      } as unknown as PrismaService;
      const jwtService = fakeJwtService({
        verifyAsync: jest
          .fn()
          .mockResolvedValue({ sub: customer.id, sessionId: 'session-1' }),
      });
      const service = new CustomerAuthService(
        prisma,
        jwtService,
        fakeConfigService(),
      );

      await service.refresh('the-refresh-token', fakeResponse(), {});

      expect(update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(create).toHaveBeenCalled();
    });

    it('treats reuse of an already-rotated token as theft and revokes every session', async () => {
      const session = {
        id: 'session-1',
        customerId: 'customer-1',
        refreshTokenHash: 'irrelevant',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      };
      const updateMany = jest.fn().mockResolvedValue({});
      const prisma = {
        customerSession: {
          findUnique: jest.fn().mockResolvedValue(session),
          updateMany,
        },
      } as unknown as PrismaService;
      const jwtService = fakeJwtService({
        verifyAsync: jest
          .fn()
          .mockResolvedValue({ sub: 'customer-1', sessionId: 'session-1' }),
      });
      const service = new CustomerAuthService(
        prisma,
        jwtService,
        fakeConfigService(),
      );

      await expect(
        service.refresh('stale-token', fakeResponse(), {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('logout', () => {
    it('revokes the session tied to the presented refresh token', async () => {
      const updateMany = jest.fn().mockResolvedValue({});
      const prisma = {
        customerSession: { updateMany },
      } as unknown as PrismaService;
      const jwtService = fakeJwtService({
        verifyAsync: jest.fn().mockResolvedValue({ sessionId: 'session-1' }),
      });
      const service = new CustomerAuthService(
        prisma,
        jwtService,
        fakeConfigService(),
      );
      const res = fakeResponse();

      await service.logout('some-token', res);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
