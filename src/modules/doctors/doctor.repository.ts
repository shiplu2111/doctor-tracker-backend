import { DoctorModel } from './doctor.schema';
import { IDoctor, DoctorQueryFilter, DoctorListResult } from './doctor.types';
import { FilterQuery, Types, UpdateQuery } from 'mongoose';

export class DoctorRepository {
  async create(data: Partial<IDoctor>): Promise<IDoctor> {
    const doc = await DoctorModel.create(data);
    return doc.toJSON() as unknown as IDoctor;
  }

  async findById(id: string | Types.ObjectId): Promise<IDoctor | null> {
    const doc = await DoctorModel.findById(id).lean<IDoctor>();
    if (!doc) return null;
    return {
      ...doc,
      id: doc._id.toString(),
    } as unknown as IDoctor;
  }

  async findByEmail(email: string): Promise<IDoctor | null> {
    return DoctorModel.findOne({ email }).lean<IDoctor>();
  }

  async update(id: string | Types.ObjectId, data: UpdateQuery<IDoctor>): Promise<IDoctor | null> {
    const updated = await DoctorModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean<IDoctor>();
    if (!updated) return null;
    return {
      ...updated,
      id: updated._id.toString(),
    } as unknown as IDoctor;
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    const res = await DoctorModel.findByIdAndDelete(id);
    return Boolean(res);
  }

  async findPaginated(filters: DoctorQueryFilter): Promise<DoctorListResult> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const mongoFilter: FilterQuery<IDoctor> = {};

    if (filters.specialization) {
      mongoFilter.specialization = filters.specialization;
    }
    if (filters.hospital) {
      mongoFilter.hospital = filters.hospital;
    }
    if (filters.status) {
      mongoFilter.status = filters.status;
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

    // Prefix regex fallback when q is provided and Meili is not yet used
    if (filters.q) {
      const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      mongoFilter.$or = [
        { name: { $regex: `^${escaped}`, $options: 'i' } },
        { email: { $regex: `^${escaped}`, $options: 'i' } },
        { specialization: { $regex: `^${escaped}`, $options: 'i' } },
        { hospital: { $regex: `^${escaped}`, $options: 'i' } },
      ];
    }

    // Allowed sort fields per docs/API.md
    const allowedSortFields: Record<string, 1 | -1> = {
      'createdAt:desc': -1,
      'createdAt:asc': 1,
      'name:asc': 1,
      'name:desc': -1,
      'patientCount:desc': -1,
      'patientCount:asc': 1,
    };

    const sortOption: Record<string, 1 | -1> = {};
    if (filters.sort && allowedSortFields[filters.sort]) {
      const [field, dir] = filters.sort.split(':');
      sortOption[field] = dir === 'asc' ? 1 : -1;
    } else {
      sortOption.createdAt = -1; // Default sort
    }

    // Projection & parallel find + count per docs/DATABASE.md
    const projection = {
      name: 1,
      specialization: 1,
      hospital: 1,
      phone: 1,
      email: 1,
      status: 1,
      patientCount: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [rawDoctors, total] = await Promise.all([
      DoctorModel.find(mongoFilter, projection)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean<IDoctor[]>(),
      DoctorModel.countDocuments(mongoFilter),
    ]);

    const doctors = rawDoctors.map((doc) => ({
      ...doc,
      id: doc._id.toString(),
    })) as unknown as IDoctor[];

    return {
      doctors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getDistinctSpecializations(): Promise<string[]> {
    const list = await DoctorModel.distinct('specialization');
    return list.sort();
  }

  async adjustPatientCount(doctorId: string | Types.ObjectId, delta: number): Promise<void> {
    await DoctorModel.updateOne({ _id: doctorId }, { $inc: { patientCount: delta } });
  }
}

export const doctorRepository = new DoctorRepository();
