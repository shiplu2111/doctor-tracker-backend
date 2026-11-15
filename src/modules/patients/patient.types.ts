import { IPatient, PatientStatus, PatientGender } from './patient.schema';

export interface PatientQueryFilter {
  q?: string;
  doctorId?: string;
  status?: PatientStatus;
  gender?: PatientGender;
  condition?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface PatientListResult {
  patients: IPatient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
