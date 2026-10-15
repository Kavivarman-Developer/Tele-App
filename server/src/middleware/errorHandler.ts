import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // If already an instance of AppError or contains operational error properties
  if (
    err instanceof AppError ||
    (typeof err === 'object' && err !== null && 'statusCode' in err && 'isOperational' in err)
  ) {
    const appErr = err as AppError;
    res.status(appErr.statusCode || 500).json({
      status: appErr.status || 'error',
      message: appErr.message,
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: formattedErrors,
    });
    return;
  }

  // Handle standard Error instances or other unknown errors
  if (err instanceof Error) {
    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
      res.status(400).json({
        status: 'fail',
        message: 'Resource not found or invalid identifier format',
      });
      return;
    }

    // Mongoose ValidationError
    if (err.name === 'ValidationError') {
      res.status(400).json({
        status: 'fail',
        message: err.message,
      });
      return;
    }

    // JWT verification errors
    if (err.name === 'JsonWebTokenError') {
      res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please authenticate again.',
      });
      return;
    }

    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication token has expired.',
      });
      return;
    }

    console.error('Unhandled Error:', err);
    res.status(500).json({
      status: 'error',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message || 'Something went wrong',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  console.error('Unknown Non-Error Exception:', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred.',
  });
};
