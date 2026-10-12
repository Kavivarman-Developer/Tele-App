import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createBranchSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Branch name is required' })
      .min(2, 'Branch name must be at least 2 characters')
      .max(50, 'Branch name cannot exceed 50 characters')
      .trim(),
    code: z.string().trim().max(10).optional(),
    address: z.string().trim().max(200).optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid branch ID format'),
  }),
  body: z.object({
    name: z.string().min(2).max(50).trim().optional(),
    code: z.string().trim().max(10).optional(),
    address: z.string().trim().max(200).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const branchIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid branch ID format'),
  }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>['body'];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>['body'];
