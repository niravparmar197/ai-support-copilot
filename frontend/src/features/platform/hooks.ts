import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCompany,
  fetchCompanies,
  fetchCompany,
  impersonateCompany,
  stopImpersonation,
  updateCompany,
} from './companiesApi';

const COMPANIES_QUERY_KEY = ['platform', 'companies'];

export function useCompanies(page: number) {
  return useQuery({
    queryKey: [...COMPANIES_QUERY_KEY, page],
    queryFn: () => fetchCompanies(page),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: [...COMPANIES_QUERY_KEY, id],
    queryFn: () => fetchCompany(id),
    enabled: id.length > 0,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_QUERY_KEY });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_QUERY_KEY });
    },
  });
}

// Both mutations below clear the entire query cache on success, not just
// invalidate ['auth', 'me'] — the authenticated identity itself changes
// (SUPER_ADMIN <-> the impersonated COMPANY_ADMIN), same reasoning
// useLogout() (auth/hooks.ts) already uses for a full clear, so nothing
// fetched under the old identity (platform company lists, dashboard
// counts, ...) can leak into the new one. useCurrentUser() is included in
// that clear, so it re-fetches /auth/me — which now reports
// impersonatedBy — on the next read.

export function useImpersonateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: impersonateCompany,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useStopImpersonation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopImpersonation,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
