import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCustomer, useCustomerOrders } from '../hooks';
import { CompanyCustomerDetail } from './CompanyCustomerDetail';

vi.mock('../hooks', () => ({
  useCustomer: vi.fn(),
  useCustomerOrders: vi.fn(),
}));

const mockUseCustomer = vi.mocked(useCustomer);
const mockUseCustomerOrders = vi.mocked(useCustomerOrders);

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/company/customers/${id}`]}>
      <Routes>
        <Route path="/company/customers/:id" element={<CompanyCustomerDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompanyCustomerDetail', () => {
  it('renders the customer and their orders with nested payments', () => {
    mockUseCustomer.mockReturnValue({
      data: { id: 'customer-1', name: 'Ada Lovelace', email: 'ada@example.com', phone: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomer>);
    mockUseCustomerOrders.mockReturnValue({
      data: [
        {
          id: 'order-1',
          totalAmount: '49.99',
          status: 'PAID',
          createdAt: '2026-01-01T00:00:00.000Z',
          payments: [
            {
              id: 'payment-1',
              amount: '25.00',
              status: 'SUCCEEDED',
              method: 'card',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomerOrders>);

    renderAt('customer-1');

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('$49.99')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
  });

  it('shows an empty state when the customer has no orders', () => {
    mockUseCustomer.mockReturnValue({
      data: { id: 'customer-1', name: 'Ada Lovelace', email: 'ada@example.com', phone: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomer>);
    mockUseCustomerOrders.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomerOrders>);

    renderAt('customer-1');

    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
  });
});
