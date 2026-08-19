import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TicketThread } from '../../tickets/TicketThread';
import { useSendTicketMessage, useTicket, useTicketMessages } from '../hooks';

// Ticket detail is MUI (matches the rest of features/company/), but the
// conversation itself is the shared <TicketThread> (Tailwind) — see Day
// 20's plan note on why the shared component isn't MUI.
export function CompanyTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading: ticketLoading } = useTicket(id ?? '');
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(id ?? '');
  const sendMessage = useSendTicketMessage(id ?? '');

  if (ticketLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  if (!ticket) {
    return <Typography color="error">Ticket not found.</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {ticket.subject}
        </Typography>
        <Chip label={ticket.status} size="small" />
        <Chip label={ticket.priority} size="small" variant="outlined" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {ticket.customer.name} ({ticket.customer.email})
        {ticket.assignedUser &&
          ` · Assigned to ${ticket.assignedUser.name ?? ticket.assignedUser.email}`}
      </Typography>

      <TicketThread
        messages={messages ?? []}
        isLoading={messagesLoading}
        viewerAuthorType="SUPPORT"
        onSend={(content) => sendMessage.mutate(content)}
        isSending={sendMessage.isPending}
      />
    </Box>
  );
}
