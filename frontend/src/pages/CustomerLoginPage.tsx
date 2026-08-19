import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { CUSTOMER_DEFAULT_LANDING_PATH } from '../features/customer/customerAuthApi';
import { useCustomerLogin } from '../features/customer/hooks';
import { ApiError } from '../lib/api';

interface LocationState {
  from?: Location;
}

// Mirrors LoginPage — separate page (not a shared component with a prop
// switching auth systems) since the two forms hit entirely different
// backend auth stacks (D-029); a shared component would just be an if/else
// wrapper around otherwise-identical markup.
export function CustomerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useCustomerLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as LocationState | null)?.from;
  const redirectTo = from ? from.pathname : CUSTOMER_DEFAULT_LANDING_PATH;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          navigate(redirectTo, { replace: true });
        },
      },
    );
  };

  const error = login.error instanceof ApiError ? login.error : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold text-gray-900">
        Sign in
      </h1>
      <p className="mt-1 text-center text-sm text-gray-500">
        Customer Portal
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error.errors && error.errors.length > 0
              ? error.errors.join(', ')
              : error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
