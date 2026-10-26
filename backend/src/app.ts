import express from 'express';
import { checkDatabaseConnection } from './db.js';
import authRouter from './auth-routes.js';
import { errorHandler } from './errors.js';
import vehicleRouter from './vehicle-routes.js';
import cartRouter from './cart-routes.js';
import favouriteRouter from './favourite-routes.js';
import notificationRouter from './notification-routes.js';
import { adminRouter, categoryRouter, purchaseRouter } from './read-model-routes.js';

import path from 'node:path';
import fs from 'node:fs';

const app = express();

app.use((req, res, next) => {
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  const origin = req.headers.origin;

  if (allowedOrigin === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin) {
    const origins = allowedOrigin.split(',').map((o) => o.trim());
    const isAllowed = origins.some((pattern) => {
      if (pattern === origin) return true;
      if (pattern.includes('*')) {
        const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
        return new RegExp(regexStr).test(origin);
      }
      return false;
    });

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

export function resolvePublicImagesPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'backend/public/images'),
    path.resolve(process.cwd(), 'public/images'),
    path.resolve(__dirname, '../public/images'),
    path.resolve(__dirname, '../../public/images'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd(), 'public/images');
}

const publicImagesPath = resolvePublicImagesPath();
app.use('/images', express.static(publicImagesPath));


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
app.use('/api/cart', cartRouter);
app.use('/api/favourites', favouriteRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/vehicle-categories', categoryRouter);
app.use('/api/purchases', purchaseRouter);
app.use('/api/admin', adminRouter);
app.use(errorHandler);

export default app;
