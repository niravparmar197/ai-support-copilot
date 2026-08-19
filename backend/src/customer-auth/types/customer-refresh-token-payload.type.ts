// Mirrors RefreshTokenPayload — see CustomerAccessTokenPayload for why
// there's no role/impersonatorId here.
export interface CustomerRefreshTokenPayload {
  sub: string;
  sessionId: string;
}
