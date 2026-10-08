import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const reportQuerySchema = z.object({
  query: z.object({
    from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    campaignId: z.string().regex(objectIdRegex, 'Invalid campaign ID format').optional(),
    userId: z.string().regex(objectIdRegex, 'Invalid user ID format').optional(),
  }),
});

export const reportExportQuerySchema = z.object({
  query: z.object({
    type: z.enum([
      'dashboard',
      'user-calls',
      'dispositions',
      'follow-ups',
      'campaign-stages',
      'campaign-leads',
    ]),
    format: z.enum(['csv']).default('csv'),
    from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    campaignId: z.string().regex(objectIdRegex, 'Invalid campaign ID format').optional(),
    userId: z.string().regex(objectIdRegex, 'Invalid user ID format').optional(),
  }),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>['query'];
export type ReportExportQueryInput = z.infer<typeof reportExportQuerySchema>['query'];
