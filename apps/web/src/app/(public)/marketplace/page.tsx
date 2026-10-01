import { Suspense } from 'react';
import { Marketplace } from '../../../features/marketplace/marketplace';
export default function Page() {
  return (
    <Suspense fallback={<main>Loading marketplace…</main>}>
      <Marketplace />
    </Suspense>
  );
}
