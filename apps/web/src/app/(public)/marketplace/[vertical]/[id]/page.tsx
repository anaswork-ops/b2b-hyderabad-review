import { notFound } from 'next/navigation';
import { VerticalDetail } from '../../../../../features/verticals/vertical-detail';
export default async function Page({
  params,
}: {
  params: Promise<{ vertical: string; id: string }>;
}) {
  const { vertical, id } = await params;
  if (!['tourism', 'visa'].includes(vertical)) notFound();
  const origin = process.env.API_ORIGIN ?? 'http://localhost:3001';
  const response = await fetch(`${origin}/verticals/${vertical}/${id}`, {
    cache: 'no-store',
  });
  if (!response.ok) notFound();
  return <VerticalDetail item={await response.json()} vertical={vertical} />;
}
