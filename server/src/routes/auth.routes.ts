import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../validations/auth.validation';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.get('/me', authenticate, AuthController.getMe);

export default router;
