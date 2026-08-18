import type { UserRole } from '@prisma/client';

// sub/tenantId/role only — deliberately no permissions. See Q3: permissions
// are looked up fresh from Permission/RolePermission on each authorization
// check (Day 12), so a revoked permission takes effect immediately instead
// of waiting up to 15 minutes for this token to expire.
export interface AccessTokenPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
}
