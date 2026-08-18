import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useCurrentUser, usePermissions } from '../auth/hooks';
import { AppSidebar } from './AppSidebar';

// Mocked at '../auth/hooks' (the path both AppSidebar and Can resolve to)
// — same pattern as RequireRole.test.tsx. usePermissions is mocked
// directly rather than derived from useCurrentUser here, since Can reads
// it independently of AppSidebar's own useCurrentUser() call.
vi.mock('../auth/hooks', () => ({
  useCurrentUser: vi.fn(),
  usePermissions: vi.fn(),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUsePermissions = vi.mocked(usePermissions);

function mockCompanyAdmin(permissions: string[]) {
  mockUseCurrentUser.mockReturnValue({
    data: { role: 'COMPANY_ADMIN' },
  } as unknown as ReturnType<typeof useCurrentUser>);
  mockUsePermissions.mockReturnValue(new Set(permissions));
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe('AppSidebar', () => {
  it('hides a permission-gated item when the role lacks the permission', () => {
    mockCompanyAdmin([]);

    renderSidebar();

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.queryByText('Approvals')).not.toBeInTheDocument();
  });

  it('shows a permission-gated item when the role has the permission', () => {
    mockCompanyAdmin(['approval.approve']);

    renderSidebar();

    expect(screen.getByText('Approvals')).toBeInTheDocument();
  });
});
