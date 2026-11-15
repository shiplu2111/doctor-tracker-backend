import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { PERMISSIONS } from '@doctor-tracker/shared';

const router = Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.DASHBOARD_READ));

router.get('/summary', asyncHandler(dashboardController.summary.bind(dashboardController)));
router.get(
  '/patients-per-doctor',
  asyncHandler(dashboardController.patientsPerDoctor.bind(dashboardController)),
);
router.get(
  '/timeseries',
  asyncHandler(dashboardController.timeseries.bind(dashboardController)),
);
router.get(
  '/conditions',
  asyncHandler(dashboardController.conditions.bind(dashboardController)),
);
router.get(
  '/specializations',
  asyncHandler(dashboardController.specializations.bind(dashboardController)),
);

export const dashboardRouter = router;
