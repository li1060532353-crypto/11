import type { AccessEnvironment } from './lib/auth';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export type KnowledgeBaseEnv = AccessEnvironment & {
  OWNER_LOGIN_CONFIG?: string;
  DB: D1Database;
  KB_ASSETS: R2Bucket;
};
