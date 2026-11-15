import mongoose, { Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { DoctorModel } from '../modules/doctors/doctor.schema';
import { PatientModel, type PatientStatus, type PatientGender } from '../modules/patients/patient.schema';
import { UserModel } from '../modules/users/user.schema';
import { hashPassword } from '../utils/password.util';
import { ROLES } from '@doctor-tracker/shared';

// Configuration & weights from docs/SEED_DATA.md
const SPECIALIZATION_WEIGHTS: Record<string, number> = {
  Cardiology: 12,
  'General Medicine': 14,
  Pediatrics: 10,
  Orthopedics: 8,
  Neurology: 7,
  Dermatology: 8,
  Gynecology: 9,
  ENT: 6,
  Psychiatry: 6,
  Oncology: 5,
  Ophthalmology: 5,
  Urology: 4,
  Endocrinology: 6,
};

const HOSPITALS = [
  'Dhaka Central Hospital',
  'Lakeview Medical Center',
  'Green Crescent Hospital',
  'Sunrise Clinic',
  'Metro Care Hospital',
  'Riverside General',
  'City Health Institute',
  'Evergreen Medical',
  'Harmony Hospital',
  'Unity Specialized Hospital',
];

const CONDITION_WEIGHTS: Record<string, number> = {
  Hypertension: 14,
  Diabetes: 14,
  Asthma: 8,
  'Fever/Flu': 12,
  'Back Pain': 8,
  Migraine: 6,
  Arthritis: 6,
  Anxiety: 6,
  'Skin Allergy': 7,
  'Heart Disease': 5,
  'Thyroid Disorder': 5,
  Fracture: 4,
  Cancer: 3,
  'Kidney Stone': 2,
};

const STATUS_WEIGHTS: Record<string, number> = {
  active: 55,
  recovered: 25,
  discharged: 12,
  critical: 8,
};

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let rand = faker.number.float({ min: 0, max: total });
  for (const [item, weight] of entries) {
    if (rand < weight) return item;
    rand -= weight;
  }
  return entries[0][0];
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let reset = false;
  let force = false;
  let seed = 42;
  let doctorsCount = 50;
  let patientsCount = 2000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reset') reset = true;
    if (args[i] === '--force') force = true;
    if (args[i] === '--seed' && args[i + 1]) seed = parseInt(args[++i], 10);
    if (args[i] === '--doctors' && args[i + 1]) doctorsCount = parseInt(args[++i], 10);
    if (args[i] === '--patients' && args[i + 1]) patientsCount = parseInt(args[++i], 10);
  }

  return { reset, force, seed, doctorsCount, patientsCount };
}

