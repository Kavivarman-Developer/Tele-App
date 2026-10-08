import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { reportQuerySchema, reportExportQuerySchema } from '../validations/report.validation';

const router = Router();

// All reporting endpoints require authentication
router.use(authenticate);

router.get('/dashboard', validate(reportQuerySchema), ReportController.getDashboard);
router.get('/user-calls', validate(reportQuerySchema), ReportController.getUserCalls);
router.get('/dispositions', validate(reportQuerySchema), ReportController.getDispositions);
router.get('/follow-ups', validate(reportQuerySchema), ReportController.getFollowUps);
router.get('/campaign-stages', validate(reportQuerySchema), ReportController.getCampaignStages);
router.get('/campaign-leads', validate(reportQuerySchema), ReportController.getCampaignLeads);
router.get('/export', validate(reportExportQuerySchema), ReportController.exportReport);

export default router;
