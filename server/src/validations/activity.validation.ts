import { z } from 'zod';
import { NotConnectedReasons } from '../models/activity.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const disposeLeadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Lead ID is required'),
  }),
  body: z
    .object({
      phone: z.string().optional().nullable(),
      connected: z.boolean({ required_error: 'connected boolean is required' }),
      callAttempt: z.boolean().default(false),
      notConnectedReason: z.enum(NotConnectedReasons).optional(),
      stage: z.string().trim().optional(),
      tag: z.string().trim().optional().nullable(),
      followUpAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
      remark: z.string().trim().optional().nullable(),
      durationSeconds: z.number().int().min(0).default(0),
      answers: z
        .array(
          z.object({
            questionId: z.string().min(1),
            value: z.unknown(),
          }),
        )
        .default([]),
      reassignToUserId: z.string().regex(objectIdRegex, 'Invalid target user ID').optional().nullable(),
      copyToCampaignId: z.string().regex(objectIdRegex, 'Invalid copy campaign ID').optional().nullable(),
    })
    .superRefine((data, ctx) => {
      if (data.connected) {
        if (!data.stage || data.stage.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'stage is required when connected is true',
            path: ['stage'],
          });
        }
      }
    }),
});

export type DisposeLeadInput = z.infer<typeof disposeLeadSchema>['body'];
