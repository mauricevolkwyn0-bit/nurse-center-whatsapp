import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';
import logger from '../utils/logger';

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 'Route not found', StatusCodes.NOT_FOUND);
};

export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error', { error: err });
    }
    sendError(res, err.message, err.statusCode);
    return;
  }

  logger.error('Unhandled error', { error: err });
  sendError(res, 'An unexpected error occurred', StatusCodes.INTERNAL_SERVER_ERROR);
};
