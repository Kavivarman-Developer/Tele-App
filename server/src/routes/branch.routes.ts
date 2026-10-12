import { Router } from 'express';
import { BranchController } from '../controllers/branch.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createBranchSchema,
  branchIdParamSchema,
} from '../validations/branch.validation';

const router = Router();

// All branch endpoints require authentication
router.use(authenticate);

// Reads: Any authenticated user can get branches (for tabs/pickers)
router.get('/', BranchController.listBranches);

// Writes: ADMIN ONLY!
router.post(
  '/',
  authorize('ADMIN'),
  validate(createBranchSchema),
  BranchController.createBranch,
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  validate(branchIdParamSchema),
  BranchController.deleteBranch,
);

export default router;
