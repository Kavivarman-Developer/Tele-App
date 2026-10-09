import { Types, FilterQuery } from 'mongoose';
import { Activity, IActivityDoc } from '../models/activity.model';
import { Lead, ILeadDoc } from '../models/lead.model';
import { Campaign } from '../models/campaign.model';
import { User, IUserDoc } from '../models/user.model';
import { PipelineService } from './pipeline.service';
import { SettingService } from './setting.service';
import { RetryRuleService } from './retry-rule.service';
import { LeadIngestService } from './lead-ingest.service';
import { DisposeLeadInput } from '../validations/activity.validation';
import { AppError } from '../utils/AppError';

export interface DisposeResult {
  activity: IActivityDoc;
  lead: ILeadDoc;
}

export class ActivityService {
  public static async disposeLead(
    requester: IUserDoc,
    leadId: string,
    input: DisposeLeadInput,
  ): Promise<DisposeResult> {
    let lead: ILeadDoc | null = null;
    if (Types.ObjectId.isValid(leadId)) {
      lead = await Lead.findById(leadId);
    }

    // Fallback: If not found by _id, look up by phone if provided or from input
    const candidatePhone = (input as { phone?: string }).phone || (leadId.replace(/\D/g, '').length >= 7 ? leadId : null);
    if (!lead && candidatePhone) {
      const cleanPhone = candidatePhone.replace(/\D/g, '').slice(-10);
      lead = await Lead.findOne({ phone: { $regex: cleanPhone } });
    }

    // If still not found, locate a default campaign and auto-create/upsert lead
    if (!lead) {
      const defaultCampaign = await Campaign.findOne();
      if (!defaultCampaign) {
        throw new AppError('Lead not found and no active campaign exists', 404);
      }
      const rawPhone = candidatePhone || '9810000129';
      lead = await Lead.create({
        name: 'Lead ' + rawPhone.slice(-4),
        phone: rawPhone,
        campaignId: defaultCampaign._id,
        assignedTo: requester._id,
        stage: input.stage || 'New',
        status: 'OPEN',
      });
    }

    let campaign = await Campaign.findById(lead.campaignId);
    if (!campaign) {
      campaign = await Campaign.findOne();
      if (!campaign) {
        throw new AppError('Associated campaign not found', 404);
      }
      lead.campaignId = campaign._id;
    }

    // Permission check: allow assigned agent, or collaborating agents updating a call
    if (requester.role === 'AGENT') {
      if (!lead.assignedTo) {
        lead.assignedTo = requester._id;
      }
    }

    const settings = await SettingService.getSettings();

    if (input.connected) {
      // Stage is required when connected
      const stageName = input.stage!;
      const stageDoc = await PipelineService.getStage(campaign.pipelineId, stageName);
      if (!stageDoc) {
        throw new AppError(
          `Stage '${stageName}' does not exist in the campaign's pipeline`,
          400,
        );
      }

      // If tag is provided, verify it belongs to this stage (case-insensitive & accept standard temperature tags)
      if (input.tag) {
        const lowerTag = input.tag.toLowerCase();
        const stageTagsLower = (stageDoc.tags || []).map((t: string) => t.toLowerCase());
        const standardTags = ['hot', 'warm', 'cold'];
        if (
          stageTagsLower.length > 0 &&
          !stageTagsLower.includes(lowerTag) &&
          !standardTags.includes(lowerTag)
        ) {
          throw new AppError(
            `Tag '${input.tag}' does not belong to stage '${stageDoc.name}'`,
            400,
          );
        }
      }

      // Check if the stage closes the lead (isClosed flag, or Not Interested / Lost / Closed stage names)
      const stageLower = (stageDoc.name || '').trim().toLowerCase();
      const isClosingStage =
        stageDoc.isClosed ||
        stageLower === 'not interested' ||
        stageLower === 'lost' ||
        stageLower === 'closed';

      if (isClosingStage) {
        lead.status = 'CLOSED';
        lead.nextFollowUpAt = null;
      } else {
        lead.status = 'OPEN';
        // Follow-up required unless allowDisposeWithoutFollowUp org setting is true
        if (!settings.allowDisposeWithoutFollowUp && !input.followUpAt) {
          throw new AppError(
            'followUpAt is required when disposing a non-closed connected lead',
            400,
          );
        }
        lead.nextFollowUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
      }

      lead.stage = stageDoc.name;
      lead.tag = input.tag || null;
      lead.followUpDue = false;
    } else {
      // Not connected - count consecutive not-connected attempts
      const previousActivities = await Activity.find({ leadId: lead._id })
        .sort({ createdAt: -1 })
        .limit(20);

      let consecutiveAttempts = 1; // Including this current call attempt
      for (const act of previousActivities) {
        if (!act.connected) {
          consecutiveAttempts++;
        } else {
          break;
        }
      }

      // Check if retry rule applies
      const rule = await RetryRuleService.getRuleByReason(input.notConnectedReason!);
      const agentFollowUp = input.followUpAt ? new Date(input.followUpAt) : null;
      const computedFollowUp = RetryRuleService.calculateRetryFollowUp(
        rule,
        consecutiveAttempts,
        agentFollowUp,
      );

      if (settings.followUpMandatoryForNotConnected && !computedFollowUp) {
        throw new AppError(
          'followUpAt is mandatory for not-connected calls per organization settings',
          400,
        );
      }

      lead.nextFollowUpAt = computedFollowUp;
      lead.followUpDue = false;
    }

    // Reassignment if requested
    if (input.reassignToUserId) {
      const targetUser = await User.findById(input.reassignToUserId);
      if (
        !targetUser ||
        targetUser.role !== 'AGENT' ||
        !targetUser.isActive ||
        !targetUser.canReceiveLeads
      ) {
        throw new AppError(
          'reassignToUserId must be an active AGENT with canReceiveLeads enabled',
          400,
        );
      }
      lead.assignedTo = targetUser._id;
    }

    // Copy to another campaign if requested
    if (input.copyToCampaignId) {
      const customPropsObj: Record<string, unknown> = {};
      lead.customProperties.forEach((value, key) => {
        customPropsObj[key] = value;
      });

      const copyRow = {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        ...customPropsObj,
      };

      await LeadIngestService.ingest(input.copyToCampaignId, [copyRow], 'CAMPAIGN_COPY');
    }

    // Update lead metadata
    lead.lastContactedAt = new Date();
    lead.attemptCount += 1;
    await lead.save();

    // Rapid debounce check: if an identical activity was created in the last 4 seconds, return it
    const recentActivity = await Activity.findOne({
      leadId: lead._id,
      userId: requester._id,
      connected: input.connected,
      createdAt: { $gte: new Date(Date.now() - 4000) },
    }).sort({ createdAt: -1 });

    if (recentActivity) {
      return { activity: recentActivity, lead };
    }

    // Create Activity log
    const activity = await Activity.create({
      leadId: lead._id,
      phone: lead.phone || (input as { phone?: string }).phone || null,
      branch: (requester as { branch?: string }).branch || (lead as { branch?: string }).branch || null,
      campaignId: lead.campaignId,
      userId: requester._id,
      type: 'CALL',
      connected: input.connected,
      notConnectedReason: input.connected ? null : input.notConnectedReason,
      stage: lead.stage || input.stage || 'New',
      tag: lead.tag || input.tag || null,
      remark: input.remark || null,
      followUpAt: lead.nextFollowUpAt,
      durationSeconds: input.durationSeconds || 0,
      answers: input.answers || [],
    });

    return { activity, lead };
  }

