import { Request, Response, NextFunction } from 'express';
import { PipelineService } from '../services/pipeline.service';

export class PipelineController {
  public static async listPipelines(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pipelines = await PipelineService.listPipelines();
      res.status(200).json({ pipelines });
    } catch (error) {
      next(error);
    }
  }

  public static async getPipeline(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pipeline = await PipelineService.getPipelineById(req.params.id);
      res.status(200).json({ pipeline });
    } catch (error) {
      next(error);
    }
  }

  public static async createPipeline(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pipeline = await PipelineService.createPipeline(req.body);
      res.status(201).json({ pipeline });
    } catch (error) {
      next(error);
    }
  }

  public static async updatePipeline(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const pipeline = await PipelineService.updatePipeline(req.params.id, req.body);
      res.status(200).json({ pipeline });
    } catch (error) {
      next(error);
    }
  }

  public static async deletePipeline(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await PipelineService.deletePipeline(req.params.id);
      res.status(200).json({ message: 'Pipeline deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
