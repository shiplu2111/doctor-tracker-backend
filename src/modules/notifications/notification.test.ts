import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { UserModel } from '../users/user.schema';
import { NotificationModel } from './notification.schema';
import { signAccessToken } from '../../utils/jwt.util';
import { ROLES, Role } from '@doctor-tracker/shared';
import { eventBus } from '../../utils/event-bus';

describe('Notification Module Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    app = createApp();

    const admin = await UserModel.create({
      name: 'Admin User',
      email: 'admin.notif@example.com',
      passwordHash: 'hash',
      role: ROLES.ADMIN,
      isActive: true,
    });
    adminId = admin._id.toString();
    adminToken = signAccessToken(adminId, admin.role as Role);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await NotificationModel.deleteMany({});
  });

  it('GET /api/v1/notifications should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/notifications/unread-count should return unread count', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it('should create notifications for admins when doctor.created event is emitted', async () => {
    eventBus.emitEvent('doctor.created', {
      doctor: {
        id: 'doc-123',
        name: 'Dr. John Test',
        specialization: 'Neurology',
        hospital: 'City Hospital',
      },
    });

    // Allow event loop to process async handler
    await new Promise((r) => setTimeout(r, 100));

    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.unreadCount).toBe(1);

    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].title).toBe('New Doctor Registered');
    expect(listRes.body.data[0].readAt).toBeNull();
  });

  it('PATCH /api/v1/notifications/:id/read should mark a notification as read', async () => {
    const notif = await NotificationModel.create({
      userId: new mongoose.Types.ObjectId(adminId),
      type: 'doctor:created',
      title: 'Test Notification',
      message: 'Test message',
      readAt: null,
    });

    const patchRes = await request(app)
      .patch(`/api/v1/notifications/${notif._id.toString()}/read`)
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.readAt).not.toBeNull();

    const countRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(countRes.body.data.unreadCount).toBe(0);
  });

  it('POST /api/v1/notifications/read-all should mark all notifications as read', async () => {
    await NotificationModel.create([
      {
        userId: new mongoose.Types.ObjectId(adminId),
        type: 'doctor:created',
        title: 'Notification 1',
        message: 'Message 1',
        readAt: null,
      },
      {
        userId: new mongoose.Types.ObjectId(adminId),
        type: 'patient:created',
        title: 'Notification 2',
        message: 'Message 2',
        readAt: null,
      },
    ]);

    const res = await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.modifiedCount).toBe(2);

    const countRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Cookie', [`dt_access=${adminToken}`]);

    expect(countRes.body.data.unreadCount).toBe(0);
  });
});
