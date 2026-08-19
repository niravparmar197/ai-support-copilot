import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../../lib/api';
import { useCreateTicket } from '../hooks';
import type { TicketPriority } from '../ticketsApi';

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function CustomerTicketNew() {
  const navigate = useNavigate();
  const createTicket = useCreateTicket();

  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTicket.mutate(
      { subject, priority: priority || undefined },
      { onSuccess: () => navigate('/customer', { replace: true }) },
    );
  };

  const error =
    createTicket.error instanceof ApiError ? createTicket.error : undefined;

  return (
    <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-gray-900">Create Ticket</h1>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Subject
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Priority (optional)
          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TicketPriority | '')
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Not sure</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
          disabled={createTicket.isPending}
          className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {createTicket.isPending ? 'Creating…' : 'Create Ticket'}
        </button>
      </form>
    </div>
  );
}
