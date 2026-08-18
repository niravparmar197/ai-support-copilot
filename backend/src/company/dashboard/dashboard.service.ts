import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyDashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class CompanyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Independent reads over disjoint tables, run concurrently — same
   * reasoning as the platform dashboard's getDashboard(). All five are
   * scoped `where: { tenantId }` (manual, matching Day 14's precedent —
   * no auto-scoping Prisma extension exists in this codebase).
   */
  async getDashboard(tenantId: string): Promise<CompanyDashboardResponseDto> {
    const [totalUsers, totalCustomers, totalTickets, totalDocuments, totalAiRequests] =
      await Promise.all([
        // Every staff row in this tenant (COMPANY_ADMIN + SUPPORT_USER) —
        // no role filter needed beyond tenantId, since Customer is its own
        // model (D-013) and SUPER_ADMIN never has a tenantId (D-008).
        this.prisma.user.count({ where: { tenantId } }),
        this.prisma.customer.count({ where: { tenantId } }),
        // Ticket has no rows until Day 18 — correctly returns 0 against an
        // empty table rather than being stubbed, same reasoning as the
        // platform dashboard's totalTickets.
        this.prisma.ticket.count({ where: { tenantId } }),
        this.prisma.document.count({ where: { tenantId } }),
        // AiRun has no rows until Day 29+ — same reasoning.
        this.prisma.aiRun.count({ where: { tenantId } }),
      ]);

    return {
      totalUsers,
      totalCustomers,
      totalTickets,
      totalDocuments,
      totalAiRequests,
    };
  }
}
