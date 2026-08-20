import { API_BASE_URL, api } from '../../lib/api';

export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'INDEXED' | 'FAILED';

export interface DocumentUploaderSummary {
  id: string;
  name: string | null;
  email: string;
}

export interface CompanyDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  uploadedBy: DocumentUploaderSummary;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedDocuments {
  data: CompanyDocument[];
  pagination: PaginationMeta;
}

export async function fetchDocuments(
  page: number,
  pageSize = 20,
): Promise<PaginatedDocuments> {
  const response = await api.get<PaginatedDocuments>('/company/documents', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function uploadDocument(file: File): Promise<CompanyDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<CompanyDocument>('/company/documents', formData);
  return response.data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/company/documents/${id}`);
}

// Not an axios call, deliberately — see API_BASE_URL's comment. Opening
// this URL (new tab or a plain <a>) lets the browser handle the binary
// response and Content-Disposition header natively.
export function documentDownloadUrl(id: string): string {
  return `${API_BASE_URL}/company/documents/${id}/download`;
}
