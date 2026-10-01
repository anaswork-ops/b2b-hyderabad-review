import { VerticalManager } from '../../../../features/verticals/vertical-manager';
import { requireRoute } from '../../../../lib/session/require-route';
export default async function Page() {
  await requireRoute('/business');
  return <VerticalManager />;
}
