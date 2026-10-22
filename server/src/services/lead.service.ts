import { Types, PipelineStage } from 'mongoose';
import { Lead, ILeadDoc } from '../models/lead.model';
import { Campaign } from '../models/campaign.model';
import { User, IUserDoc } from '../models/user.model';
import {
  ListCampaignLeadsQuery,
  MyLeadsQuery,
} from '../validations/lead.validation';
import { AppError } from '../utils/AppError';

export interface PaginatedLeads<T> {
  leads: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class LeadService {
  public static async listCampaignLeads(
    requester: IUserDoc,
    campaignId: string,
    query: ListCampaignLeadsQuery,
  ): Promise<PaginatedLeads<ILeadDoc>> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Role-based scoping check
    if (requester.role === 'MANAGER') {
      if (campaign.managerId.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only view leads for your own campaigns', 403);
      }
    } else if (requester.role === 'AGENT') {
      const isAssigned = campaign.agentIds.some(
        (aid) => aid.toString() === requester._id.toString(),
      );
      if (!isAssigned) {
        throw new AppError('Forbidden: You are not assigned to this campaign', 403);
      }
    }

    const filter: Record<string, unknown> = {
      campaignId: new Types.ObjectId(campaignId),
    };

    if (query.stage) filter.stage = query.stage;
    if (query.tag) filter.tag = query.tag;
    if (query.status) filter.status = query.status;

    // Assignment filter
    if (requester.role === 'AGENT') {
      // Agents may ONLY read leads assigned to them
      filter.assignedTo = requester._id;
    } else if (query.assignedTo) {
      if (query.assignedTo === 'unassigned') {
        filter.assignedTo = null;
      } else {
        filter.assignedTo = new Types.ObjectId(query.assignedTo);
      }
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (query.startDate) dateFilter.$gte = new Date(query.startDate);
      if (query.endDate) dateFilter.$lte = new Date(query.endDate);
      filter.createdAt = dateFilter;
    }

    // Text search on name, phone, or email
    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('assignedTo', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public static async getMyLeads(
    requester: IUserDoc,
    query: MyLeadsQuery,
  ): Promise<PaginatedLeads<unknown>> {
    const matchStage: Record<string, unknown> = {};

    // Closed leads belong in reporting/management views, never in an agent's calling queue.
    if (requester.role === 'AGENT') {
      matchStage.status = 'OPEN';
      matchStage.stage = { $not: /not interested|closed|lost|dnd|do not call|junk|dropped/i };
    }

    if (requester.role === 'ADMIN') {
      if (query.userId) {
        matchStage.assignedTo = new Types.ObjectId(query.userId);
      }
    } else if (requester.role === 'MANAGER') {
      if (query.userId) {
        matchStage.assignedTo = new Types.ObjectId(query.userId);
      } else {
        const managedCampaigns = await Campaign.find({ managerId: requester._id }, '_id');
        const managedIds = managedCampaigns.map((c) => c._id);
        matchStage.campaignId = { $in: managedIds };
      }
    } else {
      matchStage.assignedTo = requester._id;
    }

    if (query.campaignId) {
      matchStage.campaignId = new Types.ObjectId(query.campaignId);
    }

    if (query.type === 'NEW') {
      matchStage.status = 'OPEN';
      matchStage.attemptCount = 0;
    } else if (query.type === 'FOLLOW_UP') {
      matchStage.status = 'OPEN';
      matchStage.nextFollowUpAt = { $ne: null };
    } else if (query.type === 'NOT_CONNECTED') {
      matchStage.status = 'OPEN';
      matchStage.attemptCount = { $gt: 0 };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'campaigns',
          localField: 'campaignId',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: '$campaign' },
      {
        $addFields: {
          priorityRank: {
            $switch: {
              branches: [
                { case: { $eq: ['$campaign.priority', 'HIGH'] }, then: 1 },
                { case: { $eq: ['$campaign.priority', 'MEDIUM'] }, then: 2 },
                { case: { $eq: ['$campaign.priority', 'LOW'] }, then: 3 },
              ],
              default: 4,
            },
          },
          // Uncontacted leads (attemptCount 0 and no lastContactedAt) have contactedRank = 0 (top)
          // Contacted leads have contactedRank = 1 (bottom)
          contactedRank: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$attemptCount', 0] }, { $not: ['$attemptCount'] }] },
                  { $eq: [{ $ifNull: ['$lastContactedAt', null] }, null] },
                ],
              },
              0,
              1,
            ],
          },
          // For contacted leads: recently contacted goes to the very bottom
          lastContactedSort: {
            $ifNull: ['$lastContactedAt', new Date('1970-01-01T00:00:00.000Z')],
          },
          // For null nextFollowUpAt, sort them after defined follow-ups
          followUpSortKey: {
            $ifNull: ['$nextFollowUpAt', new Date('9999-12-31T23:59:59.999Z')],
          },
        },
      },
      // Priority ordering:
      // For FOLLOW_UP tab: sort by upcoming followUpSortKey
      // For general queue (ALL, NEW, etc.): fresh uncalled leads first (contactedRank: 0),
      // and contacted leads (contactedRank: 1) pushed to bottom with most recently contacted at the very bottom!
      {
        $sort:
          query.type === 'FOLLOW_UP'
            ? {
                priorityRank: 1,
                followUpSortKey: 1,
                createdAt: -1,
              }
            : {
                contactedRank: 1,
                priorityRank: 1,
                lastContactedSort: 1,
                createdAt: -1,
              },
      },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                phone: 1,
                email: 1,
                source: 1,
                branch: 1,
                stage: 1,
                tag: 1,
                status: 1,
                attemptCount: 1,
                lastContactedAt: 1,
                nextFollowUpAt: 1,
                followUpDue: 1,
                campaignId: 1,
                assignedTo: 1,
                createdAt: 1,
                updatedAt: 1,
                customProperties: 1,
                campaign: {
                  _id: '$campaign._id',
                  name: '$campaign.name',
                  priority: '$campaign.priority',
                },
              },
            },
          ],
        },
      },
    ];

    const [facetResult] = await Lead.aggregate<{
      metadata: Array<{ total: number }>;
      data: unknown[];
    }>(pipeline);

    const total = facetResult.metadata[0]?.total || 0;
    const leads = facetResult.data || [];

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public static async reassignLead(
    requester: IUserDoc,
    leadId: string,
    targetUserId: string,
  ): Promise<ILeadDoc> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    const campaign = await Campaign.findById(lead.campaignId);
    if (!campaign) {
      throw new AppError('Associated campaign not found', 404);
    }

    if (requester.role === 'MANAGER' && campaign.managerId.toString() !== requester._id.toString()) {
      throw new AppError('Forbidden: You can only reassign leads within your own campaigns', 403);
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.role !== 'AGENT' || !targetUser.isActive || !targetUser.canReceiveLeads) {
      throw new AppError('Target user must be an active AGENT with canReceiveLeads enabled', 400);
    }

    lead.assignedTo = targetUser._id;
    await lead.save();

    return lead;
  }

  public static async bulkReassign(
    requester: IUserDoc,
    fromUserId: string,
    toUserId: string,
    campaignId?: string,
  ): Promise<{ modifiedCount: number }> {
    const toUser = await User.findById(toUserId);
    if (!toUser || toUser.role !== 'AGENT' || !toUser.isActive || !toUser.canReceiveLeads) {
      throw new AppError('Target user must be an active AGENT with canReceiveLeads enabled', 400);
    }

    const filter: Record<string, unknown> = {
      assignedTo: new Types.ObjectId(fromUserId),
      status: 'OPEN',
    };

    if (campaignId) {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new AppError('Campaign not found', 404);
      }
      if (requester.role === 'MANAGER' && campaign.managerId.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You do not manage this campaign', 403);
      }
      filter.campaignId = new Types.ObjectId(campaignId);
    } else if (requester.role === 'MANAGER') {
      // Limit to campaigns managed by this manager
      const managedCampaigns = await Campaign.find({ managerId: requester._id }, '_id');
      const managedIds = managedCampaigns.map((c) => c._id);
      filter.campaignId = { $in: managedIds };
    }

    const result = await Lead.updateMany(filter, {
      $set: { assignedTo: toUser._id },
    });

    return {
      modifiedCount: result.modifiedCount,
    };
  }

  public static async exportCampaignLeadsToCsv(
    requester: IUserDoc,
    campaignId: string,
  ): Promise<string> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const filter: Record<string, unknown> = {
      campaignId: new Types.ObjectId(campaignId),
    };

    if (requester.role === 'AGENT') {
      filter.assignedTo = requester._id;
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    const lines: string[] = [
      'Name,Phone,Email,Stage,Tag,Status,Branch,Assigned Agent,Next Follow-up,Created At',
    ];

    for (const l of leads) {
      const assignedObj = l.assignedTo as unknown as { name?: string; email?: string } | null;
      const agent = assignedObj?.name || assignedObj?.email || 'Unassigned';
      const escape = (val: unknown) => `"${String(val || '').replace(/"/g, '""')}"`;
      lines.push(
        [
          escape(l.name),
          escape(l.phone),
          escape(l.email || ''),
          escape(l.stage),
          escape(l.tag || ''),
          escape(l.status),
          escape(l.branch || ''),
          escape(agent),
          escape(l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString() : ''),
          escape(new Date(l.createdAt).toISOString()),
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  public static async exportMyLeadsToCsv(
    requester: IUserDoc,
    query: MyLeadsQuery,
  ): Promise<string> {
    const filter: Record<string, unknown> = {};

    if (requester.role === 'ADMIN') {
      if (query.userId) {
        filter.assignedTo = new Types.ObjectId(query.userId);
      }
    } else if (requester.role === 'MANAGER') {
      if (query.userId) {
        filter.assignedTo = new Types.ObjectId(query.userId);
      } else {
        const managedCampaigns = await Campaign.find({ managerId: requester._id }, '_id');
        const managedIds = managedCampaigns.map((c) => c._id);
        filter.campaignId = { $in: managedIds };
      }
    } else {
      filter.assignedTo = requester._id;
    }

    if (query.campaignId) {
      filter.campaignId = new Types.ObjectId(query.campaignId);
    }

    const leads = await Lead.find(filter)
      .populate('campaignId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    const lines: string[] = [
      'Name,Phone,Email,Campaign,Stage,Tag,Status,Branch,Assigned Agent,Next Follow-up,Created At',
    ];

    for (const l of leads) {
      const campObj = l.campaignId as unknown as { name?: string } | null;
      const camp = campObj?.name || 'Outreach';
      const assignedObj = l.assignedTo as unknown as { name?: string; email?: string } | null;
      const agent = assignedObj?.name || assignedObj?.email || 'Unassigned';
      const escape = (val: unknown) => `"${String(val || '').replace(/"/g, '""')}"`;
      lines.push(
        [
          escape(l.name),
          escape(l.phone),
          escape(l.email || ''),
          escape(camp),
          escape(l.stage),
          escape(l.tag || ''),
          escape(l.status),
          escape(l.branch || ''),
          escape(agent),
          escape(l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString() : ''),
          escape(new Date(l.createdAt).toISOString()),
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  public static async updateLead(
    id: string,
    updates: { name?: string; phone?: string; email?: string },
  ): Promise<ILeadDoc> {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }
    if (updates.name && updates.name.trim()) {
      lead.name = updates.name.trim();
    }
    if (updates.phone && updates.phone.trim()) {
      lead.phone = updates.phone.trim();
    }
    if (updates.email !== undefined) {
      lead.email = updates.email.trim();
    }
    await lead.save();
    return lead;
  }
}
