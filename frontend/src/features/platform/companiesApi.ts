import { api } from '../../lib/api';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export interface CompanyAdmin {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  mustResetPassword: boolean;
  createdAt: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  status: TenantStatus;
  adminEmail: string | null;
  userCount: number;
  createdAt: string;
}

export interface CompanyDetail {
  id: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  admin: CompanyAdmin | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedCompanies {
  data: CompanyListItem[];
  pagination: PaginationMeta;
}

export interface CreateCompanyInput {
  companyName: string;
  adminName: string;
  adminEmail: string;
  temporaryPassword: string;
}

export interface CreateCompanyResult {
  tenant: CompanyDetail;
  admin: CompanyAdmin;
}

export async function fetchCompanies(
  page: number,
  pageSize = 20,
): Promise<PaginatedCompanies> {
  const response = await api.get<PaginatedCompanies>('/platform/companies', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function fetchCompany(id: string): Promise<CompanyDetail> {
  const response = await api.get<CompanyDetail>(`/platform/companies/${id}`);
  return response.data;
}

export async function createCompany(
  input: CreateCompanyInput,
): Promise<CreateCompanyResult> {
  const response = await api.post<CreateCompanyResult>(
    '/platform/companies',
    input,
  );
  return response.data;
}

export interface UpdateCompanyInput {
  id: string;
  name?: string;
  status?: TenantStatus;
}

export async function updateCompany({
  id,
  ...input
}: UpdateCompanyInput): Promise<CompanyDetail> {
  const response = await api.patch<CompanyDetail>(
    `/platform/companies/${id}`,
    input,
  );
  return response.data;
}

// No response body worth typing — success just means the browser's auth
// cookies now belong to the impersonated company admin. Callers should
// re-fetch useCurrentUser() rather than read anything from this response.
export async function impersonateCompany(id: string): Promise<void> {
  await api.post(`/platform/companies/${id}/impersonate`);
}

export interface StopImpersonationResult {
  companyId: string;
}

// Lives here (not authApi.ts) even though the backend route is
// POST /auth/stop-impersonation — its only caller is the global
// impersonation banner, and pairing it with impersonateCompany keeps the
// start/stop half of this feature in one file.
export async function stopImpersonation(): Promise<StopImpersonationResult> {
  const response = await api.post<StopImpersonationResult>(
    '/auth/stop-impersonation',
  );
  return response.data;
}
