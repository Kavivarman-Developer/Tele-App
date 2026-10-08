import { Schema, model, Document, Types } from 'mongoose';

export type LeadStatus = 'OPEN' | 'CLOSED';

export interface ILead {
  campaignId: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  source: string;
  customProperties: Map<string, string>;
  assignedTo?: Types.ObjectId | null;
  stage: string;
  tag?: string | null;
  status: LeadStatus;
  nextFollowUpAt?: Date | null;
  followUpDue: boolean;
  lastContactedAt?: Date | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeadDoc extends ILead, Document<Types.ObjectId> {}

const leadSchema = new Schema<ILeadDoc>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    source: {
      type: String,
      default: 'UPLOAD',
      trim: true,
    },
    customProperties: {
      type: Map,
      of: String,
      default: {},
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    nextFollowUpAt: {
      type: Date,
      default: null,
      index: true,
    },
    followUpDue: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for duplicate detection
leadSchema.index({ campaignId: 1, phone: 1 });

// Compound index for lead assignment and follow-up filtering
leadSchema.index({ campaignId: 1, assignedTo: 1, status: 1, nextFollowUpAt: 1 });

// Compound index for agent's my-leads queue
leadSchema.index({ assignedTo: 1, status: 1, nextFollowUpAt: 1 });

export const Lead = model<ILeadDoc>('Lead', leadSchema);
