import { Schema, model, Document, Types } from 'mongoose';
import { NotConnectedReasons, NotConnectedReason } from './activity.model';

export interface IRetryStep {
  delayMinutes: number;
}

export interface IRetryRule {
  reason: NotConnectedReason;
  enabled: boolean;
  steps: IRetryStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IRetryRuleDoc extends IRetryRule, Document<Types.ObjectId> {}

const retryStepSchema = new Schema<IRetryStep>(
  {
    delayMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const retryRuleSchema = new Schema<IRetryRuleDoc>(
  {
    reason: {
      type: String,
      enum: NotConnectedReasons,
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    steps: {
      type: [retryStepSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const RetryRule = model<IRetryRuleDoc>('RetryRule', retryRuleSchema);
