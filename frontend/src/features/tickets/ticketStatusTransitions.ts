export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

// Mirrors backend/src/tickets/ticket-status-transitions.ts (D-031) — kept
// in sync by hand, same as every other backend-enum mirror on this side
// (UserRole in authApi.ts, etc.), since the frontend has no access to the
// backend's generated Prisma types. This is UI-only guidance (don't even
// show an option that will 409) — the backend is what actually enforces
// it.
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['ASSIGNED', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

export function selectableStatuses(currentStatus: TicketStatus): TicketStatus[] {
  return [currentStatus, ...ALLOWED_TRANSITIONS[currentStatus]];
}
