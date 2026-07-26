import { HealthService } from './health.service';

describe('HealthService', () => {
  const service = new HealthService();

  it('returns ok status', () => {
    const result = service.getStatus();
    expect(result.status).toBe('ok');
  });

  it('includes a valid ISO timestamp', () => {
    const result = service.getStatus();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });

  it('returns a non-negative uptime', () => {
    const result = service.getStatus();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
