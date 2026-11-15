import { MeiliSearch } from 'meilisearch';
import { env } from './env';
import { logger } from '../utils/logger';

export const meiliClient = new MeiliSearch({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
  timeout: 800, // 800ms fallback timeout as defined in docs/SEARCH.md
});

export const checkMeiliHealth = async (): Promise<boolean> => {
  try {
    const health = await meiliClient.isHealthy();
    return health;
  } catch (error) {
    logger.warn({ error }, 'Meilisearch health check failed');
    return false;
  }
};
