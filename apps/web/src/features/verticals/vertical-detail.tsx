'use client';
import { useRouter } from 'next/navigation';
import { messageRequest } from '../../lib/api/messaging';
export function VerticalDetail({
  item,
  vertical,
}: {
  item: Record<string, any>;
  vertical: string;
}) {
  const router = useRouter();
  const enquire = async () => {
    try {
      const x = await messageRequest<{ id: string }>('', 'POST', {
        contextType:
          vertical === 'tourism' ? 'TOURISM_PACKAGE' : 'VISA_SERVICE',
        contextId: item.id,
        message: `Enquiry about ${item.name}`,
      });
      router.push('/messages?conversation=' + x.id);
    } catch (e) {
      if ((e as Error).message === 'SIGN_IN_REQUIRED') router.push('/login');
    }
  };
  return (
    <main>
      <a href={`/marketplace?mode=${vertical}`}>← Back to results</a>
      <article className="vertical-detail">
        <div
          className={`vertical-placeholder ${vertical}`}
          aria-label={`${vertical} listing placeholder`}
        >
          <span>
            {vertical === 'tourism'
              ? 'Destination journey'
              : 'Document assistance'}
          </span>
        </div>
        <span className="eyebrow">
          {vertical === 'tourism' ? 'Tourism package' : 'Visa service'}
        </span>
        <h1>{item.name}</h1>
        <p>{item.description}</p>
        <dl className="request-context">
          {Object.entries(item)
            .filter(
              ([k, v]) =>
                ![
                  'id',
                  'profileId',
                  'profile',
                  'availability',
                  'createdAt',
                  'updatedAt',
                  'publishedAt',
                  'status',
                  'description',
                ].includes(k) && typeof v !== 'object',
            )
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k.replaceAll(/([A-Z])/g, ' $1')}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
        </dl>
        <p>
          Supplier:{' '}
          <a href={'/businesses/' + item.profile.publicSlug}>
            {item.profile.name}
          </a>
        </p>
        {vertical === 'visa' && (
          <p className="visa-disclaimer">{item.disclaimer}</p>
        )}
        <button onClick={enquire}>Message Supplier</button>
      </article>
    </main>
  );
}
