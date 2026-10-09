import mongoose, { Types } from 'mongoose';
import { Campaign, ICampaignDoc } from '../models/campaign.model';
import { Pipeline } from '../models/pipeline.model';
import { User, IUserDoc } from '../models/user.model';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CopyCampaignInput,
} from '../validations/campaign.validation';
import { AppError } from '../utils/AppError';

export interface UpdateCampaignResult {
  campaign: ICampaignDoc;
  warning?: string;
}

export class CampaignService {
  private static async validateAgents(agentIdStrings: string[]): Promise<void> {
    if (agentIdStrings.length === 0) return;

    const uniqueIdStrings = Array.from(new Set(agentIdStrings));
    const objectIds = uniqueIdStrings.map((id) => new Types.ObjectId(id));

    const users = await User.find({ _id: { $in: objectIds } });

    if (users.length !== uniqueIdStrings.length) {
      throw new AppError('One or more assigned agents do not exist', 400);
    }

    for (const u of users) {
      if (u.role !== 'AGENT') {
        throw new AppError(`User '${u.name}' (${u.email}) is not an AGENT`, 400);
      }
      if (!u.isActive) {
        throw new AppError(`Agent '${u.name}' (${u.email}) is deactivated`, 400);
      }
    }
  }

  private static async validatePipeline(pipelineId: string): Promise<void> {
    const pipeline = await Pipeline.findById(pipelineId);
    if (!pipeline) {
      throw new AppError('Specified pipeline does not exist', 400);
    }
  }

  public static async createCampaign(
    requester: IUserDoc,
    input: CreateCampaignInput,
  ): Promise<ICampaignDoc> {
    await this.validatePipeline(input.pipelineId);

    // Collect all agent IDs that need validation
    const agentsToValidate: string[] = [...input.agentIds];
    if (input.conditionalRules) {
      for (const rule of input.conditionalRules) {
        agentsToValidate.push(...rule.agentIds);
      }
    }
    if (input.fallbackAgentId) {
      agentsToValidate.push(input.fallbackAgentId);
    }

    await this.validateAgents(agentsToValidate);

    // Determine manager ID
    let managerId: Types.ObjectId;
    if (requester.role === 'MANAGER') {
      managerId = requester._id;
    } else {
      if (input.managerId) {
        const mgr = await User.findById(input.managerId);
        if (!mgr || (mgr.role !== 'MANAGER' && mgr.role !== 'ADMIN') || !mgr.isActive) {
          throw new AppError('Assigned manager must be an active MANAGER or ADMIN user', 400);
        }
        managerId = mgr._id;
      } else {
        managerId = requester._id;
      }
    }

    const campaign = await Campaign.create({
      name: input.name.trim(),
      pipelineId: new Types.ObjectId(input.pipelineId),
      managerId,
      agentIds: input.agentIds.map((id) => new Types.ObjectId(id)),
      distributionMode: input.distributionMode,
      conditionalRules: input.conditionalRules.map((rule) => ({
        field: rule.field.trim(),
        value: rule.value.trim(),
        agentIds: rule.agentIds.map((id) => new Types.ObjectId(id)),
      })),
      fallbackAgentId: input.fallbackAgentId ? new Types.ObjectId(input.fallbackAgentId) : null,
      priority: input.priority,
      duplicateMode: input.duplicateMode,
      engagementForm: input.engagementForm,
      isActive: input.isActive ?? true,
    });

    return campaign;
  }

  public static async listCampaigns(requester: IUserDoc): Promise<ICampaignDoc[]> {
    let query: Record<string, unknown> = {};

    if (requester.role === 'ADMIN') {
      query = {};
    } else if (requester.role === 'MANAGER') {
      query = { managerId: requester._id };
    } else if (requester.role === 'AGENT') {
      const specificCount = await Campaign.countDocuments({ agentIds: requester._id, isActive: true });
      if (specificCount > 0) {
        query = { agentIds: requester._id, isActive: true };
      } else {
        query = { isActive: true };
      }
    }

    return Campaign.find(query)
      .populate('pipelineId', 'name')
      .populate('managerId', 'name email')
      .populate('agentIds', 'name email phone')
      .sort({ createdAt: -1 });
  }

  public static async getCampaignById(
    requester: IUserDoc,
    id: string,
  ): Promise<ICampaignDoc> {
    const campaign = await Campaign.findById(id)
      .populate('pipelineId')
      .populate('managerId', 'name email role')
      .populate('agentIds', 'name email phone isActive')
      .populate('fallbackAgentId', 'name email');

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Access authorization check
    if (requester.role === 'MANAGER') {
      if (campaign.managerId._id.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only view your own campaigns', 403);
      }
    } else if (requester.role === 'AGENT') {
      const isAssigned = campaign.agentIds.some(
        (agent: unknown) => (agent as { _id: Types.ObjectId })._id.toString() === requester._id.toString(),
      );
      if (!isAssigned) {
        throw new AppError('Forbidden: You are not assigned to this campaign', 403);
      }
    }

    return campaign;
  }

