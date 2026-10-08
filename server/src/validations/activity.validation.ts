import { z } from 'zod';
import { NotConnectedReasons } from '../models/activity.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const disposeLeadSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid lead ID format'),
  }),
  body: z
    .object({
      connected: z.boolean({ required_error: 'connected boolean is required' }),
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
      reassignToUserId: z.string().regex(objectIdRegex, 'Invalid target user ID').optional(),
      copyToCampaignId: z.string().regex(objectIdRegex, 'Invalid copy campaign ID').optional(),
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
      } else {
        if (!data.notConnectedReason) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'notConnectedReason is required when connected is false',
            path: ['notConnectedReason'],
          });
        }
      }
    }),
});

export type DisposeLeadInput = z.infer<typeof disposeLeadSchema>['body'];
