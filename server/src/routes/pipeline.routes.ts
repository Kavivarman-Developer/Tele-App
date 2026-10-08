import { Router } from 'express';
import { PipelineController } from '../controllers/pipeline.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createPipelineSchema,
  updatePipelineSchema,
  pipelineIdParamSchema,
} from '../validations/pipeline.validation';

const router = Router();

// All pipeline endpoints require authentication
router.use(authenticate);

// Reads: Any authenticated user can read pipelines
router.get('/', PipelineController.listPipelines);
router.get('/:id', validate(pipelineIdParamSchema), PipelineController.getPipeline);

// Writes: ADMIN and MANAGER
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  validate(createPipelineSchema),
  PipelineController.createPipeline,
);

router.patch(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  validate(updatePipelineSchema),
  PipelineController.updatePipeline,
);

router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  validate(pipelineIdParamSchema),
  PipelineController.deletePipeline,
);

export default router;
