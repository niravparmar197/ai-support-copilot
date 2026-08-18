import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useActivateUser, useDeactivateUser, useUsers } from '../hooks';
import { CompanyUsers } from './CompanyUsers';

vi.mock('../hooks', () => ({
  useUsers: vi.fn(),
  useCreateUser: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() })),
  useDeactivateUser: vi.fn(),
  useActivateUser: vi.fn(),
}));

const mockUseUsers = vi.mocked(useUsers);
const mockUseDeactivateUser = vi.mocked(useDeactivateUser);
const mockUseActivateUser = vi.mocked(useActivateUser);

const USER = {
  id: 'user-1',
  email: 'support@example.com',
  name: 'Support User',
  status: 'ACTIVE' as const,
  mustResetPassword: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('CompanyUsers', () => {
  it('renders the Support User list', () => {
    mockUseUsers.mockReturnValue({
      data: { data: [USER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers>);
    mockUseDeactivateUser.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeactivateUser>);
    mockUseActivateUser.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useActivateUser>);

    render(<CompanyUsers />);

    expect(screen.getByText('support@example.com')).toBeInTheDocument();
  });

  it('deactivates an active user via the row action', () => {
    const mutate = vi.fn();
    mockUseUsers.mockReturnValue({
      data: { data: [USER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers>);
    mockUseDeactivateUser.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeactivateUser>);
    mockUseActivateUser.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useActivateUser>);

    render(<CompanyUsers />);
    // MUI DataGrid can render more than one DOM node for the same row
    // (pinned-column duplication) — both wrap the identical IconButton
    // element/handler, so clicking every match is safe and avoids
    // depending on which duplicate jsdom happens to lay out as "visible".
    for (const button of screen.getAllByRole('button', { name: /deactivate/i })) {
      fireEvent.click(button);
    }

    expect(mutate).toHaveBeenCalledWith('user-1');
  });
});
