'use client';
import { useEffect, useState } from 'react';
import { API } from '../../lib/api/auth';
import { applicationRequest } from '../../lib/api/application';
type Summary = {
  id: string;
  legalName?: string;
  tradingName?: string;
  status: string;
  submittedAt?: string;
};
type Detail = Summary & {
  businessType?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  contactEmail?: string;
  contactMobile?: string;
  website?: string;
  yearsOperating?: number;
  capabilities: string[];
  sourceMarkets: string[];
  saudiDestinations: string[];
  licenceNumber?: string;
  licenceIssuer?: string;
  owner: { email: string; emailVerifiedAt?: string; mobileVerifiedAt?: string };
  documents: { id: string; kind: string; filename: string }[];
  reviews: {
    id: string;
    fromStatus: string;
    toStatus: string;
    note?: string;
    createdAt: string;
  }[];
};
const actions = [
  'START_REVIEW',
  'REQUEST_INFORMATION',
  'APPROVE',
  'REJECT',
  'SUSPEND',
  'REACTIVATE',
] as const;
export function ReviewWorkspace({ email }: { email: string }) {
  const [list, setList] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const load = async () =>
    setList(await applicationRequest<Summary[]>(`admin?page=${page}`));
  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, [page]);
  const open = async (id: string) => {
    try {
      setDetail(await applicationRequest<Detail>(`admin/${id}`));
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const review = async (action: (typeof actions)[number]) => {
    if (!detail) return;
    try {
      await applicationRequest(`admin/${detail.id}/review`, 'POST', {
        action,
        note,
      });
      setNote('');
      await open(detail.id);
      await load();
      setMessage(`Decision recorded: ${action}`);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', padding: '1rem' }}>
      <h1>Administration</h1>
      <h2>Application review</h2>
      <p>
        Signed in as {email}. Decisions grant B2B Hyderabad network status only.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(230px, 1fr) minmax(400px, 2fr)',
          gap: '1.5rem',
        }}
      >
        <section>
          <h2>Applications</h2>
          <p>Page {page}</p>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous applications
          </button>
          <button
            disabled={list.length < 25}
            onClick={() => setPage((p) => p + 1)}
          >
            Next applications
          </button>
          <ul>
            {list.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => void open(item.id)}>
                  {item.legalName ?? 'Unnamed application'} — {item.status}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          {detail ? (
            <>
              <h2>{detail.legalName}</h2>
              <p>Status: {detail.status}</p>
              <dl>
                {Object.entries({
                  'Trading name': detail.tradingName,
                  Type: detail.businessType,
                  Address: detail.address,
                  Country: detail.country,
                  State: detail.state,
                  City: detail.city,
                  Email: detail.contactEmail,
                  Mobile: detail.contactMobile,
                  Website: detail.website,
                  'Years operating': detail.yearsOperating,
                  Capabilities: detail.capabilities.join(', '),
                  'Source markets': detail.sourceMarkets.join(', '),
                  'Saudi destinations': detail.saudiDestinations.join(', '),
                  'Licence number': detail.licenceNumber,
                  'Licence issuer': detail.licenceIssuer,
                }).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      <strong>{key}</strong>
                    </dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Owner: {detail.owner.email} · Email verified:{' '}
                {detail.owner.emailVerifiedAt ? 'Yes' : 'No'} · Mobile verified:{' '}
                {detail.owner.mobileVerifiedAt ? 'Yes' : 'No'}
              </p>
              <h3>Private documents</h3>
              <ul>
                {detail.documents.map((document) => (
                  <li key={document.id}>
                    <a
                      href={`${API}/applications/admin/${detail.id}/documents/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {document.kind}: {document.filename}
                    </a>
                  </li>
                ))}
              </ul>
              <h3>Review history</h3>
              <ul>
                {detail.reviews.map((review) => (
                  <li key={review.id}>
                    {new Date(review.createdAt).toLocaleString()} —{' '}
                    {review.fromStatus} → {review.toStatus}
                    {review.note && `: ${review.note}`}
                  </li>
                ))}
              </ul>
              <label>
                Internal note or information request
                <br />
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  style={{ width: '100%' }}
                />
              </label>
              <p>
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => void review(action)}
                  >
                    {action.replaceAll('_', ' ')}
                  </button>
                ))}
              </p>
            </>
          ) : (
            <p>Select an application to review.</p>
          )}
        </section>
      </div>
      {message && <p role="status">{message}</p>}
      <p>
        <a href="/logout">Sign out</a>
      </p>
    </main>
  );
}
