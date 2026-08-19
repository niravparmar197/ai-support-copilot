import { ConflictException } from '@nestjs/common';
import type { TicketStatus } from '@prisma/client';
import {
  assertValidTransition,
  isValidTransition,
  validNextStatuses,
} from './ticket-status-transitions';

const ALL_STATUSES: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

describe('ticket-status-transitions', () => {
  it.each([
    ['OPEN', 'ASSIGNED'],
    ['OPEN', 'IN_PROGRESS'],
    ['OPEN', 'CLOSED'],
    ['ASSIGNED', 'OPEN'],
    ['ASSIGNED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER'],
    ['IN_PROGRESS', 'RESOLVED'],
    ['WAITING_FOR_CUSTOMER', 'IN_PROGRESS'],
    ['RESOLVED', 'IN_PROGRESS'],
    ['RESOLVED', 'CLOSED'],
  ] satisfies [TicketStatus, TicketStatus][])(
    'allows %s -> %s',
    (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
      expect(() => assertValidTransition(from, to)).not.toThrow();
    },
  );

  it.each([
    ['OPEN', 'RESOLVED'],
    ['OPEN', 'WAITING_FOR_CUSTOMER'],
    ['WAITING_FOR_CUSTOMER', 'OPEN'],
    ['RESOLVED', 'OPEN'],
    ['CLOSED', 'OPEN'],
    ['CLOSED', 'IN_PROGRESS'],
  ] satisfies [TicketStatus, TicketStatus][])(
    'rejects %s -> %s',
    (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
      expect(() => assertValidTransition(from, to)).toThrow(ConflictException);
    },
  );

  it('always allows a same-status no-op', () => {
    for (const status of ALL_STATUSES) {
      expect(isValidTransition(status, status)).toBe(true);
      expect(() => assertValidTransition(status, status)).not.toThrow();
    }
  });

  it('CLOSED has no valid next statuses', () => {
    expect(validNextStatuses('CLOSED')).toEqual([]);
  });
});
