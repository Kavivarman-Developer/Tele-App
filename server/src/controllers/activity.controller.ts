import { Request, Response, NextFunction } from 'express';
import { ActivityService } from '../services/activity.service';
import { AppError } from '../utils/AppError';

export class ActivityController {
  public static async disposeLead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const result = await ActivityService.disposeLead(req.user, req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async getLeadHistory(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const activities = await ActivityService.getLeadHistory(req.user, req.params.id);
      res.status(200).json({ activities });
    } catch (error) {
      next(error);
    }
  }

  public static async getUserActivities(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const activities = await ActivityService.getUserActivities(
        req.user,
        req.query as unknown as Parameters<typeof ActivityService.getUserActivities>[1],
      );
      res.status(200).json({ activities });
    } catch (error) {
      next(error);
    }
  }
}
