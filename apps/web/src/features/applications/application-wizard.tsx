'use client';
import { useEffect, useState } from 'react';
import { authRequest } from '../../lib/api/auth';
import {
  applicationRequest,
  uploadApplicationDocument,
} from '../../lib/api/application';

type Draft = {
  id?: string;
  status?: string;
  legalName?: string;
  tradingName?: string;
  businessType?: 'TRAVEL_AGENCY' | 'TOUR_OPERATOR' | 'DMC';
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  contactEmail?: string;
  contactMobile?: string;
  website?: string;
  yearsOperating?: number;
  capabilities?: string[];
  sourceMarkets?: string[];
  saudiDestinations?: string[];
  licenceNumber?: string;
  licenceIssuer?: string;
  documents?: { id: string; kind: string; filename: string }[];
  reviews?: {
    id: string;
    toStatus: string;
    note?: string;
    createdAt: string;
  }[];
};
type Preview = {
  application: Draft;
  missing: string[];
  requirements: { kind: string; required: boolean }[];
};
const steps = [
  'Owner & business',
  'Business location',
  'Hajj & Umrah activity',
  'Documents & preview',
];
const fields: [keyof Draft, string, string][] = [
  ['legalName', 'Legal business name', 'text'],
  ['tradingName', 'Trading name', 'text'],
  ['contactEmail', 'Business email (must match verified account)', 'email'],
  ['contactMobile', 'Registered mobile in +countrycode format', 'tel'],
  ['website', 'Website (optional)', 'url'],
  ['address', 'Registered address', 'text'],
  ['country', 'Business country', 'text'],
  ['state', 'State or region', 'text'],
  ['city', 'City', 'text'],
  ['licenceNumber', 'Registration or licence number', 'text'],
  ['licenceIssuer', 'Licence issuer', 'text'],
];
const style = {
  maxWidth: 760,
  margin: '2rem auto',
  padding: '1.5rem',
  border: '1px solid #ccc',
  borderRadius: 12,
};
export function ApplicationWizard({ email }: { email: string }) {
  const [draft, setDraft] = useState<Draft>({ contactEmail: email });
  const [notifications, setNotifications] = useState<
    { id: string; kind: string; createdAt: string }[]
  >([]);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileCode, setMobileCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [kind, setKind] = useState<'REGISTRATION_LICENCE' | 'SUPPORTING'>(
    'REGISTRATION_LICENCE',
  );
  useEffect(() => {
    void applicationRequest<{ id: string; kind: string; createdAt: string }[]>(
      'mine/notifications',
    )
      .then(setNotifications)
      .catch(() => undefined);
    void applicationRequest<Draft | null>('mine')
      .then((data) => {
        if (data) setDraft(data);
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoaded(true));
  }, []);
  const set = (field: keyof Draft, value: unknown) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const keys = [
        'legalName',
        'tradingName',
        'businessType',
        'address',
        'country',
        'state',
        'city',
        'contactEmail',
        'contactMobile',
        'website',
        'yearsOperating',
        'capabilities',
        'sourceMarkets',
        'saudiDestinations',
        'licenceNumber',
        'licenceIssuer',
      ] as const;
      const data = Object.fromEntries(
        keys
          .filter((key) => draft[key] !== undefined && draft[key] !== null)
          .map((key) => [key, draft[key]]),
      );
      const saved = await applicationRequest<Draft>('mine', 'PATCH', data);
      setDraft((current) => ({ ...current, ...saved }));
      setMessage('Draft saved');
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    if (await save()) setStep((value) => Math.min(3, value + 1));
  };
  const loadPreview = async () => {
    if (await save()) {
      const result = await applicationRequest<Preview>('mine/preview');
      setPreview(result);
    }
  };
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      await applicationRequest('mine/submit', 'POST');
      setDraft((current) => ({ ...current, status: 'SUBMITTED' }));
      setMessage('Application submitted for review');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      await uploadApplicationDocument(file, kind);
      setMessage('Document uploaded');
      setPreview(null);
      setDraft((current) => ({
        ...current,
        documents: [
          ...(current.documents ?? []),
          { id: '', kind, filename: file.name },
        ],
      }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main style={style}>
      <h1>Join the B2B Hyderabad Network</h1>
      {!loaded ? (
        <p role="status">Loading your application…</p>
      ) : (
        <>
          <p>
            Signed in as {email}. Platform approval means network participation
            only; it is not government accreditation.
          </p>
          <p>
            <strong>Status:</strong> {draft.status ?? 'No application yet'}
          </p>
          <section>
            <h2>Notifications</h2>
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  {new Date(notification.createdAt).toLocaleString()}:{' '}
                  {notification.kind.replaceAll('_', ' ')}
                </li>
              ))}
            </ul>
          </section>
          {draft.reviews?.map((review) => (
            <p key={review.id}>
              {new Date(review.createdAt).toLocaleString()}: {review.toStatus}{' '}
              {review.note && `— ${review.note}`}
            </p>
          ))}
          {[
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'SUSPENDED',
          ].includes(draft.status ?? '') ? (
            <p>
              Your application is available for status review.{' '}
              {draft.status === 'APPROVED' && (
                <a href="/business">Open business area</a>
              )}
            </p>
          ) : (
            <>
              <nav aria-label="Application steps">
                {steps.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setStep(index)}
                    aria-current={step === index ? 'step' : undefined}
                  >
                    {index + 1}. {name}
                  </button>
                ))}
              </nav>
              <p>
                Step {step + 1} of {steps.length}
              </p>
              {step === 0 && (
                <section>
                  <h2>Owner and business</h2>
                  {fields.slice(0, 5).map(([field, label, type]) => (
                    <label
                      key={field}
                      style={{ display: 'block', margin: '0.7rem 0' }}
                    >
                      {label}
                      <br />
                      <input
                        type={type}
                        value={String(draft[field] ?? '')}
                        onChange={(event) => set(field, event.target.value)}
                        style={{ width: '100%' }}
                      />
                    </label>
                  ))}
                  <label>
                    Business type{' '}
                    <select
                      value={draft.businessType ?? ''}
                      onChange={(event) =>
                        set('businessType', event.target.value)
                      }
                    >
                      <option value="">Choose type</option>
                      <option value="TRAVEL_AGENCY">Travel Agency</option>
                      <option value="TOUR_OPERATOR">Tour Operator</option>
                      <option value="DMC">
                        Destination Management Company
                      </option>
                    </select>
                  </label>
                  <p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await authRequest('mobile/request', {
                            mobile: draft.contactMobile,
                          });
                          setMessage(
                            'Mobile verification queued. Use local development inbox for testing.',
                          );
                        } catch (error) {
                          setMessage((error as Error).message);
                        }
                      }}
                    >
                      Verify mobile
                    </button>
                  </p>
                  <label>
                    Mobile verification code{' '}
                    <input
                      value={mobileCode}
                      onChange={(event) => setMobileCode(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await authRequest('mobile/verify', {
                          token: mobileCode,
                        });
                        setMessage('Mobile verified');
                      } catch (error) {
                        setMessage((error as Error).message);
                      }
                    }}
                  >
                    Confirm code
                  </button>
                </section>
              )}
              {step === 1 && (
                <section>
                  <h2>Business location and licence</h2>
                  {fields.slice(5).map(([field, label, type]) => (
                    <label
                      key={field}
                      style={{ display: 'block', margin: '0.7rem 0' }}
                    >
                      {label}
                      <br />
                      <input
                        type={type}
                        value={String(draft[field] ?? '')}
                        onChange={(event) => set(field, event.target.value)}
                        style={{ width: '100%' }}
                      />
                    </label>
                  ))}
                  <label>
                    Years operating{' '}
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={draft.yearsOperating ?? ''}
                      onChange={(event) =>
                        set(
                          'yearsOperating',
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        )
                      }
                    />
                  </label>
                </section>
              )}
              {step === 2 && (
                <section>
                  <h2>Markets and capabilities</h2>
                  {(
                    [
                      ['capabilities', 'Hajj & Umrah capabilities'],
                      ['sourceMarkets', 'Source markets'],
                      ['saudiDestinations', 'Saudi service destinations'],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      style={{ display: 'block', margin: '0.7rem 0' }}
                    >
                      {label} (comma separated)
                      <br />
                      <input
                        style={{ width: '100%' }}
                        value={(draft[field] ?? []).join(', ')}
                        onChange={(event) =>
                          set(
                            field,
                            event.target.value
                              .split(',')
                              .map((part) => part.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </label>
                  ))}
                </section>
              )}
              {step === 3 && (
                <section>
                  <h2>Documents and preview</h2>
                  <p>
                    Upload a registration or licence PDF, PNG, or JPEG (up to 5
                    MB). Documents are private.
                  </p>
                  <select
                    value={kind}
                    onChange={(event) =>
                      setKind(event.target.value as typeof kind)
                    }
                  >
                    <option value="REGISTRATION_LICENCE">
                      Registration or licence
                    </option>
                    <option value="SUPPORTING">Supporting</option>
                  </select>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={(event) => void upload(event.target.files?.[0])}
                  />
                  <ul>
                    {draft.documents?.map((document, index) => (
                      <li key={`${document.id}-${index}`}>
                        {document.kind}: {document.filename}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => void loadPreview()}>
                    Preview and validate
                  </button>
                  {preview && (
                    <>
                      <h3>Application preview</h3>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(
                          preview.application,
                          (key, value) =>
                            [
                              'id',
                              'businessId',
                              'ownerId',
                              'reviews',
                              'documents',
                            ].includes(key)
                              ? undefined
                              : value,
                          2,
                        )}
                      </pre>
                      <p>
                        Missing items:{' '}
                        {preview.missing.length
                          ? preview.missing.join(', ')
                          : 'None'}
                      </p>
                      <button
                        disabled={busy || preview.missing.length > 0}
                        type="button"
                        onClick={() => void submit()}
                      >
                        Submit application
                      </button>
                    </>
                  )}
                </section>
              )}
              <p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  Save draft
                </button>{' '}
                {step > 0 && (
                  <button type="button" onClick={() => setStep(step - 1)}>
                    Previous
                  </button>
                )}{' '}
                {step < 3 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void next()}
                  >
                    Save and continue
                  </button>
                )}
              </p>
            </>
          )}
          {message && <p role="status">{message}</p>}
          <p>
            <a href="/logout">Sign out</a>
          </p>
        </>
      )}
    </main>
  );
}
