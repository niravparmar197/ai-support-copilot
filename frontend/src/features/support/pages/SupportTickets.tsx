import { TicketsWorkspace } from '../../company/components/TicketsWorkspace';

// Same capabilities as CompanyTickets — SUPPORT_USER has identical
// ticket permissions to COMPANY_ADMIN (unlike Customers, where it's
// read-only), so this is the same workspace, not a restricted view.
export function SupportTickets() {
  return <TicketsWorkspace />;
}
