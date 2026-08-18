import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-xl font-semibold">403 — Forbidden</h1>
      <p className="text-gray-600">
        You're signed in, but don't have access to this page.
      </p>
      <Link to="/" className="text-blue-600 underline">
        Go home
      </Link>
    </div>
  );
}
