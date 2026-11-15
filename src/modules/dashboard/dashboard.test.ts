import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { UserModel } from '../users/user.schema';
import { DoctorModel } from '../doctors/doctor.schema';
import { PatientModel } from '../patients/patient.schema';
import { hashPassword } from '../../utils/password.util';
import { ROLES } from '@doctor-tracker/shared';
import { dashboardService } from './dashboard.service';

describe('Dashboard Module Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let adminCookie: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Seed admin
    const passwordHash = await hashPassword('AdminPass-1234');
    await UserModel.create({
      name: 'Super Admin',
      email: 'admin.dashboard.test@example.com',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.dashboard.test@example.com', password: 'AdminPass-1234' });
    adminCookie = loginRes.headers['set-cookie'][0];

    // 2. Seed test doctors
    const doc1 = await DoctorModel.create({
      name: 'Dr. Sarah Khan',
      specialization: 'Cardiology',
      hospital: 'Square Hospital',
      phone: '+8801711111111',
      email: 'sarah.khan@example.com',
      status: 'active',
      patientCount: 2,
    });

    const doc2 = await DoctorModel.create({
      name: 'Dr. Ali Ahmed',
      specialization: 'Neurology',
      hospital: 'Apollo Hospital',
      phone: '+8801722222222',
      email: 'ali.ahmed@example.com',
      status: 'active',
      patientCount: 1,
    });

    // 3. Seed test patients
    await PatientModel.create([
      {
        name: 'Patient One',
        age: 45,
        gender: 'male',
        condition: 'Hypertension',
        status: 'active',
        doctorId: doc1._id,
      },
      {
        name: 'Patient Two',
        age: 60,
        gender: 'female',
        condition: 'Hypertension',
        status: 'critical',
        doctorId: doc1._id,
      },
      {
        name: 'Patient Three',
        age: 32,
        gender: 'other',
        condition: 'Migraine',
        status: 'recovered',
        doctorId: doc2._id,
      },
    ]);
  });

  afterAll(async () => {
    dashboardService.clearCache();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/dashboard/summary should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/v1/dashboard/summary should return aggregated KPIs', async () => {
    dashboardService.clearCache();
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.totalDoctors).toBe(2);
    expect(res.body.data.totalPatients).toBe(3);
    expect(res.body.data.newPatientsThisMonth).toBe(3);
    expect(res.body.data.newDoctorsThisMonth).toBe(2);
    expect(res.body.data.avgPatientsPerDoctor).toBe(1.5);
  });

  it('GET /api/v1/dashboard/patients-per-doctor should return top doctors by patient count', async () => {
    dashboardService.clearCache();
    const res = await request(app)
      .get('/api/v1/dashboard/patients-per-doctor?limit=5')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].name).toBe('Dr. Sarah Khan');
    expect(res.body.data[0].count).toBe(2);
  });

  it('GET /api/v1/dashboard/timeseries should return zero-filled points', async () => {
    dashboardService.clearCache();
    const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const to = new Date().toISOString().substring(0, 10);

    const res = await request(app)
      .get(`/api/v1/dashboard/timeseries?metric=patients&interval=day&from=${from}&to=${to}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    // Should have 7 points for a 7-day range
    expect(res.body.data.length).toBeGreaterThanOrEqual(7);
  });

  it('GET /api/v1/dashboard/conditions should return condition breakdown with percentages', async () => {
    dashboardService.clearCache();
    const res = await request(app)
      .get('/api/v1/dashboard/conditions')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].condition).toBe('Hypertension');
    expect(res.body.data[0].count).toBe(2);
    expect(res.body.data[0].percentage).toBe(66.7);
  });

  it('GET /api/v1/dashboard/specializations should return specialization distribution', async () => {
    dashboardService.clearCache();
    const res = await request(app)
      .get('/api/v1/dashboard/specializations')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(2);
  });
});
