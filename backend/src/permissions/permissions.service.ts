import { Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Global, role-only lookup (D-012) — identical for every tenant, no
  // tenantId filter needed. Returns permission keys, not the RolePermission
  // rows themselves, since callers (AuthController.me()) only need to hand
  // the frontend a flat list to check membership against.
  async getKeysForRole(role: UserRole): Promise<string[]> {
    const grants = await this.prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });

    return grants.map((grant) => grant.permission.key);
  }
}
