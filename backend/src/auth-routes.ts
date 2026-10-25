import { Router } from 'express';
import { authenticate, createAccessToken } from './auth.js';
import { login, register } from './auth-service.js';
import { AppError } from './errors.js';

const authRouter = Router();

authRouter.post('/register', async (request, response, next) => {
  try {
    const user = await register(request.body);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const user = await login(request.body);
    if (!user) throw new AppError(401, 'Invalid email or password');
    response.json({ token: createAccessToken(user.id), user });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, (request, response) => {
  response.json({ user: request.user });
});

export default authRouter;
