import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import test from 'node:test';

import {
  assertPortsAvailable,
  createProcessTreeCleanup,
  findBuiltJavaScriptAsset,
  hasPersonalBlogRoot,
  waitForReadiness,
} from './smoke-helpers.mjs';

const host = '127.0.0.1';
const smokeScriptUrl = new URL('./smoke.mjs', import.meta.url);

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('assertPortsAvailable rejects an occupied port', async () => {
  const server = createServer();
  const port = await listen(server);

  try {
    await assert.rejects(
      assertPortsAvailable([{ host, port, name: 'test service' }]),
      new RegExp(`test service port ${port} is already in use`),
    );
  } finally {
    await close(server);
  }
});

test('waitForReadiness rejects when a watched child exits early', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(17)']);

  await assert.rejects(
    waitForReadiness({
      name: 'test service',
      url: 'http://127.0.0.1:1/unreachable',
      validate: async () => true,
      children: [child],
      timeoutMs: 2_000,
      retryMs: 10,
    }),
    /test service process exited before readiness \(code 17\)/,
  );
});

test('findBuiltJavaScriptAsset requires Vite build output and returns its asset', () => {
  const html = `<!doctype html><div id="root"></div>
    <script type="module" crossorigin src="/assets/index-Ab12_cd3.js"></script>`;

  assert.equal(findBuiltJavaScriptAsset(html), '/assets/index-Ab12_cd3.js');
  assert.throws(
    () => findBuiltJavaScriptAsset('<script type="module" src="/src/main.tsx"></script>'),
    /generated Vite build marker/,
  );
});

test('hasPersonalBlogRoot requires the personal-blog application marker', () => {
  assert.equal(hasPersonalBlogRoot('<div id="root" data-app="personal-blog"></div>'), true);
  assert.equal(hasPersonalBlogRoot('<div id="root"></div>'), false);
  assert.equal(hasPersonalBlogRoot('<div id="root" data-app="another-app"></div>'), false);
});

test('production smoke checks API health and conditionally checks content posts', async () => {
  const smokeScript = await readFile(smokeScriptUrl, 'utf8');

  assert.match(smokeScript, /http:\/\/127\.0\.0\.1:3100\/api\/v1\/health/);
  assert.match(smokeScript, /http:\/\/127\.0\.0\.1:3100\/api\/v1\/content\/posts/);
  assert.match(smokeScript, /process\.env\.DATABASE_URL/);
  assert.match(smokeScript, /skipping DB-backed content API smoke check/);
});

test('process-tree cleanup is idempotent and releases a grandchild port', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX process-group behavior is covered on supported deployment platforms');
    return;
  }

  const reservation = createServer();
  const port = await listen(reservation);
  await close(reservation);

  const grandchildScript = `
    const { createServer } = require('node:net');
    const server = createServer();
    process.on('SIGTERM', () => {});
    server.listen(${port}, '${host}');
  `;
  const parentScript = `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(grandchildScript)}], { stdio: 'ignore' });
    setInterval(() => {}, 1_000);
  `;
  const parent = spawn(process.execPath, ['-e', parentScript], {
    detached: true,
    stdio: 'ignore',
  });
  const cleanup = createProcessTreeCleanup([parent], {
    gracefulTimeoutMs: 100,
    forceTimeoutMs: 1_000,
  });

  try {
    const deadline = Date.now() + 2_000;
    let occupied = false;
    while (!occupied && Date.now() < deadline) {
      try {
        await assertPortsAvailable([{ host, port, name: 'grandchild' }]);
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch {
        occupied = true;
      }
    }
    assert.equal(occupied, true, 'grandchild never occupied its port');

    const firstCleanup = cleanup();
    const secondCleanup = cleanup();
    assert.equal(secondCleanup, firstCleanup);
    await firstCleanup;

    await assertPortsAvailable([{ host, port, name: 'grandchild' }]);
  } finally {
    await cleanup();
  }
});
