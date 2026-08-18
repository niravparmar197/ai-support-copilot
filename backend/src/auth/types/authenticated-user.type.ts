import type { SafeUser } from '../utils/to-safe-user.util';
import type { ImpersonatedBy } from './impersonated-by.type';

// sessionId isn't a User column — it's carried through from the access
// token payload (see access-token-payload.type.ts) so session-management
// endpoints can identify "the session this request is authenticated with"
// without a second lookup. impersonatedBy is the same idea applied to
// impersonation (D-026): non-null only when the access token carries an
// impersonatorId claim, i.e. this request is authenticated as a company
// admin a SUPER_ADMIN is currently impersonating.
export type AuthenticatedUser = SafeUser & {
  sessionId: string;
  impersonatedBy: ImpersonatedBy | null;
};
