import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}
