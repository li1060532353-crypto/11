import type { AccessEnvironment } from './lib/auth';

export type KnowledgeBaseEnv = AccessEnvironment & {
  DB: D1Database;
  KB_ASSETS: R2Bucket;
};
