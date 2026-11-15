import { Router } from 'express';
import { patientController } from './patient.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createPatientSchema, updatePatientSchema, PERMISSIONS } from '@doctor-tracker/shared';

const router = Router();

// All patient endpoints require authentication
router.use(authenticate);

// Conditions endpoint must precede /:id
router.get(
  '/conditions',
  authorize(PERMISSIONS.PATIENT_READ),
  asyncHandler(patientController.conditions.bind(patientController)),
);

router.get(
  '/',
  authorize(PERMISSIONS.PATIENT_READ),
  asyncHandler(patientController.list.bind(patientController)),
);

router.post(
  '/',
  authorize(PERMISSIONS.PATIENT_CREATE),
  validate(createPatientSchema),
  asyncHandler(patientController.create.bind(patientController)),
);

router.get(
  '/:id',
  authorize(PERMISSIONS.PATIENT_READ),
  asyncHandler(patientController.getById.bind(patientController)),
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.PATIENT_UPDATE),
  validate(updatePatientSchema),
  asyncHandler(patientController.update.bind(patientController)),
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.PATIENT_DELETE),
  asyncHandler(patientController.delete.bind(patientController)),
);

export const patientRouter = router;
