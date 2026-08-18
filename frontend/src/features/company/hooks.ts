import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCompanyDashboard } from './dashboardApi';
import {
  activateUser,
  createUser,
  deactivateUser,
  fetchUsers,
} from './usersApi';

const USERS_QUERY_KEY = ['company', 'users'];
const DASHBOARD_QUERY_KEY = ['company', 'dashboard'];

export function useCompanyDashboard() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchCompanyDashboard,
  });
}

export function useUsers(page: number) {
  return useQuery({
    queryKey: [...USERS_QUERY_KEY, page],
    queryFn: () => fetchUsers(page),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
