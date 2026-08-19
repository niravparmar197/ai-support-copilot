import { useParams } from 'react-router-dom';
import { TicketThread } from '../../tickets/TicketThread';
import {
  useMyTicket,
  useMyTicketMessages,
  useSendMyTicketMessage,
} from '../hooks';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_CUSTOMER: 'Waiting on you',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function CustomerTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading: ticketLoading } = useMyTicket(id ?? '');
  const { data: messages, isLoading: messagesLoading } = useMyTicketMessages(id ?? '');
  const sendMessage = useSendMyTicketMessage(id ?? '');

  if (ticketLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!ticket) {
    return <p className="text-sm text-red-600">Ticket not found.</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {STATUS_LABELS[ticket.status] ?? ticket.status}
      </p>

      <TicketThread
        messages={messages ?? []}
        isLoading={messagesLoading}
        viewerAuthorType="CUSTOMER"
        onSend={(content) => sendMessage.mutate(content)}
        isSending={sendMessage.isPending}
      />
    </div>
  );
}
