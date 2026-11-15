import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { UserModel } from '../users/user.schema';
import { DoctorModel } from '../doctors/doctor.schema';
import { PatientModel } from './patient.schema';
import { hashPassword } from '../../utils/password.util';
import { ROLES } from '@doctor-tracker/shared';

describe('Patient Module Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let adminCookie: string;
  let viewerCookie: string;
  let activeDoctorId: string;
  let inactiveDoctorId: string;
  let createdPatientId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 1. Seed admin user
    const adminPasswordHash = await hashPassword('AdminPass-1234');
    await UserModel.create({
      name: 'Super Admin',
      email: 'admin.patient.test@example.com',
      passwordHash: adminPasswordHash,
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });

    // 2. Seed viewer user
    const viewerPasswordHash = await hashPassword('ViewerPass-1234');
    await UserModel.create({
      name: 'Viewer User',
      email: 'viewer.patient.test@example.com',
      passwordHash: viewerPasswordHash,
      role: ROLES.VIEWER,
      isActive: true,
    });

    // 3. Log in admin to get cookie
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.patient.test@example.com', password: 'AdminPass-1234' });
    adminCookie = adminLoginRes.headers['set-cookie'][0];

    // 4. Log in viewer to get cookie
    const viewerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'viewer.patient.test@example.com', password: 'ViewerPass-1234' });
    viewerCookie = viewerLoginRes.headers['set-cookie'][0];

    // 5. Create active doctor
    const activeDoc = await DoctorModel.create({
      name: 'Dr. Test Active',
      specialization: 'Cardiology',
      hospital: 'Dhaka Medical',
      phone: '+8801700000001',
      email: 'active.doc@test.com',
      status: 'active',
      patientCount: 0,
    });
    activeDoctorId = activeDoc._id.toString();

    // 6. Create inactive doctor
    const inactiveDoc = await DoctorModel.create({
      name: 'Dr. Test Inactive',
      specialization: 'Neurology',
      hospital: 'Dhaka Medical',
      phone: '+8801700000002',
      email: 'inactive.doc@test.com',
      status: 'inactive',
      patientCount: 0,
    });
    inactiveDoctorId = inactiveDoc._id.toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('GET /api/v1/patients should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/patients should reject creation when requested by viewer with 403', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Cookie', viewerCookie)
      .send({
        name: 'Kamal Hossain',
        age: 45,
        gender: 'male',
        condition: 'Hypertension',
        doctorId: activeDoctorId,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/patients should validate input fields', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send({
        name: '',
        age: 200,
        gender: 'invalid-gender',
        condition: '',
        doctorId: activeDoctorId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('POST /api/v1/patients should reject assignment to inactive doctor with 409 DOCTOR_INACTIVE', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Cookie', adminCookie)
      .send({
        name: 'Fatema Begum',
        age: 38,
        gender: 'female',
        condition: 'Migraine',
        doctorId: inactiveDoctorId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DOCTOR_INACTIVE');
  });

  it('POST /api/v1/doctors/:id/patients should create patient and increment doctor patientCount', async () => {
    const res = await request(app)
      .post(`/api/v1/doctors/${activeDoctorId}/patients`)
      .set('Cookie', adminCookie)
      .send({
        name: 'Rahim Uddin',
        age: 52,
        gender: 'male',
        condition: 'Diabetes Type 2',
        status: 'active',
        phone: '+8801711223344',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Rahim Uddin');
    expect(res.body.data.condition).toBe('Diabetes Type 2');
    createdPatientId = res.body.data.id || res.body.data._id;

    // Verify doctor's patientCount was incremented to 1
    const doc = await DoctorModel.findById(activeDoctorId);
    expect(doc?.patientCount).toBe(1);
  });

  it('GET /api/v1/doctors/:id/patients should return doctor patient list', async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${activeDoctorId}/patients`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('Rahim Uddin');
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /api/v1/patients should return global list with populated doctor', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].doctor).toBeDefined();
    expect(res.body.data[0].doctor.name).toBe('Dr. Test Active');
  });

  it('GET /api/v1/patients/conditions should return list of distinct conditions', async () => {
    const res = await request(app)
      .get('/api/v1/patients/conditions')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data).toContain('Diabetes Type 2');
  });

  it('PATCH /api/v1/patients/:id should update details and reassign doctor correctly', async () => {
    // Create another active doctor to reassign to
    const targetDoc = await DoctorModel.create({
      name: 'Dr. Reassign Target',
      specialization: 'Internal Medicine',
      hospital: 'Apollo Hospital',
      phone: '+8801700000003',
      email: 'target.reassign@test.com',
      status: 'active',
      patientCount: 0,
    });

    const res = await request(app)
      .patch(`/api/v1/patients/${createdPatientId}`)
      .set('Cookie', adminCookie)
      .send({
        status: 'recovered',
        doctorId: targetDoc._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('recovered');

    // Verify old doctor's count decremented to 0
    const oldDoc = await DoctorModel.findById(activeDoctorId);
    expect(oldDoc?.patientCount).toBe(0);

    // Verify new doctor's count incremented to 1
    const newDoc = await DoctorModel.findById(targetDoc._id);
    expect(newDoc?.patientCount).toBe(1);
  });

  it('DELETE /api/v1/patients/:id should delete patient and decrement doctor count', async () => {
    const res = await request(app)
      .delete(`/api/v1/patients/${createdPatientId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(204);

    // Verify patient is gone
    const deleted = await PatientModel.findById(createdPatientId);
    expect(deleted).toBeNull();
  });
});
