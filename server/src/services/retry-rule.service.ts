import { RetryRule, IRetryRuleDoc, IRetryRule } from '../models/retry-rule.model';
import { NotConnectedReason } from '../models/activity.model';
import {
  UpdateSingleRetryRuleInput,
  UpdateRetryRulesBulkInput,
} from '../validations/retry-rule.validation';
import { AppError } from '../utils/AppError';

export const DEFAULT_RETRY_RULES_CONFIG: Array<{
  reason: NotConnectedReason;
  enabled: boolean;
  steps: Array<{ delayMinutes: number }>;
}> = [
  { reason: 'DID_NOT_PICK', enabled: true, steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }] },
  { reason: 'BUSY', enabled: true, steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }] },
  {
    reason: 'USER_DISCONNECTED',
    enabled: true,
    steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }],
  },
  { reason: 'SWITCHED_OFF', enabled: true, steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }] },
  {
    reason: 'OUT_OF_COVERAGE',
    enabled: true,
    steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }],
  },
  {
    reason: 'CALL_NOT_COMPLETED',
    enabled: true,
    steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }],
  },
  { reason: 'OTHER', enabled: true, steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }] },
  { reason: 'INVALID_NUMBER', enabled: false, steps: [] },
  { reason: 'INCOMING_NOT_AVAILABLE', enabled: false, steps: [] },
  { reason: 'NUMBER_NOT_IN_USE', enabled: false, steps: [] },
];

export class RetryRuleService {
  /**
   * Retrieves all retry rules, populating the defaults if none exist.
   */
  public static async getOrCreateDefaultRules(): Promise<IRetryRuleDoc[]> {
    const existingRules = await RetryRule.find().sort({ reason: 1 });
    if (existingRules.length > 0) {
      return existingRules;
    }

    // Seed defaults
    await RetryRule.insertMany(DEFAULT_RETRY_RULES_CONFIG);
    return RetryRule.find().sort({ reason: 1 });
  }

  public static async getRuleByReason(reason: NotConnectedReason): Promise<IRetryRuleDoc | null> {
    let rule = await RetryRule.findOne({ reason });
    if (!rule) {
      await this.getOrCreateDefaultRules();
      rule = await RetryRule.findOne({ reason });
    }
    return rule;
  }

  public static async updateRule(
    id: string,
    updates: UpdateSingleRetryRuleInput,
  ): Promise<IRetryRuleDoc> {
    const rule = await RetryRule.findById(id);
    if (!rule) {
      throw new AppError('Retry rule not found', 404);
    }

    if (updates.enabled !== undefined) rule.enabled = updates.enabled;
    if (updates.steps !== undefined) rule.steps = updates.steps;

    await rule.save();
    return rule;
  }

  public static async updateRulesBulk(
    rulesInput: UpdateRetryRulesBulkInput,
  ): Promise<IRetryRuleDoc[]> {
    for (const item of rulesInput) {
      await RetryRule.findOneAndUpdate(
        { reason: item.reason },
        { enabled: item.enabled, steps: item.steps },
        { upsert: true },
      );
    }

    return RetryRule.find().sort({ reason: 1 });
  }

  /**
   * Adjusts a scheduled follow-up or retry Date to fall strictly within legal calling hours
   * (09:00 AM to 20:00 PM). If scheduled outside this window, rolls over to 09:30 AM next morning.
   *
   * @param date The initial scheduled date
   * @param timeZoneOffsetMinutes Offset in minutes (defaults to +330 for Indian Standard Time UTC+5:30)
   * @param startHour Morning window open (09:00 AM)
   * @param startMinute Morning window target minute (09:30 AM)
   * @param endHour Evening window close (20:00 / 8:00 PM)
   */
  public static adjustForCallingHours(
    date: Date,
    timeZoneOffsetMinutes = 330,
    startHour = 9,
    startMinute = 30,
    endHour = 20,
  ): Date {
    const utcMs = date.getTime();
    const localMs = utcMs + timeZoneOffsetMinutes * 60 * 1000;
    const localDate = new Date(localMs);

    const hours = localDate.getUTCHours();
    const minutes = localDate.getUTCMinutes();
    const currentDecimalHour = hours + minutes / 60;

    // If outside 09:00 - 20:00
    if (currentDecimalHour >= endHour || currentDecimalHour < startHour) {
      const rolledLocalDate = new Date(localDate);
      if (currentDecimalHour >= endHour) {
        // Next day
        rolledLocalDate.setUTCDate(rolledLocalDate.getUTCDate() + 1);
      }
      rolledLocalDate.setUTCHours(startHour, startMinute, 0, 0);

      const adjustedUtcMs = rolledLocalDate.getTime() - timeZoneOffsetMinutes * 60 * 1000;
      return new Date(adjustedUtcMs);
    }

    return date;
  }

  /**
   * Pure calculation function: calculates the next follow-up Date based on the retry rule and
   * the consecutive count of not-connected attempts.
   *
   * @param rule The retry rule for the given reason.
   * @param consecutiveAttempts 1 for the 1st not-connected attempt, 2 for the 2nd, etc.
   * @param fallbackAgentFollowUp The date chosen manually by the agent.
   * @param baseTime Starting timestamp (defaults to now).
   */
  public static calculateRetryFollowUp(
    rule: IRetryRule | null | undefined,
    consecutiveAttempts: number,
    fallbackAgentFollowUp?: Date | null,
    baseTime: Date = new Date(),
  ): Date | null {
    if (!rule || !rule.enabled || !rule.steps || rule.steps.length === 0) {
      return fallbackAgentFollowUp || null;
    }

    const stepIndex = consecutiveAttempts - 1;

    // If within defined steps, calculate future date and adjust for legal calling hours
    if (stepIndex >= 0 && stepIndex < rule.steps.length) {
      const delayMs = rule.steps[stepIndex].delayMinutes * 60 * 1000;
      const scheduled = new Date(baseTime.getTime() + delayMs);
      return this.adjustForCallingHours(scheduled);
    }

    // Steps exhausted -> leave follow-up as the agent chose
    return fallbackAgentFollowUp || null;
  }
}
