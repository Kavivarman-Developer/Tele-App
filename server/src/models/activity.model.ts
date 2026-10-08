import { Schema, model, Document, Types } from 'mongoose';

export const NotConnectedReasons = [
  'DID_NOT_PICK',
  'BUSY',
  'USER_DISCONNECTED',
  'SWITCHED_OFF',
  'OUT_OF_COVERAGE',
  'CALL_NOT_COMPLETED',
  'OTHER',
  'INVALID_NUMBER',
  'INCOMING_NOT_AVAILABLE',
  'NUMBER_NOT_IN_USE',
] as const;

export type NotConnectedReason = (typeof NotConnectedReasons)[number];

export interface IEngagementAnswer {
  questionId: string;
  value: unknown;
}

export interface IActivity {
  leadId: Types.ObjectId;
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'CALL';
  connected: boolean;
  notConnectedReason?: NotConnectedReason | null;
  stage: string;
  tag?: string | null;
  remark?: string | null;
  followUpAt?: Date | null;
  durationSeconds: number;
  answers: IEngagementAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IActivityDoc extends IActivity, Document<Types.ObjectId> {}

const engagementAnswerSchema = new Schema<IEngagementAnswer>(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

const activitySchema = new Schema<IActivityDoc>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead ID is required'],
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['CALL'],
      default: 'CALL',
    },
    connected: {
      type: Boolean,
      required: [true, 'Connected status is required'],
    },
    notConnectedReason: {
      type: String,
      enum: NotConnectedReasons,
      default: null,
    },
    stage: {
      type: String,
      required: [true, 'Stage is required'],
      trim: true,
    },
    tag: {
      type: String,
      default: null,
      trim: true,
    },
    remark: {
      type: String,
      default: null,
      trim: true,
    },
    followUpAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    answers: {
      type: [engagementAnswerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

activitySchema.index({ leadId: 1, createdAt: -1 });

export const Activity = model<IActivityDoc>('Activity', activitySchema);
