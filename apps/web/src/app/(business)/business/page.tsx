import { requireRoute } from '../../../lib/session/require-route';
import { BusinessConsole } from '../../../features/inventory/business-console';
export default async function Page() {
  const session = await requireRoute('/business');
  return <BusinessConsole email={session.user.email} />;
}
