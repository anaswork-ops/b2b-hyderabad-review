'use client';
import { FormEvent, useEffect, useState } from 'react';
import { inventoryRequest, uploadPackageMedia } from '../../lib/api/inventory';
type Item = Record<string, unknown> & {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  pricingMode?: string;
  updatedAt?: string;
};
type Data = { packages: Item[]; services: Item[]; offers: Item[] };
type ConversationSummary = { unreadCount?: number };
type Notice = { id: string; kind: string; createdAt: string };
const list = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const num = (v: FormDataEntryValue | null) =>
  v === '' ? undefined : Number(v);
const Field = ({
  name,
  label,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) => (
  <label>
    {label}
    <input name={name} type={type} required={required} />
  </label>
);
const Pricing = () => (
  <>
    <label>
      Pricing
      <select name="pricingMode">
        <option>FIXED</option>
        <option>STARTING_FROM</option>
        <option>ON_REQUEST</option>
      </select>
    </label>
    <Field name="price" label="Price" type="number" required={false} />
    <Field name="currency" label="Currency" required={false} />
  </>
);
export function BusinessConsole({ email }: { email: string }) {
  const [data, setData] = useState<Data>({
      packages: [],
      services: [],
      offers: [],
    }),
    [profile, setProfile] = useState<Record<string, unknown> | null>(null),
    [tab, setTab] = useState('home'),
    [message, setMessage] = useState(''),
    [preview, setPreview] = useState<Item | null>(null),
    [unread, setUnread] = useState(0),
    [notices, setNotices] = useState<Notice[]>([]),
    [market, setMarket] = useState('India');
  const load = async () => {
    const [i, p, conversations, accountNotices] = await Promise.all([
      inventoryRequest<Data>('inventory'),
      inventoryRequest<Record<string, unknown> | null>(
        'businesses/mine/profile',
      ),
      inventoryRequest<ConversationSummary[]>('messages').catch(() => []),
      inventoryRequest<Notice[]>('applications/mine/notifications').catch(
        () => [],
      ),
    ]);
    setData(i);
    setProfile(p);
    setUnread(
      conversations.reduce((total, item) => total + (item.unreadCount ?? 0), 0),
    );
    setNotices(accountNotices);
  };
  useEffect(() => {
    setMarket(localStorage.getItem('b2b-market') ?? 'India');
    load().catch((e: Error) => setMessage(e.message));
  }, []);
  const changeMarket = (value: string) => {
    setMarket(value);
    localStorage.setItem('b2b-market', value);
  };
  const recent = [...data.packages, ...data.services, ...data.offers]
    .filter((item) => item.updatedAt)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 4);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      setMessage('Saving…');
      await fn();
      await load();
      setMessage('Saved.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const profileSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      inventoryRequest('businesses/mine/profile', 'PUT', {
        publicSlug: f.get('publicSlug'),
        name: f.get('name'),
        businessType: f.get('businessType'),
        description: f.get('description'),
        headquartersCountry: f.get('headquartersCountry'),
        headquartersState: f.get('headquartersState'),
        headquartersCity: f.get('headquartersCity'),
        publicEmail: f.get('publicEmail'),
        publicPhone: f.get('publicPhone'),
        privateEmail: f.get('privateEmail'),
        privatePhone: f.get('privatePhone'),
        website: f.get('website'),
        yearsOperating: Number(f.get('yearsOperating')),
        languages: list(f.get('languages')),
        marketsServed: list(f.get('marketsServed')),
        capabilities: list(f.get('capabilities')),
        serviceCountries: list(f.get('serviceCountries')),
        serviceCities: list(f.get('serviceCities')),
        licenceNumber: f.get('licenceNumber'),
        licenceIssuer: f.get('licenceIssuer'),
      }),
    );
  };
  const packageSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      inventoryRequest('inventory/packages', 'POST', {
        name: f.get('name'),
        subtype: f.get('subtype'),
        sourceMarket: f.get('sourceMarket'),
        departureCity: f.get('departureCity'),
        destinationCities: list(f.get('destinationCities')),
        validFrom: f.get('validFrom') || undefined,
        validTo: f.get('validTo') || undefined,
        totalNights: Number(f.get('totalNights')),
        makkahNights: Number(f.get('makkahNights')),
        madinahNights: Number(f.get('madinahNights')),
        minimumGroupSize: num(f.get('minimumGroupSize')),
        maximumGroupSize: num(f.get('maximumGroupSize')),
        accommodation: { details: f.get('accommodation') },
        roomOccupancy: list(f.get('roomOccupancy')),
        transport: { details: f.get('transport') },
        flights: f.get('flights') ? { details: f.get('flights') } : undefined,
        meals: list(f.get('meals')),
        visaStatus: f.get('visaStatus'),
        ziyarat: list(f.get('ziyarat')),
        assistance: list(f.get('assistance')),
        inclusions: list(f.get('inclusions')),
        exclusions: list(f.get('exclusions')),
        pricingMode: f.get('pricingMode'),
        price: num(f.get('price')),
        currency: f.get('currency') || undefined,
        cancellationTerms: f.get('cancellationTerms'),
        availability: [
          {
            kind: f.get('availabilityKind'),
            startDate: f.get('startDate') || undefined,
            endDate: f.get('endDate') || undefined,
            blackoutDates: list(f.get('blackouts')),
            capacity: num(f.get('capacity')),
          },
        ],
      }),
    );
  };
  const serviceSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      inventoryRequest('inventory/services', 'POST', {
        name: f.get('name'),
        subtype: f.get('subtype'),
        description: f.get('description'),
        sourceMarket: f.get('sourceMarket'),
        serviceCountry: f.get('serviceCountry'),
        serviceCity: f.get('serviceCity'),
        pricingMode: f.get('pricingMode'),
        price: num(f.get('price')),
        currency: f.get('currency') || undefined,
        availability: [
          {
            kind: 'YEAR_ROUND',
            blackoutDates: [],
            capacity: num(f.get('capacity')),
          },
        ],
      }),
    );
  };
  const offerSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      target = String(f.get('target'));
    run(() =>
      inventoryRequest('inventory/offers', 'POST', {
        ...(target.startsWith('p:')
          ? { packageId: target.slice(2) }
          : { serviceId: target.slice(2) }),
        title: f.get('title'),
        description: f.get('description'),
        validFrom: f.get('validFrom'),
        validTo: f.get('validTo'),
        active: true,
        pricingMode: f.get('pricingMode'),
        price: num(f.get('price')),
        currency: f.get('currency') || undefined,
      }),
    );
  };
  const life = (kind: string, id: string, action: string) =>
    run(() =>
      inventoryRequest('inventory/' + kind + '/' + id + '/lifecycle', 'POST', {
        action,
      }),
    );
  const edit = (kind: 'packages' | 'services' | 'offers', item: Item) => {
    const field = kind === 'offers' ? 'title' : 'name';
    const value = window.prompt(`Edit ${field}`, String(item[field] ?? ''));
    if (!value) return;
    const clean = { ...item, [field]: value };
    for (const key of [
      'id',
      'profileId',
      'status',
      'createdAt',
      'updatedAt',
      'publishedAt',
      'media',
    ])
      delete clean[key];
    if (Array.isArray(clean.availability))
      clean.availability = clean.availability.map((entry) => {
        const rule = { ...(entry as Record<string, unknown>) };
        for (const key of ['id', 'packageId', 'serviceId', 'createdAt'])
          delete rule[key];
        for (const key of ['startDate', 'endDate'])
          if (typeof rule[key] === 'string') rule[key] = rule[key].slice(0, 10);
        if (Array.isArray(rule.blackoutDates))
          rule.blackoutDates = rule.blackoutDates.map((date) =>
            String(date).slice(0, 10),
          );
        return rule;
      });
    for (const key of ['validFrom', 'validTo'])
      if (typeof clean[key] === 'string') clean[key] = clean[key].slice(0, 10);
    if (clean.price !== null && clean.price !== undefined)
      clean.price = Number(clean.price);
    run(() =>
      inventoryRequest('inventory/' + kind + '/' + item.id, 'PUT', clean),
    );
  };
  return (
    <main>
      <header className="console-head">
        <div>
          <h1>My Business</h1>
          <p>{email}</p>
        </div>
        <a href="/logout">Sign out</a>
      </header>
      <nav className="business-nav">
        <button onClick={() => setTab('home')}>Home</button>
        <a
          href={
            '/marketplace?mode=packages&market=' + encodeURIComponent(market)
          }
        >
          Hajj &amp; Umrah Marketplace
        </a>
        <a
          href={
            '/marketplace?mode=businesses&market=' + encodeURIComponent(market)
          }
        >
          Businesses
        </a>
        <button onClick={() => setTab('packages')}>
          My Packages &amp; Services
        </button>
        <a href="/messages">Messages</a>
        <a href="/business/verticals">Tourism &amp; Visa Inventory</a>
        <button onClick={() => setTab('notifications')}>Notifications</button>
        <button onClick={() => setTab('profile')}>My Business</button>
        <label className="nav-market">
          Market
          <select
            value={market}
            onChange={(event) => changeMarket(event.target.value)}
          >
            <option>India</option>
            <option>Saudi Arabia</option>
            <option>UAE</option>
          </select>
        </label>
      </nav>
      {tab !== 'home' && tab !== 'notifications' && (
        <nav className="tabs">
          {['profile', 'packages', 'services', 'offers'].map((x) => (
            <button key={x} onClick={() => setTab(x)} aria-pressed={tab === x}>
              {x}
            </button>
          ))}
        </nav>
      )}
      {message && (
        <p role="status" className="status">
          {message}
        </p>
      )}
      {preview && (
        <section className="preview">
          <button onClick={() => setPreview(null)}>Close preview</button>
          <h2>{String(preview.name ?? preview.title)}</h2>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </section>
      )}
      {tab === 'home' && (
        <>
          <section className="dashboard-hero">
            <div>
              <span className="eyebrow">Operational overview</span>
              <h2>Good to see you.</h2>
              <p>
                Search the {market} market, respond to enquiries and keep your
                inventory ready for buyers.
              </p>
            </div>
            <a
              className="primary-action"
              href={
                '/marketplace?mode=packages&market=' +
                encodeURIComponent(market)
              }
            >
              Search marketplace →
            </a>
          </section>
          <section className="metric-grid">
            <article>
              <span>Active packages</span>
              <strong>
                {
                  data.packages.filter((item) => item.status === 'PUBLISHED')
                    .length
                }
              </strong>
              <button onClick={() => setTab('packages')}>
                Manage packages
              </button>
            </article>
            <article>
              <span>Active services</span>
              <strong>
                {
                  data.services.filter((item) => item.status === 'PUBLISHED')
                    .length
                }
              </strong>
              <button onClick={() => setTab('services')}>
                Manage services
              </button>
            </article>
            <article className={unread ? 'attention' : ''}>
              <span>Messages needing attention</span>
              <strong>{unread}</strong>
              <a href="/messages">Open inbox</a>
            </article>
            <article className={notices.length ? 'attention' : ''}>
              <span>Account notices</span>
              <strong>{notices.length}</strong>
              <button onClick={() => setTab('notifications')}>
                View notices
              </button>
            </article>
          </section>
          <section className="dashboard-grid">
            <article className="dashboard-panel">
              <div className="panel-head">
                <h3>Quick create</h3>
                <span>Publish when ready</span>
              </div>
              <div className="quick-actions">
                <button onClick={() => setTab('packages')}>
                  + New package
                </button>
                <button onClick={() => setTab('services')}>
                  + New service
                </button>
              </div>
            </article>
            <article className="dashboard-panel">
              <div className="panel-head">
                <h3>Recent marketplace activity</h3>
                <a href={'/marketplace?market=' + encodeURIComponent(market)}>
                  View market
                </a>
              </div>
              {recent.length ? (
                <ul className="activity-list">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <span>{item.name ?? item.title}</span>
                      <b>{item.status ?? item.pricingMode}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No inventory activity yet. Create your first Package or
                  Service.
                </p>
              )}
            </article>
          </section>
        </>
      )}
      {tab === 'notifications' && (
        <section className="dashboard-panel">
          <div className="panel-head">
            <h2>Notifications</h2>
            <span>{notices.length} account notices</span>
          </div>
          {notices.length ? (
            <ul className="activity-list">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <span>{notice.kind.replaceAll('_', ' ')}</span>
                  <time>{new Date(notice.createdAt).toLocaleDateString()}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>You have no application or account notices.</p>
          )}
          <p>
            <a href="/messages">Open message notifications</a>
          </p>
        </section>
      )}
      {tab === 'profile' && (
        <section>
          <h2>Business profile</h2>
          <form className="form-grid" onSubmit={profileSave}>
            <Field name="publicSlug" label="Public URL slug" />
            <Field name="name" label="Trading name" />
            <label>
              Business type
              <select name="businessType">
                <option>TRAVEL_AGENCY</option>
                <option>TOUR_OPERATOR</option>
                <option>DMC</option>
              </select>
            </label>
            <label className="wide">
              Description
              <textarea name="description" required minLength={20} />
            </label>
            <Field name="headquartersCountry" label="Country" />
            <Field name="headquartersState" label="State" />
            <Field name="headquartersCity" label="City" />
            <Field
              name="publicEmail"
              label="Public email"
              type="email"
              required={false}
            />
            <Field name="publicPhone" label="Public phone" required={false} />
            <Field
              name="privateEmail"
              label="Private network email"
              type="email"
            />
            <Field name="privatePhone" label="Private network phone" />
            <Field name="website" label="Website" type="url" required={false} />
            <Field
              name="yearsOperating"
              label="Years operating"
              type="number"
            />
            <Field name="languages" label="Languages" />
            <Field name="marketsServed" label="Markets served" />
            <Field name="capabilities" label="Capabilities" />
            <Field name="serviceCountries" label="Service countries" />
            <Field name="serviceCities" label="Service cities" />
            <Field
              name="licenceNumber"
              label="Licence number"
              required={false}
            />
            <Field
              name="licenceIssuer"
              label="Licence issuer"
              required={false}
            />
            <button>Save profile</button>
          </form>
          {profile && (
            <p>
              <a href={'/businesses/' + String(profile.publicSlug)}>
                Preview public profile
              </a>
            </p>
          )}
        </section>
      )}
      {tab === 'packages' && (
        <section>
          <h2>Hajj and Umrah packages</h2>
          <Cards
            items={data.packages}
            kind="packages"
            life={life}
            duplicate={(id) =>
              run(() =>
                inventoryRequest(
                  'inventory/packages/' + id + '/duplicate',
                  'POST',
                ),
              )
            }
            remove={(id) =>
              run(() => inventoryRequest('inventory/packages/' + id, 'DELETE'))
            }
            preview={setPreview}
            edit={(item) => edit('packages', item)}
          />
          <form id="new-package" className="form-grid" onSubmit={packageSave}>
            <Field name="name" label="Package name" />
            <label>
              Subtype
              <select name="subtype">
                <option>UMRAH</option>
                <option>HAJJ</option>
              </select>
            </label>
            <Field name="sourceMarket" label="Source market" />
            <Field name="departureCity" label="Departure city" />
            <Field name="destinationCities" label="Destination cities" />
            <Field
              name="validFrom"
              label="Valid from"
              type="date"
              required={false}
            />
            <Field
              name="validTo"
              label="Valid to"
              type="date"
              required={false}
            />
            <Field name="totalNights" label="Total nights" type="number" />
            <Field name="makkahNights" label="Makkah nights" type="number" />
            <Field name="madinahNights" label="Madinah nights" type="number" />
            <Field
              name="minimumGroupSize"
              label="Minimum group"
              type="number"
              required={false}
            />
            <Field
              name="maximumGroupSize"
              label="Maximum group"
              type="number"
              required={false}
            />
            <Field name="accommodation" label="Accommodation" />
            <Field name="roomOccupancy" label="Room occupancy" />
            <Field name="transport" label="Transport" />
            <Field name="flights" label="Flights" required={false} />
            <Field name="meals" label="Meals" />
            <Field name="visaStatus" label="Visa status" />
            <Field name="ziyarat" label="Ziyarat" />
            <Field name="assistance" label="Assistance" />
            <Field name="inclusions" label="Inclusions" />
            <Field name="exclusions" label="Exclusions" />
            <Pricing />
            <Field name="cancellationTerms" label="Cancellation terms" />
            <label>
              Availability
              <select name="availabilityKind">
                <option>DATE_RANGE</option>
                <option>FIXED_DEPARTURE</option>
                <option>YEAR_ROUND</option>
                <option>ON_REQUEST</option>
              </select>
            </label>
            <Field
              name="startDate"
              label="Start"
              type="date"
              required={false}
            />
            <Field name="endDate" label="End" type="date" required={false} />
            <Field name="blackouts" label="Blackout dates" required={false} />
            <Field
              name="capacity"
              label="Capacity"
              type="number"
              required={false}
            />
            <button>Create draft</button>
          </form>
          <Media data={data} run={run} />
        </section>
      )}
      {tab === 'services' && (
        <section>
          <h2>Services</h2>
          <Cards
            items={data.services}
            kind="services"
            life={life}
            remove={(id) =>
              run(() => inventoryRequest('inventory/services/' + id, 'DELETE'))
            }
            preview={setPreview}
            edit={(item) => edit('services', item)}
          />
          <form id="new-service" className="form-grid" onSubmit={serviceSave}>
            <Field name="name" label="Service name" />
            <label>
              Subtype
              <select name="subtype">
                <option>UMRAH</option>
                <option>HAJJ</option>
              </select>
            </label>
            <label className="wide">
              Description
              <textarea name="description" required minLength={10} />
            </label>
            <Field name="sourceMarket" label="Source market" />
            <Field name="serviceCountry" label="Country" />
            <Field name="serviceCity" label="City" />
            <Pricing />
            <Field
              name="capacity"
              label="Capacity"
              type="number"
              required={false}
            />
            <button>Create service</button>
          </form>
        </section>
      )}
      {tab === 'offers' && (
        <section>
          <h2>Offers</h2>
          <Cards
            items={data.offers}
            kind="offers"
            remove={(id) =>
              run(() => inventoryRequest('inventory/offers/' + id, 'DELETE'))
            }
            preview={setPreview}
            edit={(item) => edit('offers', item)}
          />
          <form className="form-grid" onSubmit={offerSave}>
            <label>
              Package or service
              <select name="target">
                {data.packages.map((x) => (
                  <option key={x.id} value={'p:' + x.id}>
                    Package: {x.name}
                  </option>
                ))}
                {data.services.map((x) => (
                  <option key={x.id} value={'s:' + x.id}>
                    Service: {x.name}
                  </option>
                ))}
              </select>
            </label>
            <Field name="title" label="Offer title" />
            <label className="wide">
              Description
              <textarea name="description" required minLength={10} />
            </label>
            <Field name="validFrom" label="Valid from" type="date" />
            <Field name="validTo" label="Valid to" type="date" />
            <Pricing />
            <button>Create offer</button>
          </form>
        </section>
      )}
    </main>
  );
}
function Cards({
  items,
  kind,
  life,
  duplicate,
  remove,
  preview,
  edit,
}: {
  items: Item[];
  kind: string;
  life?: (k: string, id: string, a: string) => void;
  duplicate?: (id: string) => void;
  remove?: (id: string) => void;
  preview?: (item: Item) => void;
  edit?: (item: Item) => void;
}) {
  return (
    <div className="cards">
      {items.map((x) => (
        <article key={x.id}>
          <h3>{x.name ?? x.title}</h3>
          <p>{x.status ?? x.pricingMode}</p>
          {preview && <button onClick={() => preview(x)}>Preview</button>}
          {edit && x.status !== 'ARCHIVED' && (
            <button onClick={() => edit(x)}>Edit</button>
          )}
          {life && x.status === 'DRAFT' && (
            <button onClick={() => life(kind, x.id, 'PUBLISH')}>Publish</button>
          )}
          {life && x.status === 'PUBLISHED' && (
            <button onClick={() => life(kind, x.id, 'PAUSE')}>Pause</button>
          )}
          {life && x.status === 'PAUSED' && (
            <button onClick={() => life(kind, x.id, 'RESUME')}>Resume</button>
          )}
          {life && x.status !== 'ARCHIVED' && (
            <button onClick={() => life(kind, x.id, 'ARCHIVE')}>Archive</button>
          )}
          {duplicate && (
            <button onClick={() => duplicate(x.id)}>Duplicate</button>
          )}
          {remove && (!x.status || x.status === 'DRAFT') && (
            <button onClick={() => remove(x.id)}>Delete</button>
          )}
        </article>
      ))}
    </div>
  );
}
function Media({
  data,
  run,
}: {
  data: Data;
  run: (fn: () => Promise<unknown>) => void;
}) {
  return (
    <form
      className="media"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          file = f.get('file');
        if (file instanceof File && file.size)
          run(() =>
            uploadPackageMedia(
              String(f.get('packageId')),
              file,
              String(f.get('kind')) as 'IMAGE' | 'BROCHURE' | 'DOCUMENT',
              f.get('public') === 'on',
            ),
          );
      }}
    >
      <h3>Add package media</h3>
      <select name="packageId">
        {data.packages.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <select name="kind">
        <option>IMAGE</option>
        <option>BROCHURE</option>
        <option>DOCUMENT</option>
      </select>
      <input
        name="file"
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        required
      />
      <label>
        <input name="public" type="checkbox" /> Public
      </label>
      <button>Upload</button>
    </form>
  );
}
