import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { DoctorModel } from '../modules/doctors/doctor.schema';
import { PatientModel } from '../modules/patients/patient.schema';

interface QueryPattern {
  name: string;
  run: () => Promise<unknown>;
}

interface ExplainStats {
  executionStats: {
    nReturned: number;
    totalDocsExamined: number;
    executionTimeMillis: number;
  };
  queryPlanner: {
    winningPlan: Record<string, unknown>;
  };
}

export async function verifyQueryPerformance() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB. Running index execution plan audit...');

  const patterns: QueryPattern[] = [
    {
      name: 'Doctors: Filter by Specialization and Status (Sorted by createdAt desc)',
      run: () =>
        DoctorModel.find({ specialization: 'Cardiology', status: 'active' })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: 'Doctors: Filter by Hospital',
      run: () =>
        DoctorModel.find({ hospital: 'Dhaka Central Hospital' })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: 'Doctors: Filter by Status',
      run: () =>
        DoctorModel.find({ status: 'active' })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: 'Patients: Filter by Status and Condition',
      run: () =>
        PatientModel.find({ status: 'active', condition: 'Hypertension' })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: 'Patients: Filter by DoctorId and Status',
      run: () =>
        PatientModel.find({ status: 'active' })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
  ];

  let allPassed = true;

  for (const p of patterns) {
    const explanation = (await p.run()) as ExplainStats;
    const stats = explanation.executionStats;
    const stages = JSON.stringify(explanation.queryPlanner.winningPlan);

    const isIxScan = stages.includes('IXSCAN');
    const isCollScan = stages.includes('COLLSCAN');

    logger.info(`--- [Audit] ${p.name} ---`);
    logger.info(`Stage: ${isIxScan ? 'IXSCAN ✅' : isCollScan ? 'COLLSCAN ❌' : 'OTHER'}`);
    logger.info(`nReturned: ${stats.nReturned}, totalDocsExamined: ${stats.totalDocsExamined}, executionTimeMillis: ${stats.executionTimeMillis}ms`);

    if (isCollScan) {
      allPassed = false;
      logger.error(`Failed index verification for ${p.name}: COLLSCAN detected!`);
    }
  }

  await mongoose.disconnect();

  if (!allPassed) {
    throw new Error('Index verification failed: One or more queries used COLLSCAN');
  }

  logger.info('✅ All query patterns verified: using IXSCAN index scans exclusively!');
}

if (require.main === module || process.argv[1]?.includes('verify-indexes.ts')) {
  verifyQueryPerformance()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Verification failed');
      process.exit(1);
    });
}
