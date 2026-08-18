import { CompanyDashboardService } from './dashboard.service';
import type { PrismaService } from '../../prisma/prisma.service';

const TENANT_ID = 'tenant-1';

describe('CompanyDashboardService', () => {
  it('scopes every count to the given tenant', async () => {
    const prisma = {
      user: { count: jest.fn().mockResolvedValue(3) },
      customer: { count: jest.fn().mockResolvedValue(5) },
      ticket: { count: jest.fn().mockResolvedValue(0) },
      document: { count: jest.fn().mockResolvedValue(0) },
      aiRun: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new CompanyDashboardService(prisma);

    const result = await service.getDashboard(TENANT_ID);

    expect(result).toEqual({
      totalUsers: 3,
      totalCustomers: 5,
      totalTickets: 0,
      totalDocuments: 0,
      totalAiRequests: 0,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    expect(prisma.ticket.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    expect(prisma.document.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    expect(prisma.aiRun.count).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
  });
});
