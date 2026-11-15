import { MeiliSearch } from 'meilisearch';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export const meiliClient = new MeiliSearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
  timeout: 800, // 800ms timeout per docs/SEARCH.md
});

export const DOCTORS_INDEX = `${env.MEILI_INDEX_PREFIX}doctors`;
export const PATIENTS_INDEX = `${env.MEILI_INDEX_PREFIX}patients`;

export async function setupMeiliIndexes(): Promise<void> {
  try {
    const isHealthy = await meiliClient.isHealthy();
    if (!isHealthy) {
      logger.warn('Meilisearch instance is not healthy, skipping index setup');
      return;
    }

    // 1. Doctors Index
    const doctorsIndex = meiliClient.index(DOCTORS_INDEX);
    await meiliClient.createIndex(DOCTORS_INDEX, { primaryKey: 'id' }).catch(() => {});
    await doctorsIndex.updateSettings({
      searchableAttributes: ['name', 'specialization', 'hospital', 'email', 'phone'],
      filterableAttributes: ['specialization', 'hospital', 'status', 'createdAtTs'],
      sortableAttributes: ['createdAtTs', 'name', 'patientCount'],
      displayedAttributes: [
        'id',
        'name',
        'specialization',
        'hospital',
        'phone',
        'email',
        'status',
        'patientCount',
        'createdAt',
      ],
    });

    // 2. Patients Index
    const patientsIndex = meiliClient.index(PATIENTS_INDEX);
    await meiliClient.createIndex(PATIENTS_INDEX, { primaryKey: 'id' }).catch(() => {});
    await patientsIndex.updateSettings({
      searchableAttributes: ['name', 'condition', 'phone', 'email', 'doctorName'],
      filterableAttributes: ['condition', 'status', 'doctorId', 'gender', 'createdAtTs'],
      sortableAttributes: ['createdAtTs', 'name', 'age'],
      displayedAttributes: [
        'id',
        'name',
        'age',
        'gender',
        'condition',
        'status',
        'doctorId',
        'doctorName',
        'phone',
        'email',
        'createdAt',
      ],
    });

    logger.info('Meilisearch indexes and settings successfully synchronized');
  } catch (error) {
    logger.warn({ error }, 'Failed to configure Meilisearch indexes');
  }
}
