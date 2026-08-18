import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../../components/layout/LoadingScreen';
import type { UserRole } from './authApi';
import { useCurrentUser } from './hooks';

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps) {
  const location = useLocation();
  const { data: user, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError || !user) {
    // Carries the attempted location so LoginPage can send the user back
    // here after a successful sign-in, instead of always landing on "/".
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== role) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
