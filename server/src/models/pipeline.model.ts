import { Schema, model, Document, Types } from 'mongoose';

export interface IStage {
  _id?: Types.ObjectId;
  name: string;
  isClosed: boolean;
  tags: string[];
  order: number;
}

export interface IPipeline {
  name: string;
  stages: IStage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPipelineDoc extends IPipeline, Document<Types.ObjectId> {}

const stageSchema = new Schema<IStage>(
  {
    name: {
      type: String,
      required: [true, 'Stage name is required'],
      trim: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: true },
);

const pipelineSchema = new Schema<IPipelineDoc>(
  {
    name: {
      type: String,
      required: [true, 'Pipeline name is required'],
      unique: true,
      trim: true,
    },
    stages: {
      type: [stageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const Pipeline = model<IPipelineDoc>('Pipeline', pipelineSchema);
