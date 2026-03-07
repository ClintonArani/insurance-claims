import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle body-parser JSON errors
  if (err instanceof SyntaxError && 'body' in err && 'statusCode' in err && err.statusCode === 400) {
    // Don't log during tests
    if (process.env.NODE_ENV !== 'test') {
      console.error('JSON Parse Error:', err.message);
    }
    
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format',
      error: 'Malformed JSON in request body'
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message
    });
  }

  // MongoDB duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `Duplicate value for ${field}. Please use another value.`,
      error: err.message
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values((err as any).errors).map((e: any) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: messages
    });
  }

  // Only log errors in development, not during tests
  if (process.env.NODE_ENV !== 'test') {
    console.error('Error:', err);
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};