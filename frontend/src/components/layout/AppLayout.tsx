import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/platform', label: 'Platform' },
  { to: '/company', label: 'Company' },
  { to: '/support', label: 'Support' },
  { to: '/customer', label: 'Customer' },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 p-4">
        <nav className="flex gap-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'font-semibold underline' : 'text-gray-600'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
