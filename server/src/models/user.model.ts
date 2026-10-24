import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

export interface IUser {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  branch?: string | null;
  managerId?: Types.ObjectId | null;
  isActive: boolean;
  canReceiveLeads: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDoc extends IUser, Document<Types.ObjectId> {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUserDoc>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'AGENT'],
      required: [true, 'Role is required'],
    },
    branch: {
      type: String,
      default: null,
      trim: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    canReceiveLeads: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = model<IUserDoc>('User', userSchema);
