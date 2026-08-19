import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentCustomer, useCustomerLogout } from './hooks';

const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-blue-50 font-semibold text-blue-700'
      : 'text-gray-600 hover:bg-gray-100'
  }`;

// Inline, not the shared <AppSidebar> — that component derives its role
// from the staff useCurrentUser() (features/navigation/AppSidebar.tsx),
// which a logged-in customer never satisfies, so it would silently render
// nothing here. Customer's nav is 3 static links with no permission
// gating (Customer has no permissions concept), so a small dedicated list
// is simpler than reworking AppSidebar to serve two unrelated identities.
function CustomerSidebar() {
  return (
    <nav className="w-60 shrink-0 space-y-0.5 border-r border-gray-200 p-3">
      <NavLink to="/customer" end className={navLinkClasses}>
        My Tickets
      </NavLink>
      <NavLink to="/customer/tickets/new" className={navLinkClasses}>
        Create Ticket
      </NavLink>
      <NavLink to="/customer/profile" className={navLinkClasses}>
        Profile
      </NavLink>
    </nav>
  );
}

// Tailwind, not MUI — mirrors PlatformLayout's structure (sidebar + top bar
// with user email/logout) but stays on Tailwind like the rest of the
// non-platform-admin app (see theme.ts's ThemeProvider scoping comment).
//
// Customer auth landed Day 17 (D-029) — a separate stack from staff auth,
// so this reads useCurrentCustomer()/useCustomerLogout() here, not the
// staff useCurrentUser()/useLogout() the earlier scaffolding stubbed in.
export function CustomerLayout() {
  const { data: customer } = useCurrentCustomer();
  const logoutMutation = useCustomerLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/customer/login', { replace: true }),
    });
  };

  return (
    <div className="flex min-h-screen">
      <CustomerSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">{customer?.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Log out
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
