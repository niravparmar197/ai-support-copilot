import { NavLink } from 'react-router-dom';
import { Can } from '../auth/Can';
import { useCurrentUser } from '../auth/hooks';
import { sidebarConfigByRole, type SidebarMenuItem } from './sidebarConfig';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-blue-50 font-semibold text-blue-700'
      : 'text-gray-600 hover:bg-gray-100'
  }`;

function MenuItem({ item }: { item: SidebarMenuItem }) {
  // Group headers (e.g. COMPANY_ADMIN's "AI") have no path of their own —
  // render children directly, no collapse/expand state needed for the one
  // level of nesting this config currently has.
  if (item.children) {
    return (
      <div>
        <p className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          {item.label}
        </p>
        <div className="space-y-0.5">
          {item.children.map((child) => (
            <MenuItem key={child.label} item={child} />
          ))}
        </div>
      </div>
    );
  }

  const link = (
    <NavLink to={item.path!} end={item.end} className={linkClasses}>
      {item.label}
    </NavLink>
  );

  if (item.permission) {
    return <Can permission={item.permission}>{link}</Can>;
  }

  return link;
}

// The one sidebar for every non-platform role (COMPANY_ADMIN, SUPPORT_USER,
// CUSTOMER) — reads the menu structure for the current user's role out of
// sidebarConfig instead of being duplicated per role. PlatformLayout keeps
// its own inline nav (see sidebarConfig.ts comment), so this isn't a fourth
// copy of the same idea, it's the single implementation for the roles that
// didn't have one yet.
export function AppSidebar() {
  const { data: user } = useCurrentUser();

  if (!user) {
    return null;
  }

  const items = sidebarConfigByRole[user.role];

  return (
    <nav className="w-60 shrink-0 space-y-0.5 border-r border-gray-200 p-3">
      {items.map((item) => (
        <MenuItem key={item.label} item={item} />
      ))}
    </nav>
  );
}
