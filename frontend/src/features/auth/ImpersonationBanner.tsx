import { useNavigate } from 'react-router-dom';
import { useStopImpersonation } from '../platform/hooks';
import { useCurrentUser } from './hooks';

// Rendered from AppLayout, not PlatformLayout — impersonating navigates
// OUT of /platform into the impersonated company admin's actual area
// (AppLayout's routes), and PlatformLayout is unreachable while
// impersonating anyway (RequireRole role="SUPER_ADMIN" blocks it). Tailwind,
// not MUI — this lives in AppLayout's subtree, which stays on Tailwind
// deliberately (see PlatformLayout's ThemeProvider/CssBaseline comment).
export function ImpersonationBanner() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const stopImpersonation = useStopImpersonation();

  if (!user?.impersonatedBy) {
    return null;
  }

  const handleExit = () => {
    stopImpersonation.mutate(undefined, {
      onSuccess: ({ companyId }) => {
        navigate(`/platform/companies/${companyId}`, { replace: true });
      },
    });
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 shadow">
      <span>⚠ IMPERSONATING {user.impersonatedBy.companyName}</span>
      <button
        type="button"
        onClick={handleExit}
        disabled={stopImpersonation.isPending}
        className="rounded bg-amber-950/10 px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors hover:bg-amber-950/20 disabled:opacity-50"
      >
        {stopImpersonation.isPending ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
