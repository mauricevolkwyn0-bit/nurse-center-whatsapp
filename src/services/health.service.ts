import config from '../config';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  environment: string;
  uptime: number;
  timestamp: string;
}

export class HealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      environment: config.env,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
