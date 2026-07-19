import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWranglerConfig } from './verify-cloudflare-config.mjs';

const config = {
  name: '11', pages_build_output_dir: './apps/web/dist', compatibility_date: '2026-07-18', compatibility_flags: ['nodejs_compat'],
  d1_databases: [{ binding: 'DB', database_name: 'personal-blog-db', database_id: '05e121a3-b61c-4da0-b09b-338ad28b7a2d', migrations_dir: './migrations' }],
  r2_buckets: [{ binding: 'KB_ASSETS', bucket_name: 'personal-blog-assets' }],
  vars: { CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', CF_ACCESS_AUD: 'aud', LOCAL_AUTH_BYPASS: 'false' },
  env: { preview: { d1_databases: [{ binding: 'DB', database_name: 'personal-blog-db-preview', database_id: '3ed8b013-75d8-4a7e-b278-c065e6b360c5', migrations_dir: './migrations' }], r2_buckets: [{ binding: 'KB_ASSETS', bucket_name: 'personal-blog-assets-preview' }], vars: { CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', CF_ACCESS_AUD: 'aud', LOCAL_AUTH_BYPASS: 'false' } } },
};
const source = (value = config) => JSON.stringify(value);

test('accepts an isolated Pages production and Preview configuration', () => assert.doesNotThrow(() => validateWranglerConfig(source())));
test('accepts comments and trailing commas accepted by JSONC', () => assert.doesNotThrow(() => validateWranglerConfig(`// Pages config\n${source().replace(/}$/, ',}')}`)));
test('rejects malformed JSONC', () => assert.throws(() => validateWranglerConfig('{"name": }'), /valid JSONC/));
test('rejects an unterminated JSONC block comment', () => assert.throws(() => validateWranglerConfig(`${source()} /* incomplete`), /valid JSONC/));
test('rejects identical production and Preview D1 IDs', () => { const value = structuredClone(config); value.env.preview.d1_databases[0].database_id = value.d1_databases[0].database_id; assert.throws(() => validateWranglerConfig(source(value)), /different D1/); });
test('rejects identical production and Preview R2 names', () => { const value = structuredClone(config); value.env.preview.r2_buckets[0].bucket_name = value.r2_buckets[0].bucket_name; assert.throws(() => validateWranglerConfig(source(value)), /different R2/); });
test('rejects a missing Preview binding', () => { const value = structuredClone(config); value.env.preview.d1_databases = []; assert.throws(() => validateWranglerConfig(source(value)), /Preview.*DB/); });
test('rejects a placeholder Preview D1 ID', () => { const value = structuredClone(config); value.env.preview.d1_databases[0].database_id = 'REPLACE_WITH_D1_DATABASE_ID'; assert.throws(() => validateWranglerConfig(source(value)), /placeholder/); });
test('rejects enabled local bypass', () => { const value = structuredClone(config); value.vars.LOCAL_AUTH_BYPASS = 'true'; assert.throws(() => validateWranglerConfig(source(value)), /LOCAL_AUTH_BYPASS/); });
test('rejects missing required Preview Access variable', () => { const value = structuredClone(config); delete value.env.preview.vars.CF_ACCESS_AUD; assert.throws(() => validateWranglerConfig(source(value)), /CF_ACCESS_AUD/); });
test('rejects an ambiguous non-Pages deployment target', () => { const value = structuredClone(config); delete value.env.preview; assert.throws(() => validateWranglerConfig(source(value)), /deployment target/); });
test('rejects unexpected resource mappings and secret fields', () => { const value = structuredClone(config); value.env.preview.r2_buckets[0].bucket_name = 'other'; assert.throws(() => validateWranglerConfig(source(value)), /Preview R2/); value.env.preview.r2_buckets[0].bucket_name = 'personal-blog-assets-preview'; value.apiToken = 'secret'; assert.throws(() => validateWranglerConfig(source(value)), /prohibited secret/); });
