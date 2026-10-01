import { requireRoute } from '../../../lib/session/require-route';
import { AdminConsole } from '../../../features/admin/admin-console';
export default async function Page() {
  const session = await requireRoute('/admin');
  return <AdminConsole email={session.user.email} />;
}
