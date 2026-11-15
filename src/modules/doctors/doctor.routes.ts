import { Router } from 'express';
import { doctorController } from './doctor.controller';
import { patientController } from '../patients/patient.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createDoctorSchema,
  updateDoctorSchema,
  bulkImportDoctorsSchema,
  createPatientSchema,
  PERMISSIONS,
} from '@doctor-tracker/shared';

const router = Router();

// 1. All routes require authentication
router.use(authenticate);

// Specializations must be declared before :id to prevent matching as id
router.get(
  '/specializations',
  authorize(PERMISSIONS.DOCTOR_READ),
  asyncHandler(doctorController.specializations.bind(doctorController)),
);

router.get(
  '/',
  authorize(PERMISSIONS.DOCTOR_READ),
  asyncHandler(doctorController.list.bind(doctorController)),
);

router.post(
  '/',
  authorize(PERMISSIONS.DOCTOR_CREATE),
  validate(createDoctorSchema),
  asyncHandler(doctorController.create.bind(doctorController)),
);

router.post(
  '/import',
  authorize(PERMISSIONS.DOCTOR_CREATE),
  validate(bulkImportDoctorsSchema),
  asyncHandler(doctorController.bulkImport.bind(doctorController)),
);

router.get(
  '/:id',
  authorize(PERMISSIONS.DOCTOR_READ),
  asyncHandler(doctorController.getById.bind(doctorController)),
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.DOCTOR_UPDATE),
  validate(updateDoctorSchema),
  asyncHandler(doctorController.update.bind(doctorController)),
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.DOCTOR_DELETE),
  asyncHandler(doctorController.delete.bind(doctorController)),
);

// Nested Doctor Patients Endpoints per docs/API.md
router.get(
  '/:id/patients',
  authorize(PERMISSIONS.PATIENT_READ),
  asyncHandler(patientController.list.bind(patientController)),
);

router.post(
  '/:id/patients',
  authorize(PERMISSIONS.PATIENT_CREATE),
  validate(createPatientSchema),
  asyncHandler(patientController.create.bind(patientController)),
);

router.delete(
  '/:id/patients/:patientId',
  authorize(PERMISSIONS.PATIENT_DELETE),
  asyncHandler(patientController.delete.bind(patientController)),
);

export const doctorRouter = router;
