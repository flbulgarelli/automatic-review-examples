import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation_error', issues: err.issues });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error' });
};
