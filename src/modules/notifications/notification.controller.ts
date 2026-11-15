import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { AppError } from '../../utils/app-error';

export class NotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    }

    const unreadOnly = req.query.unread === 'true';
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const result = await notificationService.listUserNotifications(userId, {
      unreadOnly,
      page,
      limit,
    });

    res.status(200).json({
      data: result.notifications,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async unreadCount(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    }

    const unreadCount = await notificationService.getUnreadCount(userId);

    res.status(200).json({
      data: {
        unreadCount,
      },
    });
  }

  async markRead(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    }

    const notification = await notificationService.markAsRead(userId, req.params.id);
    if (!notification) {
      throw new AppError('NOTIFICATION_NOT_FOUND', 404, 'Notification not found');
    }

    res.status(200).json({
      data: notification,
    });
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication required');
    }

    const count = await notificationService.markAllAsRead(userId);

    res.status(200).json({
      data: {
        modifiedCount: count,
      },
    });
  }
}

export const notificationController = new NotificationController();
