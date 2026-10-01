'use client';
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main>
      <h1>We could not load this page</h1>
      <p>
        Please try again. If the problem continues, return to the marketplace.
      </p>
      <button onClick={retry}>Try again</button>{' '}
      <a href="/marketplace">Explore businesses</a>
    </main>
  );
}
