import express from 'express';
import { checkDatabaseConnection } from './db.js';

const app = express();

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

export default app;
