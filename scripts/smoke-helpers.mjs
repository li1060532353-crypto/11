import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

function delay(ms, signal) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timeout = setTimeout(finish, ms);

    if (signal?.aborted) finish();
    else signal?.addEventListener('abort', finish, { once: true });
  });
}

function checkPort({ host, port, name }) {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.unref();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`${name} port ${port} is already in use at ${host}`));
        return;
      }

      reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

export async function assertPortsAvailable(ports) {
  await Promise.all(ports.map(checkPort));
}

function describeExit(code, signal) {
  if (code !== null) return `code ${code}`;
  if (signal !== null) return `signal ${signal}`;
  return 'unknown status';
}

function watchChildren(children, name) {
  const listeners = [];

  const failure = new Promise((_, reject) => {
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) {
        reject(
          new Error(
            `${name} process exited before readiness (${describeExit(child.exitCode, child.signalCode)})`,
          ),
        );
        return;
      }

      const onError = (error) => {
        reject(new Error(`${name} process failed to start: ${error.message}`, { cause: error }));
      };
      const onExit = (code, signal) => {
        reject(
          new Error(`${name} process exited before readiness (${describeExit(code, signal)})`),
        );
      };

      child.once('error', onError);
      child.once('exit', onExit);
      listeners.push({ child, onError, onExit });
    }
  });

  return {
    failure,
    dispose() {
      for (const { child, onError, onExit } of listeners) {
        child.off('error', onError);
        child.off('exit', onExit);
      }
    },
  };
}

export async function waitForReadiness({
  name,
  url,
  validate,
  children,
  timeoutMs = 20_000,
  retryMs = 250,
}) {
  const controller = new AbortController();
  const childWatcher = watchChildren(children, name);
  const deadline = Date.now() + timeoutMs;

  const poll = async () => {
    while (Date.now() < deadline && !controller.signal.aborted) {
      try {
        const remainingMs = Math.max(1, deadline - Date.now());
        const response = await fetch(url, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(Math.min(1_000, remainingMs)),
          ]),
        });
        if (response.ok && (await validate(response))) return;
      } catch {
        // Connection refusal and incomplete startup responses are retried until the deadline.
      }

      await delay(Math.min(retryMs, Math.max(0, deadline - Date.now())), controller.signal);
    }

    if (!controller.signal.aborted) throw new Error(`Timed out waiting for ${name} at ${url}`);
  };

  try {
    await Promise.race([poll(), childWatcher.failure]);
  } finally {
    controller.abort();
    childWatcher.dispose();
  }
}

export function findBuiltJavaScriptAsset(html) {
  const scripts = html.match(/<script\b[^>]*>/giu) ?? [];

  for (const script of scripts) {
    const isModule = /\btype=["']module["']/iu.test(script);
    const isCrossOrigin = /\bcrossorigin(?:\s|=|>)/iu.test(script);
    const source = script.match(/\bsrc=["']([^"']+)["']/iu)?.[1];

    if (
      isModule &&
      isCrossOrigin &&
      source &&
      /^\/assets\/[a-z0-9_.-]+\.js(?:\?[^#]*)?$/iu.test(source)
    ) {
      return source;
    }
  }

  throw new Error('Web response does not contain the generated Vite build marker');
}

export function hasPersonalBlogRoot(html) {
  return /<div\b(?=[^>]*\bid=["']root["'])(?=[^>]*\bdata-app=["']personal-blog["'])[^>]*>/iu.test(
    html,
  );
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      child.off('exit', finish);
      resolve();
    };
    const timeout = setTimeout(finish, timeoutMs);

    child.once('exit', finish);
  });
}

function signalProcessTree(child, signal) {
  if (!child.pid) return;

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function waitForProcessGroupExit(child, timeoutMs) {
  if (!child.pid) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-child.pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') return;
      throw error;
    }

    await delay(25);
  }

  throw new Error(`Process group ${child.pid} did not exit after SIGKILL`);
}

async function forceKillWindowsTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
    stdio: 'ignore',
  });
  await waitForExit(taskkill, 5_000);
}

export function createProcessTreeCleanup(
  children,
  { gracefulTimeoutMs = 5_000, forceTimeoutMs = 5_000 } = {},
) {
  let cleanupPromise;

  return function cleanup() {
    cleanupPromise ??= (async () => {
      if (process.platform === 'win32') {
        await Promise.all(children.map(forceKillWindowsTree));
        await Promise.all(children.map((child) => waitForExit(child, forceTimeoutMs)));
        return;
      }

      for (const child of children) signalProcessTree(child, 'SIGTERM');
      await Promise.all(children.map((child) => waitForExit(child, gracefulTimeoutMs)));

      // Always probe the whole process group: the pnpm wrapper may have exited while a
      // grandchild ignored SIGTERM.
      for (const child of children) signalProcessTree(child, 'SIGKILL');
      await Promise.all(children.map((child) => waitForExit(child, forceTimeoutMs)));
      await Promise.all(children.map((child) => waitForProcessGroupExit(child, forceTimeoutMs)));
    })();

    return cleanupPromise;
  };
}
