import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/user.model';
import { AppError } from '../utils/AppError';

interface TokenPayload {
  id: string;
  role: string;
  tokenVersion?: number;
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing Bearer token.', 401);
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new AppError('JWT_SECRET is not configured on the server', 500);
    }

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired authentication token', 401);
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new AppError('The user belonging to this token no longer exists', 401);
    }

    if (!user.isActive) {
      throw new AppError('User account has been deactivated. Access denied.', 401);
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        throw new AppError('Session has expired or was revoked. Please log in again.', 401);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: You do not have permission to perform this action', 403),
      );
    }

    next();
  };
