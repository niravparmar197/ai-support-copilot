import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  useAssignableSupportUsers,
  useAssignTicket,
  useTickets,
  useUpdateTicket,
} from '../hooks';
import { TicketsWorkspace } from './TicketsWorkspace';

vi.mock('../hooks', () => ({
  useTickets: vi.fn(),
  useUpdateTicket: vi.fn(),
  useAssignTicket: vi.fn(),
  useAssignableSupportUsers: vi.fn(),
}));

const mockUseTickets = vi.mocked(useTickets);
const mockUseUpdateTicket = vi.mocked(useUpdateTicket);
const mockUseAssignTicket = vi.mocked(useAssignTicket);
const mockUseAssignableSupportUsers = vi.mocked(useAssignableSupportUsers);

const TICKET = {
  id: 'ticket-1',
  subject: 'Cannot log in',
  status: 'OPEN' as const,
  priority: 'HIGH' as const,
  category: null,
  sentiment: null,
  customer: { id: 'customer-1', name: 'Ada Lovelace', email: 'ada@example.com' },
  assignedUser: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('TicketsWorkspace assign action', () => {
  it('assigns a ticket to the selected Support User', () => {
    const assignMutate = vi.fn();
    mockUseTickets.mockReturnValue({
      data: { data: [TICKET], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useTickets>);
    mockUseUpdateTicket.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTicket>);
    mockUseAssignTicket.mockReturnValue({
      mutate: assignMutate,
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAssignTicket>);
    mockUseAssignableSupportUsers.mockReturnValue({
      data: {
        data: [{ id: 'support-1', email: 'sam@example.com', name: 'Sam', status: 'ACTIVE', mustResetPassword: false, createdAt: '' }],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useAssignableSupportUsers>);

    render(
      <MemoryRouter>
        <TicketsWorkspace basePath="/company/tickets" />
      </MemoryRouter>,
    );

    for (const button of screen.getAllByRole('button', { name: /assign/i })) {
      fireEvent.click(button);
    }

    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(within(dialog).getByLabelText('Assigned to'));
    fireEvent.click(screen.getByRole('option', { name: 'Sam' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(assignMutate).toHaveBeenCalledWith(
      { id: 'ticket-1', assignedUserId: 'support-1' },
      expect.anything(),
    );
  });
});
