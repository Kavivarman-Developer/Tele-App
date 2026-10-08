import { Types } from 'mongoose';
import { Lead } from '../models/lead.model';
import { Activity } from '../models/activity.model';
import { Campaign } from '../models/campaign.model';
import { IUserDoc } from '../models/user.model';
import { ReportQueryInput, ReportExportQueryInput } from '../validations/report.validation';
import { AppError } from '../utils/AppError';

export interface DashboardReportData {
  totalLeads: number;
  openLeads: number;
  closedLeads: number;
  callsMade: number;
  connectedCalls: number;
  connectRate: number;
  leadsBySource: Array<{ source: string; count: number }>;
  leadsByStage: Array<{ stage: string; count: number }>;
  followUpsDueToday: number;
  followUpsMissed: number;
}

export interface UserCallsReportData {
  userId: string;
  name: string;
  email: string;
  calls: number;
  connected: number;
  notConnected: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
}

export interface DispositionsReportData {
  userId: string;
  name: string;
  stages: Array<{ stage: string; count: number }>;
}

export interface FollowUpsReportData {
  userId: string;
  name: string;
  due: number;
  completed: number;
  missed: number;
}

export interface CampaignStagesReportData {
  campaignId: string;
  campaignName: string;
  stages: Array<{ stage: string; count: number }>;
}

export interface CampaignLeadsReportData {
  campaignId: string;
  campaignName: string;
  created: number;
  assigned: number;
  closed: number;
  converted: number;
}

