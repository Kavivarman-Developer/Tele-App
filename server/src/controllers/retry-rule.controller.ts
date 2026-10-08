import { Request, Response, NextFunction } from 'express';
import { RetryRuleService } from '../services/retry-rule.service';

export class RetryRuleController {
  public static async listRules(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rules = await RetryRuleService.getOrCreateDefaultRules();
      res.status(200).json({ rules });
    } catch (error) {
      next(error);
    }
  }

  public static async updateSingleRule(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rule = await RetryRuleService.updateRule(req.params.id, req.body);
      res.status(200).json({ rule });
    } catch (error) {
      next(error);
    }
  }

  public static async updateBulkRules(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rules = await RetryRuleService.updateRulesBulk(req.body);
      res.status(200).json({ rules });
    } catch (error) {
      next(error);
    }
  }
}
