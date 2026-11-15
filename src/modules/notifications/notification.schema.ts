import { Schema, model, Types } from 'mongoose';
import { NotificationType } from '@doctor-tracker/shared';

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  entity?: {
    kind: 'doctor' | 'patient';
    id: string;
  };
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      kind: {
        type: String,
        enum: ['doctor', 'patient'],
      },
      id: {
        type: String,
      },
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for querying user unread/read notifications
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

// TTL index: auto-delete after 90 days (90 * 24 * 3600 seconds)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
