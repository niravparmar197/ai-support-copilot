import type { UserRole } from '@prisma/client';

// sub/tenantId/role/sessionId — deliberately no permissions. See Q3:
// permissions are looked up fresh from Permission/RolePermission on each
// authorization check (Day 12), so a revoked permission takes effect
// immediately instead of waiting up to 15 minutes for this token to expire.
// sessionId was added for session management (list/revoke sessions): it
// identifies which UserSession this access token was issued alongside, so
// an authenticated request can know "which session is *this one*" without
// also depending on the refresh-token cookie being present/valid. This
// isn't a permission grant like the thing Q3 excluded — it doesn't go
// stale the same way, since a session doesn't change identity, only
// existence (revoked or not).
//
// impersonatorId (D-026): set only while this session is a SUPER_ADMIN
// impersonating a company admin — the SUPER_ADMIN's own user id, carried
// on the *impersonated* user's token. Absent on every ordinary session.
export interface AccessTokenPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
  sessionId: string;
  impersonatorId?: string;
}
