export interface HealthResponse {
  status: 'ok' | 'degraded';
  services: Record<string, 'up' | 'down'>;
}
