import { Schema, model, Document, Types } from 'mongoose';

export interface ISetting {
  allowDisposeWithoutFollowUp: boolean;
  followUpMandatoryForNotConnected: boolean;
  reassignAfterHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingDoc extends ISetting, Document<Types.ObjectId> {}

const settingSchema = new Schema<ISettingDoc>(
  {
    allowDisposeWithoutFollowUp: {
      type: Boolean,
      default: false,
    },
    followUpMandatoryForNotConnected: {
      type: Boolean,
      default: false,
    },
    reassignAfterHours: {
      type: Number,
      default: 24,
    },
  },
  {
    timestamps: true,
  },
);

export const Setting = model<ISettingDoc>('Setting', settingSchema);
