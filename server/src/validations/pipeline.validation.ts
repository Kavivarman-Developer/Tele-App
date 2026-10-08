import { z } from 'zod';

const stageInputSchema = z.object({
  _id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid stage ID format').optional(),
  name: z
    .string({ required_error: 'Stage name is required' })
    .min(1, 'Stage name cannot be empty')
    .trim(),
  isClosed: z.boolean().default(false),
  tags: z.array(z.string().trim()).default([]),
  order: z.number().int().default(0),
});

const validateUniqueStageNames = (stages?: Array<{ name: string }>): boolean => {
  if (!stages || stages.length === 0) return true;
  const names = stages.map((s) => s.name.trim().toLowerCase());
  const uniqueNames = new Set(names);
  return uniqueNames.size === names.length;
};

export const createPipelineSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Pipeline name is required' })
        .min(1, 'Pipeline name cannot be empty')
        .trim(),
      stages: z.array(stageInputSchema).default([]),
    })
    .refine((data) => validateUniqueStageNames(data.stages), {
      message: 'Stage names must be unique inside a pipeline',
      path: ['stages'],
    }),
});

export const updatePipelineSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid pipeline ID format'),
  }),
  body: z
    .object({
      name: z.string().min(1, 'Pipeline name cannot be empty').trim().optional(),
      stages: z.array(stageInputSchema).optional(),
    })
    .refine((data) => !data.stages || validateUniqueStageNames(data.stages), {
      message: 'Stage names must be unique inside a pipeline',
      path: ['stages'],
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const pipelineIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid pipeline ID format'),
  }),
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>['body'];
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>['body'];
