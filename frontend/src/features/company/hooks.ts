import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
} from './customersApi';
import { fetchCompanyDashboard } from './dashboardApi';
import {
  activateUser,
  createUser,
  deactivateUser,
  fetchUsers,
} from './usersApi';

const USERS_QUERY_KEY = ['company', 'users'];
const DASHBOARD_QUERY_KEY = ['company', 'dashboard'];
const CUSTOMERS_QUERY_KEY = ['company', 'customers'];

export function useCustomers(page: number) {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, page],
    queryFn: () => fetchCustomers(page),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    },
  });
}

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
