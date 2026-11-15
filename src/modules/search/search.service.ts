import { meiliClient, DOCTORS_INDEX, PATIENTS_INDEX } from './meili.client';
import { DoctorModel } from '../doctors/doctor.schema';
import { IDoctor } from '../doctors/doctor.types';
import { PatientModel, IPatient } from '../patients/patient.schema';
import { logger } from '../../utils/logger';

export interface SearchDoctorHit {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  status: string;
  highlight?: string;
}

export interface SearchPatientHit {
  id: string;
  name: string;
  condition: string;
  status: string;
  doctorId: string;
  doctorName?: string;
  highlight?: string;
}

export interface MultiSearchResult {
  doctors: SearchDoctorHit[];
  patients: SearchPatientHit[];
  searchEngine: 'meilisearch' | 'mongo-fallback';
}

export class SearchService {
  // Sync individual doctor into Meilisearch
  async syncDoctor(doctor: IDoctor): Promise<void> {
    try {
      const doc = {
        id: doctor._id.toString(),
        name: doctor.name,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        phone: doctor.phone,
        email: doctor.email,
        status: doctor.status,
        patientCount: doctor.patientCount || 0,
        createdAt: doctor.createdAt ? new Date(doctor.createdAt).toISOString() : new Date().toISOString(),
        createdAtTs: doctor.createdAt ? Math.floor(new Date(doctor.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
      };

      await meiliClient.index(DOCTORS_INDEX).addDocuments([doc], { primaryKey: 'id' });
    } catch (error) {
      logger.warn({ error, doctorId: doctor._id }, 'Failed to sync doctor to Meilisearch');
    }
  }

  // Remove doctor from Meilisearch
  async removeDoctor(id: string): Promise<void> {
    try {
      await meiliClient.index(DOCTORS_INDEX).deleteDocument(id);
    } catch (error) {
      logger.warn({ error, id }, 'Failed to delete doctor from Meilisearch');
    }
  }

  // Sync individual patient into Meilisearch
  async syncPatient(patient: IPatient, doctorName?: string): Promise<void> {
    try {
      let resolvedDoctorName = doctorName;
      if (!resolvedDoctorName && patient.doctorId) {
        const doc = await DoctorModel.findById(patient.doctorId).select('name').lean();
        resolvedDoctorName = doc?.name;
      }

      const doc = {
        id: patient._id.toString(),
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        condition: patient.condition,
        status: patient.status,
        doctorId: patient.doctorId?.toString(),
        doctorName: resolvedDoctorName || '',
        phone: patient.phone || '',
        email: patient.email || '',
        createdAt: patient.createdAt ? new Date(patient.createdAt).toISOString() : new Date().toISOString(),
        createdAtTs: patient.createdAt ? Math.floor(new Date(patient.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
      };

      await meiliClient.index(PATIENTS_INDEX).addDocuments([doc], { primaryKey: 'id' });
    } catch (error) {
      logger.warn({ error, patientId: patient._id }, 'Failed to sync patient to Meilisearch');
    }
  }

  // Remove patient from Meilisearch
  async removePatient(id: string): Promise<void> {
    try {
      await meiliClient.index(PATIENTS_INDEX).deleteDocument(id);
    } catch (error) {
      logger.warn({ error, id }, 'Failed to delete patient from Meilisearch');
    }
  }

  // Multi-search across doctors and patients with fallback
  async search(
    query: string,
    type: 'all' | 'doctors' | 'patients' = 'all',
    limit = 5,
  ): Promise<MultiSearchResult> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return { doctors: [], patients: [], searchEngine: 'meilisearch' };
    }

    try {
      const searches: Array<Promise<unknown>> = [];

      if (type === 'all' || type === 'doctors') {
        searches.push(
          meiliClient.index(DOCTORS_INDEX).search(trimmed, {
            limit,
            attributesToHighlight: ['name', 'specialization', 'hospital'],
          }),
        );
      } else {
        searches.push(Promise.resolve({ hits: [] }));
      }

      if (type === 'all' || type === 'patients') {
        searches.push(
          meiliClient.index(PATIENTS_INDEX).search(trimmed, {
            limit,
            attributesToHighlight: ['name', 'condition', 'doctorName'],
          }),
        );
      } else {
        searches.push(Promise.resolve({ hits: [] }));
      }

      interface MeiliSearchResult<T> {
        hits: Array<T & { _formatted?: Record<string, string> }>;
      }

      const [doctorResult, patientResult] = (await Promise.all(searches)) as [
        MeiliSearchResult<SearchDoctorHit>,
        MeiliSearchResult<SearchPatientHit>,
      ];

      const doctors: SearchDoctorHit[] = (doctorResult.hits || []).map((hit) => ({
        id: hit.id,
        name: hit.name,
        specialization: hit.specialization,
        hospital: hit.hospital,
        status: hit.status,
        highlight: hit._formatted?.name || hit.name,
      }));

      const patients: SearchPatientHit[] = (patientResult.hits || []).map((hit) => ({
        id: hit.id,
        name: hit.name,
        condition: hit.condition,
        status: hit.status,
        doctorId: hit.doctorId,
        doctorName: hit.doctorName,
        highlight: hit._formatted?.name || hit.name,
      }));

      return {
        doctors,
        patients,
        searchEngine: 'meilisearch',
      };
    } catch (error) {
      logger.warn({ error, query: trimmed }, 'Meilisearch query failed or timed out, using Mongo fallback');
      return this.mongoFallbackSearch(trimmed, type, limit);
    }
  }

  // Graceful fallback to anchored case-insensitive MongoDB regex
  private async mongoFallbackSearch(
    query: string,
    type: 'all' | 'doctors' | 'patients',
    limit: number,
  ): Promise<MultiSearchResult> {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}`, 'i');

    const promises: [Promise<IDoctor[]>, Promise<IPatient[]>] = [
      type === 'all' || type === 'doctors'
        ? DoctorModel.find({ $or: [{ name: regex }, { specialization: regex }] })
            .limit(limit)
            .lean<IDoctor[]>()
        : Promise.resolve([]),
      type === 'all' || type === 'patients'
        ? PatientModel.find({ $or: [{ name: regex }, { condition: regex }] })
            .limit(limit)
            .populate('doctorId', 'name')
            .lean<IPatient[]>()
        : Promise.resolve([]),
    ];

    const [doctorDocs, patientDocs] = await Promise.all(promises);

    const doctors: SearchDoctorHit[] = doctorDocs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      specialization: doc.specialization,
      hospital: doc.hospital,
      status: doc.status,
      highlight: `<mark>${doc.name}</mark>`,
    }));

    const patients: SearchPatientHit[] = patientDocs.map((doc) => {
      const docObj = doc.doctorId as unknown as { name?: string };
      return {
        id: doc._id.toString(),
        name: doc.name,
        condition: doc.condition,
        status: doc.status,
        doctorId: doc.doctorId?.toString(),
        doctorName: docObj?.name,
        highlight: `<mark>${doc.name}</mark>`,
      };
    });

    return {
      doctors,
      patients,
      searchEngine: 'mongo-fallback',
    };
  }
}

export const searchService = new SearchService();
