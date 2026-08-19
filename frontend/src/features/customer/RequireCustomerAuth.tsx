import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingScreen } from '../../components/layout/LoadingScreen';
import { useCurrentCustomer } from './hooks';

interface RequireCustomerAuthProps {
  children: ReactNode;
}

// Mirrors RequireRole, but there's no role to match against — Customer
// isn't a User row (D-013), so "authenticated as a customer at all" is the
// entire check (D-029).
export function RequireCustomerAuth({ children }: RequireCustomerAuthProps) {
  const location = useLocation();
  const { data: customer, isLoading, isError } = useCurrentCustomer();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError || !customer) {
    return <Navigate to="/customer/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
