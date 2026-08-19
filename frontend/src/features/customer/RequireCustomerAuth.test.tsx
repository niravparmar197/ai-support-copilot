import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireCustomerAuth } from './RequireCustomerAuth';
import { useCurrentCustomer } from './hooks';

vi.mock('./hooks', () => ({
  useCurrentCustomer: vi.fn(),
}));

const mockUseCurrentCustomer = vi.mocked(useCurrentCustomer);

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/customer']}>
      <Routes>
        <Route path="/customer/login" element={<div>Customer login page</div>} />
        <Route
          path="/customer"
          element={
            <RequireCustomerAuth>
              <div>Protected content</div>
            </RequireCustomerAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mockCurrentCustomer(
  overrides: Partial<ReturnType<typeof useCurrentCustomer>>,
) {
  mockUseCurrentCustomer.mockReturnValue(
    overrides as ReturnType<typeof useCurrentCustomer>,
  );
}

describe('RequireCustomerAuth', () => {
  it('redirects an unauthenticated visitor to /customer/login', () => {
    mockCurrentCustomer({ data: undefined, isLoading: false, isError: true });

    renderProtectedRoute();

    expect(screen.getByText('Customer login page')).toBeInTheDocument();
  });

  it('renders children for an authenticated customer', () => {
    mockCurrentCustomer({
      data: { id: 'customer-1' } as ReturnType<typeof useCurrentCustomer>['data'],
      isLoading: false,
      isError: false,
    });

    renderProtectedRoute();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
