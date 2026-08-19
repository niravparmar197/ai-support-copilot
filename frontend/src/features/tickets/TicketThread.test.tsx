import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TicketThread, type ThreadMessage } from './TicketThread';

const MESSAGES: ThreadMessage[] = [
  {
    id: 'm1',
    authorType: 'CUSTOMER',
    authorName: 'Ada Lovelace',
    content: 'My printer is on fire',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'm2',
    authorType: 'SUPPORT',
    authorName: 'Sam',
    content: 'Have you tried turning it off?',
    createdAt: '2026-01-01T00:05:00.000Z',
  },
  {
    id: 'm3',
    authorType: 'AI',
    authorName: null,
    content: 'Suggested resolution: unplug the printer.',
    createdAt: '2026-01-01T00:06:00.000Z',
  },
];

describe('TicketThread', () => {
  it('renders every message with its author label', () => {
    render(
      <TicketThread
        messages={MESSAGES}
        isLoading={false}
        viewerAuthorType="SUPPORT"
        onSend={vi.fn()}
        isSending={false}
      />,
    );

    expect(screen.getByText('My printer is on fire')).toBeInTheDocument();
    expect(screen.getByText('Have you tried turning it off?')).toBeInTheDocument();
    expect(screen.getByText('Suggested resolution: unplug the printer.')).toBeInTheDocument();
    expect(screen.getByText(/AI Assistant/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no messages', () => {
    render(
      <TicketThread
        messages={[]}
        isLoading={false}
        viewerAuthorType="CUSTOMER"
        onSend={vi.fn()}
        isSending={false}
      />,
    );

    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('calls onSend with the draft content and clears the textarea', () => {
    const onSend = vi.fn();
    render(
      <TicketThread
        messages={[]}
        isLoading={false}
        viewerAuthorType="CUSTOMER"
        onSend={onSend}
        isSending={false}
      />,
    );

    const textarea = screen.getByPlaceholderText('Write a reply…');
    fireEvent.change(textarea, { target: { value: 'Still broken' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith('Still broken');
    expect(textarea).toHaveValue('');
  });

  it('does not call onSend for a blank draft', () => {
    const onSend = vi.fn();
    render(
      <TicketThread
        messages={[]}
        isLoading={false}
        viewerAuthorType="CUSTOMER"
        onSend={onSend}
        isSending={false}
      />,
    );

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });
});
