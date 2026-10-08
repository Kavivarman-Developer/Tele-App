import { Router } from 'express';
import { SettingController } from '../controllers/setting.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateSettingSchema } from '../validations/setting.validation';

const router = Router();

// Public settings (accessible by any authenticated user for disposition rules)
router.get('/public', authenticate, SettingController.getPublicSettings);

// Only ADMIN and MANAGER can view full settings or edit settings
router.use(authenticate, authorize('ADMIN', 'MANAGER'));

router.get('/', SettingController.getSettings);
router.patch('/', validate(updateSettingSchema), SettingController.updateSettings);

export default router;
