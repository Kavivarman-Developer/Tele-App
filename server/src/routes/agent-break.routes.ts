import { Router } from 'express';
import { AgentBreakController } from '../controllers/agent-break.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/start', AgentBreakController.startBreak);
router.post('/end', AgentBreakController.endBreak);
router.get('/current', AgentBreakController.getCurrentBreak);
router.get('/today', AgentBreakController.getTodayBreaks);

export default router;
