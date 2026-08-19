import type { SafeCustomer } from '../utils/to-safe-customer.util';

// sessionId carried through the same way AuthenticatedUser does — see that
// type's comment. No impersonatedBy: impersonation is staff-only (D-026).
export type AuthenticatedCustomer = SafeCustomer & {
  sessionId: string;
};
