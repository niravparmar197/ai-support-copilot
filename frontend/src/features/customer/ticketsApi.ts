import { api } from '../../lib/api';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CustomerTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedCustomerTickets {
  data: CustomerTicket[];
  pagination: PaginationMeta;
}

export interface CreateTicketInput {
  subject: string;
  priority?: TicketPriority;
}

export async function fetchMyTickets(
  page: number,
  pageSize = 20,
): Promise<PaginatedCustomerTickets> {
  const response = await api.get<PaginatedCustomerTickets>('/customer/tickets', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function createTicket(
  input: CreateTicketInput,
): Promise<CustomerTicket> {
  const response = await api.post<CustomerTicket>('/customer/tickets', input);
  return response.data;
}
