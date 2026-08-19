import { api } from '../../lib/api';

// amount/totalAmount are strings, matching the backend DTO (D-019 — Order/
// Payment amounts are Prisma Decimal, serialized as strings, never cast
// to number). Display-only today, so no arithmetic is needed here; if
// that changes, reach for a decimal library, not parseFloat.
export interface Payment {
  id: string;
  amount: string;
  status: string;
  method: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  payments: Payment[];
}

export async function fetchCustomerOrders(customerId: string): Promise<Order[]> {
  const response = await api.get<Order[]>(
    `/company/customers/${customerId}/orders`,
  );
  return response.data;
}
