import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';
import { sendError } from '../utils/apiResponse';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg as string);
    sendError(res, 'Validation failed', StatusCodes.UNPROCESSABLE_ENTITY, messages);
    return;
  }
  next();
};
