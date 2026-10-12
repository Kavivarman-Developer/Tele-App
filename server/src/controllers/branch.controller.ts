import { Request, Response, NextFunction } from 'express';
import { BranchService } from '../services/branch.service';
import { AppError } from '../utils/AppError';

export class BranchController {
  public static async listBranches(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const branches = await BranchService.listBranches();
      res.status(200).json({ branches });
    } catch (error) {
      next(error);
    }
  }

  public static async createBranch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const branch = await BranchService.createBranch(req.user, req.body);
      res.status(201).json({ branch, message: 'Branch created successfully' });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteBranch(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      await BranchService.deleteBranch(req.user, req.params.id);
      res.status(200).json({ message: 'Branch deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
