import { api } from '../../lib/api';

export interface CompanyUser {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  mustResetPassword: boolean;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedUsers {
  data: CompanyUser[];
  pagination: PaginationMeta;
}

export interface CreateUserInput {
  name: string;
  email: string;
  temporaryPassword: string;
}

export async function fetchUsers(
  page: number,
  pageSize = 20,
): Promise<PaginatedUsers> {
  const response = await api.get<PaginatedUsers>('/company/users', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function createUser(input: CreateUserInput): Promise<CompanyUser> {
  const response = await api.post<CompanyUser>('/company/users', input);
  return response.data;
}

export async function deactivateUser(id: string): Promise<CompanyUser> {
  const response = await api.patch<CompanyUser>(`/company/users/${id}/deactivate`);
  return response.data;
}

export async function activateUser(id: string): Promise<CompanyUser> {
  const response = await api.patch<CompanyUser>(`/company/users/${id}/activate`);
  return response.data;
}
