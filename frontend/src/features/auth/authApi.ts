import { api } from '../../lib/api';

// Kept in sync by hand with backend/prisma/schema.prisma's UserRole enum —
// the frontend has no access to the backend's generated Prisma types.
export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SUPPORT_USER' | 'CUSTOMER';

// Non-null only when this session is a SUPER_ADMIN impersonating a
// company admin (backend D-026) — mirrors AuthenticatedUser.impersonatedBy.
export interface ImpersonatedBy {
  userId: string;
  companyId: string;
  companyName: string;
}

export interface CurrentUser {
  id: string;
  tenantId: string | null;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  impersonatedBy: ImpersonatedBy | null;
}

// Every non-SUPER_ADMIN role lands here today — there's no per-role
// dashboard yet (through Day 8). Shared by LoginPage's default redirect
// and by the "start impersonating" success handler (PlatformCompanyDetail)
// so both post-auth landings move together once real per-role destinations
// exist.
export const DEFAULT_LANDING_PATH = '/';

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await api.get<CurrentUser>('/auth/me');
  return response.data;
}

// Return type is void, not CurrentUser, deliberately: POST /auth/login
// returns the user without a sessionId (that only gets attached via the
// access-token payload on subsequent requests, see backend
// auth.controller.ts), which doesn't satisfy the CurrentUser shape here.
// Callers should invalidate/refetch the current-user query instead of
// trying to seed the cache from this response directly.
export async function login(email: string, password: string): Promise<void> {
  await api.post('/auth/login', { email, password });
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
