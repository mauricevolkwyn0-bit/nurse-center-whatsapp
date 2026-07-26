import { Request, Response } from 'express';
import { healthService } from '../services/health.service';
import { sendSuccess } from '../utils/apiResponse';

export class HealthController {
  getHealth(_req: Request, res: Response): void {
    const status = healthService.getStatus();
    sendSuccess(res, status, 'Service is healthy');
  }
}

export const healthController = new HealthController();
