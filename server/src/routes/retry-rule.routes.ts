import { Router } from 'express';
import { RetryRuleController } from '../controllers/retry-rule.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  updateSingleRetryRuleSchema,
  updateRetryRulesBulkSchema,
} from '../validations/retry-rule.validation';

const router = Router();

// Authenticated users can read retry rules to know default follow-up delays
router.get('/', authenticate, RetryRuleController.listRules);

// ADMIN and MANAGER can update retry rules
router.patch(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(updateRetryRulesBulkSchema),
  RetryRuleController.updateBulkRules,
);
router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  validate(updateSingleRetryRuleSchema),
  RetryRuleController.updateSingleRule,
);

export default router;
