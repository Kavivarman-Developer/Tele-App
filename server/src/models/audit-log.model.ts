import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog {
  userId?: Types.ObjectId | null;
  userEmail?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface IAuditLogDoc extends IAuditLog, Document<Types.ObjectId> {}

const auditLogSchema = new Schema<IAuditLogDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      trim: true,
    },
    userRole: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog = model<IAuditLogDoc>('AuditLog', auditLogSchema);
