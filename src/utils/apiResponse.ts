import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = StatusCodes.OK,
): Response => {
  const body: ApiResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created'): Response =>
  sendSuccess(res, data, message, StatusCodes.CREATED);

export const sendNoContent = (res: Response): Response =>
  res.status(StatusCodes.NO_CONTENT).send();

export const sendError = (
  res: Response,
  message: string,
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
  errors?: string[],
): Response => {
  const body: ApiResponse = { success: false, message, errors };
  return res.status(statusCode).json(body);
};
