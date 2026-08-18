import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../../auth/utils/hash-password.util';
import { toSafeUser } from '../../auth/utils/to-safe-user.util';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type {
  CompanyAdminDto,
  CompanyDetailDto,
  PaginatedCompaniesDto,
} from './dto/company-response.dto';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a Tenant and its first COMPANY_ADMIN User, plus an audit log
   * entry, as a single transaction — see Q2 in the accompanying answer.
   * If anything fails (a constraint violation, duplicate input within the
   * same request), everything rolls back: no orphaned zero-user tenant, no
   * audit log describing a company that doesn't exist.
   *
   * Password hashing happens *before* the transaction starts, not inside
   * it — bcrypt is CPU-bound and slow relative to DB writes; holding an
   * interactive transaction open across it would hold locks longer than
   * necessary for no benefit.
   */
  async createCompany(
    dto: CreateCompanyDto,
    actorId: string,
  ): Promise<{ tenant: CompanyDetailDto; admin: CompanyAdminDto }> {
    const passwordHash = await hashPassword(dto.temporaryPassword);

    const { tenant, admin } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          status: 'ACTIVE',
        },
      });

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          name: dto.adminName,
          passwordHash,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
          // Provisioned with a Super Admin-chosen password — see Q1 in the
          // accompanying answer. Set correctly now; nothing enforces it
          // yet (TODO, tracked, not silently skipped).
          mustResetPassword: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId,
          action: 'company.created',
          targetType: 'tenant',
          targetId: tenant.id,
          metadata: {
            companyName: dto.companyName,
            adminEmail: dto.adminEmail,
          },
        },
      });

      return { tenant, admin };
    });

    return {
      tenant: { ...tenant, admin: null },
      admin: toSafeUser(admin),
    };
  }

  async listCompanies(
    query: PaginationQueryDto,
  ): Promise<PaginatedCompaniesDto> {
    const { page, pageSize } = query;

    const [tenants, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true } },
          // At most one row: the primary COMPANY_ADMIN, not the tenant's
          // full user list (item 5 of the task explicitly rules that out;
          // see the accompanying answer for why this single filtered field
          // isn't the same thing).
          users: {
            where: { role: 'COMPANY_ADMIN' },
            take: 1,
            select: { email: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    return {
      data: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        adminEmail: tenant.users[0]?.email ?? null,
        userCount: tenant._count.users,
        createdAt: tenant.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCompany(id: string): Promise<CompanyDetailDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'COMPANY_ADMIN' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException();
    }

    const { users, ...tenantFields } = tenant;
    const admin = users[0] ? toSafeUser(users[0]) : null;

    return { ...tenantFields, admin };
  }

  /**
   * Metadata only (companyName, for now) — never status, see Q2 in the
   * accompanying answer. Logs "company.updated" with before/after values
   * in metadata (not just "after") specifically so the audit trail shows
   * what changed, not just what it changed to — deliberate choice, noted
   * per the task's request to say which. A no-op (name unchanged) doesn't
   * get logged.
   */
  async updateCompany(
    id: string,
    dto: UpdateCompanyDto,
    actorId: string,
  ): Promise<CompanyDetailDto> {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException();
    }

    if (dto.companyName !== existing.name) {
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id },
          data: { name: dto.companyName },
        });

        await tx.auditLog.create({
          data: {
            tenantId: id,
            actorId,
            action: 'company.updated',
            targetType: 'tenant',
            targetId: id,
            metadata: {
              name: { from: existing.name, to: dto.companyName },
            },
          },
        });
      });
    }

    // Re-fetched rather than built from the transaction's return value, so
    // the response shape (tenant + admin) stays identical to getCompany()
    // — one place defines what "company detail" looks like.
    return this.getCompany(id);
  }

  /**
   * Idempotent: suspending an already-suspended tenant is a no-op 200, not
   * an error — the caller asked for "make sure this is suspended," which
   * is already true, not "perform a state transition that must occur."
   *
   * Revokes every active session for every user in this tenant — see Q1 in
   * the accompanying answer. This alone does NOT immediately block a
   * still-valid access token from working (see Q6/JwtStrategy) — it blocks
   * the *next* refresh, and keeps the sessions list honest. The access
   * token itself is closed off by the live tenant-status check added to
   * JwtStrategy.validate().
   */
  async suspendCompany(id: string, actorId: string): Promise<CompanyDetailDto> {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException();
    }

    if (existing.status !== 'SUSPENDED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id },
          data: { status: 'SUSPENDED' },
        });

        await tx.userSession.updateMany({
          where: { user: { tenantId: id }, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            tenantId: id,
            actorId,
            action: 'company.suspended',
            targetType: 'tenant',
            targetId: id,
            metadata: {},
          },
        });
      });
    }

    return this.getCompany(id);
  }

  /**
   * Resolves who "impersonate this company" actually means: the tenant's
   * primary COMPANY_ADMIN, the same lookup getCompany() already uses to
   * surface `admin` on the detail response — there's no per-user
   * impersonation target picker (D-026), just "the company's admin."
   *
   * Rejects a SUSPENDED company server-side, not just via the frontend's
   * disabled button — that tenant's users are supposed to be locked out
   * entirely (their sessions were already revoked by suspendCompany(), and
   * they can't log in), so impersonating one would hand a SUPER_ADMIN a
   * working session for an account that's meant to be inaccessible.
   */
  async getImpersonationTarget(id: string): Promise<User> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'COMPANY_ADMIN' },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException();
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ConflictException('Cannot impersonate a suspended company.');
    }

    const [admin] = tenant.users;

    if (!admin) {
      throw new NotFoundException('Company has no admin user to impersonate.');
    }

    return admin;
  }

  /** Idempotent, same reasoning as suspendCompany. */
  async activateCompany(
    id: string,
    actorId: string,
  ): Promise<CompanyDetailDto> {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException();
    }

    if (existing.status !== 'ACTIVE') {
      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id },
          data: { status: 'ACTIVE' },
        });

        await tx.auditLog.create({
          data: {
            tenantId: id,
            actorId,
            action: 'company.activated',
            targetType: 'tenant',
            targetId: id,
            metadata: {},
          },
        });
      });
    }

    return this.getCompany(id);
  }
}
