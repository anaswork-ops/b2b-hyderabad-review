'use client';
import { FormEvent, useEffect, useState } from 'react';
import {
  attachmentUrl,
  messageRequest,
  uploadMessageAttachment,
} from '../../lib/api/messaging';
type Message = {
  id: string;
  body: string;
  senderBusiness: { profile?: { name: string } };
  attachments: Array<{ id: string; filename: string }>;
};
type Conversation = {
  id: string;
  contextType: string;
  messages: Message[];
  customRequest?: Record<string, unknown>;
  unreadCount?: number;
};
export function MessagesWorkspace() {
  const [items, setItems] = useState<Conversation[]>([]),
    [active, setActive] = useState<Conversation | null>(null),
    [notice, setNotice] = useState(''),
    [query, setQuery] = useState('');
  const load = async (q = '') => {
    try {
      setItems(
        await messageRequest<Conversation[]>(
          q ? `?q=${encodeURIComponent(q)}` : '',
        ),
      );
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  useEffect(() => void load(), []);
  const open = async (id: string) => {
    try {
      setActive(await messageRequest<Conversation>(id));
      await load(query);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active) return;
    try {
      const form = event.currentTarget,
        data = new FormData(form),
        message = await messageRequest<Message>(active.id + '/send', 'POST', {
          body: data.get('body'),
        }),
        file = data.get('attachment');
      if (file instanceof File && file.size)
        await uploadMessageAttachment(active.id, message.id, file);
      form.reset();
      await open(active.id);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const action = async (path: string, body?: object) => {
    if (!active) return;
    try {
      await messageRequest(`${active.id}/${path}`, 'POST', body);
      setNotice('Action completed');
      await open(active.id);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  return (
    <main>
      <header className="console-head">
        <div>
          <h1>Messages</h1>
          <p>Business enquiries and custom package requests</p>
        </div>
        <a href="/business">My Business</a>
      </header>
      {notice && (
        <p role="status" className="status">
          {notice}
        </p>
      )}
      <form
        className="message-search"
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
      >
        <input
          aria-label="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button>Search</button>
      </form>
      <div className="message-layout">
        <aside className="conversation-list">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => open(item.id)}
              aria-pressed={active?.id === item.id}
            >
              <strong>{item.contextType.replace('_', ' ')}</strong>
              <span>{item.messages[0]?.body ?? 'No messages'}</span>
              {!!item.unreadCount && <b>{item.unreadCount} unread</b>}
            </button>
          ))}
          {!items.length && <p>No conversations yet.</p>}
        </aside>
        <section className="message-thread">
          {!active && <p>Select a conversation.</p>}
          {active && (
            <>
              <h2>{active.contextType.replace('_', ' ')}</h2>
              {active.customRequest && (
                <dl className="request-context">
                  {Object.entries(active.customRequest)
                    .filter(
                      ([k]) =>
                        ![
                          'id',
                          'requesterBusinessId',
                          'providerBusinessId',
                        ].includes(k),
                    )
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </div>
                    ))}
                </dl>
              )}
              <div className="message-history">
                {active.messages.map((message) => (
                  <article key={message.id}>
                    <strong>
                      {message.senderBusiness.profile?.name ?? 'Business'}
                    </strong>
                    <p>{message.body}</p>
                    {message.attachments.map((file) => (
                      <a key={file.id} href={attachmentUrl(active.id, file.id)}>
                        {file.filename}
                      </a>
                    ))}
                  </article>
                ))}
              </div>
              <form onSubmit={send} className="message-compose">
                <textarea
                  name="body"
                  aria-label="Message"
                  required
                  maxLength={4000}
                />
                <input
                  name="attachment"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                />
                <button>Send</button>
              </form>
              <button onClick={() => action('block')}>Block business</button>
              <button
                onClick={() => {
                  const reason = window.prompt(
                    'Why are you reporting this conversation?',
                  );
                  if (reason) action('report', { reason });
                }}
              >
                Report
              </button>
              {active.customRequest &&
                active.customRequest.status !== 'CLOSED' && (
                  <button onClick={() => action('custom-request/close')}>
                    Close request
                  </button>
                )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
