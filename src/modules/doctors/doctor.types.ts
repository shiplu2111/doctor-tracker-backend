import { Types } from 'mongoose';

export type DoctorStatus = 'active' | 'inactive';

export interface IDoctor {
  _id: Types.ObjectId;
  id?: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  status: DoctorStatus;
  patientCount: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorQueryFilter {
  q?: string;
  specialization?: string;
  hospital?: string;
  status?: DoctorStatus;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface DoctorListResult {
  doctors: IDoctor[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
