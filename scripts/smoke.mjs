import { spawn } from 'node:child_process';

import {
  assertPortsAvailable,
  createProcessTreeCleanup,
  findBuiltJavaScriptAsset,
  hasPersonalBlogRoot,
  waitForReadiness,
} from './smoke-helpers.mjs';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [];
const services = [
  { host: '127.0.0.1', port: 3100, name: 'API' },
  { host: '127.0.0.1', port: 4173, name: 'web preview' },
];
const cleanup = createProcessTreeCleanup(children);
let receivedSignal;
let resolveSignal;
const signalReceived = new Promise((resolve) => {
  resolveSignal = resolve;
});

function start(args, env = {}) {
  const child = spawn(pnpm, args, {
    detached: true,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  children.push(child);
  return child;
}

function handleSignal(signal) {
  if (receivedSignal) return;
  receivedSignal = signal;
  resolveSignal(signal);
}

const handleSigint = () => handleSignal('SIGINT');
const handleSigterm = () => handleSignal('SIGTERM');

process.once('SIGINT', handleSigint);
process.once('SIGTERM', handleSigterm);

try {
  await assertPortsAvailable(services);
  if (receivedSignal) throw new Error(`Interrupted by ${receivedSignal}`);

  start(['--filter', '@namdw/api', 'start'], { API_HOST: '127.0.0.1', API_PORT: '3100' });
  start([
    '--filter',
    '@namdw/web',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ]);

  const readinessChecks = [
    waitForReadiness({
      name: 'API',
      url: 'http://127.0.0.1:3100/api/v1/health',
      children,
      validate: async (response) => {
        const body = await response.json();
        return body.data?.status === 'ok';
      },
    }),
    waitForReadiness({
      name: 'web preview',
      url: 'http://127.0.0.1:4173',
      children,
      validate: async (response) => {
        const html = await response.text();
        if (!hasPersonalBlogRoot(html)) return false;

        const assetPath = findBuiltJavaScriptAsset(html);
        const assetResponse = await fetch(new URL(assetPath, response.url));
        const contentType = assetResponse.headers.get('content-type') ?? '';
        return (
          assetResponse.ok &&
          contentType.includes('javascript') &&
          (await assetResponse.text()).length > 0
        );
      },
    }),
  ];

  if (process.env.DATABASE_URL) {
    readinessChecks.push(
      waitForReadiness({
        name: 'API content posts',
        url: 'http://127.0.0.1:3100/api/v1/content/posts',
        children,
        validate: async (response) => {
          const body = await response.json();
          return Array.isArray(body.data?.items);
        },
      }),
    );
  } else {
    console.log('DATABASE_URL is not set; skipping DB-backed content API smoke check.');
  }

  const readiness = Promise.all(readinessChecks);

  const outcome = await Promise.race([
    readiness.then(() => 'ready'),
    signalReceived.then(() => 'interrupted'),
  ]);

  if (outcome === 'interrupted') {
    await cleanup();
    await readiness.catch(() => {});
  } else {
    console.log('Production smoke check passed.');
  }
} catch (error) {
  if (!receivedSignal) {
    console.error(`Production smoke check failed: ${error.message}`);
    process.exitCode = 1;
  }
} finally {
  await cleanup();
  process.removeListener('SIGINT', handleSigint);
  process.removeListener('SIGTERM', handleSigterm);

  if (receivedSignal) process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
}
