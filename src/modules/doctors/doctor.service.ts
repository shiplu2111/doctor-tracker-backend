import { doctorRepository } from './doctor.repository';
import { IDoctor, DoctorQueryFilter, DoctorListResult } from './doctor.types';
import {
  CreateDoctorInput,
  UpdateDoctorInput,
  DoctorImportRow,
  DoctorImportSummary,
  createDoctorSchema,
} from '@doctor-tracker/shared';
import { AppError } from '../../utils/app-error';
import { DoctorModel } from './doctor.schema';
import { PatientModel } from '../patients/patient.schema';
import { searchService } from '../search/search.service';
import { eventBus } from '../../utils/event-bus';

export class DoctorService {
  async createDoctor(input: CreateDoctorInput, userId?: string): Promise<IDoctor> {
    const existing = await doctorRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('DUPLICATE_EMAIL', 409, 'A doctor with this email address already exists');
    }

    const created = await doctorRepository.create({
      ...input,
      patientCount: 0,
      createdBy: userId as unknown as undefined,
    });

    // Write-through sync to Meilisearch
    searchService.syncDoctor(created).catch(() => {});

    // Emit domain event for notifications
    eventBus.emitEvent('doctor.created', {
      doctor: {
        id: created.id || created._id.toString(),
        name: created.name,
        specialization: created.specialization,
        hospital: created.hospital,
      },
      actorId: userId,
    });

    return created;
  }

  async getDoctorById(id: string): Promise<IDoctor> {
    const doctor = await doctorRepository.findById(id);
    if (!doctor) {
      throw new AppError('NOT_FOUND', 404, 'Doctor not found');
    }
    return doctor;
  }

  async updateDoctor(id: string, input: UpdateDoctorInput): Promise<IDoctor> {
    const existing = await doctorRepository.findById(id);
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, 'Doctor not found');
    }

    if (input.email && input.email !== existing.email) {
      const emailConflict = await doctorRepository.findByEmail(input.email);
      if (emailConflict && emailConflict._id.toString() !== id) {
        throw new AppError('DUPLICATE_EMAIL', 409, 'A doctor with this email address already exists');
      }
    }

    const updated = await doctorRepository.update(id, input);
    if (!updated) {
      throw new AppError('NOT_FOUND', 404, 'Doctor not found');
    }

    // Write-through sync to Meilisearch
    searchService.syncDoctor(updated).catch(() => {});

    return updated;
  }

  async deleteDoctor(id: string, reassignTo?: string, actorId?: string): Promise<void> {
    const doctor = await doctorRepository.findById(id);
    if (!doctor) {
      throw new AppError('NOT_FOUND', 404, 'Doctor not found');
    }

    if (doctor.patientCount > 0) {
      if (!reassignTo) {
        throw new AppError(
          'HAS_PATIENTS',
          409,
          'Cannot delete doctor with assigned patients without reassigning them.',
        );
      }

      if (reassignTo === id) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot reassign patients to the doctor being deleted');
      }

      const targetDoctor = await doctorRepository.findById(reassignTo);
      if (!targetDoctor) {
        throw new AppError('NOT_FOUND', 404, 'Target doctor for reassignment was not found');
      }
      if (targetDoctor.status === 'inactive') {
        throw new AppError('DOCTOR_INACTIVE', 409, 'Cannot reassign patients to an inactive doctor');
      }

      // Reassign patients to target doctor
      await PatientModel.updateMany({ doctorId: id }, { $set: { doctorId: reassignTo } });
      await doctorRepository.adjustPatientCount(reassignTo, doctor.patientCount);
    }

    await doctorRepository.delete(id);

    // Write-through removal from Meilisearch
    searchService.removeDoctor(id).catch(() => {});

    // Emit domain event for notifications
    eventBus.emitEvent('doctor.deleted', {
      doctorId: doctor.id || doctor._id.toString(),
      doctorName: doctor.name,
      actorId,
    });
  }

  async listDoctors(filter: DoctorQueryFilter): Promise<DoctorListResult> {
    return doctorRepository.findPaginated(filter);
  }

  async getSpecializations(): Promise<string[]> {
    return doctorRepository.getDistinctSpecializations();
  }

  async bulkImport(rows: DoctorImportRow[], userId?: string): Promise<DoctorImportSummary> {
    const totalRows = rows.length;
    const errors: Array<{ row: number; email?: string; message: string }> = [];
    const validRowsToInsert: Array<DoctorImportRow & { createdBy?: unknown; patientCount: number }> = [];

    // Pre-check for duplicate emails in this batch
    const seenEmailsInBatch = new Set<string>();
    const cleanedRows = rows.map((row, idx) => {
      const email = row.email ? row.email.trim().toLowerCase() : '';
      return { ...row, email, originalIndex: idx + 1 };
    });

    const emailsToCheck = cleanedRows.map((r) => r.email).filter(Boolean);
    const existingDoctors = await DoctorModel.find(
      { email: { $in: emailsToCheck } },
      { email: 1 },
    ).lean();
    const existingEmailSet = new Set(existingDoctors.map((d) => d.email.toLowerCase()));

    for (const row of cleanedRows) {
      // 1. Zod validation
      const parseResult = createDoctorSchema.safeParse(row);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
        errors.push({
          row: row.originalIndex,
          email: row.email,
          message: errorMsg,
        });
        continue;
      }

      // 2. Duplicate in batch check
      if (seenEmailsInBatch.has(row.email)) {
        errors.push({
          row: row.originalIndex,
          email: row.email,
          message: 'Duplicate email within the import file',
        });
        continue;
      }
      seenEmailsInBatch.add(row.email);

      // 3. Duplicate in database check
      if (existingEmailSet.has(row.email)) {
        errors.push({
          row: row.originalIndex,
          email: row.email,
          message: 'A doctor with this email address already exists',
        });
        continue;
      }

      validRowsToInsert.push({
        ...parseResult.data,
        status: parseResult.data.status || 'active',
        patientCount: 0,
        createdBy: userId as unknown as undefined,
      });
    }

    let importedCount = 0;
    if (validRowsToInsert.length > 0) {
      try {
        const inserted = await DoctorModel.insertMany(validRowsToInsert, {
          ordered: false,
        });
        importedCount = inserted.length;

        // Write-through sync inserted to Meilisearch
        for (const doc of inserted) {
          searchService.syncDoctor(doc as unknown as IDoctor).catch(() => {});
        }

        // Emit bulk notification or doctor.created event for imported doctors
        if (inserted.length > 0) {
          eventBus.emitEvent('doctor.created', {
            doctor: {
              id: inserted[0]._id.toString(),
              name: `${inserted.length} doctors (bulk imported)`,
              specialization: 'Multiple',
              hospital: 'Multiple',
            },
            actorId: userId,
          });
        }
      } catch (insertError: unknown) {
        // With ordered: false, mongoose throws if any fail, but insertedDocs contains the ones that succeeded
        const err = insertError as { insertedDocs?: unknown[]; writeErrors?: Array<{ err?: { errmsg?: string } }> };
        if (err.insertedDocs) {
          importedCount = err.insertedDocs.length;
          for (const doc of err.insertedDocs) {
            searchService.syncDoctor(doc as unknown as IDoctor).catch(() => {});
          }
        }
        if (err.writeErrors) {
          err.writeErrors.forEach((we) => {
            errors.push({
              row: 0,
              message: we.err?.errmsg || 'Failed to insert row',
            });
          });
        }
      }
    }

    return {
      totalRows,
      imported: importedCount,
      skipped: totalRows - importedCount,
      errors,
    };
  }
}

export const doctorService = new DoctorService();
