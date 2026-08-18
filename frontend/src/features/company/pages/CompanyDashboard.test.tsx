import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompanyDashboard } from '../hooks';
import { CompanyDashboard } from './CompanyDashboard';

vi.mock('../hooks', () => ({
  useCompanyDashboard: vi.fn(),
}));

const mockUseCompanyDashboard = vi.mocked(useCompanyDashboard);

describe('CompanyDashboard', () => {
  it('shows a loading state before data arrives', () => {
    mockUseCompanyDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useCompanyDashboard>);

    render(<CompanyDashboard />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the fetched counts as stat tiles', () => {
    mockUseCompanyDashboard.mockReturnValue({
      data: {
        totalUsers: 3,
        totalCustomers: 12,
        totalTickets: 0,
        totalDocuments: 0,
        totalAiRequests: 0,
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCompanyDashboard>);

    render(<CompanyDashboard />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', () => {
    mockUseCompanyDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useCompanyDashboard>);

    render(<CompanyDashboard />);

    expect(screen.getByText('Failed to load dashboard.')).toBeInTheDocument();
  });
});
