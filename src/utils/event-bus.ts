import { EventEmitter } from 'events';

export interface DoctorCreatedPayload {
  doctor: {
    id: string;
    name: string;
    specialization: string;
    hospital: string;
  };
  actorId?: string;
}

export interface DoctorDeletedPayload {
  doctorId: string;
  doctorName: string;
  actorId?: string;
}

export interface PatientCreatedPayload {
  patient: {
    id: string;
    name: string;
    condition: string;
    status: string;
    doctorId: string;
  };
  actorId?: string;
}

export interface PatientCriticalPayload {
  patient: {
    id: string;
    name: string;
    condition: string;
    doctorId: string;
  };
  actorId?: string;
}

export interface DomainEvents {
  'doctor.created': DoctorCreatedPayload;
  'doctor.deleted': DoctorDeletedPayload;
  'patient.created': PatientCreatedPayload;
  'patient.critical': PatientCriticalPayload;
}

class AppEventBus extends EventEmitter {
  emitEvent<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): boolean {
    return this.emit(event, payload);
  }

  onEvent<K extends keyof DomainEvents>(event: K, listener: (payload: DomainEvents[K]) => void): this {
    return this.on(event, listener);
  }
}

export const eventBus = new AppEventBus();
