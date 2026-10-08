import { z } from 'zod';
import { NotConnectedReasons } from '../models/activity.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const updateSingleRetryRuleSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid rule ID format'),
  }),
  body: z
    .object({
      enabled: z.boolean().optional(),
      steps: z
        .array(
          z.object({
            delayMinutes: z.number().int().min(1, 'delayMinutes must be at least 1 minute'),
          }),
        )
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided for update',
    }),
});

export const updateRetryRulesBulkSchema = z.object({
  body: z
    .array(
      z.object({
        reason: z.enum(NotConnectedReasons),
        enabled: z.boolean(),
        steps: z.array(
          z.object({
            delayMinutes: z.number().int().min(1, 'delayMinutes must be at least 1 minute'),
          }),
        ),
      }),
    )
    .min(1, 'At least one rule must be provided for bulk update'),
});

export type UpdateSingleRetryRuleInput = z.infer<typeof updateSingleRetryRuleSchema>['body'];
export type UpdateRetryRulesBulkInput = z.infer<typeof updateRetryRulesBulkSchema>['body'];
