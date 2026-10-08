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
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    const campaign = await Campaign.findById(lead.campaignId);
    if (!campaign) {
      throw new AppError('Associated campaign not found', 404);
    }

    // Permission check: only assigned agent or ADMIN/MANAGER managing this campaign
    if (requester.role === 'AGENT') {
      if (!lead.assignedTo || lead.assignedTo.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: Only the assigned agent can dispose this lead', 403);
      }
    } else if (requester.role === 'MANAGER') {
      if (campaign.managerId.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only dispose leads for your own campaigns', 403);
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

      // If tag is provided, verify it belongs to this stage
      if (input.tag) {
        if (!stageDoc.tags || !stageDoc.tags.includes(input.tag)) {
          throw new AppError(
            `Tag '${input.tag}' does not belong to stage '${stageDoc.name}'`,
            400,
          );
        }
      }

      // Check if the stage closes the lead
      if (stageDoc.isClosed) {
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

    // Create Activity log
    const activity = await Activity.create({
      leadId: lead._id,
      campaignId: lead.campaignId,
      userId: requester._id,
      type: 'CALL',
      connected: input.connected,
      notConnectedReason: input.connected ? null : input.notConnectedReason,
      stage: lead.stage,
      tag: lead.tag,
      remark: input.remark || null,
      followUpAt: lead.nextFollowUpAt,
      durationSeconds: input.durationSeconds || 0,
      answers: input.answers || [],
    });

    return { activity, lead };
  }

  public static async getLeadHistory(
    requester: IUserDoc,
    leadId: string,
  ): Promise<IActivityDoc[]> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    const campaign = await Campaign.findById(lead.campaignId);
    if (!campaign) {
      throw new AppError('Associated campaign not found', 404);
    }

    // Access check
    if (requester.role === 'AGENT') {
      const isAssignedLead = lead.assignedTo?.toString() === requester._id.toString();
      const isAssignedCampaign = campaign.agentIds.some(
        (aid) => aid.toString() === requester._id.toString(),
      );
      if (!isAssignedLead && !isAssignedCampaign) {
        throw new AppError('Forbidden: You do not have access to this lead', 403);
      }
    } else if (requester.role === 'MANAGER') {
      if (campaign.managerId.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only view history for your own campaigns', 403);
      }
    }

    return Activity.find({ leadId: lead._id })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });
  }
}
