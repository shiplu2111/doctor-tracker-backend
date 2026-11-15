import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(notificationController.list.bind(notificationController)));
router.get('/unread-count', asyncHandler(notificationController.unreadCount.bind(notificationController)));
router.patch('/:id/read', asyncHandler(notificationController.markRead.bind(notificationController)));
router.post('/read-all', asyncHandler(notificationController.markAllRead.bind(notificationController)));

export const notificationRouter = router;
