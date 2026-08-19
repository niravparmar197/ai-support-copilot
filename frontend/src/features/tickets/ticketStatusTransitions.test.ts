import { describe, expect, it } from 'vitest';
import { selectableStatuses } from './ticketStatusTransitions';

describe('selectableStatuses', () => {
  it('includes the current status plus its valid next statuses', () => {
    expect(selectableStatuses('OPEN')).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED']);
  });

  it('offers only the current status for a terminal ticket', () => {
    expect(selectableStatuses('CLOSED')).toEqual(['CLOSED']);
  });

  it('does not offer OPEN as an option from WAITING_FOR_CUSTOMER', () => {
    expect(selectableStatuses('WAITING_FOR_CUSTOMER')).not.toContain('OPEN');
  });
});
