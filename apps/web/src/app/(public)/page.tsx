import { apiHealth } from '../../lib/api/health';
import { LandingExperience } from '../../features/landing/landing-experience';
export default async function Home() {
  const status = await apiHealth();
  return <LandingExperience apiStatus={status} />;
}
