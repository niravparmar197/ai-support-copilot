import type { User } from '@prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

export function toSafeUser(user: User): AuthenticatedUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
