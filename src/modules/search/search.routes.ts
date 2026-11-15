import { Router } from 'express';
import { searchController } from './search.controller';
import { asyncHandler } from '../../utils/async-handler';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/rbac.middleware';
import { PERMISSIONS } from '@doctor-tracker/shared';

const router = Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.SEARCH_READ));

router.get('/', asyncHandler(searchController.search.bind(searchController)));

export const searchRouter = router;
