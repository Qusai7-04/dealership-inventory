import express from 'express';
import { checkDatabaseConnection } from './db.js';
import authRouter from './auth-routes.js';
import { errorHandler } from './errors.js';
import vehicleRouter from './vehicle-routes.js';

const app = express();

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/health/db', async (_request, response) => {
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.ok) {
    response.status(200).json({ status: 'ok', database: 'connected' });
  } else {
    response.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/vehicles', vehicleRouter);
app.use(errorHandler);

export default app;
