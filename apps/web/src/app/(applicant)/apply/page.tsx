import { requireRoute } from '../../../lib/session/require-route';
import { ApplicationWizard } from '../../../features/applications/application-wizard';
export default async function Page() {
  const session = await requireRoute('/apply');
  return <ApplicationWizard email={session.user.email} />;
}
