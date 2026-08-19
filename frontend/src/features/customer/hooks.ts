import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerLogin, customerLogout, fetchCurrentCustomer } from './customerAuthApi';
import { fetchMyTicketMessages, sendMyTicketMessage } from './ticketMessagesApi';
import { createTicket, fetchMyTicket, fetchMyTickets } from './ticketsApi';

const CURRENT_CUSTOMER_QUERY_KEY = ['customer-auth', 'me'];
const MY_TICKETS_QUERY_KEY = ['customer', 'tickets'];
const MY_TICKET_MESSAGES_QUERY_KEY = ['customer', 'ticket-messages'];

export function useCurrentCustomer() {
  return useQuery({
    queryKey: CURRENT_CUSTOMER_QUERY_KEY,
    queryFn: fetchCurrentCustomer,
    // A 401 here means "not logged in" — same reasoning as useCurrentUser().
    retry: false,
  });
}

export function useCustomerLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      customerLogin(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENT_CUSTOMER_QUERY_KEY });
    },
  });
}

export function useCustomerLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: customerLogout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useMyTickets(page: number) {
  return useQuery({
    queryKey: [...MY_TICKETS_QUERY_KEY, page],
    queryFn: () => fetchMyTickets(page),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_TICKETS_QUERY_KEY });
    },
  });
}

export function useMyTicket(id: string) {
  return useQuery({
    queryKey: [...MY_TICKETS_QUERY_KEY, id],
    queryFn: () => fetchMyTicket(id),
  });
}

export function useMyTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: [...MY_TICKET_MESSAGES_QUERY_KEY, ticketId],
    queryFn: () => fetchMyTicketMessages(ticketId),
  });
}

export function useSendMyTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => sendMyTicketMessage({ ticketId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...MY_TICKET_MESSAGES_QUERY_KEY, ticketId],
      });
    },
  });
}
