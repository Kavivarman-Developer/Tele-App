import { Schema, model, Document } from 'mongoose';

export interface ISchedulerLockDoc extends Document {
  lockKey: string;
  lockedAt: Date;
  lockedBy: string;
  expiresAt: Date;
}

const schedulerLockSchema = new Schema<ISchedulerLockDoc>(
  {
    lockKey: {
      type: String,
      required: true,
      unique: true,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    lockedBy: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Document automatically purged by MongoDB TTL when expiresAt is reached
    },
  },
  {
    timestamps: false,
  },
);

export const SchedulerLock = model<ISchedulerLockDoc>('SchedulerLock', schedulerLockSchema);