  public static async updateCampaign(
    requester: IUserDoc,
    id: string,
    updates: UpdateCampaignInput,
  ): Promise<UpdateCampaignResult> {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (requester.role === 'MANAGER' && campaign.managerId.toString() !== requester._id.toString()) {
      throw new AppError('Forbidden: You can only edit your own campaigns', 403);
    }

    if (updates.pipelineId) {
      await this.validatePipeline(updates.pipelineId);
      campaign.pipelineId = new Types.ObjectId(updates.pipelineId);
    }

    // Validate agents if agentIds, conditionalRules, or fallbackAgentId changed
    const agentsToValidate: string[] = [];
    if (updates.agentIds) agentsToValidate.push(...updates.agentIds);
    if (updates.conditionalRules) {
      for (const rule of updates.conditionalRules) {
        agentsToValidate.push(...rule.agentIds);
      }
    }
    if (updates.fallbackAgentId) {
      agentsToValidate.push(updates.fallbackAgentId);
    }

    if (agentsToValidate.length > 0) {
      await this.validateAgents(agentsToValidate);
    }

    let warning: string | undefined;

    // Check if distribution mode is modified on a campaign that already has leads
    if (updates.distributionMode && updates.distributionMode !== campaign.distributionMode) {
      if (mongoose.modelNames().includes('Lead')) {
        const Lead = mongoose.model('Lead');
        const leadCount = await Lead.countDocuments({ campaignId: id });
        if (leadCount > 0) {
          warning =
            'Warning: Leads already exist for this campaign. The distribution mode was changed, but existing leads will not be automatically redistributed.';
        }
      }
      campaign.distributionMode = updates.distributionMode;
    }

    if (updates.name !== undefined) campaign.name = updates.name.trim();
    if (updates.agentIds !== undefined) {
      campaign.agentIds = updates.agentIds.map((aid) => new Types.ObjectId(aid));
    }
    if (updates.conditionalRules !== undefined) {
      campaign.conditionalRules = updates.conditionalRules.map((r) => ({
        field: r.field.trim(),
        value: r.value.trim(),
        agentIds: r.agentIds.map((aid) => new Types.ObjectId(aid)),
      }));
    }
    if (updates.fallbackAgentId !== undefined) {
      campaign.fallbackAgentId = updates.fallbackAgentId
        ? new Types.ObjectId(updates.fallbackAgentId)
        : null;
    }
    if (updates.priority !== undefined) campaign.priority = updates.priority;
    if (updates.duplicateMode !== undefined) campaign.duplicateMode = updates.duplicateMode;
    if (updates.engagementForm !== undefined) campaign.engagementForm = updates.engagementForm;
    if (updates.isActive !== undefined) campaign.isActive = updates.isActive;

    if (updates.managerId !== undefined && requester.role === 'ADMIN') {
      campaign.managerId = new Types.ObjectId(updates.managerId);
    }

    // Check conditional mode completeness
    if (campaign.distributionMode === 'CONDITIONAL') {
      if (!campaign.conditionalRules || campaign.conditionalRules.length === 0) {
        throw new AppError('conditionalRules are required when distributionMode is CONDITIONAL', 400);
      }
      if (!campaign.fallbackAgentId) {
        throw new AppError('fallbackAgentId is required when distributionMode is CONDITIONAL', 400);
      }
    }

    await campaign.save();
    return { campaign, warning };
  }

  public static async copyCampaign(
    requester: IUserDoc,
    id: string,
    input?: CopyCampaignInput,
  ): Promise<ICampaignDoc> {
    const original = await Campaign.findById(id);
    if (!original) {
      throw new AppError('Original campaign not found', 404);
    }

    if (requester.role === 'MANAGER' && original.managerId.toString() !== requester._id.toString()) {
      throw new AppError('Forbidden: You can only copy your own campaigns', 403);
    }

    const newName = input?.name ? input.name.trim() : `${original.name} (Copy)`;

    const duplicated = await Campaign.create({
      name: newName,
      pipelineId: original.pipelineId,
      managerId: requester.role === 'MANAGER' ? requester._id : original.managerId,
      agentIds: [...original.agentIds],
      distributionMode: original.distributionMode,
      conditionalRules: original.conditionalRules.map((r) => ({
        field: r.field,
        value: r.value,
        agentIds: [...r.agentIds],
      })),
      fallbackAgentId: original.fallbackAgentId,
      priority: original.priority,
      duplicateMode: original.duplicateMode,
      engagementForm: [...original.engagementForm],
      isActive: true,
    });

    return duplicated;
  }

  public static async deleteCampaign(requester: IUserDoc, id: string): Promise<void> {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (requester.role === 'MANAGER' && campaign.managerId.toString() !== requester._id.toString()) {
      throw new AppError('Forbidden: You can only delete your own campaigns', 403);
    }

    // Block deletion if any leads belong to this campaign
    if (mongoose.modelNames().includes('Lead')) {
      const Lead = mongoose.model('Lead');
      const leadCount = await Lead.countDocuments({ campaignId: id });
      if (leadCount > 0) {
        throw new AppError(
          `Cannot delete campaign because it contains ${leadCount} lead(s). Please deactivate the campaign instead.`,
          400,
        );
      }
    }

    await campaign.deleteOne();
  }
}
