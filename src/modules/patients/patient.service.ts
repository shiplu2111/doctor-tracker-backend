import { Types } from 'mongoose';
import { patientRepository, PatientRepository } from './patient.repository';
import { doctorRepository, DoctorRepository } from '../doctors/doctor.repository';
import { DoctorModel } from '../doctors/doctor.schema';
import { AppError } from '../../utils/app-error';
import { CreatePatientInput, UpdatePatientInput } from '@doctor-tracker/shared';
import { IPatient } from './patient.schema';
import { PatientListResult, PatientQueryFilter } from './patient.types';
import { searchService } from '../search/search.service';
import { eventBus } from '../../utils/event-bus';

export class PatientService {
  constructor(
    private readonly patientRepo: PatientRepository = patientRepository,
    private readonly doctorRepo: DoctorRepository = doctorRepository,
  ) {}

  async createPatient(
    data: CreatePatientInput & { doctorId: string },
    creatorId?: string,
  ): Promise<IPatient> {
    if (!data.doctorId || !Types.ObjectId.isValid(data.doctorId)) {
      throw new AppError('VALIDATION_ERROR', 400, 'A valid doctorId is required');
    }

    // 1. Verify doctor exists
    const doctor = await this.doctorRepo.findById(data.doctorId);
    if (!doctor) {
      throw new AppError('NOT_FOUND', 404, 'Assigned doctor not found');
    }

    // 2. Enforce active doctor constraint per docs/API.md
    if (doctor.status === 'inactive') {
      throw new AppError(
        'DOCTOR_INACTIVE',
        409,
        'Cannot assign patients to an inactive doctor. Please activate the doctor first.',
      );
    }

    // 3. Create patient
    const patientData: Partial<IPatient> = {
      name: data.name,
      age: data.age,
      gender: data.gender,
      phone: data.phone || undefined,
      email: data.email || undefined,
      condition: data.condition,
      status: data.status || 'active',
      notes: data.notes || '',
      doctorId: new Types.ObjectId(data.doctorId),
      createdBy: creatorId ? new Types.ObjectId(creatorId) : undefined,
    };

    const patient = await this.patientRepo.create(patientData);

    // 4. Atomically increment doctor's patientCount
    await DoctorModel.updateOne(
      { _id: new Types.ObjectId(data.doctorId) },
      { $inc: { patientCount: 1 } },
    );

    const patientId = (patient as { id?: string; _id?: { toString(): string } }).id || patient._id?.toString() || '';
    const createdDoc = (await this.patientRepo.findById(patientId)) || patient;

    // Write-through sync to Meilisearch
    searchService.syncPatient(createdDoc, doctor.name).catch(() => {});

    // Emit domain event for notifications
    eventBus.emitEvent('patient.created', {
      patient: {
        id: patientId,
        name: createdDoc.name,
        condition: createdDoc.condition,
        status: createdDoc.status,
        doctorId: data.doctorId,
      },
      actorId: creatorId,
    });

    if (createdDoc.status === 'critical') {
      eventBus.emitEvent('patient.critical', {
        patient: {
          id: patientId,
          name: createdDoc.name,
          condition: createdDoc.condition,
          doctorId: data.doctorId,
        },
        actorId: creatorId,
      });
    }

    return createdDoc;
  }

  async getPatientById(id: string): Promise<IPatient> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid patient ID format');
    }

    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      throw new AppError('NOT_FOUND', 404, 'Patient record not found');
    }
    return patient;
  }

  async listPatients(filters: PatientQueryFilter): Promise<PatientListResult> {
    return this.patientRepo.findPaginated(filters);
  }

  async updatePatient(id: string, data: UpdatePatientInput): Promise<IPatient> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid patient ID format');
    }

    const existing = await this.patientRepo.findById(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, 'Patient record not found');
    }

    const updatePayload: Partial<IPatient> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.age !== undefined) updatePayload.age = data.age;
    if (data.gender !== undefined) updatePayload.gender = data.gender;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.condition !== undefined) updatePayload.condition = data.condition;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.notes !== undefined) updatePayload.notes = data.notes;

    // Handle doctor reassignment if doctorId changed
    if (data.doctorId && data.doctorId !== existing.doctorId.toString()) {
      if (!Types.ObjectId.isValid(data.doctorId)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid target doctor ID format');
      }

      const targetDoctor = await this.doctorRepo.findById(data.doctorId);
      if (!targetDoctor) {
        throw new AppError('NOT_FOUND', 404, 'Target doctor not found');
      }

      if (targetDoctor.status === 'inactive') {
        throw new AppError(
          'DOCTOR_INACTIVE',
          409,
          'Cannot reassign patient to an inactive doctor.',
        );
      }

      updatePayload.doctorId = new Types.ObjectId(data.doctorId);

      // Decrement old doctor and increment new doctor atomically
      await Promise.all([
        DoctorModel.updateOne(
          { _id: new Types.ObjectId(existing.doctorId) },
          { $inc: { patientCount: -1 } },
        ),
        DoctorModel.updateOne(
          { _id: new Types.ObjectId(data.doctorId) },
          { $inc: { patientCount: 1 } },
        ),
      ]);
    }

    const updated = await this.patientRepo.update(id, updatePayload);
    if (!updated) {
      throw new AppError('NOT_FOUND', 404, 'Patient record not found');
    }

    // Write-through sync to Meilisearch
    searchService.syncPatient(updated).catch(() => {});

    // If status became critical, emit patient.critical event
    if (updated.status === 'critical' && existing.status !== 'critical') {
      eventBus.emitEvent('patient.critical', {
        patient: {
          id: id,
          name: updated.name,
          condition: updated.condition,
          doctorId: (updated.doctorId as { toString(): string })?.toString() || '',
        },
      });
    }

    return updated;
  }

  async deletePatient(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid patient ID format');
    }

    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      throw new AppError('NOT_FOUND', 404, 'Patient record not found');
    }

    await this.patientRepo.delete(id);

    // Atomically decrement doctor's patientCount
    await DoctorModel.updateOne(
      { _id: new Types.ObjectId(patient.doctorId) },
      { $inc: { patientCount: -1 } },
    );

    // Write-through delete from Meilisearch
    searchService.removePatient(id).catch(() => {});
  }

  async getConditions(): Promise<string[]> {
    return this.patientRepo.getDistinctConditions();
  }
}

export const patientService = new PatientService();
