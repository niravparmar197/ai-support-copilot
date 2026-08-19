import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCustomers, useDeleteCustomer } from '../hooks';
import { CompanyCustomers } from './CompanyCustomers';

function renderComponent() {
  return render(
    <MemoryRouter>
      <CompanyCustomers />
    </MemoryRouter>,
  );
}

vi.mock('../hooks', () => ({
  useCustomers: vi.fn(),
  useDeleteCustomer: vi.fn(),
  useCreateCustomer: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() })),
  useUpdateCustomer: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null, reset: vi.fn() })),
}));

const mockUseCustomers = vi.mocked(useCustomers);
const mockUseDeleteCustomer = vi.mocked(useDeleteCustomer);

const CUSTOMER = {
  id: 'customer-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CompanyCustomers', () => {
  it('renders the customer list', () => {
    mockUseCustomers.mockReturnValue({
      data: { data: [CUSTOMER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomers>);
    mockUseDeleteCustomer.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteCustomer>);

    renderComponent();

    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('deletes a customer via the row action', () => {
    const mutate = vi.fn();
    mockUseCustomers.mockReturnValue({
      data: { data: [CUSTOMER], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomers>);
    mockUseDeleteCustomer.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteCustomer>);

    renderComponent();
    for (const button of screen.getAllByRole('button', { name: /delete/i })) {
      fireEvent.click(button);
    }

    expect(mutate).toHaveBeenCalledWith('customer-1');
  });

  it('opens the create dialog from the New Customer button', () => {
    mockUseCustomers.mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomers>);
    mockUseDeleteCustomer.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteCustomer>);

    renderComponent();
    for (const button of screen.getAllByRole('button', { name: /new customer/i })) {
      fireEvent.click(button);
    }

    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  });
});
