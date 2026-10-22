import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { compressionMiddleware } from './middleware/compression.middleware';
import { AppError } from './utils/AppError';

const app: Application = express();

// Trust reverse proxy (Render, Cloudflare, Heroku) to correctly identify client IP
app.set('trust proxy', 1);

// Security and utility middlewares
app.use(compressionMiddleware);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Apply API rate limiter to protect against abuse and DDOS
app.use('/api', apiLimiter);

// API Routes (supports both /api and /api/api to handle any duplicate prefixes gracefully)
app.use('/api/api', apiRoutes);
app.use('/api', apiRoutes);

// Catch-all for undefined routes
app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global error handling middleware
app.use(errorHandler);

export default app;
