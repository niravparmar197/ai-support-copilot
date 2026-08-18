import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireRole } from './RequireRole';
import { useCurrentUser } from './hooks';

vi.mock('./hooks', () => ({
  useCurrentUser: vi.fn(),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/platform']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/forbidden" element={<div>Forbidden page</div>} />
        <Route
          path="/platform"
          element={
            <RequireRole role="SUPER_ADMIN">
              <div>Protected content</div>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// Only the fields RequireRole actually reads are filled in — the rest of
// useQuery's return shape doesn't matter for these tests.
function mockCurrentUser(
  overrides: Partial<ReturnType<typeof useCurrentUser>>,
) {
  mockUseCurrentUser.mockReturnValue(
    overrides as ReturnType<typeof useCurrentUser>,
  );
}

describe('RequireRole', () => {
  it('redirects an unauthenticated user to /login', () => {
    mockCurrentUser({ data: undefined, isLoading: false, isError: true });

    renderProtectedRoute();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a wrong-role user to /forbidden', () => {
    mockCurrentUser({
      data: { role: 'COMPANY_ADMIN' } as ReturnType<
        typeof useCurrentUser
      >['data'],
      isLoading: false,
      isError: false,
    });

    renderProtectedRoute();

    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
  });

  it('renders children for the correct role', () => {
    mockCurrentUser({
      data: { role: 'SUPER_ADMIN' } as ReturnType<
        typeof useCurrentUser
      >['data'],
      isLoading: false,
      isError: false,
    });

    renderProtectedRoute();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
