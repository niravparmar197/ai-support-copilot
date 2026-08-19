import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCreateTicket } from '../hooks';
import { CustomerTicketNew } from './CustomerTicketNew';

vi.mock('../hooks', () => ({
  useCreateTicket: vi.fn(),
}));

const mockUseCreateTicket = vi.mocked(useCreateTicket);

describe('CustomerTicketNew', () => {
  it('submits the subject and priority', () => {
    const mutate = vi.fn();
    mockUseCreateTicket.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateTicket>);

    render(
      <MemoryRouter>
        <CustomerTicketNew />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: 'My printer is on fire' },
    });
    fireEvent.change(screen.getByLabelText(/priority/i), {
      target: { value: 'URGENT' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    expect(mutate).toHaveBeenCalledWith(
      { subject: 'My printer is on fire', priority: 'URGENT' },
      expect.anything(),
    );
  });
});
