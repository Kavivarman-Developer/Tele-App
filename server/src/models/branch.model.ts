import { Schema, model, Document, Types } from 'mongoose';

export interface IBranch {
  name: string;
  code?: string;
  address?: string;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranchDoc extends IBranch, Document<Types.ObjectId> {}

const branchSchema = new Schema<IBranchDoc>(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

branchSchema.index({ name: 1 }, { unique: true });

export const Branch = model<IBranchDoc>('Branch', branchSchema);
