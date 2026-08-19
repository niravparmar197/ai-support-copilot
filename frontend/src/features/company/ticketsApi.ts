import { api } from '../../lib/api';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface TicketAssignedUserSummary {
  id: string;
  name: string | null;
  email: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  sentiment: string | null;
  customer: TicketCustomerSummary;
  assignedUser: TicketAssignedUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedTickets {
  data: Ticket[];
  pagination: PaginationMeta;
}

export interface UpdateTicketInput {
  id: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
}

export interface AssignTicketInput {
  id: string;
  assignedUserId: string | null;
}

export async function fetchTickets(
  page: number,
  pageSize = 20,
): Promise<PaginatedTickets> {
  const response = await api.get<PaginatedTickets>('/company/tickets', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function updateTicket({
  id,
  ...input
}: UpdateTicketInput): Promise<Ticket> {
  const response = await api.patch<Ticket>(`/company/tickets/${id}`, input);
  return response.data;
}

export async function assignTicket({
  id,
  assignedUserId,
}: AssignTicketInput): Promise<Ticket> {
  const response = await api.patch<Ticket>(`/company/tickets/${id}/assign`, {
    assignedUserId,
  });
  return response.data;
}
