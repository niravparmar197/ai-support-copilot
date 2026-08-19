import { api } from '../../lib/api';

// Mirrors CurrentUser/authApi.ts, but for the customer portal — a Customer
// has no role/status/impersonation, since it's a separate identity from
// User entirely (D-013, D-029).
export interface CurrentCustomer {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string | null;
  sessionId: string;
  mustResetPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CUSTOMER_DEFAULT_LANDING_PATH = '/customer';

export async function fetchCurrentCustomer(): Promise<CurrentCustomer> {
  const response = await api.get<CurrentCustomer>('/auth/customer/me');
  return response.data;
}

export async function customerLogin(
  email: string,
  password: string,
): Promise<void> {
  await api.post('/auth/customer/login', { email, password });
}

export async function customerLogout(): Promise<void> {
  await api.post('/auth/customer/logout');
}
