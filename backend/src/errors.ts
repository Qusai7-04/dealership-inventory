import type { ErrorRequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
};
