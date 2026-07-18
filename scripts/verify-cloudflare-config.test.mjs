import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWranglerConfig } from './verify-cloudflare-config.mjs';

test('accepts a concrete private D1 and R2 configuration', () => {
  assert.doesNotThrow(() => validateWranglerConfig(JSON.stringify({
    d1_databases: [{ binding: 'DB' }],
    r2_buckets: [{ binding: 'ASSETS' }],
  })));
});

test('rejects a deployment placeholder', () => {
  assert.throws(() => validateWranglerConfig('{"name":"REPLACE_WITH_PROJECT"}'), /placeholders/);
});
