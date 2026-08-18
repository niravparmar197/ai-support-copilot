import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../../auth/utils/hash-password.util';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';

// Every method here takes tenantId from the caller (the Company Admin's
// own AuthenticatedUser.tenantId, see UsersController) and filters by
// { tenantId, role: 'SUPPORT_USER' } on every query — not just on create.
// That's D-014's boundary applied uniformly: a Company Admin can create,
// list, deactivate, and reactivate Support Users in their own tenant, and
// nothing else — never another tenant's users, never a COMPANY_ADMIN row
// (there's only ever one per tenant, provisioned exclusively via Day 6's
// SUPER_ADMIN company-creation flow).
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    tenantId: string,
    dto: CreateUserDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    const passwordHash = await hashPassword(dto.temporaryPassword);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: 'SUPPORT_USER',
          status: 'ACTIVE',
          mustResetPassword: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          action: 'user.created',
          targetType: 'user',
          targetId: user.id,
          metadata: { email: dto.email },
        },
      });

      return toUserResponse(user);
    });
  }

  async listUsers(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedUsersDto> {
    const { page, pageSize } = query;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { tenantId, role: 'SUPPORT_USER' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { tenantId, role: 'SUPPORT_USER' } }),
    ]);

    return {
      data: users.map(toUserResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Idempotent, same reasoning as CompaniesService.suspendCompany: asking
   * to deactivate an already-inactive user is "make sure this is
   * deactivated," already true, not an error. Revokes every active
   * session so a still-logged-in support user is actually locked out, not
   * just blocked from a future login.
   */
  async deactivateUser(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<UserResponseDto> {
    const existing = await this.findTenantSupportUser(tenantId, id);

    if (existing.status !== 'INACTIVE') {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { status: 'INACTIVE' } });

        await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorId,
            action: 'user.deactivated',
            targetType: 'user',
            targetId: id,
            metadata: {},
          },
        });
      });
    }

    return toUserResponse(await this.findTenantSupportUser(tenantId, id));
  }

  /** Idempotent, same reasoning as deactivateUser. */
  async activateUser(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<UserResponseDto> {
    const existing = await this.findTenantSupportUser(tenantId, id);

    if (existing.status !== 'ACTIVE') {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { status: 'ACTIVE' } });

        await tx.auditLog.create({
          data: {
            tenantId,
            actorId,
            action: 'user.activated',
            targetType: 'user',
            targetId: id,
            metadata: {},
          },
        });
      });
    }

    return toUserResponse(await this.findTenantSupportUser(tenantId, id));
  }

  // 404, not 403, for a wrong-tenant or wrong-role id — same "don't
  // confirm existence of something the caller has no business seeing" as
  // AuthService.revokeSession.
  private async findTenantSupportUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user || user.tenantId !== tenantId || user.role !== 'SUPPORT_USER') {
      throw new NotFoundException();
    }

    return user;
  }
}

function toUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  mustResetPassword: boolean;
  createdAt: Date;
}): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    mustResetPassword: user.mustResetPassword,
    createdAt: user.createdAt,
  };
}