function generateBangladeshiPhone(): string {
  const prefixes = ['017', '018', '019', '016', '015', '013'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const rest = faker.string.numeric(8);
  return `+88${prefix}${rest}`;
}

export async function seedDemoData() {
  const { reset, force, seed, doctorsCount, patientsCount } = parseCliArgs();

  if (env.NODE_ENV === 'production' && !force) {
    throw new Error('Refusing to seed demo data in production without --force');
  }

  faker.seed(seed);
  logger.info(`Seeding demo data with seed=${seed}, doctors=${doctorsCount}, patients=${patientsCount}, reset=${reset}...`);

  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB');

  // Check existing data if not reset
  if (!reset) {
    const existingDoctors = await DoctorModel.countDocuments();
    if (existingDoctors > 0) {
      logger.info(`Database already contains ${existingDoctors} doctors. Skipping seed. (Use --reset to wipe and reseed)`);
      await mongoose.disconnect();
      return;
    }
  } else {
    logger.info('Reset flag provided: wiping doctors and patients...');
    await Promise.all([DoctorModel.deleteMany({}), PatientModel.deleteMany({})]);
    logger.info('Wiped existing doctors and patients.');
  }

  // 1. Ensure Viewer User exists
  const viewerEmail = 'viewer@example.com';
  const existingViewer = await UserModel.findOne({ email: viewerEmail });
  if (!existingViewer) {
    const defaultPassword = env.SEED_ADMIN_PASSWORD || 'Admin123!';
    const passwordHash = await hashPassword(defaultPassword);
    await UserModel.create({
      name: 'Demo Viewer',
      email: viewerEmail,
      passwordHash,
      role: ROLES.VIEWER,
      isActive: true,
    });
    logger.info(`Created demo viewer user: ${viewerEmail}`);
  }

  // 2. Prepare Doctors
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * ONE_DAY_MS;

  interface GeneratedDoctor {
    _id: Types.ObjectId;
    name: string;
    specialization: string;
    hospital: string;
    phone: string;
    email: string;
    status: 'active' | 'inactive';
    patientCount: number;
    createdAt: Date;
    updatedAt: Date;
  }

  const doctorsToInsert: GeneratedDoctor[] = [];

  // Special Edge Case Doctors (from SEED_DATA.md §5)
  // 1. Dr. Ayesha Rahman
  const docAyeshaId = new Types.ObjectId();
  const ayeshaCreatedAt = new Date(now.getTime() - 150 * ONE_DAY_MS);
  doctorsToInsert.push({
    _id: docAyeshaId,
    name: 'Dr. Ayesha Rahman',
    specialization: 'Cardiology',
    hospital: 'Dhaka Central Hospital',
    phone: generateBangladeshiPhone(),
    email: 'ayesha.rahman@doctortracker.test',
    status: 'active',
    patientCount: 0,
    createdAt: ayeshaCreatedAt,
    updatedAt: ayeshaCreatedAt,
  });

  // 2. Dr. Aisha Rahman (typo tolerance testing)
  const docAishaId = new Types.ObjectId();
  const aishaCreatedAt = new Date(now.getTime() - 140 * ONE_DAY_MS);
  doctorsToInsert.push({
    _id: docAishaId,
    name: 'Dr. Aisha Rahman',
    specialization: 'Pediatrics',
    hospital: 'Lakeview Medical Center',
    phone: generateBangladeshiPhone(),
    email: 'aisha.rahman@doctortracker.test',
    status: 'active',
    patientCount: 0,
    createdAt: aishaCreatedAt,
    updatedAt: aishaCreatedAt,
  });

  // 3. Duplicate Hospital & Specialization pair doctor 1
  const docPair1Id = new Types.ObjectId();
  const pair1CreatedAt = new Date(now.getTime() - 120 * ONE_DAY_MS);
  doctorsToInsert.push({
    _id: docPair1Id,
    name: 'Dr. Rafiqul Islam',
    specialization: 'General Medicine',
    hospital: 'Green Crescent Hospital',
    phone: generateBangladeshiPhone(),
    email: 'rafiqul.islam@doctortracker.test',
    status: 'active',
    patientCount: 0,
    createdAt: pair1CreatedAt,
    updatedAt: pair1CreatedAt,
  });

  // 4. Duplicate Hospital & Specialization pair doctor 2
  const docPair2Id = new Types.ObjectId();
  const pair2CreatedAt = new Date(now.getTime() - 110 * ONE_DAY_MS);
  doctorsToInsert.push({
    _id: docPair2Id,
    name: 'Dr. Mahmudul Hasan',
    specialization: 'General Medicine',
    hospital: 'Green Crescent Hospital',
    phone: generateBangladeshiPhone(),
    email: 'mahmudul.hasan@doctortracker.test',
    status: 'active',
    patientCount: 0,
    createdAt: pair2CreatedAt,
    updatedAt: pair2CreatedAt,
  });

  // 5. Inactive doctor with patients (for reassign testing)
  const docInactiveWithPatientsId = new Types.ObjectId();
  const inactiveCreatedAt = new Date(now.getTime() - 160 * ONE_DAY_MS);
  doctorsToInsert.push({
    _id: docInactiveWithPatientsId,
    name: 'Dr. Shamsur Rahman',
    specialization: 'Neurology',
    hospital: 'Metro Care Hospital',
    phone: generateBangladeshiPhone(),
    email: 'shamsur.rahman@doctortracker.test',
    status: 'inactive',
    patientCount: 0,
    createdAt: inactiveCreatedAt,
    updatedAt: inactiveCreatedAt,
  });

  // 6. 4 other inactive doctors (to reach ≈ 5 inactive total)
  for (let i = 0; i < 4; i++) {
    const docId = new Types.ObjectId();
    const dCreatedAt = new Date(now.getTime() - faker.number.int({ min: 30, max: 170 }) * ONE_DAY_MS);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    doctorsToInsert.push({
      _id: docId,
      name: `Dr. ${firstName} ${lastName}`,
      specialization: pickWeighted(SPECIALIZATION_WEIGHTS),
      hospital: faker.helpers.arrayElement(HOSPITALS),
      phone: generateBangladeshiPhone(),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@doctortracker.test`,
      status: 'inactive',
      patientCount: 0,
      createdAt: dCreatedAt,
      updatedAt: dCreatedAt,
    });
  }

  // 7. Remaining active doctors
  const remainingCount = doctorsCount - doctorsToInsert.length;
  for (let i = 0; i < remainingCount; i++) {
    const docId = new Types.ObjectId();
    const daysAgo = faker.number.int({ min: 10, max: 180 });
    const dCreatedAt = new Date(now.getTime() - daysAgo * ONE_DAY_MS);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    doctorsToInsert.push({
      _id: docId,
      name: `Dr. ${firstName} ${lastName}`,
      specialization: pickWeighted(SPECIALIZATION_WEIGHTS),
      hospital: faker.helpers.arrayElement(HOSPITALS),
      phone: generateBangladeshiPhone(),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 10}@doctortracker.test`,
      status: 'active',
      patientCount: 0,
      createdAt: dCreatedAt,
      updatedAt: dCreatedAt,
    });
  }

  logger.info(`Inserting ${doctorsToInsert.length} doctors...`);
  await DoctorModel.insertMany(doctorsToInsert, { ordered: false });
  logger.info('Doctors inserted.');

  // 3. Prepare Patients
  // Distribution targets:
  // - Doctor 0 (e.g. last doctor): 0 patients (empty state)
  // - Doctor 1 (e.g. Dr. Ayesha Rahman): 150+ patients (pagination stress)
  // - Inactive Doctor with patients: ~15 patients
  // - Remaining patients distributed with Pareto distribution across remaining doctors
  const doctorWithZero = doctorsToInsert[doctorsToInsert.length - 1];
  const doctorWith150Plus = doctorsToInsert[0]; // Dr. Ayesha Rahman
  const inactiveDoc = doctorsToInsert[4]; // Dr. Shamsur Rahman

  // Build weight array for doctor selection for general patients
  const eligibleDoctors = doctorsToInsert.filter(
    (d) => d._id !== doctorWithZero._id && d._id !== inactiveDoc._id
  );

  // Generate doctor patient quotas
  // 1 doctor with ~160
  // inactive doctor with 15
  // remaining ~1825 spread across eligibleDoctors using skewed exponential weights
  const patientQuotas = new Map<string, number>();
  patientQuotas.set(doctorWithZero._id.toString(), 0);
  patientQuotas.set(doctorWith150Plus._id.toString(), 160);
  patientQuotas.set(inactiveDoc._id.toString(), 15);

  const remainingPatients = patientsCount - 160 - 15;
  const weights = eligibleDoctors.map((_, idx) => Math.pow(0.92, idx));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  eligibleDoctors.forEach((doc, idx) => {
    if (doc._id === doctorWith150Plus._id) return;
    const share = Math.round((weights[idx] / totalWeight) * remainingPatients);
    patientQuotas.set(doc._id.toString(), share);
  });

  // Adjust any rounding discrepancy to first doctor
  let assignedSum = 0;
  patientQuotas.forEach((q) => (assignedSum += q));
  const diff = patientsCount - assignedSum;
  patientQuotas.set(
    doctorWith150Plus._id.toString(),
    (patientQuotas.get(doctorWith150Plus._id.toString()) || 160) + diff
  );

  // Map doctors by ID for fast lookup of createdAt
  const doctorMap = new Map(doctorsToInsert.map((d) => [d._id.toString(), d]));

  interface GeneratedPatient {
    name: string;
    age: number;
    gender: PatientGender;
    condition: string;
    status: PatientStatus;
    doctorId: Types.ObjectId;
    phone?: string;
    email?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  const patientsToInsert: GeneratedPatient[] = [];

  // Edge cases: 3 critical patients today (at 09:00, 11:30, 14:15)
  const todayMorning = new Date();
  todayMorning.setHours(9, 0, 0, 0);
  const todayNoon = new Date();
  todayNoon.setHours(11, 30, 0, 0);
  const todayAfternoon = new Date();
  todayAfternoon.setHours(14, 15, 0, 0);

  const criticalTimes = [todayMorning, todayNoon, todayAfternoon];
  criticalTimes.forEach((time, idx) => {
    const assignedDoc = doctorsToInsert[idx % 3];
    patientsToInsert.push({
      name: `${faker.person.firstName()} ${faker.person.lastName()}`,
      age: faker.number.int({ min: 45, max: 80 }),
      gender: faker.helpers.arrayElement(['male', 'female'] as PatientGender[]),
      condition: 'Heart Disease',
      status: 'critical' as PatientStatus,
      doctorId: assignedDoc._id,
      phone: generateBangladeshiPhone(),
      email: `patient.crit.${idx}@patients.test`,
      notes: 'URGENT: Admitted to ICU for observation.',
      createdAt: time,
      updatedAt: time,
    });
  });

  // Generate the rest of the patients
  patientQuotas.forEach((quota, docIdStr) => {
    const doc = doctorMap.get(docIdStr)!;
    // Account for critical patients already assigned
    const alreadyAssigned = patientsToInsert.filter((p) => p.doctorId.toString() === docIdStr).length;
    const countToGenerate = quota - alreadyAssigned;

    for (let i = 0; i < countToGenerate; i++) {
      // Ensure patient createdAt >= doctor createdAt
      const docCreatedTime = doc.createdAt.getTime();
      const minTime = Math.max(docCreatedTime, now.getTime() - ONE_HUNDRED_EIGHTY_DAYS_MS);
      
      // Biased towards recent 30 days (at least 200 overall in last 30d)
      let patientDate: Date;
      const isRecent = faker.number.float({ min: 0, max: 1 }) < 0.35; // 35% in last 30 days
      if (isRecent) {
        const recentDaysAgo = faker.number.int({ min: 0, max: 29 });
        patientDate = new Date(now.getTime() - recentDaysAgo * ONE_DAY_MS);
        if (patientDate.getTime() < docCreatedTime) {
          patientDate = new Date(docCreatedTime + faker.number.int({ min: 1, max: 1000000 }));
        }
      } else {
        const randTime = faker.number.int({ min: minTime, max: now.getTime() });
        patientDate = new Date(randTime);
      }

      // Gender distribution: male 48%, female 48%, other 4%
      const genderRand = faker.number.int({ min: 1, max: 100 });
      const gender: PatientGender =
        genderRand <= 48 ? 'male' : genderRand <= 96 ? 'female' : 'other';

      // Age distribution centered around 38
      const age = Math.min(90, Math.max(1, Math.round(faker.number.float({ min: 18, max: 58 }) + faker.number.float({ min: -17, max: 32 }))));

      // Contact details
      const hasPhone = faker.number.float({ min: 0, max: 1 }) < 0.8;
      const hasEmail = faker.number.float({ min: 0, max: 1 }) < 0.3;
      const hasNotes = faker.number.float({ min: 0, max: 1 }) < 0.2;

      const pFirstName = faker.person.firstName();
      const pLastName = faker.person.lastName();

      patientsToInsert.push({
        name: `${pFirstName} ${pLastName}`,
        age,
        gender,
        condition: pickWeighted(CONDITION_WEIGHTS),
        status: pickWeighted(STATUS_WEIGHTS) as PatientStatus,
        doctorId: doc._id,
        phone: hasPhone ? generateBangladeshiPhone() : undefined,
        email: hasEmail
          ? `${pFirstName.toLowerCase()}.${pLastName.toLowerCase()}.${faker.string.alphanumeric(4)}@patients.test`
          : undefined,
        notes: hasNotes
          ? faker.helpers.arrayElement([
              'Follow-up in 2 weeks',
              'Report review required',
              'Prescribed physical therapy',
              'Routine checkup completed',
              'Blood panel requested',
            ])
          : undefined,
        createdAt: patientDate,
        updatedAt: patientDate,
      });
    }
  });

  logger.info(`Inserting ${patientsToInsert.length} patients in batches of 500...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < patientsToInsert.length; i += BATCH_SIZE) {
    const batch = patientsToInsert.slice(i, i + BATCH_SIZE);
    await PatientModel.insertMany(batch, { ordered: false });
    logger.info(`Inserted patients ${i + batch.length}/${patientsToInsert.length}`);
  }

  // 4. Recalculate doctor.patientCount with aggregation & bulkWrite
  logger.info('Calculating exact patient counts per doctor and updating doctor records...');
  const counts = await PatientModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $group: {
        _id: '$doctorId',
        count: { $sum: 1 },
      },
    },
  ]);

  const bulkOps = counts.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { patientCount: item.count } },
    },
  }));

  if (bulkOps.length > 0) {
    await DoctorModel.bulkWrite(bulkOps);
  }

  // Set 0 for doctors with no patients
  await DoctorModel.updateMany(
    { _id: { $nin: counts.map((c) => c._id) } },
    { $set: { patientCount: 0 } }
  );

  // 5. Verification checks
  const totalDoctors = await DoctorModel.countDocuments();
  const totalPatients = await PatientModel.countDocuments();
  const sumPatientCounts = await DoctorModel.aggregate<{ total: number }>([
    { $group: { _id: null, total: { $sum: '$patientCount' } } },
  ]);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * ONE_DAY_MS);
  const patientsLast30d = await PatientModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

  logger.info('================ SEED VERIFICATION ================');
  logger.info(`Total Doctors: ${totalDoctors}`);
  logger.info(`Total Patients: ${totalPatients}`);
  logger.info(`Sum of Doctor.patientCount: ${sumPatientCounts[0]?.total || 0}`);
  logger.info(`Patients in last 30 days: ${patientsLast30d}`);
  logger.info('====================================================');

  await mongoose.disconnect();
  logger.info('Demo data seeding finished successfully!');
}

if (require.main === module || process.argv[1]?.includes('seed-demo.ts')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Failed to seed demo data');
      process.exit(1);
    });
}
