'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { comparePackages, marketSearch } from '../../lib/api/marketplace';
import { messageRequest } from '../../lib/api/messaging';
type Item = Record<string, unknown> & {
  id?: string;
  name: string;
  publicSlug?: string;
  profile?: { name: string; publicSlug: string };
  availability?: Array<{ kind: string }>;
};
const marketplaceModes = [
  ['packages', 'Hajj & Umrah'],
  ['tourism', 'Tourism Packages'],
  ['visa', 'Visa Services'],
  ['services', 'Ground Services'],
  ['businesses', 'Travel Agencies'],
] as const;
export function Marketplace() {
  const router = useRouter(),
    current = useSearchParams(),
    [result, setResult] = useState<{
      items: Item[];
      total: number;
      page: number;
      pageSize: number;
      elapsedMs?: number;
    }>({ items: [], total: 0, page: 1, pageSize: 12 }),
    [error, setError] = useState(''),
    [advanced, setAdvanced] = useState(false),
    [shortlist, setShortlist] = useState<string[]>([]),
    [comparison, setComparison] = useState<Item[]>([]),
    [requestProvider, setRequestProvider] = useState<string | null>(null),
    searchSequence = useRef(0);
  const search = async (q: URLSearchParams) => {
    const sequence = ++searchSequence.current;
    try {
      setError('');
      const data = await marketSearch(q);
      if (sequence !== searchSequence.current) return;
      setResult(data);
      localStorage.setItem('marketplace-search', q.toString());
    } catch (e) {
      if (sequence === searchSequence.current) setError((e as Error).message);
    }
  };
  useEffect(() => {
    const q = current.toString()
      ? new URLSearchParams(current)
      : new URLSearchParams(
          localStorage.getItem('marketplace-search') ??
            'mode=packages&market=India',
        );
    router.replace('/marketplace?' + q.toString());
    search(q);
  }, []);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      q = new URLSearchParams();
    for (const [k, v] of f) if (String(v)) q.set(k, String(v));
    q.set('page', '1');
    router.push('/marketplace?' + q);
    search(q);
  };
  const page = (value: number) => {
    const q = new URLSearchParams(current);
    q.set('page', String(value));
    router.push('/marketplace?' + q);
    search(q);
  };
  const compare = async () => {
    try {
      setComparison(await comparePackages(shortlist));
    } catch (e) {
      if ((e as Error).message === 'SIGN_IN_REQUIRED')
        router.push(
          '/login?next=' + encodeURIComponent('/marketplace?' + current),
        );
      else setError((e as Error).message);
    }
  };
  const message = async (item: Item) => {
    const mode = current.get('mode') ?? 'packages',
      contextType =
        mode === 'businesses'
          ? 'BUSINESS'
          : mode === 'services'
            ? 'SERVICE'
            : mode === 'tourism'
              ? 'TOURISM_PACKAGE'
              : mode === 'visa'
                ? 'VISA_SERVICE'
                : 'PACKAGE',
      contextId = contextType === 'BUSINESS' ? item.publicSlug : item.id;
    try {
      const result = await messageRequest<{ id: string }>('', 'POST', {
        contextType,
        contextId,
        message: `Enquiry about ${item.name}`,
      });
      router.push('/messages?conversation=' + result.id);
    } catch (e) {
      if ((e as Error).message === 'SIGN_IN_REQUIRED')
        router.push(
          '/login?next=' + encodeURIComponent('/marketplace?' + current),
        );
      else setError((e as Error).message);
    }
  };
  const custom = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!requestProvider) return;
    const f = new FormData(e.currentTarget);
    try {
      const result = await messageRequest<{ conversationId: string }>(
        'custom-requests',
        'POST',
        {
          providerSlug: requestProvider,
          subtype: f.get('subtype'),
          departureCity: f.get('departureCity'),
          startDate: f.get('startDate'),
          endDate: f.get('endDate'),
          groupSize: Number(f.get('groupSize')),
          totalNights: Number(f.get('totalNights')),
          makkahNights: Number(f.get('makkahNights')),
          madinahNights: Number(f.get('madinahNights')),
          requirements: f.get('requirements'),
        },
      );
      router.push('/messages?conversation=' + result.conversationId);
    } catch (error) {
      if ((error as Error).message === 'SIGN_IN_REQUIRED')
        router.push(
          '/login?next=' + encodeURIComponent('/marketplace?' + current),
        );
      else setError((error as Error).message);
    }
  };
  const mode = current.get('mode') ?? 'packages';
  const title =
      mode === 'tourism'
        ? 'Tourism Packages Marketplace'
        : mode === 'visa'
          ? 'Visa Services Marketplace'
          : mode === 'businesses'
            ? 'Travel Agency Network'
            : mode === 'services'
              ? 'Ground Services Marketplace'
              : 'Hajj & Umrah Marketplace',
    theme = ['tourism', 'visa', 'services'].includes(mode)
      ? mode
      : 'pilgrimage';
  return (
    <main className={`marketplace-shell marketplace-${theme}`}>
      <nav className="marketplace-nav" aria-label="Marketplace Navigation">
        <a className="marketplace-brand" href="/">
          <span>B2B</span> Hyderabad
        </a>
        <div>
          <a href="/">Home</a>
          <a href="/business">Dashboard</a>
          <a className="marketplace-signin" href="/login">
            Business Sign In
          </a>
        </div>
      </nav>
      <header className="marketplace-hero">
        <div>
          <span className="marketplace-kicker">
            Verified B2B Travel Network
          </span>
          <h1>{title}</h1>
          <p>
            Discover approved travel agencies, compare published inventory and
            connect with suppliers in one professional workspace.
          </p>
        </div>
        <div className="marketplace-hero-stat">
          <strong>{result.total}</strong>
          <span>Verified Results</span>
        </div>
      </header>
      <section
        className="marketplace-insights"
        aria-label="Marketplace Overview"
      >
        <div>
          <span>Active Vertical</span>
          <strong>{title.replace(' Marketplace', '')}</strong>
        </div>
        <div>
          <span>Supplier Standard</span>
          <strong>Approved Businesses</strong>
        </div>
        <div>
          <span>Inventory Status</span>
          <strong>Published & Available</strong>
        </div>
      </section>
      <form className="market-search" onSubmit={submit}>
        <div className="search-heading">
          <span>Smart Discovery</span>
          <strong>Find The Right Travel Partner</strong>
        </div>
        <label>
          Market
          <input
            name="market"
            list="market-options"
            defaultValue={current.get('market') ?? 'India'}
          />
          <datalist id="market-options">
            <option value="India" />
            <option value="Saudi Arabia" />
            <option value="UAE" />
          </datalist>
        </label>
        <label>
          Departure
          <input
            name="departure"
            defaultValue={current.get('departure') ?? ''}
          />
        </label>
        <label>
          Travel Start
          <input
            type="date"
            name="startDate"
            defaultValue={current.get('startDate') ?? ''}
          />
        </label>
        <label>
          Travel End
          <input
            type="date"
            name="endDate"
            defaultValue={current.get('endDate') ?? ''}
          />
        </label>
        <label>
          Travellers
          <input
            type="number"
            min="1"
            name="groupSize"
            defaultValue={current.get('groupSize') ?? ''}
          />
        </label>
        {mode === 'tourism' || mode === 'visa' ? (
          <label>
            Category
            <input
              name="category"
              defaultValue={current.get('category') ?? ''}
            />
          </label>
        ) : (
          <label>
            Journey
            <select
              name="subtype"
              defaultValue={current.get('subtype') ?? 'UMRAH'}
            >
              <option>UMRAH</option>
              <option>HAJJ</option>
            </select>
          </label>
        )}
        <button>Search</button>
        <button type="button" onClick={() => setAdvanced(!advanced)}>
          More Filters
        </button>
        {advanced && (
          <div className="advanced">
            <label>
              Destination
              <input
                name="destination"
                defaultValue={current.get('destination') ?? ''}
              />
            </label>
            <label>
              Minimum Nights
              <input type="number" name="minNights" />
            </label>
            <label>
              Maximum Nights
              <input type="number" name="maxNights" />
            </label>
            <label>
              Makkah Nights
              <input type="number" name="makkahNights" />
            </label>
            <label>
              Madinah Nights
              <input type="number" name="madinahNights" />
            </label>
            <label>
              Room Occupancy
              <input name="occupancy" />
            </label>
            <label>
              Visa Status
              <input name="visa" />
            </label>
            <label>
              Transport
              <input name="transport" />
            </label>
            <label>
              Meals
              <input name="meals" />
            </label>
            <label>
              Pricing
              <select name="pricingMode">
                <option value="">Any</option>
                <option>FIXED</option>
                <option>STARTING_FROM</option>
                <option>ON_REQUEST</option>
              </select>
            </label>
            <label>
              Currency
              <input name="currency" maxLength={3} />
            </label>
            <label>
              Maximum Price
              <input type="number" name="maxPrice" />
            </label>
            <label>
              Availability
              <select name="availability">
                <option value="">Any</option>
                <option>AVAILABLE</option>
                <option>ON_REQUEST</option>
              </select>
            </label>
            <label>
              Supplier Type
              <select name="supplierType">
                <option value="">Any</option>
                <option>TRAVEL_AGENCY</option>
                <option>TOUR_OPERATOR</option>
                <option>DMC</option>
              </select>
            </label>
          </div>
        )}
      </form>
      <nav className="tabs marketplace-tabs" aria-label="Marketplace Verticals">
        {marketplaceModes.map(([modeKey, label]) => (
          <button
            key={modeKey}
            aria-pressed={(current.get('mode') ?? 'packages') === modeKey}
            onClick={() => {
              const q = new URLSearchParams(current);
              q.set('mode', modeKey);
              q.set('page', '1');
              router.push('/marketplace?' + q);
              search(q);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="availability-legend" aria-label="Availability legend">
        <span>Available</span>
        <span>On Request</span>
        <span>Unavailable Items Excluded</span>
      </div>
      {error && (
        <p role="alert" className="status">
          {error}
        </p>
      )}
      <p className="result-summary">
        <strong>{result.total} Matching Results</strong>
        <span>Search Completed In {result.elapsedMs ?? 0} ms</span>
      </p>
      <div className="cards">
        {result.items.map((item) => (
          <article key={item.id ?? item.publicSlug}>
            {mode !== 'businesses' && (
              <div
                className={`vertical-placeholder ${mode}`}
                role="img"
                aria-label={`${title} destination imagery`}
              >
                <span>
                  {mode === 'tourism'
                    ? 'Destination Journey'
                    : mode === 'visa'
                      ? 'Document Assistance'
                      : mode === 'services'
                        ? 'Ground Mobility'
                        : 'Pilgrimage Journey'}
                </span>
              </div>
            )}
            <h2>{item.name}</h2>
            <p>{item.profile?.name ?? String(item.businessType ?? '')}</p>
            <p>
              {String(item.subtype ?? '')} {String(item.totalNights ?? '')}{' '}
              {item.totalNights ? 'nights' : ''}
            </p>
            <p>{item.availability?.map((x) => x.kind).join(', ')}</p>
            <span className="availability-state">
              {item.availability?.some((rule) => rule.kind === 'ON_REQUEST')
                ? 'On request'
                : 'Available'}
            </span>
            <strong>
              {item.pricingMode === 'ON_REQUEST'
                ? 'Price on request'
                : item.currency && item.price
                  ? String(item.currency) + ' ' + String(item.price)
                  : ''}
            </strong>
            {(current.get('mode') === 'tourism' ||
              current.get('mode') === 'visa') &&
              item.id && (
                <p>
                  <a
                    href={`/marketplace/${current.get('mode')}/${item.id}?${current.toString()}`}
                  >
                    View Details
                  </a>
                </p>
              )}
            {current.get('mode') === 'visa' && (
              <p className="visa-disclaimer">
                Visa approval, appointments and processing times are determined
                by government or consular authorities and are never guaranteed.
              </p>
            )}
            {item.publicSlug && (
              <p>
                <a href={'/businesses/' + item.publicSlug}>View Business</a>
              </p>
            )}
            {item.profile && (
              <p>
                <a
                  href={
                    '/businesses/' +
                    item.profile.publicSlug +
                    '?' +
                    current.toString()
                  }
                >
                  Supplier Profile
                </a>
              </p>
            )}
            <button onClick={() => message(item)}>Message Supplier</button>
            {mode !== 'tourism' && mode !== 'visa' && (
              <button
                onClick={() =>
                  setRequestProvider(
                    item.publicSlug ?? item.profile?.publicSlug ?? null,
                  )
                }
              >
                Request Custom Package
              </button>
            )}
            {item.id && mode === 'packages' && (
              <label>
                <input
                  type="checkbox"
                  checked={shortlist.includes(item.id)}
                  onChange={(e) =>
                    setShortlist(
                      e.target.checked
                        ? [...shortlist, item.id!]
                        : shortlist.filter((x) => x !== item.id),
                    )
                  }
                  disabled={
                    !shortlist.includes(item.id) && shortlist.length >= 4
                  }
                />{' '}
                Compare
              </label>
            )}
          </article>
        ))}
      </div>
      {requestProvider && mode !== 'tourism' && mode !== 'visa' && (
        <section className="custom-request">
          <h2>Custom Package Request</h2>
          <form className="form-grid" onSubmit={custom}>
            <label>
              Journey
              <select name="subtype">
                <option>UMRAH</option>
                <option>HAJJ</option>
              </select>
            </label>
            <label>
              Departure City
              <input name="departureCity" required />
            </label>
            <label>
              Travel Start
              <input name="startDate" type="date" required />
            </label>
            <label>
              Travel End
              <input name="endDate" type="date" required />
            </label>
            <label>
              Group Size
              <input name="groupSize" type="number" min="1" required />
            </label>
            <label>
              Total Nights
              <input name="totalNights" type="number" min="1" required />
            </label>
            <label>
              Makkah Nights
              <input name="makkahNights" type="number" min="0" required />
            </label>
            <label>
              Madinah Nights
              <input name="madinahNights" type="number" min="0" required />
            </label>
            <label className="wide">
              Requirements
              <textarea name="requirements" required maxLength={4000} />
            </label>
            <button>Send Request</button>
            <button type="button" onClick={() => setRequestProvider(null)}>
              Cancel
            </button>
          </form>
        </section>
      )}
      {shortlist.length >= 2 && (
        <button onClick={compare}>Compare {shortlist.length} packages</button>
      )}
      {comparison.length > 0 && (
        <section className="comparison">
          <h2>Package Comparison</h2>
          <div className="compare-grid">
            {comparison.map((x) => (
              <article key={x.id}>
                <h3>{x.name}</h3>
                <p>
                  {String(x.totalNights)} nights: {String(x.makkahNights)}{' '}
                  Makkah / {String(x.madinahNights)} Madinah
                </p>
                <p>Accommodation: {JSON.stringify(x.accommodation)}</p>
                <p>Transport: {JSON.stringify(x.transport)}</p>
                <p>Visa: {String(x.visaStatus)}</p>
                <p>Meals: {(x.meals as string[]).join(', ')}</p>
                <strong>
                  {String(x.currency ?? '')} {String(x.price ?? 'On request')}
                </strong>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer className="pager">
        <button
          disabled={result.page <= 1}
          onClick={() => page(result.page - 1)}
        >
          Previous
        </button>
        <span>Page {result.page}</span>
        <button
          disabled={result.page * result.pageSize >= result.total}
          onClick={() => page(result.page + 1)}
        >
          Next
        </button>
      </footer>
    </main>
  );
}
