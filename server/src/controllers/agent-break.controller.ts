import { Request, Response, NextFunction } from 'express';
import { AgentBreakService } from '../services/agent-break.service';
import { AppError } from '../utils/AppError';

export class AgentBreakController {
  public static async startBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const { reason } = req.body;
      const currentBreak = await AgentBreakService.startBreak(req.user._id, reason);
      res.status(200).json({ status: 'ok', data: currentBreak });
    } catch (err) {
      next(err);
    }
  }

  public static async endBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const finishedBreak = await AgentBreakService.endBreak(req.user._id);
      res.status(200).json({ status: 'ok', data: finishedBreak });
    } catch (err) {
      next(err);
    }
  }

  public static async getCurrentBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const activeBreak = await AgentBreakService.getCurrentBreak(req.user._id);
      res.status(200).json({ status: 'ok', data: activeBreak });
    } catch (err) {
      next(err);
    }
  }

  public static async getTodayBreaks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const summary = await AgentBreakService.getTodayBreaks(req.user._id);
      res.status(200).json({ status: 'ok', data: summary });
    } catch (err) {
      next(err);
    }
  }
}
