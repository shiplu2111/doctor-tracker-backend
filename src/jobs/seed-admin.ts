import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { userRepository } from '../modules/users/user.repository';
import { hashPassword } from '../utils/password.util';
import { logger } from '../utils/logger';
import { ROLES } from '@doctor-tracker/shared';

export const seedAdmin = async (): Promise<void> => {
  await connectDB();

  try {
    const existingAdmin = await userRepository.findByEmail(env.SEED_ADMIN_EMAIL);
    if (existingAdmin) {
      logger.info(`Admin user with email "${env.SEED_ADMIN_EMAIL}" already exists. Skipping.`);
      return;
    }

    const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
    const admin = await userRepository.create({
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      role: ROLES.SUPER_ADMIN,
    });

    logger.info(`✅ Admin created successfully: ${admin.email} (Role: ${admin.role})`);
  } catch (error) {
    logger.error({ error }, 'Failed to seed admin user');
    throw error;
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
