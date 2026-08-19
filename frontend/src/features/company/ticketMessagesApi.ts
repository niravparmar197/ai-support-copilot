import { api } from '../../lib/api';
import type { MessageAuthorType } from '../tickets/TicketThread';

export interface TicketMessage {
  id: string;
  authorType: MessageAuthorType;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export async function fetchTicketMessages(
  ticketId: string,
): Promise<TicketMessage[]> {
  const response = await api.get<TicketMessage[]>(
    `/company/tickets/${ticketId}/messages`,
  );
  return response.data;
}

export async function sendTicketMessage({
  ticketId,
  content,
}: {
  ticketId: string;
  content: string;
}): Promise<TicketMessage> {
  const response = await api.post<TicketMessage>(
    `/company/tickets/${ticketId}/messages`,
    { content },
  );
  return response.data;
}
