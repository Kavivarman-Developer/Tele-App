import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { ReportQueryInput, ReportExportQueryInput } from '../validations/report.validation';
import { AppError } from '../utils/AppError';

export class ReportController {
  public static async getDashboard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getDashboard(req.user, query);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  public static async getUserCalls(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getUserCalls(req.user, query);
      res.status(200).json({ agents: data });
    } catch (error) {
      next(error);
    }
  }

  public static async getDispositions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getDispositions(req.user, query);
      res.status(200).json({ dispositions: data });
    } catch (error) {
      next(error);
    }
  }

  public static async getFollowUps(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getFollowUps(req.user, query);
      res.status(200).json({ followUps: data });
    } catch (error) {
      next(error);
    }
  }

  public static async getCampaignStages(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getCampaignStages(req.user, query);
      res.status(200).json({ campaigns: data });
    } catch (error) {
      next(error);
    }
  }

  public static async getCampaignLeads(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportQueryInput;
      const data = await ReportService.getCampaignLeads(req.user, query);
      res.status(200).json({ campaigns: data });
    } catch (error) {
      next(error);
    }
  }

  public static async exportReport(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as ReportExportQueryInput;
      const csv = await ReportService.exportReportToCsv(req.user, query);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${query.type}-${Date.now()}.csv"`,
      );
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}
