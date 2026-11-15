import { PatientModel, IPatient } from './patient.schema';
import { PatientQueryFilter, PatientListResult } from './patient.types';
import { FilterQuery, Types, UpdateQuery } from 'mongoose';

export class PatientRepository {
  async create(data: Partial<IPatient>): Promise<IPatient> {
    const doc = await PatientModel.create(data);
    return doc.toJSON() as unknown as IPatient;
  }

  async findById(id: string | Types.ObjectId): Promise<IPatient | null> {
    const doc = await PatientModel.findById(id)
      .populate('doctorId', 'name specialization hospital')
      .lean();
    if (!doc) return null;

    const doctorObj = doc.doctorId as unknown as { _id?: Types.ObjectId; name?: string; specialization?: string; hospital?: string };

    return {
      ...doc,
      id: doc._id.toString(),
      doctorId: doctorObj?._id ? doctorObj._id.toString() : doc.doctorId?.toString(),
      doctor: doctorObj?._id
        ? {
            id: doctorObj._id.toString(),
            name: doctorObj.name || '',
            specialization: doctorObj.specialization || '',
            hospital: doctorObj.hospital || '',
          }
        : undefined,
    } as unknown as IPatient;
  }

  async update(id: string | Types.ObjectId, data: UpdateQuery<IPatient>): Promise<IPatient | null> {
    const updated = await PatientModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    })
      .populate('doctorId', 'name specialization hospital')
      .lean();
    if (!updated) return null;

    const doctorObj = updated.doctorId as unknown as { _id?: Types.ObjectId; name?: string; specialization?: string; hospital?: string };

    return {
      ...updated,
      id: updated._id.toString(),
      doctorId: doctorObj?._id ? doctorObj._id.toString() : updated.doctorId?.toString(),
      doctor: doctorObj?._id
        ? {
            id: doctorObj._id.toString(),
            name: doctorObj.name || '',
            specialization: doctorObj.specialization || '',
            hospital: doctorObj.hospital || '',
          }
        : undefined,
    } as unknown as IPatient;
  }

  async delete(id: string | Types.ObjectId): Promise<IPatient | null> {
    const doc = await PatientModel.findByIdAndDelete(id).lean();
    if (!doc) return null;
    return {
      ...doc,
      id: doc._id.toString(),
    } as unknown as IPatient;
  }

  async findPaginated(filters: PatientQueryFilter): Promise<PatientListResult> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const mongoFilter: FilterQuery<IPatient> = {};

    if (filters.doctorId) {
      mongoFilter.doctorId = new Types.ObjectId(filters.doctorId);
    }
    if (filters.status) {
      mongoFilter.status = filters.status;
    }
    if (filters.condition) {
      mongoFilter.condition = filters.condition;
    }
    if (filters.gender) {
      mongoFilter.gender = filters.gender;
    }
    if (filters.from || filters.to) {
      mongoFilter.createdAt = {};
      if (filters.from) {
        mongoFilter.createdAt.$gte = filters.from;
      }
      if (filters.to) {
        mongoFilter.createdAt.$lte = filters.to;
      }
    }

    if (filters.q && filters.q.trim()) {
      const sanitized = filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      mongoFilter.name = { $regex: `^${sanitized}`, $options: 'i' };
    }

    // Determine sort
    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (filters.sort) {
      const isDesc = filters.sort.startsWith('-');
      const field = isDesc ? filters.sort.substring(1) : filters.sort;
      if (['createdAt', 'name', 'age'].includes(field)) {
        sortOptions = { [field]: isDesc ? -1 : 1 };
      }
    }

    // Parallel count and find
    const [rawDocs, total] = await Promise.all([
      PatientModel.find(mongoFilter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate('doctorId', 'name specialization hospital')
        .lean(),
      PatientModel.countDocuments(mongoFilter),
    ]);

    const patients = rawDocs.map((doc) => {
      const doctorObj = doc.doctorId as unknown as { _id?: Types.ObjectId; name?: string; specialization?: string; hospital?: string };
      return {
        ...doc,
        id: doc._id.toString(),
        doctorId: doctorObj?._id ? doctorObj._id.toString() : doc.doctorId?.toString(),
        doctor: doctorObj?._id
          ? {
              id: doctorObj._id.toString(),
              name: doctorObj.name || '',
              specialization: doctorObj.specialization || '',
              hospital: doctorObj.hospital || '',
            }
          : undefined,
      } as unknown as IPatient;
    });

    return {
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getDistinctConditions(): Promise<string[]> {
    return PatientModel.distinct('condition');
  }

  async countByDoctorId(doctorId: string | Types.ObjectId): Promise<number> {
    return PatientModel.countDocuments({ doctorId });
  }
}

export const patientRepository = new PatientRepository();
