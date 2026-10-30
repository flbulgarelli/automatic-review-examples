import express, { type Express, type Router } from 'express';
import { errorMiddleware } from './middleware/error.js';

export function createApp(router: Router): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(router);
  app.use(errorMiddleware);
  return app;
}
