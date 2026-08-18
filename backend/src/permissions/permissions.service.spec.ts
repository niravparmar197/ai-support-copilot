import { PermissionsService } from './permissions.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PermissionsService', () => {
  function buildService(findMany: jest.Mock) {
    const prisma = {
      rolePermission: { findMany },
    } as unknown as PrismaService;

    return new PermissionsService(prisma);
  }

  it('returns the permission keys granted to a role', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { permission: { key: 'approval.approve' } },
      { permission: { key: 'approval.reject' } },
    ]);
    const service = buildService(findMany);

    const keys = await service.getKeysForRole('COMPANY_ADMIN');

    expect(keys).toEqual(['approval.approve', 'approval.reject']);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: 'COMPANY_ADMIN' },
      include: { permission: true },
    });
  });

  it('returns an empty array for a role with no grants', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = buildService(findMany);

    const keys = await service.getKeysForRole('CUSTOMER');

    expect(keys).toEqual([]);
  });
});
