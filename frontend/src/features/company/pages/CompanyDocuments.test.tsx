import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCurrentUser } from '../../auth/hooks';
import { useDeleteDocument, useDocuments, useUploadDocument } from '../hooks';
import { CompanyDocuments } from './CompanyDocuments';

vi.mock('../../auth/hooks', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useDocuments: vi.fn(),
  useUploadDocument: vi.fn(),
  useDeleteDocument: vi.fn(),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseDocuments = vi.mocked(useDocuments);
const mockUseUploadDocument = vi.mocked(useUploadDocument);
const mockUseDeleteDocument = vi.mocked(useDeleteDocument);

const DOCUMENT = {
  id: 'document-1',
  filename: 'handbook.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  status: 'UPLOADED' as const,
  uploadedBy: { id: 'staff-1', name: 'Sam', email: 'sam@example.com' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

function mockAsCompanyAdmin() {
  mockUseCurrentUser.mockReturnValue({
    data: { role: 'COMPANY_ADMIN' },
  } as unknown as ReturnType<typeof useCurrentUser>);
}

describe('CompanyDocuments', () => {
  it('renders the document list', () => {
    mockAsCompanyAdmin();
    mockUseDocuments.mockReturnValue({
      data: { data: [DOCUMENT], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    mockUseUploadDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUploadDocument>);
    mockUseDeleteDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteDocument>);

    render(<CompanyDocuments />);

    expect(screen.getByText('handbook.pdf')).toBeInTheDocument();
  });

  it('uploads the selected file', () => {
    mockAsCompanyAdmin();
    const mutate = vi.fn();
    mockUseDocuments.mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    mockUseUploadDocument.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUploadDocument>);
    mockUseDeleteDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteDocument>);

    const { container } = render(<CompanyDocuments />);
    const file = new File(['hello'], 'handbook.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mutate).toHaveBeenCalledWith(file);
  });

  it('deletes a document via the row action', () => {
    mockAsCompanyAdmin();
    const mutate = vi.fn();
    mockUseDocuments.mockReturnValue({
      data: { data: [DOCUMENT], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    mockUseUploadDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUploadDocument>);
    mockUseDeleteDocument.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteDocument>);

    render(<CompanyDocuments />);
    for (const button of screen.getAllByRole('button', { name: /delete/i })) {
      fireEvent.click(button);
    }

    expect(mutate).toHaveBeenCalledWith('document-1');
  });

  it('hides upload and delete for a Support User', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { role: 'SUPPORT_USER' },
    } as unknown as ReturnType<typeof useCurrentUser>);
    mockUseDocuments.mockReturnValue({
      data: { data: [DOCUMENT], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useDocuments>);
    mockUseUploadDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useUploadDocument>);
    mockUseDeleteDocument.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteDocument>);

    render(<CompanyDocuments />);

    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});
