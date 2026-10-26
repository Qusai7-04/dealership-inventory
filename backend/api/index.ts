import app from '../src/app.js';
import { assertAuthConfig } from '../src/auth.js';

try {
  assertAuthConfig();
} catch (err: any) {
  // If configuration is incomplete, requests will surface diagnostic configuration guidance
  console.warn('Vercel serverless startup notice:', err.message);
}

export default app;
