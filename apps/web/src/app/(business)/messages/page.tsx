import { MessagesWorkspace } from '../../../features/messaging/messages-workspace';
import { requireRoute } from '../../../lib/session/require-route';

export default async function MessagesPage() {
  await requireRoute('/business');
  return <MessagesWorkspace />;
}
