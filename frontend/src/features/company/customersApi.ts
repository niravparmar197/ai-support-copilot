import { api } from '../../lib/api';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedCustomers {
  data: Customer[];
  pagination: PaginationMeta;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  // Every customer now needs a password to use the portal (Day 17/D-029) —
  // staff-provisioned at creation, same pattern as CreateUserInput.
  temporaryPassword: string;
}

export interface UpdateCustomerInput {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export async function fetchCustomers(
  page: number,
  pageSize = 20,
): Promise<PaginatedCustomers> {
  const response = await api.get<PaginatedCustomers>('/company/customers', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function fetchCustomer(id: string): Promise<Customer> {
  const response = await api.get<Customer>(`/company/customers/${id}`);
  return response.data;
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  const response = await api.post<Customer>('/company/customers', input);
  return response.data;
}

export async function updateCustomer({
  id,
  ...input
}: UpdateCustomerInput): Promise<Customer> {
  const response = await api.patch<Customer>(`/company/customers/${id}`, input);
  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/company/customers/${id}`);
}
