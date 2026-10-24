import { AuditLog, IAuditLogDoc } from '../models/audit-log.model';
import { Request } from 'express';
import { Types } from 'mongoose';

export interface CreateAuditLogParams {
  req?: Request;
  userId?: string | Types.ObjectId;
  userEmail?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export class AuditService {
  public static async log(params: CreateAuditLogParams): Promise<IAuditLogDoc | null> {
    try {
      const user = params.req?.user;
      const ipAddress =
        params.req?.ip ||
        (params.req?.headers['x-forwarded-for'] as string) ||
        params.req?.socket?.remoteAddress;
      const userAgent = params.req?.headers['user-agent'];

      return await AuditLog.create({
        userId: params.userId || user?._id || null,
        userEmail: params.userEmail || user?.email,
        userRole: params.userRole || user?.role,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details || {},
        ipAddress,
        userAgent,
      });
    } catch {
      // Never let audit logging failure crash business requests
      return null;
    }
  }

  public static async getLogs(query: {
    action?: string;
    resourceType?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: IAuditLogDoc[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const filter: Record<string, unknown> = {};

    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs: logs as unknown as IAuditLogDoc[],
      total,
      page,
      limit,
    };
  }
}
