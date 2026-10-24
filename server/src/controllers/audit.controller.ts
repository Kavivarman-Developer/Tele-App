import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';

export class AuditController {
  public static async getLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { action, resourceType, userId, page, limit } = req.query;
      const result = await AuditService.getLogs({
        action: action as string | undefined,
        resourceType: resourceType as string | undefined,
        userId: userId as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
