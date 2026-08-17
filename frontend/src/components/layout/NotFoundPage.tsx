import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-xl font-semibold">404 — Page not found</h1>
      <Link to="/" className="text-blue-600 underline">
        Go home
      </Link>
    </div>
  );
}
