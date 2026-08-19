import type { Customer } from '@prisma/client';

export type SafeCustomer = Omit<Customer, 'passwordHash'>;

export function toSafeCustomer(customer: Customer): SafeCustomer {
  const { passwordHash: _passwordHash, ...safeCustomer } = customer;
  return safeCustomer;
}
