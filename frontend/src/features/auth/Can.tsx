import type { ReactNode } from 'react';
import { usePermissions } from './hooks';

interface CanProps {
  permission: string;
  children: ReactNode;
}

// Unlike RequireRole, this never redirects — an unauthorized nav item (or
// any other UI it wraps) should just not render, not send the user to
// /forbidden for something they were never shown a link to.
export function Can({ permission, children }: CanProps) {
  const permissions = usePermissions();

  if (!permissions.has(permission)) {
    return null;
  }

  return <>{children}</>;
}
