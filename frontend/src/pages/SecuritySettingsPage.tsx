import {
  useRevokeAllSessions,
  useRevokeSession,
  useSessions,
} from '../features/auth/hooks';

export function SecuritySettingsPage() {
  const { data: sessions, isLoading, isError } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  if (isLoading) {
    return <p className="text-gray-600">Loading sessions…</p>;
  }

  if (isError || !sessions) {
    return <p className="text-red-600">Failed to load sessions.</p>;
  }

  const current = sessions.find((session) => session.isCurrent);
  const others = sessions.filter((session) => !session.isCurrent);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Security</h1>

      {current && (
        <section className="mt-4">
          <h2 className="text-sm font-medium text-gray-500">
            Current session
          </h2>
          <div className="mt-2 rounded border border-gray-200 p-3">
            <p className="font-medium">{current.label}</p>
            <p className="text-sm text-gray-500">
              {current.ip ?? 'Unknown IP'}
            </p>
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">
            Other active sessions
          </h2>
          {others.length > 0 && (
            <button
              type="button"
              onClick={() => revokeAll.mutate()}
              disabled={revokeAll.isPending}
              className="text-sm text-red-600 underline disabled:opacity-50"
            >
              Revoke all other sessions
            </button>
          )}
        </div>

        {others.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No other active sessions.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {others.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between rounded border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium">{session.label}</p>
                  <p className="text-sm text-gray-500">
                    {session.ip ?? 'Unknown IP'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeSession.mutate(session.id)}
                  disabled={revokeSession.isPending}
                  className="text-sm text-red-600 underline disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
