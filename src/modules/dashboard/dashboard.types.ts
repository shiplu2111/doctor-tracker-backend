export interface DashboardSummary {
  totalDoctors: number;
  totalPatients: number;
  newPatientsThisMonth: number;
  newDoctorsThisMonth: number;
  avgPatientsPerDoctor: number;
}

export interface PatientPerDoctorStat {
  doctorId: string;
  name: string;
  specialization: string;
  hospital: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface ConditionStat {
  condition: string;
  count: number;
  percentage?: number;
}

export interface SpecializationStat {
  specialization: string;
  count: number;
}
