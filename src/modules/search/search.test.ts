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

describe('Search Module Integration Tests', () => {
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
      email: 'admin.search.test@example.com',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.search.test@example.com', password: 'AdminPass-1234' });
    adminCookie = loginRes.headers['set-cookie'][0];

    // 2. Seed test doctor
    const doc = await DoctorModel.create({
      name: 'Dr. Ayesha Rahman',
      specialization: 'Cardiology',
      hospital: 'Square Hospital',
      phone: '+8801711122233',
      email: 'ayesha.rahman@example.com',
      status: 'active',
      patientCount: 1,
    });

    // 3. Seed test patient
    await PatientModel.create({
      name: 'Ayesha Akhter',
      age: 28,
      gender: 'female',
      condition: 'Arrhythmia',
      status: 'active',
      doctorId: doc._id,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/search should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/search?q=ayesha');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/v1/search?q=ayesha should return multi-search results with engine metadata', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=ayesha')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.doctors).toBeInstanceOf(Array);
    expect(res.body.data.patients).toBeInstanceOf(Array);
    expect(res.body.meta.searchEngine).toMatch(/meilisearch|mongo-fallback/);
  });

  it('GET /api/v1/search with empty query should return empty results', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toEqual([]);
    expect(res.body.data.patients).toEqual([]);
  });

  it('GET /api/v1/search?type=doctors should only search doctors', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=ayesha&type=doctors')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.doctors).toBeDefined();
    expect(res.body.data.patients).toHaveLength(0);
  });
});
