import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../auth.constants';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}
