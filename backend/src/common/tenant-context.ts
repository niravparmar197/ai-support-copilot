import { ClsServiceManager, type ClsStore } from 'nestjs-cls';

// Populated once per request, immediately after JwtAuthGuard verifies the
// JWT (see guards/jwt-auth.guard.ts) — never re-derived from the token
// anywhere else. tenantId is null for SUPER_ADMIN (D-008: User.tenantId is
// nullable), including on platform-level endpoints that never touch this
// store at all.
export interface AppClsStore extends ClsStore {
  tenantId: string | null;
  userId: string;
}

// ClsServiceManager.getClsService() is nestjs-cls's documented way to reach
// the current request's CLS instance from a plain function, outside of
// Nest's DI graph — which is exactly what's needed here: any service in
// any module can call these without taking a ClsService (or a tenantId)
// as a constructor/method parameter.
//
// Why CLS over threading tenantId through every function signature: a
// parameter can be forgotten, passed in the wrong order, or copied from
// the wrong variable by a caller several layers up. A value read from CLS
// isn't a parameter at all, so none of those mistakes are possible — every
// tenant-scoped service reads the same one value written at the same one
// choke point (the guard), instead of each call site re-deriving or
// re-plumbing it independently.
function cls() {
  return ClsServiceManager.getClsService<AppClsStore>();
}

export function getCurrentTenantId(): string | null {
  return cls().get('tenantId');
}

export function getCurrentUserId(): string {
  return cls().get('userId');
}
