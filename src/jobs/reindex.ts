import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { DoctorModel } from '../modules/doctors/doctor.schema';
import { PatientModel } from '../modules/patients/patient.schema';
import { meiliClient, DOCTORS_INDEX, PATIENTS_INDEX, setupMeiliIndexes } from '../modules/search/meili.client';

async function reindex() {
  logger.info('Starting full search index re-sync...');

  // 1. Connect to MongoDB
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB');

  // 2. Configure Meilisearch settings
  await setupMeiliIndexes();

  // 3. Re-index Doctors in batches of 1000
  logger.info('Indexing doctors...');
  const doctorsCursor = DoctorModel.find().lean().cursor({ batchSize: 1000 });
  let docBatch: Array<Record<string, unknown>> = [];
  let totalDocsIndexed = 0;

  for await (const doc of doctorsCursor) {
    docBatch.push({
      id: doc._id.toString(),
      name: doc.name,
      specialization: doc.specialization,
      hospital: doc.hospital,
      phone: doc.phone,
      email: doc.email,
      status: doc.status,
      patientCount: doc.patientCount || 0,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      createdAtTs: doc.createdAt ? Math.floor(new Date(doc.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    });

    if (docBatch.length >= 1000) {
      await meiliClient.index(DOCTORS_INDEX).addDocuments(docBatch, { primaryKey: 'id' });
      totalDocsIndexed += docBatch.length;
      logger.info(`Indexed ${totalDocsIndexed} doctors...`);
      docBatch = [];
    }
  }

  if (docBatch.length > 0) {
    await meiliClient.index(DOCTORS_INDEX).addDocuments(docBatch, { primaryKey: 'id' });
    totalDocsIndexed += docBatch.length;
    docBatch = [];
  }
  logger.info(`Doctors reindexing completed. Total: ${totalDocsIndexed}`);

  // 4. Re-index Patients in batches of 1000
  logger.info('Indexing patients...');
  const patientsCursor = PatientModel.find()
    .populate('doctorId', 'name')
    .lean()
    .cursor({ batchSize: 1000 });

  let patientBatch: Array<Record<string, unknown>> = [];
  let totalPatientsIndexed = 0;

  for await (const p of patientsCursor) {
    const docObj = p.doctorId as unknown as { name?: string };
    patientBatch.push({
      id: p._id.toString(),
      name: p.name,
      age: p.age,
      gender: p.gender,
      condition: p.condition,
      status: p.status,
      doctorId: p.doctorId?.toString(),
      doctorName: docObj?.name || '',
      phone: p.phone || '',
      email: p.email || '',
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      createdAtTs: p.createdAt ? Math.floor(new Date(p.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
    });

    if (patientBatch.length >= 1000) {
      await meiliClient.index(PATIENTS_INDEX).addDocuments(patientBatch, { primaryKey: 'id' });
      totalPatientsIndexed += patientBatch.length;
      logger.info(`Indexed ${totalPatientsIndexed} patients...`);
      patientBatch = [];
    }
  }

  if (patientBatch.length > 0) {
    await meiliClient.index(PATIENTS_INDEX).addDocuments(patientBatch, { primaryKey: 'id' });
    totalPatientsIndexed += patientBatch.length;
    patientBatch = [];
  }
  logger.info(`Patients reindexing completed. Total: ${totalPatientsIndexed}`);

  await mongoose.disconnect();
  logger.info('Search re-indexing finished successfully.');
}

if (require.main === module || process.argv[1]?.includes('reindex.ts')) {
  reindex()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Search reindexing job failed');
      process.exit(1);
    });
}
