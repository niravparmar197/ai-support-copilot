import type { UserRole } from '../auth/authApi';

export interface SidebarMenuItem {
  label: string;
  // Omitted on a group header that only exists to nest `children` (e.g.
  // COMPANY_ADMIN's "AI").
  path?: string;
  // Matches NavLink's own `end` prop: true for a role's index/dashboard
  // route, so it doesn't stay highlighted while on a nested route under it
  // (mirrors PlatformLayout's identical `end: true` on its Dashboard item).
  end?: boolean;
  // Permission key from the Day 12 catalog (see backend/prisma/schema.prisma
  // "customer.manage, document.upload, ... approval.approve, approval.reject
  // ..." comment). When set, AppSidebar wraps this item in <Can> so it's
  // hidden from anyone whose role lacks the grant.
  permission?: string;
  children?: SidebarMenuItem[];
}

// Single source of truth for role -> nav structure (task requirement:
// data-driven, not per-role JSX). PlatformLayout's own nav isn't migrated to
// read this — it already renders the identical SUPER_ADMIN list below and
// wasn't in scope to touch — but the entry is kept here so this file stays
// the complete map of every role's navigation, not just three of four.
export const sidebarConfigByRole: Record<UserRole, SidebarMenuItem[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', path: '/platform' },
    { label: 'Companies', path: '/platform/companies' },
    { label: 'Audit Logs', path: '/platform/audit-logs' },
    { label: 'Settings', path: '/platform/settings' },
  ],
  COMPANY_ADMIN: [
    { label: 'Dashboard', path: '/company', end: true },
    { label: 'Users', path: '/company/users' },
    { label: 'Customers', path: '/company/customers' },
    { label: 'Tickets', path: '/company/tickets' },
    { label: 'Documents', path: '/company/documents' },
    {
      label: 'Approvals',
      path: '/company/approvals',
      permission: 'approval.approve',
    },
    {
      label: 'AI',
      children: [
        { label: 'Evaluation', path: '/company/ai/evaluation' },
        { label: 'Usage', path: '/company/ai/usage' },
        { label: 'Prompts', path: '/company/ai/prompts' },
      ],
    },
  ],
  SUPPORT_USER: [
    { label: 'My Tickets', path: '/support', end: true },
    { label: 'Copilot', path: '/support/copilot' },
    { label: 'Customers', path: '/support/customers' },
  ],
  CUSTOMER: [
    { label: 'My Tickets', path: '/customer', end: true },
    { label: 'Create Ticket', path: '/customer/tickets/new' },
    { label: 'Profile', path: '/customer/profile' },
  ],
};
