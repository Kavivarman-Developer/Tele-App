import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * General API Rate Limiter
 * 300 requests per 15 minutes per IP.
 * Skips health check requests so uptime monitors & keep-alive pings are never throttled.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // High throughput for active telecalling sessions & auto-refresh
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  skip: (req: Request) => {
    // Never throttle health checks or active polling
    return (
      req.path === '/health' ||
      req.path === '/api/health' ||
      req.originalUrl.includes('/health')
    );
  },
});

/**
 * Strict Auth Rate Limiter
 * 30 login attempts per 15 minutes per IP.
 * Prevents credential stuffing and brute-force attacks against agents and admins.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});
