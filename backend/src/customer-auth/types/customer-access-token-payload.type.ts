// Mirrors AccessTokenPayload — sub/tenantId/sessionId, no role (Customer
// has none) and no impersonatorId (impersonation is a staff-only concept,
// D-026).
export interface CustomerAccessTokenPayload {
  sub: string;
  tenantId: string;
  sessionId: string;
}
