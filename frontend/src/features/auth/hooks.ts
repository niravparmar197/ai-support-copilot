import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, login, logout } from './authApi';
import {
  fetchSessions,
  revokeAllOtherSessions,
  revokeSession,
} from './sessionsApi';

const SESSIONS_QUERY_KEY = ['auth', 'sessions'];
const CURRENT_USER_QUERY_KEY = ['auth', 'me'];

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    // A 401 here means "not logged in" — retrying won't change that, it
    // would just delay RequireRole's redirect to /login.
    retry: false,
  });
}

// Derived from useCurrentUser() — no separate network call, since /auth/me
// already returns the resolved permission keys for the user's role.
export function usePermissions() {
  const { data: user } = useCurrentUser();
  return new Set(user?.permissions ?? []);
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: () => {
      // login()'s response can't seed the cache directly (see authApi.ts) —
      // invalidate so the next useCurrentUser() read re-fetches from
      // /auth/me, which does have the full shape.
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clears everything, not just the current-user query — sessions,
      // and anything else fetched while authenticated, shouldn't survive
      // logout in the cache either.
      queryClient.clear();
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: fetchSessions,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
  });
}