export class ReportService {
  private static async buildScopeFilters(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<{
    leadMatch: Record<string, unknown>;
    activityMatch: Record<string, unknown>;
  }> {
    const leadMatch: Record<string, unknown> = {};
    const activityMatch: Record<string, unknown> = {};

    // Date range filter
    if (query.from || query.to) {
      const dateRange: Record<string, Date> = {};
      if (query.from) dateRange.$gte = new Date(query.from);
      if (query.to) dateRange.$lte = new Date(query.to);
      leadMatch.createdAt = dateRange;
      activityMatch.createdAt = dateRange;
    }

    if (requester.role === 'AGENT') {
      leadMatch.assignedTo = requester._id;
      activityMatch.userId = requester._id;

      if (query.campaignId) {
        leadMatch.campaignId = new Types.ObjectId(query.campaignId);
        activityMatch.campaignId = new Types.ObjectId(query.campaignId);
      }
    } else if (requester.role === 'MANAGER') {
      const managedCampaigns = await Campaign.find({ managerId: requester._id }, '_id');
      const managedIds = managedCampaigns.map((c) => c._id);

      if (query.campaignId) {
        const reqCampId = new Types.ObjectId(query.campaignId);
        if (!managedIds.some((id) => id.equals(reqCampId))) {
          // Manager does not own this campaign, return no matches
          leadMatch.campaignId = { $in: [] };
          activityMatch.campaignId = { $in: [] };
        } else {
          leadMatch.campaignId = reqCampId;
          activityMatch.campaignId = reqCampId;
        }
      } else {
        leadMatch.campaignId = { $in: managedIds };
        activityMatch.campaignId = { $in: managedIds };
      }

      if (query.userId) {
        leadMatch.assignedTo = new Types.ObjectId(query.userId);
        activityMatch.userId = new Types.ObjectId(query.userId);
      }
    } else {
      // ADMIN
      if (query.campaignId) {
        leadMatch.campaignId = new Types.ObjectId(query.campaignId);
        activityMatch.campaignId = new Types.ObjectId(query.campaignId);
      }
      if (query.userId) {
        leadMatch.assignedTo = new Types.ObjectId(query.userId);
        activityMatch.userId = new Types.ObjectId(query.userId);
      }
    }

    return { leadMatch, activityMatch };
  }

  public static async getDashboard(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<DashboardReportData> {
    const { leadMatch, activityMatch } = await this.buildScopeFilters(requester, query);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [leadStats, activityStats] = await Promise.all([
      Lead.aggregate<{
        total: Array<{ count: number }>;
        open: Array<{ count: number }>;
        closed: Array<{ count: number }>;
        bySource: Array<{ _id: string; count: number }>;
        byStage: Array<{ _id: string; count: number }>;
        dueToday: Array<{ count: number }>;
        missed: Array<{ count: number }>;
      }>([
        { $match: leadMatch },
        {
          $facet: {
            total: [{ $count: 'count' }],
            open: [{ $match: { status: 'OPEN' } }, { $count: 'count' }],
            closed: [{ $match: { status: 'CLOSED' } }, { $count: 'count' }],
            bySource: [{ $group: { _id: '$source', count: { $sum: 1 } } }],
            byStage: [{ $group: { _id: '$stage', count: { $sum: 1 } } }],
            dueToday: [
              {
                $match: {
                  status: 'OPEN',
                  nextFollowUpAt: { $gte: startOfToday, $lte: endOfToday },
                },
              },
              { $count: 'count' },
            ],
            missed: [
              {
                $match: {
                  status: 'OPEN',
                  nextFollowUpAt: { $lt: startOfToday, $ne: null },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),

      Activity.aggregate<{
        callsMade: Array<{ count: number }>;
        connectedCalls: Array<{ count: number }>;
      }>([
        { $match: activityMatch },
        {
          $facet: {
            callsMade: [{ $count: 'count' }],
            connectedCalls: [{ $match: { connected: true } }, { $count: 'count' }],
          },
        },
      ]),
    ]);

    const l = leadStats[0] || {};
    const a = activityStats[0] || {};

    const totalLeads = l.total?.[0]?.count || 0;
    const openLeads = l.open?.[0]?.count || 0;
    const closedLeads = l.closed?.[0]?.count || 0;

    const callsMade = a.callsMade?.[0]?.count || 0;
    const connectedCalls = a.connectedCalls?.[0]?.count || 0;
    const connectRate = callsMade > 0 ? Number(((connectedCalls / callsMade) * 100).toFixed(1)) : 0;

    const leadsBySource = (l.bySource || []).map((s) => ({
      source: s._id || 'Unknown',
      count: s.count,
    }));

    const leadsByStage = (l.byStage || []).map((s) => ({
      stage: s._id || 'Unknown',
      count: s.count,
    }));

    const followUpsDueToday = l.dueToday?.[0]?.count || 0;
    const followUpsMissed = l.missed?.[0]?.count || 0;

    return {
      totalLeads,
      openLeads,
      closedLeads,
      callsMade,
      connectedCalls,
      connectRate,
      leadsBySource,
      leadsByStage,
      followUpsDueToday,
      followUpsMissed,
    };
  }

  public static async getUserCalls(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<UserCallsReportData[]> {
    const { activityMatch } = await this.buildScopeFilters(requester, query);

    const stats = await Activity.aggregate<UserCallsReportData>([
      { $match: activityMatch },
      {
        $group: {
          _id: '$userId',
          calls: { $sum: 1 },
          connected: { $sum: { $cond: ['$connected', 1, 0] } },
          notConnected: { $sum: { $cond: ['$connected', 0, 1] } },
          totalDurationSeconds: { $sum: '$durationSeconds' },
          avgDurationSeconds: { $avg: '$durationSeconds' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: '$user.name',
          email: '$user.email',
          calls: 1,
          connected: 1,
          notConnected: 1,
          totalDurationSeconds: 1,
          avgDurationSeconds: { $round: ['$avgDurationSeconds', 1] },
        },
      },
      { $sort: { calls: -1 } },
    ]);

    return stats || [];
  }

  public static async getDispositions(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<DispositionsReportData[]> {
    const { activityMatch } = await this.buildScopeFilters(requester, query);

    const stats = await Activity.aggregate<DispositionsReportData>([
      { $match: activityMatch },
      {
        $group: {
          _id: { userId: '$userId', stage: '$stage' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.userId',
          stages: {
            $push: { stage: '$_id.stage', count: '$count' },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: '$user.name',
          stages: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    return stats || [];
  }

  public static async getFollowUps(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<FollowUpsReportData[]> {
    const { leadMatch } = await this.buildScopeFilters(requester, query);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const stats = await Lead.aggregate<FollowUpsReportData>([
      {
        $match: {
          ...leadMatch,
          assignedTo: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          due: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'OPEN'] },
                    { $gte: ['$nextFollowUpAt', startOfToday] },
                    { $lte: ['$nextFollowUpAt', endOfToday] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          missed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'OPEN'] },
                    { $lt: ['$nextFollowUpAt', startOfToday] },
                    { $ne: ['$nextFollowUpAt', null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $gt: ['$attemptCount', 0] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: '$user.name',
          due: 1,
          completed: 1,
          missed: 1,
        },
      },
      { $sort: { due: -1 } },
    ]);

    return stats || [];
  }

  public static async getCampaignStages(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<CampaignStagesReportData[]> {
    const { leadMatch } = await this.buildScopeFilters(requester, query);

    const stats = await Lead.aggregate<CampaignStagesReportData>([
      { $match: leadMatch },
      {
        $group: {
          _id: { campaignId: '$campaignId', stage: '$stage' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.campaignId',
          stages: {
            $push: { stage: '$_id.stage', count: '$count' },
          },
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: '$campaign' },
      {
        $project: {
          _id: 0,
          campaignId: { $toString: '$_id' },
          campaignName: '$campaign.name',
          stages: 1,
        },
      },
      { $sort: { campaignName: 1 } },
    ]);

    return stats || [];
  }

  public static async getCampaignLeads(
    requester: IUserDoc,
    query: ReportQueryInput,
  ): Promise<CampaignLeadsReportData[]> {
    const { leadMatch } = await this.buildScopeFilters(requester, query);

    const stats = await Lead.aggregate<CampaignLeadsReportData>([
      { $match: leadMatch },
      {
        $group: {
          _id: '$campaignId',
          created: { $sum: 1 },
          assigned: {
            $sum: { $cond: [{ $ne: ['$assignedTo', null] }, 1, 0] },
          },
          closed: {
            $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] },
          },
          converted: {
            $sum: { $cond: [{ $eq: ['$stage', 'Converted'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: '$campaign' },
      {
        $project: {
          _id: 0,
          campaignId: { $toString: '$_id' },
          campaignName: '$campaign.name',
          created: 1,
          assigned: 1,
          closed: 1,
          converted: 1,
        },
      },
      { $sort: { campaignName: 1 } },
    ]);

    return stats || [];
  }

  public static async exportReportToCsv(
    requester: IUserDoc,
    input: ReportExportQueryInput,
  ): Promise<string> {
    const query: ReportQueryInput = {
      from: input.from,
      to: input.to,
      campaignId: input.campaignId,
      userId: input.userId,
    };

    switch (input.type) {
      case 'dashboard': {
        const d = await this.getDashboard(requester, query);
        const lines: string[] = [
          'Metric,Value',
          `Total Leads,${d.totalLeads}`,
          `Open Leads,${d.openLeads}`,
          `Closed Leads,${d.closedLeads}`,
          `Calls Made,${d.callsMade}`,
          `Connected Calls,${d.connectedCalls}`,
          `Connect Rate,${d.connectRate}%`,
          `Follow-ups Due Today,${d.followUpsDueToday}`,
          `Follow-ups Missed,${d.followUpsMissed}`,
        ];
        return lines.join('\n');
      }

      case 'user-calls': {
        const data = await this.getUserCalls(requester, query);
        const lines: string[] = [
          'Agent Name,Email,Calls Made,Connected,Not Connected,Total Talk Time (sec),Avg Duration (sec)',
        ];
        for (const row of data) {
          lines.push(
            `"${row.name}","${row.email}",${row.calls},${row.connected},${row.notConnected},${row.totalDurationSeconds},${row.avgDurationSeconds}`,
          );
        }
        return lines.join('\n');
      }

      case 'dispositions': {
        const data = await this.getDispositions(requester, query);
        const lines: string[] = ['Agent Name,Stage,Count'];
        for (const row of data) {
          for (const s of row.stages) {
            lines.push(`"${row.name}","${s.stage}",${s.count}`);
          }
        }
        return lines.join('\n');
      }

      case 'follow-ups': {
        const data = await this.getFollowUps(requester, query);
        const lines: string[] = ['Agent Name,Due Today,Completed,Missed'];
        for (const row of data) {
          lines.push(`"${row.name}",${row.due},${row.completed},${row.missed}`);
        }
        return lines.join('\n');
      }

      case 'campaign-stages': {
        const data = await this.getCampaignStages(requester, query);
        const lines: string[] = ['Campaign Name,Stage,Lead Count'];
        for (const row of data) {
          for (const s of row.stages) {
            lines.push(`"${row.campaignName}","${s.stage}",${s.count}`);
          }
        }
        return lines.join('\n');
      }

      case 'campaign-leads': {
        const data = await this.getCampaignLeads(requester, query);
        const lines: string[] = ['Campaign Name,Created,Assigned,Closed,Converted'];
        for (const row of data) {
          lines.push(
            `"${row.campaignName}",${row.created},${row.assigned},${row.closed},${row.converted}`,
          );
        }
        return lines.join('\n');
      }

      default:
        throw new AppError('Unsupported export report type', 400);
    }
  }
}
