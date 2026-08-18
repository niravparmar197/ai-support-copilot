import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PlatformDashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All five queries are independent reads over disjoint tables, so they run
   * concurrently via Promise.all rather than sequential awaits — this is
   * called on every platform-dashboard page load, so latency here is
   * multiplied by traffic, not just a one-off cost.
   */
  async getDashboard(): Promise<PlatformDashboardResponseDto> {
    const [tenantCounts, totalUsers, totalTickets, totalAiRequests] =
      await Promise.all([
        this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
        // Excludes SUPER_ADMIN users: they have tenantId = null (D-008) and
        // aren't "in" any tenant, so counting them here would inflate a
        // number meant to represent tenant-side headcount across the
        // platform with platform-operator accounts.
        this.prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
        // Ticket has no rows until Day 18 — this correctly returns 0 against
        // an empty table rather than being stubbed, so it's already correct
        // once ticket data exists.
        this.prisma.ticket.count(),
        // AiRun has no rows until Day 29+ — same reasoning as totalTickets.
        this.prisma.aiRun.count(),
      ]);

    const activeCompanies =
      tenantCounts.find((group) => group.status === 'ACTIVE')?._count._all ?? 0;
    const suspendedCompanies =
      tenantCounts.find((group) => group.status === 'SUSPENDED')?._count._all ??
      0;

    return {
      totalCompanies: activeCompanies + suspendedCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      totalTickets,
      totalAiRequests,
    };
  }
}
