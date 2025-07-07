import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.config';
import { ApiError } from '../utils/api-error';
import { appConfig } from '../config/app.config';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Handle ApiError instances
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Handle database errors
  if (error.name === 'QueryFailedError') {
    statusCode = 400;
    message = 'Database query failed';
  }

  // Log error
  logger.error({
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode
  });

  // Send error response
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode
    },
    timestamp: new Date().toISOString(),
    path: req.path
  };

  // Include stack trace in development
  if (appConfig.node_env === 'development') {
    errorResponse.error.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};
