'use client';
import { useEffect, useState } from 'react';
import { adminRequest } from '../../lib/api/admin';
import { ReviewWorkspace } from '../applications/review-workspace';
import './admin.css';
const areas = [
  'Dashboard',
  'Applications',
  'Businesses',
  'Marketplace',
  'Users',
  'Reports',
  'Audit',
  'System Health',
] as const;
type Area = (typeof areas)[number];
type Row = Record<string, unknown>;
type Page = { items: Row[]; total: number; page: number };
function text(value: unknown): string {
  return value == null
    ? '—'
    : typeof value === 'boolean'
      ? value
        ? 'Yes'
        : 'No'
      : Array.isArray(value)
        ? value.map(text).join(', ')
        : typeof value === 'object'
          ? Object.values(value).map(text).join(' · ')
          : String(value);
}
function Details({ data }: { data: Row }) {
  return (
    <dl className="admin-details">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
          <dd>
            {value && typeof value === 'object' && !Array.isArray(value) ? (
              <Details data={value as Row} />
            ) : (
              text(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function AdminConsole({ email }: { email: string }) {
  const [area, setArea] = useState<Area>('Dashboard'),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState('packages'),
    [data, setData] = useState<Row | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [history, setHistory] = useState<Row[]>([]),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [businessId, setBusinessId] = useState(''),
    [resourceId, setResourceId] = useState('');
  const endpoint =
    area === 'Dashboard'
      ? 'dashboard'
      : area === 'System Health'
        ? 'health'
        : area === 'Marketplace'
          ? `listings/${kind}`
          : area.toLowerCase();
  useEffect(() => {
    if (area === 'Applications') return;
    let active = true;
    setBusy(true);
    setData(null);
    setSelected(null);
    setMessage('');
    void adminRequest<Row>(
      `${endpoint}?page=${page}&q=${encodeURIComponent(search)}${area === 'Marketplace' && businessId ? '&businessId=' + businessId : ''}${area === 'Audit' && resourceId ? '&resourceId=' + resourceId : ''}`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [area, endpoint, page, search, version, businessId, resourceId]);
  const open = async (row: Row) => {
    setBusy(true);
    setMessage('');
    setReason('');
    setSelected(null);
    try {
      const id = String(row.id);
      const [detail, audit] = await Promise.all([
        area === 'Businesses'
          ? adminRequest<Row>(`businesses/${id}`)
          : area === 'Marketplace'
            ? adminRequest<Row>(`listings/${kind}/${id}`)
            : Promise.resolve(row),
        adminRequest<Page>(`audit?resourceId=${id}`),
      ]);
      setSelected(detail);
      setHistory(audit.items);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: string) => {
    if (!selected) return;
    setBusy(true);
    setMessage('');
    try {
      const id = String(selected.id);
      const path =
        area === 'Businesses'
          ? `businesses/${id}/status`
          : area === 'Marketplace'
            ? `listings/${kind}/${id}/moderation`
            : `reports/${id}/resolve`;
      await adminRequest(
        path,
        area === 'Businesses'
          ? { action, reason }
          : area === 'Marketplace'
            ? { hidden: action === 'HIDE', reason }
            : { reason },
      );
      setSelected(null);
      setReason('');
      setVersion((v) => v + 1);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const list =
    data && Array.isArray(data.items) ? (data as unknown as Page) : null;
  const canAct =
    selected &&
    (area === 'Businesses' || area === 'Marketplace' || area === 'Reports');
  return (
    <main className="admin-console">
      <header>
        <div>
          <p className="admin-eyebrow">B2B HYDERABAD · OPERATIONS</p>
          <h1>Admin Console</h1>
          <p>Signed in as {email}</p>
        </div>
        <a href="/logout">Sign out</a>
      </header>
      <nav aria-label="Admin areas">
        {areas.map((name) => (
          <button
            key={name}
            aria-current={area === name ? 'page' : undefined}
            onClick={() => {
              setArea(name);
              setPage(1);
              setSearch('');
              setQuery('');
              setSelected(null);
              setBusinessId('');
              setResourceId('');
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {area === 'Applications' ? (
        <ReviewWorkspace email={email} />
      ) : (
        <section aria-label={area}>
          <h2>{area}</h2>
          {area === 'Users' && (
            <p>
              Account and verification status. Administrator and role management
              remain reserved to Super Admin.
            </p>
          )}
          {area === 'Reports' && (
            <p>
              Review reported reasons and participant references. Private
              conversations remain accessible only to their participants.
            </p>
          )}
          {area === 'Marketplace' && (
            <label>
              Listing type{' '}
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPage(1);
                }}
              >
                <option value="packages">Hajj & Umrah Packages</option>
                <option value="services">Services / Ground</option>
                <option value="offers">Offers</option>
                <option value="tourism">Tourism Packages</option>
                <option value="visa">Visa Services</option>
              </select>
            </label>
          )}
          {area !== 'Dashboard' && area !== 'System Health' && (
            <form
              className="admin-search"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(query);
                setPage(1);
              }}
            >
              <label>
                Search {area.toLowerCase()}
                <input
                  value={query}
                  maxLength={100}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button disabled={busy}>Search</button>
            </form>
          )}
          {busy && <p role="status">Loading…</p>}
          {message && <p role="alert">{message}</p>}
          {list ? (
            <>
              <p>
                {list.total} records · Page {page}
              </p>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(list.items[0] ?? { result: '' }).map(
                        (key) => (
                          <th key={key}>{key.replace(/([A-Z])/g, ' $1')}</th>
                        ),
                      )}
                      {area !== 'Users' && area !== 'Audit' && <th>Review</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((row) => (
                      <tr key={String(row.id)}>
                        {Object.entries(row).map(([key, value]) => (
                          <td
                            key={key}
                            data-label={key.replace(/([A-Z])/g, ' $1')}
                          >
                            {text(value)}
                          </td>
                        ))}
                        {area !== 'Users' && area !== 'Audit' && (
                          <td>
                            <button
                              disabled={busy}
                              onClick={() => void open(row)}
                            >
                              Inspect
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!list.items.length && <p>No matching records.</p>}
              <div className="admin-pagination">
                <button
                  disabled={busy || page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={busy || page * 25 >= list.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            data && <Details data={data} />
          )}
          {selected && (
            <aside className="admin-inspection">
              <h3>Record inspection</h3>
              <Details data={selected} />
              {area === 'Businesses' && (
                <p>
                  <button
                    onClick={() => {
                      setBusinessId(String(selected.id));
                      setPage(1);
                      setSearch('');
                      setQuery('');
                      setArea('Marketplace');
                    }}
                  >
                    View business listings
                  </button>
                </p>
              )}
              <h3>Administrative history</h3>
              <button
                onClick={() => {
                  setResourceId(String(selected.id));
                  setPage(1);
                  setSearch('');
                  setQuery('');
                  setArea('Audit');
                }}
              >
                View full audit history
              </button>
              {history.length ? (
                history.map((row) => (
                  <Details key={String(row.id)} data={row} />
                ))
              ) : (
                <p>No recorded administrative actions for this resource.</p>
              )}
              {canAct && (
                <form onSubmit={(e) => e.preventDefault()}>
                  <label>
                    Reason for this decision
                    <textarea
                      value={reason}
                      minLength={10}
                      maxLength={2000}
                      rows={3}
                      onChange={(e) => setReason(e.target.value)}
                      required
                    />
                  </label>
                  <p>
                    The decision and reason will be recorded in the audit
                    history.
                  </p>
                  {area === 'Businesses' &&
                    ['APPROVED', 'SUSPENDED'].includes(
                      String(selected.status),
                    ) && (
                      <button
                        disabled={busy || reason.trim().length < 10}
                        onClick={() =>
                          void act(
                            selected.status === 'APPROVED'
                              ? 'SUSPEND'
                              : 'REACTIVATE',
                          )
                        }
                      >
                        {selected.status === 'APPROVED'
                          ? 'Suspend business'
                          : 'Reactivate business'}
                      </button>
                    )}
                  {area === 'Marketplace' && (
                    <button
                      disabled={busy || reason.trim().length < 10}
                      onClick={() =>
                        void act(selected.moderationHidden ? 'RESTORE' : 'HIDE')
                      }
                    >
                      {selected.moderationHidden
                        ? 'Remove moderation restriction'
                        : 'Hide listing'}
                    </button>
                  )}
                  {area === 'Reports' && selected.status === 'OPEN' && (
                    <button
                      disabled={busy || reason.trim().length < 10}
                      onClick={() => void act('REVIEWED')}
                    >
                      Resolve report
                    </button>
                  )}
                </form>
              )}
            </aside>
          )}
        </section>
      )}
      <footer>
        Network approval is B2B Hyderabad approval only. Commercial inventory
        belongs to its supplier.
      </footer>
    </main>
  );
}
