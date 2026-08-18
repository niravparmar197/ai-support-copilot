import { api } from '../../lib/api';

export interface CompanyDashboard {
  totalUsers: number;
  totalCustomers: number;
  totalTickets: number;
  totalDocuments: number;
  totalAiRequests: number;
}

export async function fetchCompanyDashboard(): Promise<CompanyDashboard> {
  const response = await api.get<CompanyDashboard>('/company/dashboard');
  return response.data;
}
