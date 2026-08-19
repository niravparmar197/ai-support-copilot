import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { ErrorPage } from '../../components/layout/ErrorPage';
import { NotFoundPage } from '../../components/layout/NotFoundPage';
import { RequireRole } from '../../features/auth/RequireRole';
import { CompanyLayout } from '../../features/company/CompanyLayout';
import { CompanyAiEvaluation } from '../../features/company/pages/CompanyAiEvaluation';
import { CompanyAiPrompts } from '../../features/company/pages/CompanyAiPrompts';
import { CompanyAiUsage } from '../../features/company/pages/CompanyAiUsage';
import { CompanyApprovals } from '../../features/company/pages/CompanyApprovals';
import { CompanyCustomerDetail } from '../../features/company/pages/CompanyCustomerDetail';
import { CompanyCustomers } from '../../features/company/pages/CompanyCustomers';
import { CompanyDashboard } from '../../features/company/pages/CompanyDashboard';
import { CompanyDocuments } from '../../features/company/pages/CompanyDocuments';
import { CompanyTicketDetail } from '../../features/company/pages/CompanyTicketDetail';
import { CompanyTickets } from '../../features/company/pages/CompanyTickets';
import { CompanyUsers } from '../../features/company/pages/CompanyUsers';
import { CustomerLayout } from '../../features/customer/CustomerLayout';
import { CustomerProfile } from '../../features/customer/pages/CustomerProfile';
import { CustomerTicketDetail } from '../../features/customer/pages/CustomerTicketDetail';
import { CustomerTicketNew } from '../../features/customer/pages/CustomerTicketNew';
import { CustomerTickets } from '../../features/customer/pages/CustomerTickets';
import { RequireCustomerAuth } from '../../features/customer/RequireCustomerAuth';
import { PlatformLayout } from '../../features/platform/PlatformLayout';
import { PlatformAuditLogs } from '../../features/platform/pages/PlatformAuditLogs';
import { PlatformCompanies } from '../../features/platform/pages/PlatformCompanies';
import { PlatformCompanyDetail } from '../../features/platform/pages/PlatformCompanyDetail';
import { PlatformCompanyNew } from '../../features/platform/pages/PlatformCompanyNew';
import { PlatformDashboard } from '../../features/platform/pages/PlatformDashboard';
import { PlatformProfile } from '../../features/platform/pages/PlatformProfile';
import { PlatformSettings } from '../../features/platform/pages/PlatformSettings';
import { SupportLayout } from '../../features/support/SupportLayout';
import { SupportCopilot } from '../../features/support/pages/SupportCopilot';
import { SupportCustomers } from '../../features/support/pages/SupportCustomers';
import { SupportTickets } from '../../features/support/pages/SupportTickets';
import { CustomerLoginPage } from '../../pages/CustomerLoginPage';
import { ForbiddenPage } from '../../pages/ForbiddenPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { SecuritySettingsPage } from '../../pages/SecuritySettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'settings/security', element: <SecuritySettingsPage /> },
      { path: 'forbidden', element: <ForbiddenPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'customer/login', element: <CustomerLoginPage /> },
    ],
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
  {
    path: 'company',
    element: (
      <RequireRole role="COMPANY_ADMIN">
        <CompanyLayout />
      </RequireRole>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <CompanyDashboard /> },
      { path: 'users', element: <CompanyUsers /> },
      { path: 'customers', element: <CompanyCustomers /> },
      { path: 'customers/:id', element: <CompanyCustomerDetail /> },
      { path: 'tickets', element: <CompanyTickets /> },
      { path: 'tickets/:id', element: <CompanyTicketDetail /> },
      { path: 'documents', element: <CompanyDocuments /> },
      { path: 'approvals', element: <CompanyApprovals /> },
      { path: 'ai/evaluation', element: <CompanyAiEvaluation /> },
      { path: 'ai/usage', element: <CompanyAiUsage /> },
      { path: 'ai/prompts', element: <CompanyAiPrompts /> },
    ],
  },
  {
    path: 'support',
    element: (
      <RequireRole role="SUPPORT_USER">
        <SupportLayout />
      </RequireRole>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <SupportTickets /> },
      { path: 'tickets/:id', element: <CompanyTicketDetail /> },
      { path: 'copilot', element: <SupportCopilot /> },
      { path: 'customers', element: <SupportCustomers /> },
      { path: 'customers/:id', element: <CompanyCustomerDetail /> },
    ],
  },
  {
    path: 'customer',
    element: (
      <RequireCustomerAuth>
        <CustomerLayout />
      </RequireCustomerAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <CustomerTickets /> },
      { path: 'tickets/new', element: <CustomerTicketNew /> },
      { path: 'tickets/:id', element: <CustomerTicketDetail /> },
      { path: 'profile', element: <CustomerProfile /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
