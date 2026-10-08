import { Request, Response, NextFunction } from 'express';
import { SettingService } from '../services/setting.service';

export class SettingController {
  public static async getSettings(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const settings = await SettingService.getSettings();
      res.status(200).json({ settings });
    } catch (error) {
      next(error);
    }
  }

  public static async getPublicSettings(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const settings = await SettingService.getSettings();
      res.status(200).json({
        settings: {
          allowDisposeWithoutFollowUp: settings.allowDisposeWithoutFollowUp,
          followUpMandatoryForNotConnected: settings.followUpMandatoryForNotConnected,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const settings = await SettingService.updateSettings(req.body);
      res.status(200).json({ settings });
    } catch (error) {
      next(error);
    }
  }
}
