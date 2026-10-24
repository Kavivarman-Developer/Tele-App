import { Schema, model, Document, Types } from 'mongoose';

export interface ITaggedLead {
  leadId: Types.ObjectId;
  customerName: string;
  customerPhone: string;
  agentId: Types.ObjectId;
  agentName: string;
  branch?: string | null;
  targetRole: 'BOTH' | 'MANAGER' | 'ADMIN';
  reason: string;
  note: string;
  dismissedBy: Types.ObjectId[];
  status: 'ACTIVE' | 'DISMISSED';
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaggedLeadDoc extends ITaggedLead, Document<Types.ObjectId> {}

const taggedLeadSchema = new Schema<ITaggedLeadDoc>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      required: [true, 'Lead ID is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone is required'],
      trim: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Agent ID is required'],
      index: true,
    },
    agentName: {
      type: String,
      required: [true, 'Agent name is required'],
      trim: true,
    },
    branch: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    targetRole: {
      type: String,
      enum: ['BOTH', 'MANAGER', 'ADMIN'],
      default: 'BOTH',
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Tag reason is required'],
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    dismissedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'DISMISSED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

taggedLeadSchema.index({ status: 1, targetRole: 1, branch: 1, createdAt: -1 });

export const TaggedLead = model<ITaggedLeadDoc>('TaggedLead', taggedLeadSchema);
