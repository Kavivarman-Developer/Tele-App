import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', AuditController.getLogs);

export default router;
