import { Outlet, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../auth/hooks';
import { AppSidebar } from '../navigation/AppSidebar';

// Tailwind, not MUI — mirrors PlatformLayout's structure (sidebar + top bar
// with user email/logout) but stays on Tailwind like the rest of the
// non-platform-admin app (see theme.ts's ThemeProvider scoping comment).
export function SupportLayout() {
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    });
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">{user?.email}</span>
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
