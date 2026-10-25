import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findActiveUser, type User } from './auth-service.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const issuer = 'dealership-inventory';
const audience = 'dealership-api';

function getAuthConfig(): { secret: string; expiresIn: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }

  const expiresIn = Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 3600);
  if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
    throw new Error('JWT_EXPIRES_IN_SECONDS must be a positive integer');
  }
  return { secret, expiresIn };
}

export function assertAuthConfig(): void {
  getAuthConfig();
}

export function createAccessToken(userId: string): string {
  const { secret, expiresIn } = getAuthConfig();
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: userId,
    issuer,
    audience,
    expiresIn,
  });
}

export async function authenticate(request: Request, response: Response, next: NextFunction): Promise<void> {
  const match = request.header('authorization')?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    response.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { secret } = getAuthConfig();
    const payload = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
      issuer,
      audience,
    });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Invalid token subject');

    const user = await findActiveUser(payload.sub);
    if (!user) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    request.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError || error instanceof Error && error.message === 'Invalid token subject') {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    next(error);
  }
}

export function requireRole(role: User['role']): RequestHandler {
  return (request, response, next) => {
    if (!request.user) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (request.user.role !== role) {
      response.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
