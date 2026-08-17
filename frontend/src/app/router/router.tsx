import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../../components/layout/AppLayout';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { ErrorPage } from '../../components/layout/ErrorPage';
import { NotFoundPage } from '../../components/layout/NotFoundPage';
import { CompanyPage } from '../../pages/CompanyPage';
import { CustomerPage } from '../../pages/CustomerPage';
import { HomePage } from '../../pages/HomePage';
import { LoginPage } from '../../pages/LoginPage';
import { PlatformPage } from '../../pages/PlatformPage';
import { SupportPage } from '../../pages/SupportPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'platform', element: <PlatformPage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'customer', element: <CustomerPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [{ path: 'login', element: <LoginPage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
]);