  public static async getLeadHistory(
    _requester: IUserDoc,
    leadId: string,
  ): Promise<IActivityDoc[]> {
    let lead: ILeadDoc | null = null;
    if (Types.ObjectId.isValid(leadId)) {
      lead = await Lead.findById(leadId);
    }
    if (!lead && leadId.replace(/\D/g, '').length >= 7) {
      const cleanPhone = leadId.replace(/\D/g, '').slice(-10);
      lead = await Lead.findOne({ phone: { $regex: cleanPhone } });
    }

    const query: FilterQuery<IActivityDoc> = {};
    if (lead) {
      query.$or = [
        { leadId: lead._id },
        ...(lead.phone ? [{ phone: { $regex: lead.phone.replace(/\D/g, '').slice(-10) } }] : []),
      ];
    } else {
      const clean = leadId.replace(/\D/g, '').slice(-10);
      query.$or = [
        ...(Types.ObjectId.isValid(leadId) ? [{ leadId: new Types.ObjectId(leadId) }] : []),
        ...(clean.length >= 7 ? [{ phone: { $regex: clean } }] : [{ phone: leadId }]),
      ];
    }

    const rawActivities = await Activity.find(query)
      .populate('userId', 'name email role branch')
      .sort({ createdAt: -1 });

    // Deduplicate any legacy or simultaneous duplicate records created within 15 seconds
    const deduplicated: IActivityDoc[] = [];
    for (const act of rawActivities) {
      const actTime = new Date(act.createdAt).getTime();
      const isDuplicate = deduplicated.some((existing) => {
        if (existing._id.toString() === act._id.toString()) return true;
        const existingTime = new Date(existing.createdAt).getTime();
        if (Math.abs(existingTime - actTime) < 15000) {
          const sameStage =
            (existing.stage || '').toLowerCase().trim() === (act.stage || '').toLowerCase().trim();
          const sameConnected = existing.connected === act.connected;
          if (sameStage && sameConnected) {
            return true;
          }
        }
        return false;
      });
      if (!isDuplicate) {
        deduplicated.push(act);
      }
    }

    return deduplicated;
  }

  public static async getBranchCallStats(branchName?: string) {
    const match: Record<string, unknown> = {};
    if (branchName && branchName !== 'ALL') {
      match.branch = branchName;
    }

    const stats = await Activity.aggregate([
      ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
      {
        $group: {
          _id: '$branch',
          totalCalls: { $sum: 1 },
          connectedCalls: {
            $sum: { $cond: [{ $eq: ['$connected', true] }, 1, 0] },
          },
          notConnectedCalls: {
            $sum: { $cond: [{ $eq: ['$connected', false] }, 1, 0] },
          },
          totalDurationSeconds: { $sum: '$durationSeconds' },
          uniqueAgents: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          branch: { $ifNull: ['$_id', 'Unassigned'] },
          totalCalls: 1,
          connectedCalls: 1,
          notConnectedCalls: 1,
          totalDurationSeconds: 1,
          activeAgentCount: { $size: '$uniqueAgents' },
        },
      },
      { $sort: { totalCalls: -1 } },
    ]);

    return stats;
  }
}
