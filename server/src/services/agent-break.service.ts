import { Types } from 'mongoose';
import { AgentBreak, IAgentBreakDoc, BreakReason } from '../models/agent-break.model';
import { User } from '../models/user.model';
import { AppError } from '../utils/AppError';

export class AgentBreakService {
  public static async startBreak(
    userId: string | Types.ObjectId,
    reason: BreakReason = 'TEA',
  ): Promise<IAgentBreakDoc> {
    const existing = await AgentBreak.findOne({ userId, isActive: true });
    if (existing) {
      return existing;
    }

    const currentBreak = await AgentBreak.create({
      userId,
      reason,
      startTime: new Date(),
      isActive: true,
    });

    // While on break, temporarily pause lead distribution to this agent
    await User.findByIdAndUpdate(userId, { canReceiveLeads: false });

    return currentBreak;
  }

  public static async endBreak(userId: string | Types.ObjectId): Promise<IAgentBreakDoc> {
    const currentBreak = await AgentBreak.findOne({ userId, isActive: true });
    if (!currentBreak) {
      throw new AppError('No active break found to end', 400);
    }

    const now = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(currentBreak.startTime).getTime()) / 60000),
    );

    currentBreak.endTime = now;
    currentBreak.durationMinutes = durationMinutes;
    currentBreak.isActive = false;
    await currentBreak.save();

    // Re-enable lead distribution
    await User.findByIdAndUpdate(userId, { canReceiveLeads: true });

    return currentBreak;
  }

  public static async getCurrentBreak(userId: string | Types.ObjectId): Promise<IAgentBreakDoc | null> {
    return AgentBreak.findOne({ userId, isActive: true });
  }

  public static async getTodayBreaks(userId: string | Types.ObjectId): Promise<{
    breaks: IAgentBreakDoc[];
    totalDurationMinutes: number;
    activeBreak: IAgentBreakDoc | null;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const breaks = await AgentBreak.find({
      userId,
      startTime: { $gte: startOfDay },
    }).sort({ startTime: -1 });

    const activeBreak = breaks.find((b) => b.isActive) || null;
    const totalDurationMinutes = breaks.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

    return {
      breaks,
      totalDurationMinutes,
      activeBreak,
    };
  }
}
