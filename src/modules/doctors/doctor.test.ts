import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { UserModel } from '../users/user.schema';
import { DoctorModel } from './doctor.schema';
import { hashPassword } from '../../utils/password.util';
import { ROLES } from '@doctor-tracker/shared';

describe('Doctor Module Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let adminCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create Admin User
    const adminHash = await hashPassword('AdminPass123!');
    await UserModel.create({
      name: 'System Admin',
      email: 'admin.doc@example.com',
      passwordHash: adminHash,
      role: ROLES.ADMIN,
    });

    // Create Viewer User
    const viewerHash = await hashPassword('ViewerPass123!');
    await UserModel.create({
      name: 'Auditor Viewer',
      email: 'viewer.doc@example.com',
      passwordHash: viewerHash,
      role: ROLES.VIEWER,
    });

    // Login as Admin
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.doc@example.com', password: 'AdminPass123!' });
    const adminCookies = adminLogin.headers['set-cookie'] as unknown as string[];
    adminCookie = adminCookies.find((c) => c.startsWith('dt_access='))!;

    // Login as Viewer
    const viewerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer.doc@example.com', password: 'ViewerPass123!' });
    const viewerCookies = viewerLogin.headers['set-cookie'] as unknown as string[];
    viewerCookie = viewerCookies.find((c) => c.startsWith('dt_access='))!;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/doctors should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/doctors');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/doctors should reject creation when requested by viewer with 403', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', viewerCookie)
      .send({
        name: 'Dr. Unauthorized',
        specialization: 'Neurology',
        hospital: 'City Clinic',
        phone: '+8801700000000',
        email: 'unauthorized@example.com',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/doctors should validate input fields', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie)
      .send({
        name: '',
        specialization: 'Cardiology',
        hospital: 'Square Hospital',
        phone: 'invalid-phone',
        email: 'bad-email',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  let createdDoctorId: string;
  const validDoctor = {
    name: 'Dr. Ayesha Rahman',
    specialization: 'Cardiology',
    hospital: 'Square Hospital',
    phone: '+8801712345678',
    email: 'ayesha.rahman@example.com',
  };

  it('POST /api/v1/doctors should create a new doctor successfully', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie)
      .send(validDoctor);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(validDoctor.name);
    expect(res.body.data.email).toBe(validDoctor.email);
    expect(res.body.data.patientCount).toBe(0);
    expect(res.body.data.id).toBeDefined();

    createdDoctorId = res.body.data.id;
  });

  it('POST /api/v1/doctors should return 409 DUPLICATE_EMAIL when email already exists', async () => {
    const res = await request(app)
      .post('/api/v1/doctors')
      .set('Cookie', adminCookie)
      .send(validDoctor);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('GET /api/v1/doctors should return paginated list of doctors', async () => {
    const res = await request(app)
      .get('/api/v1/doctors?page=1&limit=10')
      .set('Cookie', viewerCookie); // Viewer can read

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.meta).toHaveProperty('total');
    expect(res.body.meta).toHaveProperty('page', 1);
    expect(res.body.meta).toHaveProperty('limit', 10);
  });

  it('GET /api/v1/doctors/specializations should return list of distinct specializations', async () => {
    const res = await request(app)
      .get('/api/v1/doctors/specializations')
      .set('Cookie', viewerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toContain('Cardiology');
  });

  it('PATCH /api/v1/doctors/:id should update doctor details', async () => {
    const res = await request(app)
      .patch(`/api/v1/doctors/${createdDoctorId}`)
      .set('Cookie', adminCookie)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('DELETE /api/v1/doctors/:id should block deletion with 409 HAS_PATIENTS if doctor has patients', async () => {
    // Add 1 patient to doctor
    await DoctorModel.updateOne({ _id: createdDoctorId }, { $set: { patientCount: 2 } });

    const res = await request(app)
      .delete(`/api/v1/doctors/${createdDoctorId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_PATIENTS');
  });

  it('DELETE /api/v1/doctors/:id with ?reassignTo should reassign patients and delete doctor', async () => {
    // Create target replacement doctor
    const targetDoc = await DoctorModel.create({
      name: 'Dr. Target Replacement',
      specialization: 'Cardiology',
      hospital: 'Apollo Hospital',
      phone: '+8801812345678',
      email: 'target.doc@example.com',
      status: 'active',
      patientCount: 0,
    });

    const res = await request(app)
      .delete(`/api/v1/doctors/${createdDoctorId}?reassignTo=${targetDoc._id.toString()}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(204);

    // Verify deleted doctor is gone
    const deleted = await DoctorModel.findById(createdDoctorId);
    expect(deleted).toBeNull();

    // Verify target doctor received patient count
    const updatedTarget = await DoctorModel.findById(targetDoc._id);
    expect(updatedTarget?.patientCount).toBe(2);
  });

  it('POST /api/v1/doctors/import should reject import by viewer with 403', async () => {
    const res = await request(app)
      .post('/api/v1/doctors/import')
      .set('Cookie', viewerCookie)
      .send({
        doctors: [
          {
            name: 'Dr. Bulk One',
            specialization: 'Neurology',
            hospital: 'Square Hospital',
            phone: '01712345678',
            email: 'bulk1@example.com',
          },
        ],
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/v1/doctors/import should batch import valid doctors and report row-level errors', async () => {
    const res = await request(app)
      .post('/api/v1/doctors/import')
      .set('Cookie', adminCookie)
      .send({
        doctors: [
          {
            name: 'Dr. Valid Import',
            specialization: 'Pediatrics',
            hospital: 'United Hospital',
            phone: '01799998888',
            email: 'valid.import@example.com',
          },
          {
            name: 'X', // Invalid name < 2 chars
            specialization: 'Pediatrics',
            hospital: 'United Hospital',
            phone: '01799998888',
            email: 'invalid.name@example.com',
          },
          {
            name: 'Dr. Duplicate Batch',
            specialization: 'Pediatrics',
            hospital: 'United Hospital',
            phone: '01799998888',
            email: 'valid.import@example.com', // Duplicate email within batch
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalRows).toBe(3);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(2);
    expect(res.body.data.errors).toHaveLength(2);

    // Verify imported doctor is in DB
    const saved = await DoctorModel.findOne({ email: 'valid.import@example.com' });
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Dr. Valid Import');
  });
});
