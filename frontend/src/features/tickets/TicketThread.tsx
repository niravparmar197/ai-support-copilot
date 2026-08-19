import { useState, type FormEvent } from 'react';

export type MessageAuthorType = 'CUSTOMER' | 'SUPPORT' | 'AI';

export interface ThreadMessage {
  id: string;
  authorType: MessageAuthorType;
  authorName: string | null;
  content: string;
  createdAt: string;
}

interface TicketThreadProps {
  messages: ThreadMessage[];
  isLoading: boolean;
  // Which side of the conversation the current viewer is on, for
  // left/right alignment — a customer viewing their own ticket sees their
  // own messages on the right, a staff member sees SUPPORT messages on
  // the right. There's no "viewer" concept AI messages belong to, so
  // those get their own centered treatment regardless.
  viewerAuthorType: 'CUSTOMER' | 'SUPPORT';
  onSend: (content: string) => void;
  isSending: boolean;
}

function authorLabel(message: ThreadMessage): string {
  if (message.authorType === 'AI') {
    return 'AI Assistant';
  }
  return message.authorName ?? (message.authorType === 'CUSTOMER' ? 'Customer' : 'Support');
}

// The one shared component for both the staff and customer ticket-detail
// pages (Day 20) — plain Tailwind, not MUI. Tailwind is loaded app-wide
// (see index.css), so this drops cleanly into both an MUI-heavy company
// page and the Tailwind-only customer portal without pulling MUI into a
// bundle that doesn't otherwise use it, or rendering unthemed MUI in the
// portal. Purely presentational: data fetching/sending is the caller's
// job, since the two audiences hit different guarded endpoints.
export function TicketThread({
  messages,
  isLoading,
  viewerAuthorType,
  onSend,
  isSending,
}: TicketThreadProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim().length === 0) {
      return;
    }
    onSend(draft);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-gray-500">No messages yet.</p>
        )}

        {!isLoading &&
          messages.map((message) => {
            const isAi = message.authorType === 'AI';
            const isMine = !isAi && message.authorType === viewerAuthorType;

            return (
              <div
                key={message.id}
                className={`flex ${isAi ? 'justify-center' : isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-lg px-3 py-2 text-sm ${
                    isAi
                      ? 'bg-purple-50 text-purple-900'
                      : isMine
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p
                    className={`mb-0.5 text-xs font-medium ${
                      isAi ? 'text-purple-600' : isMine ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {authorLabel(message)} ·{' '}
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            );
          })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a reply…"
          rows={2}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isSending || draft.trim().length === 0}
          className="self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
