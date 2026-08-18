import { api } from '../../lib/api';

export interface Session {
  id: string;
  label: string;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export async function fetchSessions(): Promise<Session[]> {
  const response = await api.get<Session[]>('/auth/sessions');
  return response.data;
}

export async function revokeSession(id: string): Promise<void> {
  await api.delete(`/auth/sessions/${id}`);
}

export async function revokeAllOtherSessions(): Promise<void> {
  await api.post('/auth/sessions/revoke-all');
}
