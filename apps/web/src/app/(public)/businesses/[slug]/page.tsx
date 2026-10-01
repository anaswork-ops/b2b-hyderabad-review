import { notFound } from 'next/navigation';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params,
    context = await searchParams,
    api = process.env.API_ORIGIN ?? 'http://localhost:3001';
  const response = await fetch(
    api + '/businesses/public/' + encodeURIComponent(slug),
    { cache: 'no-store' },
  ).catch(() => null);
  if (!response?.ok) notFound();
  const p = await response.json();
  return (
    <main>
      {Object.keys(context).length > 0 && (
        <p>
          <a
            href={
              '/marketplace?' +
              new URLSearchParams(
                Object.entries(context).flatMap(([key, value]) =>
                  typeof value === 'string' ? [[key, value]] : [],
                ),
              ).toString()
            }
          >
            ← Back to marketplace results
          </a>
        </p>
      )}
      <a href="/">B2B Hyderabad</a>
      <h1>{p.name}</h1>
      <p>
        {p.businessType} · {p.headquartersCity}, {p.headquartersCountry}
      </p>
      <p>{p.description}</p>
      <h2>Capabilities</h2>
      <p>{p.capabilities.join(', ')}</p>
      <h2>Published packages</h2>
      <div className="cards">
        {p.packages.map(
          (x: {
            id: string;
            name: string;
            subtype: string;
            totalNights: number;
            departureCity: string;
            destinationCities: string[];
            pricingMode: string;
            price?: string;
            currency?: string;
          }) => (
            <article key={x.id}>
              <h3>{x.name}</h3>
              <p>
                {x.subtype} · {x.totalNights} nights · {x.departureCity} to{' '}
                {x.destinationCities.join(', ')}
              </p>
              <strong>
                {x.pricingMode === 'ON_REQUEST'
                  ? 'Price on request'
                  : x.currency + ' ' + x.price}
              </strong>
            </article>
          ),
        )}
      </div>
      <h2>Published services</h2>
      <div className="cards">
        {p.services.map(
          (x: {
            id: string;
            name: string;
            description: string;
            serviceCity: string;
          }) => (
            <article key={x.id}>
              <h3>{x.name}</h3>
              <p>{x.description}</p>
              <p>{x.serviceCity}</p>
            </article>
          ),
        )}
      </div>
    </main>
  );
}
