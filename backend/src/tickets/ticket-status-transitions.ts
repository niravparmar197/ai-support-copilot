import { ConflictException } from '@nestjs/common';
import type { TicketStatus } from '@prisma/client';

// The state machine (D-031). CLOSED is a true dead end — no manual
// reopening, no automatic one either; a recurring issue is a new ticket,
// not a reopened old one.
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['ASSIGNED', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

export function validNextStatuses(currentStatus: TicketStatus): TicketStatus[] {
  return ALLOWED_TRANSITIONS[currentStatus];
}

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

// Single source of truth for "is this ticket status move allowed" — used
// by the manual staff update (TicketsService.updateForTenant), the
// assign/unassign status coupling (Day 19), and the customer-reply
// auto-transition (Day 20/21), so there's one table instead of each call
// site re-deciding what's a valid move. Same-status "transitions" are
// always allowed (idempotent no-op), matching every other mutation in
// this app (suspendCompany, deactivateUser, ...).
export function assertValidTransition(from: TicketStatus, to: TicketStatus): void {
  if (!isValidTransition(from, to)) {
    throw new ConflictException(
      `Cannot move a ticket from ${from} to ${to}.`,
    );
  }
}
