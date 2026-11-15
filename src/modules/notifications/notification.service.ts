import { Types } from 'mongoose';
import { NotificationModel, INotification } from './notification.schema';
import { UserModel } from '../users/user.schema';
import { eventBus } from '../../utils/event-bus';
import { logger } from '../../utils/logger';
import { ROLES, type NotificationType } from '@doctor-tracker/shared';

export class NotificationService {
  constructor() {
    this.registerEventSubscribers();
  }

  private registerEventSubscribers() {
    eventBus.onEvent('doctor.created', async ({ doctor }) => {
      try {
        await this.notifyAdmins({
          type: 'doctor:created',
          title: 'New Doctor Registered',
          message: `${doctor.name} (${doctor.specialization}) was added at ${doctor.hospital}.`,
          entity: { kind: 'doctor', id: doctor.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed to process doctor.created notification');
      }
    });

    eventBus.onEvent('doctor.deleted', async ({ doctorId, doctorName }) => {
      try {
        await this.notifyAdmins({
          type: 'doctor:deleted',
          title: 'Doctor Removed',
          message: `The profile for ${doctorName} has been deleted.`,
          entity: { kind: 'doctor', id: doctorId },
        });
      } catch (err) {
        logger.error({ err }, 'Failed to process doctor.deleted notification');
      }
    });

    eventBus.onEvent('patient.created', async ({ patient }) => {
      try {
        await this.notifyAdmins({
          type: 'patient:created',
          title: 'New Patient Registered',
          message: `Patient ${patient.name} (${patient.condition}) was registered.`,
          entity: { kind: 'patient', id: patient.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed to process patient.created notification');
      }
    });

    eventBus.onEvent('patient.critical', async ({ patient }) => {
      try {
        await this.notifyAdmins({
          type: 'patient:critical',
          title: '🚨 Critical Patient Alert',
          message: `Patient ${patient.name} has been marked as CRITICAL condition.`,
          entity: { kind: 'patient', id: patient.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed to process patient.critical notification');
      }
    });
  }

  async notifyAdmins(data: {
    type: NotificationType;
    title: string;
    message: string;
    entity?: { kind: 'doctor' | 'patient'; id: string };
  }): Promise<void> {
    const adminUsers = await UserModel.find({
      role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
      isActive: true,
    })
      .select('_id')
      .lean();

    if (adminUsers.length === 0) return;

    const notifications = adminUsers.map((user) => ({
      userId: user._id,
      type: data.type,
      title: data.title,
      message: data.message,
      entity: data.entity,
      readAt: null,
    }));

    await NotificationModel.insertMany(notifications, { ordered: false });
  }

  async listUserNotifications(
    userId: string,
    options: { unreadOnly?: boolean; page?: number; limit?: number } = {}
  ): Promise<{ notifications: INotification[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (options.unreadOnly) {
      filter.readAt = null;
    }

    const [docs, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NotificationModel.countDocuments(filter),
    ]);

    const notifications = docs.map((doc) => doc.toJSON() as unknown as INotification);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      readAt: null,
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<INotification | null> {
    const updated = await NotificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      },
      {
        $set: { readAt: new Date() },
      },
      { new: true }
    );

    return updated ? (updated.toJSON() as unknown as INotification) : null;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    return result.modifiedCount;
  }
}

export const notificationService = new NotificationService();
