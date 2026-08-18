import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { ErrorPage } from '../../components/layout/ErrorPage';
import { NotFoundPage } from '../../components/layout/NotFoundPage';
import { RequireRole } from '../../features/auth/RequireRole';
import { PlatformLayout } from '../../features/platform/PlatformLayout';
import { PlatformAuditLogs } from '../../features/platform/pages/PlatformAuditLogs';
import { PlatformCompanies } from '../../features/platform/pages/PlatformCompanies';
import { PlatformCompanyDetail } from '../../features/platform/pages/PlatformCompanyDetail';
import { PlatformCompanyNew } from '../../features/platform/pages/PlatformCompanyNew';
import { PlatformDashboard } from '../../features/platform/pages/PlatformDashboard';
import { PlatformProfile } from '../../features/platform/pages/PlatformProfile';
import { PlatformSettings } from '../../features/platform/pages/PlatformSettings';
import { CompanyPage } from '../../pages/CompanyPage';
import { CustomerPage } from '../../pages/CustomerPage';
import { ForbiddenPage } from '../../pages/ForbiddenPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { SecuritySettingsPage } from '../../pages/SecuritySettingsPage';
import { SupportPage } from '../../pages/SupportPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'customer', element: <CustomerPage /> },
      { path: 'settings/security', element: <SecuritySettingsPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [{ path: 'login', element: <LoginPage /> }],
  },
  {
    path: 'platform',
    element: (
      <RequireRole role="SUPER_ADMIN">
        <PlatformLayout />
      </RequireRole>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <PlatformDashboard /> },
      { path: 'companies', element: <PlatformCompanies /> },
      { path: 'companies/new', element: <PlatformCompanyNew /> },
      { path: 'companies/:id', element: <PlatformCompanyDetail /> },
      { path: 'audit-logs', element: <PlatformAuditLogs /> },
      { path: 'settings', element: <PlatformSettings /> },
      { path: 'profile', element: <PlatformProfile /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
