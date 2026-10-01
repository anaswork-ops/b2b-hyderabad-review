'use client';
import { FormEvent, useEffect, useState } from 'react';
import { inventoryRequest } from '../../lib/api/inventory';
type Item = Record<string, any> & { id: string; name: string; status: string };
type Data = { tourism: Item[]; visa: Item[] };
const list = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const availability = [{ kind: 'YEAR_ROUND', blackoutDates: [] }];
export function VerticalManager() {
  const [data, setData] = useState<Data>({ tourism: [], visa: [] }),
    [notice, setNotice] = useState('');
  const load = () => inventoryRequest<Data>('verticals').then(setData);
  useEffect(() => void load(), []);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
      setNotice('Saved.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const tourism = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      inventoryRequest('verticals/tourism', 'POST', {
        name: f.get('name'),
        description: f.get('description'),
        sourceMarket: f.get('sourceMarket'),
        departureCity: f.get('departureCity'),
        destinationCountry: f.get('destinationCountry'),
        destinationCities: list(f.get('destinationCities')),
        category: f.get('category'),
        durationDays: Number(f.get('durationDays')),
        accommodation: f.get('accommodation'),
        transport: f.get('transport'),
        inclusions: list(f.get('inclusions')),
        exclusions: list(f.get('exclusions')),
        pricingMode: f.get('pricingMode'),
        price: f.get('price') ? Number(f.get('price')) : undefined,
        currency: f.get('currency') || undefined,
        availability,
      }),
    );
  };
  const visa = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      inventoryRequest('verticals/visa', 'POST', {
        name: f.get('name'),
        description: f.get('description'),
        sourceMarket: f.get('sourceMarket'),
        applicantNationality: f.get('applicantNationality'),
        destinationCountry: f.get('destinationCountry'),
        visaCategory: f.get('visaCategory'),
        processingRequirement: f.get('processingRequirement'),
        documentSummary: f.get('documentSummary'),
        appointmentAssistance: f.get('appointmentAssistance') === 'on',
        governmentFeeIncluded: f.get('governmentFeeIncluded') === 'on',
        pricingMode: f.get('pricingMode'),
        price: f.get('price') ? Number(f.get('price')) : undefined,
        currency: f.get('currency') || undefined,
        availability,
      }),
    );
  };
  const life = (kind: string, id: string, action: string) =>
    run(() =>
      inventoryRequest(`verticals/${kind}/${id}/lifecycle`, 'POST', { action }),
    );
  const cards = (kind: string, items: Item[]) => (
    <div className="cards">
      {items.map((x) => (
        <article key={x.id}>
          <h3>{x.name}</h3>
          <p>{x.status}</p>
          {x.status === 'DRAFT' && (
            <button onClick={() => life(kind, x.id, 'PUBLISH')}>Publish</button>
          )}
          {x.status === 'PUBLISHED' && (
            <button onClick={() => life(kind, x.id, 'PAUSE')}>Pause</button>
          )}
          <button
            onClick={() => {
              const name = prompt('Listing name', x.name);
              if (name)
                run(() =>
                  inventoryRequest(`verticals/${kind}/${x.id}`, 'PUT', {
                    ...x,
                    name,
                    availability: x.availability.map(
                      ({ id, createdAt, ...r }: any) => r,
                    ),
                  }),
                );
            }}
          >
            Edit
          </button>
        </article>
      ))}
    </div>
  );
  return (
    <main>
      <header className="console-head">
        <div>
          <h1>Tourism &amp; Visa Inventory</h1>
          <p>Create independent vertical listings.</p>
        </div>
        <a href="/business">Dashboard</a>
      </header>
      {notice && <p className="status">{notice}</p>}
      <h2>Tourism Packages</h2>
      {cards('tourism', data.tourism)}
      <form className="form-grid" onSubmit={tourism}>
        {[
          'name',
          'sourceMarket',
          'departureCity',
          'destinationCountry',
          'destinationCities',
          'category',
          'durationDays',
          'accommodation',
          'transport',
          'inclusions',
          'exclusions',
          'currency',
          'price',
        ].map((n) => (
          <label key={n}>
            {n}
            <input
              name={n}
              type={['durationDays', 'price'].includes(n) ? 'number' : 'text'}
              required={!['currency', 'price'].includes(n)}
            />
          </label>
        ))}
        <label className="wide">
          description
          <textarea name="description" minLength={20} required />
        </label>
        <label>
          Pricing
          <select name="pricingMode">
            <option>FIXED</option>
            <option>STARTING_FROM</option>
            <option>ON_REQUEST</option>
          </select>
        </label>
        <button>Create Tourism draft</button>
      </form>
      <h2>Visa Services</h2>
      {cards('visa', data.visa)}
      <form className="form-grid" onSubmit={visa}>
        {[
          'name',
          'sourceMarket',
          'applicantNationality',
          'destinationCountry',
          'visaCategory',
          'currency',
          'price',
        ].map((n) => (
          <label key={n}>
            {n}
            <input
              name={n}
              type={n === 'price' ? 'number' : 'text'}
              required={!['currency', 'price'].includes(n)}
            />
          </label>
        ))}
        {['description', 'processingRequirement', 'documentSummary'].map(
          (n) => (
            <label className="wide" key={n}>
              {n}
              <textarea
                name={n}
                minLength={n === 'description' ? 20 : 10}
                required
              />
            </label>
          ),
        )}
        <label>
          <input name="appointmentAssistance" type="checkbox" /> Appointment
          assistance
        </label>
        <label>
          <input name="governmentFeeIncluded" type="checkbox" /> Government fee
          included
        </label>
        <label>
          Pricing
          <select name="pricingMode">
            <option>FIXED</option>
            <option>STARTING_FROM</option>
            <option>ON_REQUEST</option>
          </select>
        </label>
        <button>Create Visa draft</button>
      </form>
      <p className="visa-disclaimer">
        Visa approval, appointments and processing times are controlled by
        government or consular authorities and are never guaranteed.
      </p>
    </main>
  );
}
